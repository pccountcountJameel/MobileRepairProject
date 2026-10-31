
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";

function optionalText(
  value: unknown,
  maxLength: number
): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    return undefined;
  }

  return text;
}

function createTrackingNumber(): string {
  return `MR-${Date.now().toString(36).toUpperCase()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(request: Request) {
  try {
    // 1. التأكد من تسجيل دخول العميل
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    // 2. قراءة البيانات والتحقق من صلاحيتها
    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return NextResponse.json(
          { error: "البيانات المرسلة غير صالحة." },
          { status: 400 }
        );
      }

      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "تعذر قراءة البيانات المرسلة." },
        { status: 400 }
      );
    }

    const deviceType =
      typeof body.deviceType === "string"
        ? body.deviceType.trim()
        : "";

    const issueDescription =
      typeof body.issueDescription === "string"
        ? body.issueDescription.trim()
        : "";

    if (!deviceType || !issueDescription) {
      return NextResponse.json(
        { error: "نوع الجهاز ووصف المشكلة مطلوبان." },
        { status: 400 }
      );
    }

    if (
      deviceType.length > 100 ||
      issueDescription.length > 3000
    ) {
      return NextResponse.json(
        { error: "تجاوزت البيانات الحد المسموح به." },
        { status: 400 }
      );
    }

    // 3. التحقق من موعد الصيانة
    if (typeof body.appointment_date !== "string") {
      return NextResponse.json(
        { error: "موعد الصيانة مطلوب." },
        { status: 400 }
      );
    }

    const appointmentDate = new Date(body.appointment_date);

    if (!Number.isFinite(appointmentDate.getTime())) {
      return NextResponse.json(
        { error: "موعد الصيانة غير صالح." },
        { status: 400 }
      );
    }

    if (appointmentDate.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "يجب اختيار موعد في المستقبل." },
        { status: 400 }
      );
    }

    // 4. التحقق من بيانات الاستقبال الاختيارية
    const customerPhone = optionalText(body.customerPhone, 30);
    const intakeCondition = optionalText(body.intakeCondition, 2000);
    const intakeAccessories = optionalText(
      body.intakeAccessories,
      1000
    );
    const intakeNotes = optionalText(body.intakeNotes, 2000);

    if (
      customerPhone === undefined ||
      intakeCondition === undefined ||
      intakeAccessories === undefined ||
      intakeNotes === undefined
    ) {
      return NextResponse.json(
        {
          error:
            "إحدى بيانات الاستقبال غير صالحة أو تجاوزت الحد المسموح.",
        },
        { status: 400 }
      );
    }

    // 5. إنشاء الطلب مع رقم تتبع فريد وسجل للحالة الأولى
    let service: {
      id: string;
      trackingNumber: string | null;
      deviceType: string;
      issueDescription: string;
      appointment_date: Date;
      customerPhone: string | null;
      intakeCondition: string | null;
      intakeAccessories: string | null;
      intakeNotes: string | null;
      status: string;
      createdAt: Date;
    } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const trackingNumber = createTrackingNumber();

      try {
        service = await prisma.service.create({
          data: {
            deviceType,
            issueDescription,
            appointment_date: appointmentDate,
            userId: user.id,
            trackingNumber,
            customerPhone,
            intakeCondition,
            intakeAccessories,
            intakeNotes,
            status: "scheduled",
            statusHistory: {
              create: {
                status: "scheduled",
                note: "تم إنشاء طلب الصيانة.",
              },
            },
          },
          select: {
            id: true,
            trackingNumber: true,
            deviceType: true,
            issueDescription: true,
            appointment_date: true,
            customerPhone: true,
            intakeCondition: true,
            intakeAccessories: true,
            intakeNotes: true,
            status: true,
            createdAt: true,
          },
        });

        break;
      } catch (error) {
        if (
          !isPrismaUniqueConflict(error) ||
          attempt === 2
        ) {
          throw error;
        }
      }
    }

    if (!service) {
      throw new Error("تعذر إنشاء طلب الصيانة.");
    }

    // 6. مسح الذاكرة المؤقتة دون إلغاء نجاح إنشاء الطلب
    try {
      if (!redis.isOpen) {
        await redis.connect();
      }

      await redis.del("admin:services:latest100");
    } catch (cacheError) {
      console.error(
        "Redis cache invalidation error:",
        cacheError instanceof Error
          ? cacheError.message
          : cacheError
      );
    }

    // 7. إعادة بيانات الطلب ورقم التتبع
    return NextResponse.json(
      {
        message: "تم إنشاء طلب الصيانة بنجاح.",
        service,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create service error:", error);

    return NextResponse.json(
      { error: "تعذر إنشاء طلب الصيانة." },
      { status: 500 }
    );
  }
}
