
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/session";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) {
    return { response: NextResponse.json(
      { error: "يجب تسجيل الدخول أولاً." },
      { status: 401 }
    ) };
  }

  const session = await verifySession(token);

  if (!session) {
    return { response: NextResponse.json(
      { error: "جلسة الدخول غير صالحة." },
      { status: 401 }
    ) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });

  if (!user) {
    return { response: NextResponse.json(
      { error: "المستخدم غير موجود." },
      { status: 401 }
    ) };
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return { response: NextResponse.json(
      { error: "ليس لديك صلاحية لتنفيذ هذا الإجراء." },
      { status: 403 }
    ) };
  }

  return { user };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// GET /api/services/[id]/parts
// عرض قطع الغيار المطلوبة لطلب صيانة.
export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await getAuthorizedUser();

    if ("response" in auth) {
      return auth.response;
    }

    const { id } = await context.params;

    const service = await prisma.service.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: "طلب الصيانة غير موجود." },
        { status: 404 }
      );
    }

    const parts = await prisma.servicePartRequirement.findMany({
      where: { serviceId: id },
      orderBy: { createdAt: "asc" },
      include: {
        sparePart: {
          select: {
            id: true,
            code: true,
            name: true,
            unitPrice: true,
            quantityOnHand: true,
            quantityReserved: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({ parts });
  } catch (error) {
    console.error("Get service parts error:", error);

    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب قطع الغيار." },
      { status: 500 }
    );
  }
}

// POST /api/services/[id]/parts
// إضافة قطعة مطلوبة إلى طلب الصيانة.
export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await getAuthorizedUser();

    if ("response" in auth) {
      return auth.response;
    }

    const { id: serviceId } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "بيانات الطلب ليست JSON صالحًا." },
        { status: 400 }
      );
    }

    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "بيانات الطلب غير صالحة." },
        { status: 400 }
      );
    }

    const quantityRequired = body.quantityRequired;
    const sparePartId =
      typeof body.sparePartId === "string" && body.sparePartId.trim()
        ? body.sparePartId.trim()
        : null;

    if (
      typeof quantityRequired !== "number" ||
      !Number.isSafeInteger(quantityRequired) ||
      quantityRequired < 1 ||
      quantityRequired > 10000
    ) {
      return NextResponse.json(
        { error: "الكمية المطلوبة يجب أن تكون عددًا صحيحًا بين 1 و10000." },
        { status: 400 }
      );
    }

    const note =
      typeof body.note === "string" ? body.note.trim() : null;

    if (note && note.length > 1000) {
      return NextResponse.json(
        { error: "ملاحظات القطعة يجب ألا تتجاوز 1000 حرف." },
        { status: 400 }
      );
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true },
    });

    if (!service) {
      return NextResponse.json(
        { error: "طلب الصيانة غير موجود." },
        { status: 404 }
      );
    }

    let requestedPartName: string;
    let requestedCode: string | null;
    let unitPrice: number | null;

    if (sparePartId) {
      const sparePart = await prisma.sparePart.findUnique({
        where: { id: sparePartId },
        select: {
          id: true,
          code: true,
          name: true,
          unitPrice: true,
          isActive: true,
        },
      });

      if (!sparePart || !sparePart.isActive) {
        return NextResponse.json(
          { error: "قطعة المخزون غير موجودة أو غير مفعّلة." },
          { status: 400 }
        );
      }

      requestedPartName = sparePart.name;
      requestedCode = sparePart.code;
      unitPrice = sparePart.unitPrice;
    } else {
      const name =
        typeof body.requestedPartName === "string"
          ? body.requestedPartName.trim()
          : "";

      const code =
        typeof body.requestedCode === "string"
          ? body.requestedCode.trim()
          : "";

      const suppliedPrice = body.unitPrice;

      if (!name || name.length > 200) {
        return NextResponse.json(
          { error: "أدخل اسم القطعة، بحد أقصى 200 حرف." },
          { status: 400 }
        );
      }

      if (code.length > 100) {
        return NextResponse.json(
          { error: "رمز القطعة يجب ألا يتجاوز 100 حرف." },
          { status: 400 }
        );
      }

      if (
        suppliedPrice !== undefined &&
        suppliedPrice !== null &&
        (
          typeof suppliedPrice !== "number" ||
          !Number.isSafeInteger(suppliedPrice) ||
          suppliedPrice < 0
        )
      ) {
        return NextResponse.json(
          { error: "سعر القطعة يجب أن يكون عددًا صحيحًا غير سالب." },
          { status: 400 }
        );
      }

      requestedPartName = name;
      requestedCode = code || null;
      unitPrice =
        typeof suppliedPrice === "number" ? suppliedPrice : null;
    }

    const part = await prisma.servicePartRequirement.create({
      data: {
        serviceId,
        sparePartId,
        requestedPartName,
        requestedCode,
        quantityRequired,
        quantityReserved: 0,
        unitPrice,
        note: note || null,
        status: "requested",
      },
      include: {
        sparePart: {
          select: {
            id: true,
            code: true,
            name: true,
            unitPrice: true,
            quantityOnHand: true,
            quantityReserved: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "تمت إضافة القطعة إلى طلب الصيانة.",
        part,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add service part error:", error);

    return NextResponse.json(
      { error: "حدث خطأ أثناء إضافة القطعة." },
      { status: 500 }
    );
  }
}
