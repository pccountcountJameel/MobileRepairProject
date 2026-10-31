
import { NextResponse } from "next/server";
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";


const TRACK_SESSION_TTL_SECONDS = 600;
const OTP_TTL_SECONDS = 300;
const MAX_ATTEMPTS = 5;

function hmac(value: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }

  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeCompare(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) {
    return false;
  }

  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  return timingSafeEqual(aBuffer, bBuffer);
}

function invalidCodeResponse() {
  return NextResponse.json(
    {
      error:
        "تعذر التحقق من الرمز. تأكد من الرمز أو اطلب رمزًا جديدًا.",
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
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

    const code =
      typeof input.code === "string" ? input.code.trim() : "";

    if (
      !trackingNumber ||
      trackingNumber.length > 100 ||
      !/^\d{6}$/.test(code)
    ) {
      return invalidCodeResponse();
    }

    if (!redis.isOpen) {
      await redis.connect();
    }

    const service = await prisma.service.findUnique({
      where: { trackingNumber },
      select: { id: true },
    });

    // Use the same response when the tracking number is unknown.
    if (!service) {
      return invalidCodeResponse();
    }

    const otpKey = `otp:service:${service.id}`;
    const attemptsKey = `otp:attempts:${service.id}`;

    const storedHash = await redis.get(otpKey);

    if (!storedHash) {
      return invalidCodeResponse();
    }

    const submittedHash = hmac(`${service.id}:${code}`);

    // Atomically check the attempt limit, compare the code hash,
    // and consume the OTP when it matches.
    const result = await redis.eval(
      `
        local stored = redis.call("GET", KEYS[1])
        if not stored then
          return -1
        end

        local attempts = tonumber(redis.call("GET", KEYS[2]) or "0")
        if attempts >= tonumber(ARGV[2]) then
          redis.call("DEL", KEYS[1])
          redis.call("DEL", KEYS[2])
          return -2
        end

        attempts = redis.call("INCR", KEYS[2])
        if attempts == 1 then
          redis.call("EXPIRE", KEYS[2], tonumber(ARGV[3]))
        end

        if attempts > tonumber(ARGV[2]) then
          redis.call("DEL", KEYS[1])
          redis.call("DEL", KEYS[2])
          return -2
        end

        if stored ~= ARGV[1] then
          return 0
        end

        redis.call("DEL", KEYS[1])
        redis.call("DEL", KEYS[2])
        return 1
      `,
      {
        keys: [otpKey, attemptsKey],
        arguments: [
          submittedHash,
          String(MAX_ATTEMPTS),
          String(OTP_TTL_SECONDS),
        ],
      }
    );

    if (Number(result) !== 1) {
      if (Number(result) === -2) {
        return NextResponse.json(
          {
            error:
              "تجاوزت عدد المحاولات المسموح بها. اطلب رمز تحقق جديدًا.",
          },
          { status: 429 }
        );
      }

      return invalidCodeResponse();
    }

    const trackingToken = randomBytes(32).toString("hex");
    const tokenHash = hmac(`tracking-session:${trackingToken}`);
    const trackingSessionKey = `track:session:${tokenHash}`;

    const sessionCreated = await redis.set(
      trackingSessionKey,
      service.id,
      {
        EX: TRACK_SESSION_TTL_SECONDS,
        NX: true,
      }
    );

    if (sessionCreated !== "OK") {
      return NextResponse.json(
        { error: "تعذر إنشاء جلسة التتبع. حاول طلب رمز جديد." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "تم التحقق بنجاح.",
      trackingToken,
      expiresIn: TRACK_SESSION_TTL_SECONDS,
    });
  } catch (error) {
    console.error(
      "OTP verification error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "تعذر التحقق حاليًا. حاول لاحقًا." },
      { status: 500 }
    );
  }
}
