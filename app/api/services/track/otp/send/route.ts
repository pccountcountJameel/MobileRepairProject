/*
import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import twilio from "twilio";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const OTP_TTL_SECONDS = 300;
const SEND_LIMIT = 3;
const SEND_WINDOW_SECONDS = 900;

function hashOtp(serviceId: string, code: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }

  return createHmac("sha256", secret)
    .update(`${serviceId}:${code}`)
    .digest("hex");
}

function normalizeWhatsAppPhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null;

  const cleaned = phone
    .trim()
    .replace(/^whatsapp:/i, "")
    .replace(/[\s()-]/g, "");

  // Require international E.164 format.
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    return null;
  }

  return `whatsapp:${cleaned}`;
}

function genericResponse() {
  return NextResponse.json({
    message:
      "إذا كان الطلب مؤهلًا للتحقق، فسيتم إرسال رمز إلى وسيلة الاتصال المسجلة.",
  });
}

export async function POST(request: Request) {
  try {
    const sendGridApiKey = process.env.SENDGRID_API_KEY?.trim();
    const sendGridFromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();

    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const twilioApiKey = process.env.TWILIO_API_KEY?.trim();
    const twilioApiSecret = process.env.TWILIO_API_SECRET?.trim();
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM?.trim();
    const whatsappContentSid =
      process.env.TWILIO_OTP_CONTENT_SID?.trim();

    const emailProviderReady = Boolean(
      sendGridApiKey && sendGridFromEmail
    );

    const whatsappProviderReady = Boolean(
      accountSid &&
      twilioApiKey &&
      twilioApiSecret &&
      whatsappFrom &&
      whatsappContentSid
    );

    if (!emailProviderReady && !whatsappProviderReady) {
      console.error("No OTP delivery provider is configured.");

      return NextResponse.json(
        { error: "خدمة إرسال رمز التحقق غير متاحة حاليًا." },
        { status: 503 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "البيانات المرسلة غير صالحة." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "البيانات المرسلة غير صالحة." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const trackingNumber =
      typeof input.trackingNumber === "string"
        ? input.trackingNumber.trim().toUpperCase()
        : "";

    if (!trackingNumber || trackingNumber.length > 100) {
      return NextResponse.json(
        { error: "يرجى إدخال رقم تتبع صحيح." },
        { status: 400 }
      );
    }

    if (!redis.isOpen) {
      await redis.connect();
    }

    const service = await prisma.service.findUnique({
      where: { trackingNumber },
      select: {
        id: true,
        customerPhone: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    // Do not reveal whether a tracking number exists.
    if (!service) {
      return genericResponse();
    }

    const customerEmail = service.user?.email;
    const customerWhatsApp = normalizeWhatsAppPhone(
      service.customerPhone
    );

    const canSendEmail = Boolean(
      emailProviderReady && customerEmail
    );

    const canSendWhatsApp = Boolean(
      whatsappProviderReady && customerWhatsApp
    );

    if (!canSendEmail && !canSendWhatsApp) {
      return genericResponse();
    }

    const rateLimitKey = `otp:send:limit:${service.id}`;
    const sendCount = await redis.incr(rateLimitKey);

    if (sendCount === 1) {
      await redis.expire(rateLimitKey, SEND_WINDOW_SECONDS);
    }

    if (sendCount > SEND_LIMIT) {
      return NextResponse.json(
        {
          error:
            "تجاوزت الحد المسموح لطلبات الرمز. حاول مجددًا بعد 15 دقيقة.",
        },
        { status: 429 }
      );
    }

    const code = randomInt(0, 1_000_000)
      .toString()
      .padStart(6, "0");

    const otpKey = `otp:service:${service.id}`;
    const attemptsKey = `otp:attempts:${service.id}`;

    const codeHash = hashOtp(service.id, code);

    await redis
      .multi()
      .set(otpKey, codeHash, { EX: OTP_TTL_SECONDS })
      .del(attemptsKey)
      .exec();

    const deliveryTasks: Promise<unknown>[] = [];

    // Send OTP by email when configured and available.
    if (canSendEmail && customerEmail) {
      sgMail.setApiKey(sendGridApiKey!);

      deliveryTasks.push(
        sgMail.send({
          to: customerEmail,
          from: sendGridFromEmail!,
          subject: "رمز التحقق لطلب الصيانة",
          text:
            `رمز التحقق الخاص بك هو: ${code}\n` +
            "صلاحية الرمز 5 دقائق، ويستخدم مرة واحدة فقط. " +
            "إذا لم تطلب هذا الرمز، فتجاهل الرسالة.",
          html: `
            <div dir="rtl" style="font-family:Arial,sans-serif">
              <h2>رمز التحقق</h2>
              <p>استخدم الرمز التالي للتحقق من طلب الصيانة:</p>
              <p style="font-size:28px;font-weight:bold;letter-spacing:6px">
                ${code}
              </p>
              <p>تنتهي صلاحية الرمز خلال 5 دقائق، ويستخدم مرة واحدة فقط.</p>
              <p>إذا لم تطلب هذا الرمز، فتجاهل الرسالة.</p>
            </div>
          `,
        })
      );
    }

    // Send OTP by WhatsApp using the Sandbox verification template.
    if (
      canSendWhatsApp &&
      customerWhatsApp &&
      accountSid &&
      twilioApiKey &&
      twilioApiSecret &&
      whatsappFrom &&
      whatsappContentSid
    ) {
      const twilioClient = twilio(
        twilioApiKey,
        twilioApiSecret,
        { accountSid }
      );

      const formattedFrom = whatsappFrom.startsWith("whatsapp:")
        ? whatsappFrom
        : `whatsapp:${whatsappFrom}`;

      deliveryTasks.push(
        twilioClient.messages.create({
          from: formattedFrom,
          to: customerWhatsApp,
          contentSid: whatsappContentSid,
          contentVariables: JSON.stringify({
            "1": "MobileRepairProject",
            "2": code,
          }),
        })
      );
    }

    const results = await Promise.allSettled(deliveryTasks);

    const successfulDeliveries = results.filter(
      (result) => result.status === "fulfilled"
    ).length;

    if (successfulDeliveries === 0) {
      await redis.del([otpKey, attemptsKey]);

      console.error(
        "All OTP delivery channels failed:",
        results.map((result) =>
          result.status === "rejected"
            ? result.reason instanceof Error
              ? result.reason.message
              : "Unknown delivery error"
            : "Success"
        )
      );

      return NextResponse.json(
        { error: "تعذر إرسال رمز التحقق حاليًا. حاول لاحقًا." },
        { status: 502 }
      );
    }

    if (successfulDeliveries < deliveryTasks.length) {
      console.warn("One OTP delivery channel failed.");
    }

    return genericResponse();
  } catch (error) {
    console.error(
      "OTP send error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "تعذر إرسال رمز التحقق حاليًا." },
      { status: 500 }
    );
  }
}
*/



