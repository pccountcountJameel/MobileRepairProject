
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

function hashTrackingToken(token: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }

  return createHmac("sha256", secret)
    .update(`tracking-session:${token}`)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: "الدفع الإلكتروني غير مُهيأ على الخادم." },
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

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "بيانات الطلب غير صالحة." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const trackingNumber =
      typeof input.trackingNumber === "string"
        ? input.trackingNumber.trim().toUpperCase()
        : "";

    const trackingToken =
      typeof input.trackingToken === "string"
        ? input.trackingToken.trim()
        : "";

    const orderId =
      typeof input.orderId === "string"
        ? input.orderId.trim()
        : "";

    if (
      !trackingNumber ||
      trackingNumber.length > 100 ||
      !/^[a-f0-9]{64}$/i.test(trackingToken) ||
      !orderId ||
      orderId.length > 100
    ) {
      return NextResponse.json(
        { error: "بيانات التتبع أو الفاتورة غير صالحة." },
        { status: 400 }
      );
    }

    if (!redis.isOpen) {
      await redis.connect();
    }

    const tokenHash = hashTrackingToken(trackingToken);
    const sessionServiceId = await redis.get(
      `track:session:${tokenHash}`
    );

    if (!sessionServiceId) {
      return NextResponse.json(
        { error: "انتهت جلسة التتبع. تحقق من الطلب مجددًا." },
        { status: 401 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        isPaid: true,
        serviceId: true,
        service: {
          select: {
            id: true,
            trackingNumber: true,
            quoteAmount: true,
            quoteStatus: true,
            isPaid: true,
          },
        },
        payments: {
          select: {
            amount: true,
          },
        },
      },
    });

    if (
      !order ||
      order.serviceId !== sessionServiceId ||
      order.service.id !== sessionServiceId ||
      order.service.trackingNumber !== trackingNumber
    ) {
      return NextResponse.json(
        { error: "الفاتورة غير مرتبطة بطلب التتبع هذا." },
        { status: 404 }
      );
    }

    if (
      order.service.quoteStatus !== "approved" ||
      order.service.quoteAmount === null ||
      order.totalAmount === null ||
      order.totalAmount !== order.service.quoteAmount
    ) {
      return NextResponse.json(
        { error: "الفاتورة لا تطابق عرض السعر المعتمد." },
        { status: 409 }
      );
    }

    if (order.totalAmount <= 0) {
      return NextResponse.json(
        { error: "لا يمكن إنشاء جلسة دفع لفاتورة قيمتها صفر." },
        { status: 409 }
      );
    }

    const totalPaid = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    if (
      !Number.isSafeInteger(totalPaid) ||
      totalPaid < 0 ||
      totalPaid > order.totalAmount
    ) {
      return NextResponse.json(
        { error: "تعذر التحقق من مجموع الدفعات المسجلة." },
        { status: 409 }
      );
    }

    const remainingAmount = order.totalAmount - totalPaid;

    if (
      order.isPaid ||
      order.service.isPaid ||
      remainingAmount === 0
    ) {
      return NextResponse.json(
        { error: "الفاتورة مسددة بالفعل أو لا يوجد مبلغ متبقٍ." },
        { status: 409 }
      );
    }

    // الأسعار في قاعدة البيانات بالريال السعودي الكامل.
    // Stripe يستقبل المبلغ بالهللات.
    const amountInHalalas = remainingAmount * 100;

    if (!Number.isSafeInteger(amountInHalalas)) {
      return NextResponse.json(
        { error: "مبلغ الفاتورة خارج النطاق المسموح." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeSecretKey);

    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        serviceId: order.serviceId,
        invoiceNumber: order.invoiceNumber ?? "",
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          serviceId: order.serviceId,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "sar",
            unit_amount: amountInHalalas,
            product_data: {
              name: order.invoiceNumber
                ? `فاتورة صيانة ${order.invoiceNumber}`
                : "فاتورة صيانة جهاز",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/track?payment=success`,
      cancel_url: `${origin}/track?payment=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "تعذر إنشاء رابط الدفع." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      checkoutUrl: session.url,
      expiresAt: session.expires_at,
    });
  } catch (error) {
    console.error("Create Stripe Checkout session failed:", error);

    return NextResponse.json(
      { error: "تعذر إنشاء جلسة الدفع حاليًا." },
      { status: 500 }
    );
  }
}
