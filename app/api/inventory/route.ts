
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authorization";

const MAX_QUANTITY = 1_000_000_000;
const MAX_PRICE = 2_000_000_000;

type InventoryMovementType =
  | "restock"
  | "adjustment_in"
  | "adjustment_out";

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

async function checkAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "يرجى تسجيل الدخول أولًا." },
        { status: 401 }
      ),
    };
  }

  if (user.role !== "admin" && user.role !== "super_admin") {
    return {
      user: null,
      response: NextResponse.json(
        { error: "ليس لديك صلاحية لإدارة المخزون." },
        { status: 403 }
      ),
    };
  }

  return { user, response: null };
}

function validMovementType(
  value: unknown
): value is InventoryMovementType {
  return (
    value === "restock" ||
    value === "adjustment_in" ||
    value === "adjustment_out"
  );
}

// GET /api/inventory
export async function GET(request: Request) {
  try {
    const auth = await checkAdmin();

    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const search = (url.searchParams.get("search") ?? "").trim();

    const parts = await prisma.sparePart.findMany({
      where: {
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" as const } },
                { name: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        unitPrice: true,
        quantityOnHand: true,
        quantityReserved: true,
        minStock: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const summary = {
      totalParts: parts.length,
      activeParts: parts.filter((part) => part.isActive).length,
      lowStockParts: parts.filter(
        (part) =>
          part.isActive &&
          part.quantityOnHand - part.quantityReserved <= part.minStock
      ).length,
      totalAvailableQuantity: parts.reduce(
        (sum, part) =>
          sum + part.quantityOnHand - part.quantityReserved,
        0
      ),
    };

    return NextResponse.json({ parts, summary });
  } catch (error) {
    console.error("Get inventory error:", error);

    return NextResponse.json(
      { error: "تعذر تحميل بيانات المخزون." },
      { status: 500 }
    );
  }
}

// POST /api/inventory
// action=create: إضافة قطعة جديدة.
// action=movement: تسجيل توريد أو تسوية مخزون.
export async function POST(request: Request) {
  try {
    const auth = await checkAdmin();

    if (auth.response) {
      return auth.response;
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "صيغة البيانات غير صحيحة." },
        { status: 400 }
      );
    }

    if (!isObject(body)) {
      return NextResponse.json(
        { error: "البيانات المرسلة غير صحيحة." },
        { status: 400 }
      );
    }

    const action = body.action;

    if (action === "create") {
      const code =
        typeof body.code === "string"
          ? body.code.trim().toUpperCase()
          : "";

      const name =
        typeof body.name === "string" ? body.name.trim() : "";

      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : "";

      const unitPrice = body.unitPrice;
      const quantityOnHand = body.quantityOnHand;
      const minStock = body.minStock;

      if (!code || !name) {
        return NextResponse.json(
          { error: "رمز القطعة واسمها مطلوبان." },
          { status: 400 }
        );
      }

      if (code.length > 50 || name.length > 150) {
        return NextResponse.json(
          { error: "رمز القطعة أو اسمها أطول من الحد المسموح." },
          { status: 400 }
        );
      }

      if (description.length > 1000) {
        return NextResponse.json(
          { error: "الوصف أطول من الحد المسموح." },
          { status: 400 }
        );
      }

      if (
        !isNonNegativeInteger(unitPrice) ||
        unitPrice > MAX_PRICE ||
        !isNonNegativeInteger(quantityOnHand) ||
        quantityOnHand > MAX_QUANTITY ||
        !isNonNegativeInteger(minStock) ||
        minStock > MAX_QUANTITY
      ) {
        return NextResponse.json(
          { error: "تحقق من السعر والكميات المدخلة." },
          { status: 400 }
        );
      }

      const part = await prisma.$transaction(async (tx) => {
        const created = await tx.sparePart.create({
          data: {
            code,
            name,
            description: description || null,
            unitPrice,
            quantityOnHand,
            minStock,
          },
        });

        if (quantityOnHand > 0) {
          await tx.inventoryMovement.create({
            data: {
              sparePartId: created.id,
              type: "restock",
              quantityChange: quantityOnHand,
              quantityBefore: 0,
              quantityAfter: quantityOnHand,
              note: "الرصيد الافتتاحي عند إنشاء القطعة",
              createdById: auth.user!.id,
            },
          });
        }

        return created;
      });

      return NextResponse.json({ part }, { status: 201 });
    }

    if (action === "movement") {
      const sparePartId =
        typeof body.sparePartId === "string"
          ? body.sparePartId.trim()
          : "";

      const type = body.type;
      const quantity = body.quantity;
      const note =
        typeof body.note === "string" ? body.note.trim() : "";

      if (!sparePartId || !validMovementType(type)) {
        return NextResponse.json(
          { error: "حدد القطعة ونوع حركة المخزون بصورة صحيحة." },
          { status: 400 }
        );
      }

      if (!isPositiveInteger(quantity) || quantity > MAX_QUANTITY) {
        return NextResponse.json(
          { error: "يجب أن تكون الكمية عددًا صحيحًا موجبًا." },
          { status: 400 }
        );
      }

      if (note.length > 500) {
        return NextResponse.json(
          { error: "ملاحظة الحركة أطول من الحد المسموح." },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const part = await tx.sparePart.findUnique({
          where: { id: sparePartId },
          select: {
            id: true,
            code: true,
            name: true,
            quantityOnHand: true,
            quantityReserved: true,
            isActive: true,
          },
        });

        if (!part) {
          throw new Error("PART_NOT_FOUND");
        }

        if (!part.isActive) {
          throw new Error("PART_INACTIVE");
        }

        const quantityChange =
          type === "adjustment_out" ? -quantity : quantity;

        const quantityAfter = part.quantityOnHand + quantityChange;

        if (
          !Number.isSafeInteger(quantityAfter) ||
          quantityAfter < 0 ||
          quantityAfter > MAX_QUANTITY
        ) {
          throw new Error("INVALID_RESULTING_QUANTITY");
        }

        if (quantityAfter < part.quantityReserved) {
          throw new Error("BELOW_RESERVED_QUANTITY");
        }

        // يمنع تسجيل حركة بناءً على كمية قديمة إذا تغير الرصيد بالتزامن.
        const update = await tx.sparePart.updateMany({
          where: {
            id: part.id,
            quantityOnHand: part.quantityOnHand,
            isActive: true,
          },
          data: {
            quantityOnHand: quantityAfter,
          },
        });

        if (update.count !== 1) {
          throw new Error("CONCURRENT_INVENTORY_UPDATE");
        }

        const movement = await tx.inventoryMovement.create({
          data: {
            sparePartId: part.id,
            type,
            quantityChange,
            quantityBefore: part.quantityOnHand,
            quantityAfter,
            note: note || null,
            createdById: auth.user!.id,
          },
        });

        return {
          part: {
            ...part,
            quantityOnHand: quantityAfter,
          },
          movement,
        };
      });

      return NextResponse.json(result, { status: 201 });
    }

    return NextResponse.json(
      { error: "نوع العملية غير مدعوم." },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { message: string; status: number }> = {
        PART_NOT_FOUND: {
          message: "قطعة الغيار غير موجودة.",
          status: 404,
        },
        PART_INACTIVE: {
          message: "لا يمكن تعديل مخزون قطعة غير نشطة.",
          status: 409,
        },
        INVALID_RESULTING_QUANTITY: {
          message: "الكمية الناتجة خارج النطاق المسموح.",
          status: 400,
        },
        BELOW_RESERVED_QUANTITY: {
          message: "لا يمكن خفض المخزون إلى أقل من الكمية المحجوزة.",
          status: 409,
        },
        CONCURRENT_INVENTORY_UPDATE: {
          message: "تغير رصيد القطعة بالتزامن. أعد تحميل المخزون وحاول مجددًا.",
          status: 409,
        },
      };

      const known = errors[error.message];

      if (known) {
        return NextResponse.json(
          { error: known.message },
          { status: known.status }
        );
      }

      // Prisma unique constraint violation (duplicate code).
      if ("code" in error && error.code === "P2002") {
        return NextResponse.json(
          { error: "رمز قطعة الغيار مستخدم بالفعل." },
          { status: 409 }
        );
      }
    }

    console.error("Inventory operation error:", error);

    return NextResponse.json(
      { error: "تعذرت معالجة عملية المخزون." },
      { status: 500 }
    );
  }
}
