import { createHmac } from "node:crypto";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

function hashTrackingToken(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is not configured correctly");
  }
  return createHmac("sha256", secret)
    .update(`tracking-session:${token}`)
    .digest("hex");
}

function getAppUrl(): string {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is not configured");
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  ) {
    throw new Error("APP_URL must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("APP_URL must not contain credentials");
  }
  return url.origin;
}

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "الدفع الإلكتروني غير مُعدّ على الخادم." },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "بيانات الطلب غير صالحة." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "بيانات الطلب غير صالحة." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const trackingNumber =
      typeof data.trackingNumber === "string"
        ? data.trackingNumber.trim().toUpperCase()
        : "";
    const trackingToken =
      typeof data.trackingToken === "string" ? data.trackingToken.trim() : "";

    if (!trackingNumber || !/^[a-f0-9]{64}$/i.test(trackingToken)) {
      return NextResponse.json(
        { error: "رقم التتبع أو رمز الجلسة غير صالح." },
        { status: 400 }
      );
    }

    const tokenHash = hashTrackingToken(trackingToken);
    const serviceId = await redis.get(`track:session:${tokenHash}`);
    if (!serviceId) {
      return NextResponse.json(
        { error: "انتهت جلسة التتبع. تحقق من الطلب مجددًا." },
        { status: 401 }
      );
    }

    const service = await prisma.service.findFirst({
      where: { id: serviceId, trackingNumber },
      select: {
        id: true,
        trackingNumber: true,
        quoteAmount: true,
        quoteStatus: true,
        isPaid: true,
      },
    });

    if (!service) {
      return NextResponse.json(
        { error: "تعذر العثور على طلب الصيانة." },
        { status: 404 }
      );
    }
    if (service.quoteStatus !== "approved" || service.quoteAmount === null) {
      return NextResponse.json(
        { error: "يجب الموافقة على عرض السعر أولًا." },
        { status: 400 }
      );
    }
    if (service.isPaid) {
      return NextResponse.json(
        { error: "تم دفع طلب الصيانة بالفعل." },
        { status: 409 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { serviceId: service.id },
      include: { payments: { select: { amount: true } } },
    });

    if (!order) {
      return NextResponse.json(
        { error: "لم تُنشأ فاتورة لهذا الطلب بعد." },
        { status: 404 }
      );
    }
    if (order.isPaid) {
      return NextResponse.json(
        { error: "تم دفع الفاتورة بالفعل." },
        { status: 409 }
      );
    }
    if (order.totalAmount === null || order.totalAmount !== service.quoteAmount) {
      return NextResponse.json(
        { error: "مبلغ الفاتورة لا يطابق عرض السعر." },
        { status: 409 }
      );
    }

    const totalAmount = order.totalAmount;
    if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "مبلغ الفاتورة غير صالح للدفع الإلكتروني." },
        { status: 400 }
      );
    }

    const alreadyPaid = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );
    const remainingAmount = totalAmount - alreadyPaid;
    if (!Number.isSafeInteger(remainingAmount) || remainingAmount <= 0) {
      return NextResponse.json(
        { error: "لا يوجد مبلغ متبقٍ للدفع الإلكتروني." },
        { status: 409 }
      );
    }

    const amountHalalas = remainingAmount * 100;
    if (!Number.isSafeInteger(amountHalalas)) {
      return NextResponse.json(
        { error: "مبلغ الدفع يتجاوز الحد المسموح." },
        { status: 400 }
      );
    }

    const appUrl = getAppUrl();
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        serviceId: service.id,
        invoiceNumber: order.invoiceNumber ?? "",
      },
      payment_intent_data: {
        metadata: { orderId: order.id, serviceId: service.id },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "sar",
            unit_amount: amountHalalas,
            product_data: {
              name: `فاتورة صيانة ${order.invoiceNumber ?? order.id}`,
            },
          },
        },
      ],
      success_url: `${appUrl}/track?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/track?payment=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "تعذر إنشاء رابط الدفع." },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "تعذر بدء الدفع حاليًا. تحقق من إعدادات الخادم وحاول مجددًا." },
      { status: 500 }
    );
  }
}