import { createHmac, randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const OTP_TTL_SECONDS = 300;
const SEND_LIMIT = 3;
const SEND_WINDOW_SECONDS = 900;

type DeliveryMethod = "email" | "whatsapp";

function hashOtp(serviceId: string, code: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }

  return createHmac("sha256", secret)
    .update(`${serviceId}:${code}`)
    .digest("hex");
}

function genericResponse() {
  return NextResponse.json({
    message: "إذا كان الطلب مؤهلًا للتحقق، فسيتم إرسال رمز التحقق عبر الوسيلة المختارة.",
  });
}

async function sendEmail(email: string, code: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("SendGrid configuration is missing.");
  }

  sgMail.setApiKey(apiKey);

  await sgMail.send({
    to: email,
    from: fromEmail,
    subject: "رمز التحقق لطلب الصيانة",
    text:
      `رمز التحقق الخاص بك هو: ${code}\n` +
      "صلاحية الرمز 5 دقائق، ويستخدم مرة واحدة فقط. " +
      "إذا لم تطلب هذا الرمز، فتجاهل الرسالة.",
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif">
        <h2>رمز التحقق</h2>
        <p>استخدم الرمز التالي للتحقق من طلب الصيانة:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:6px">
          ${code}
        </p>
        <p>تنتهي صلاحية الرمز خلال 5 دقائق، ويستخدم مرة واحدة فقط.</p>
        <p>إذا لم تطلب هذا الرمز، فتجاهل الرسالة.</p>
      </div>
    `,
  });
}

async function sendWhatsApp(phone: string, code: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !whatsappFrom) {
    throw new Error("Twilio configuration is missing.");
  }

  // يقبل الرقم الدولي مثل +967XXXXXXXXX
  const normalizedPhone = phone.replace(/[\s()-]/g, "");

  if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
    throw new Error("Customer phone number is not valid E.164.");
  }

  const from = whatsappFrom.startsWith("whatsapp:")
    ? whatsappFrom
    : `whatsapp:${whatsappFrom}`;

  const to = `whatsapp:${normalizedPhone}`;

  const endpoint =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  const form = new URLSearchParams({
    From: from,
    To: to,
    Body:
      `رمز التحقق لطلب الصيانة هو: ${code}\n` +
      "صلاحية الرمز 5 دقائق ويستخدم مرة واحدة فقط.",
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    console.error("Twilio WhatsApp delivery failed:", {
      status: response.status,
      code: errorData?.code,
      message: errorData?.message,
    });

    throw new Error("WhatsApp delivery failed.");
  }
}

export async function POST(request: Request) {
  let otpKey: string | null = null;
  let attemptsKey: string | null = null;

  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "البيانات المرسلة غير صالحة." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "البيانات المرسلة غير صالحة." },
        { status: 400 }
      );
    }

    const input = body as Record<string, unknown>;

    const trackingNumber =
      typeof input.trackingNumber === "string"
        ? input.trackingNumber.trim().toUpperCase()
        : "";

    const method = input.method;

    if (
      !trackingNumber ||
      trackingNumber.length > 100 ||
      (method !== "email" && method !== "whatsapp")
    ) {
      return NextResponse.json(
        { error: "يرجى إدخال البيانات واختيار وسيلة إرسال صحيحة." },
        { status: 400 }
      );
    }

    if (!redis.isOpen) {
      await redis.connect();
    }

    const service = await prisma.service.findUnique({
      where: { trackingNumber },
      select: {
        id: true,
        customerPhone: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!service) {
      return genericResponse();
    }

    if (method === "email" && !service.user.email) {
      return genericResponse();
    }

    if (method === "whatsapp" && !service.customerPhone) {
      return genericResponse();
    }

    const rateLimitKey = `otp:send:limit:${service.id}`;
    const sendCount = await redis.incr(rateLimitKey);

    if (sendCount === 1) {
      await redis.expire(rateLimitKey, SEND_WINDOW_SECONDS);
    }

    if (sendCount > SEND_LIMIT) {
      return NextResponse.json(
        {
          error:
            "تجاوزت الحد المسموح لطلبات الرمز. حاول مجددًا بعد 15 دقيقة.",
        },
        { status: 429 }
      );
    }

    const code = randomInt(0, 1_000_000)
      .toString()
      .padStart(6, "0");

    otpKey = `otp:service:${service.id}`;
    attemptsKey = `otp:attempts:${service.id}`;

    const codeHash = hashOtp(service.id, code);

    await redis
      .multi()
      .set(otpKey, codeHash, { EX: OTP_TTL_SECONDS })
      .del(attemptsKey)
      .exec();

    try {
      if (method === "email") {
        await sendEmail(service.user.email!, code);
      } else {
        await sendWhatsApp(service.customerPhone!, code);
      }
    } catch (deliveryError) {
      await redis.del([otpKey, attemptsKey]);

      console.error("OTP delivery error:", {
        method,
        message:
          deliveryError instanceof Error
            ? deliveryError.message
            : "Unknown error",
      });

      return NextResponse.json(
        { error: "تعذر إرسال رمز التحقق عبر الوسيلة المختارة. حاول لاحقًا." },
        { status: 502 }
      );
    }

    return genericResponse();
  } catch (error) {
    if (otpKey && attemptsKey) {
      await redis.del([otpKey, attemptsKey]).catch(() => {});
    }

    console.error(
      "OTP send error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "تعذر إرسال رمز التحقق حاليًا." },
      { status: 500 }
    );
  }
}
