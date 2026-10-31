
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const allowedMethods = [
  "cash",
  "bank_transfer",
  "card",
  "other",
] as const;

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    // التحقق من المستخدم وصلاحياته
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    if (
      user.role !== "admin" &&
      user.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية تسجيل الدفعات." },
        { status: 403 }
      );
    }

    const { orderId } = await context.params;

    if (
      typeof orderId !== "string" ||
      orderId.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "رقم الفاتورة غير صالح." },
        { status: 400 }
      );
    }

    // قراءة بيانات الطلب والتحقق من JSON
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "بيانات الطلب ليست JSON صالحاً." },
        { status: 400 }
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "بيانات الدفعة غير صالحة." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;
    const { amount, method, reference, note } = data;

    // التحقق من المبلغ
    if (
      typeof amount !== "number" ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "يجب أن يكون مبلغ الدفعة عدداً صحيحاً أكبر من صفر.",
        },
        { status: 400 }
      );
    }

    // التحقق من طريقة الدفع
    if (
      typeof method !== "string" ||
      !allowedMethods.includes(
        method as (typeof allowedMethods)[number]
      )
    ) {
      return NextResponse.json(
        { error: "طريقة الدفع غير صالحة." },
        { status: 400 }
      );
    }

    // التحقق من المرجع
    if (
      reference !== undefined &&
      reference !== null &&
      (typeof reference !== "string" ||
        reference.length > 200)
    ) {
      return NextResponse.json(
        {
          error:
            "المرجع غير صالح أو أطول من 200 حرف.",
        },
        { status: 400 }
      );
    }

    // التحقق من الملاحظة
    if (
      note !== undefined &&
      note !== null &&
      (typeof note !== "string" ||
        note.length > 1000)
    ) {
      return NextResponse.json(
        {
          error:
            "الملاحظة غير صالحة أو أطول من 1000 حرف.",
        },
        { status: 400 }
      );
    }

    // تسجيل الدفعة داخل معاملة ذرية
    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            isPaid: true,
          },
        });

        if (!order) {
          return {
            status: 404,
            body: {
              error: "الفاتورة غير موجودة.",
            },
          };
        }

        const totalAmount = order.totalAmount;

        // التحقق من إجمالي الفاتورة
        if (
          totalAmount === null ||
          !Number.isSafeInteger(totalAmount) ||
          totalAmount < 0
        ) {
          return {
            status: 400,
            body: {
              error: "إجمالي الفاتورة غير صالح.",
            },
          };
        }

        // الفاتورة ذات الإجمالي صفر لا تحتاج إلى دفعة
        if (totalAmount === 0) {
          return {
            status: 409,
            body: {
              error:
                "إجمالي الفاتورة صفر ولا يمكن تسجيل دفعة لها.",
            },
          };
        }

        // حساب مجموع الدفعات السابقة
        const paymentSummary =
          await tx.payment.aggregate({
            where: { orderId },
            _sum: { amount: true },
          });

        const totalPaidBefore =
          paymentSummary._sum.amount ?? 0;

        // التحقق من سلامة مجموع الدفعات
        if (
          !Number.isSafeInteger(totalPaidBefore) ||
          totalPaidBefore < 0 ||
          totalPaidBefore > totalAmount
        ) {
          return {
            status: 409,
            body: {
              error:
                "مجموع الدفعات المسجلة غير متوافق مع إجمالي الفاتورة. يرجى مراجعة السجلات.",
            },
          };
        }

        const remainingBefore =
          totalAmount - totalPaidBefore;

        // التمييز بين السداد الكامل وتعارض حالة الفاتورة
        if (remainingBefore === 0) {
          if (!order.isPaid) {
            return {
              status: 409,
              body: {
                error:
                  "جميع المبالغ مسددة، لكن حالة الفاتورة غير محدثة. يرجى مراجعة السجلات.",
              },
            };
          }

          return {
            status: 409,
            body: {
              error: "تم سداد هذه الفاتورة بالكامل.",
            },
          };
        }

        if (order.isPaid) {
          return {
            status: 409,
            body: {
              error:
                "حالة الفاتورة تشير إلى السداد الكامل، لكن يوجد مبلغ متبقٍ. يرجى مراجعة السجلات.",
            },
          };
        }

        // منع تجاوز المبلغ المتبقي
        if (amount > remainingBefore) {
          return {
            status: 400,
            body: {
              error:
                "مبلغ الدفعة أكبر من المبلغ المتبقي.",
              remainingAmount: remainingBefore,
            },
          };
        }

        // التأكد من سلامة المجموع قبل الحفظ
        const totalPaid = totalPaidBefore + amount;

        if (!Number.isSafeInteger(totalPaid)) {
          return {
            status: 400,
            body: {
              error:
                "نتيجة جمع الدفعات تتجاوز النطاق العددي الآمن.",
            },
          };
        }

        const remainingAmount =
          totalAmount - totalPaid;

        if (
          !Number.isSafeInteger(remainingAmount) ||
          remainingAmount < 0
        ) {
          return {
            status: 409,
            body: {
              error:
                "تعذر حساب المبلغ المتبقي بصورة صحيحة.",
            },
          };
        }

        // إنشاء سجل الدفعة
        const payment = await tx.payment.create({
          data: {
            orderId,
            amount,
            method:
              method as (typeof allowedMethods)[number],
            reference:
              typeof reference === "string"
                ? reference.trim() || null
                : null,
            note:
              typeof note === "string"
                ? note.trim() || null
                : null,
            receivedById: user.id,
          },
        });

        // تحديث حالة الفاتورة بناءً على المبلغ المتبقي
        const isPaid = remainingAmount === 0;

        await tx.order.update({
          where: { id: orderId },
          data: { isPaid },
        });

        return {
          status: 201,
          body: {
            message: "تم تسجيل الدفعة بنجاح.",
            payment,
            invoiceNumber: order.invoiceNumber,
            totalAmount,
            totalPaid,
            remainingAmount,
            isPaid,
          },
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json(result.body, {
      status: result.status,
    });
  } catch (error) {
    // تعارض معاملات قاعدة البيانات
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error:
            "حدث تعارض أثناء تسجيل الدفعة. يرجى إعادة المحاولة.",
        },
        { status: 409 }
      );
    }

    console.error(
      "POST /api/orders/[orderId]/payments error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "حدث خطأ داخلي أثناء تسجيل الدفعة.",
      },
      { status: 500 }
    );
  }
}
