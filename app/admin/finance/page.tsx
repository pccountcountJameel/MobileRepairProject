
import Link from "next/link";
import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const instant = false;

function formatAmount(amount: number | null | undefined) {
  return new Intl.NumberFormat("ar", {
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
  }).format(date);
}

function getPaymentStatus(
  invoiceAmount: number,
  receivedAmount: number,
  remainingAmount: number
) {
  if (invoiceAmount === 0) {
    return {
      label: "فاتورة بصفر",
      className: "bg-gray-100 text-gray-700",
    };
  }

  if (remainingAmount === 0) {
    return {
      label: "مدفوعة بالكامل",
      className: "bg-green-100 text-green-800",
    };
  }

  if (receivedAmount > 0) {
    return {
      label: "مدفوعة جزئيًا",
      className: "bg-blue-100 text-blue-800",
    };
  }

  return {
    label: "غير مدفوعة",
    className: "bg-amber-100 text-amber-800",
  };
}

function calculatePayments(
  invoiceAmount: number | null,
  payments: { amount: number }[]
) {
  const total = invoiceAmount ?? 0;

  const received = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const valid =
    Number.isSafeInteger(total) &&
    total >= 0 &&
    Number.isSafeInteger(received) &&
    received >= 0 &&
    received <= total;

  return {
    invoiceAmount: total,
    receivedAmount: received,
    remainingAmount: valid ? total - received : 0,
    valid,
  };
}

export default async function FinancePage() {
  await requireRole(["admin", "super_admin"]);

  const [orders, recentOrders] = await Promise.all([
    prisma.order.findMany({
      select: {
        id: true,
        totalAmount: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    }),

    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        createdAt: true,
        payments: {
          select: {
            amount: true,
          },
        },
        service: {
          select: {
            id: true,
            deviceType: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
  ]);

  let totalAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let paidCount = 0;
  let partialCount = 0;
  let unpaidCount = 0;
  let zeroInvoiceCount = 0;
  let inconsistentCount = 0;

  for (const order of orders) {
    const summary = calculatePayments(
      order.totalAmount,
      order.payments
    );

    if (!summary.valid) {
      inconsistentCount++;
      continue;
    }

    totalAmount += summary.invoiceAmount;
    paidAmount += summary.receivedAmount;
    unpaidAmount += summary.remainingAmount;

    if (summary.invoiceAmount === 0) {
      zeroInvoiceCount++;
    } else if (summary.remainingAmount === 0) {
      paidCount++;
    } else if (summary.receivedAmount > 0) {
      partialCount++;
    } else {
      unpaidCount++;
    }
  }

  const totalsAreSafe = [
    totalAmount,
    paidAmount,
    unpaidAmount,
  ].every(Number.isSafeInteger);

  return (
    <main
      dir="rtl"
      className="mx-auto max-w-6xl space-y-6 p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            التقرير المالي
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            ملخص الفواتير والتحصيل الفعلي والمبالغ المتبقية.
          </p>
        </div>

        <Link
          href="/admin"
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-800 hover:bg-gray-200"
        >
          العودة إلى لوحة الإدارة
        </Link>
      </header>

      {inconsistentCount > 0 && (
        <section
          role="alert"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
        >
          <h2 className="font-semibold">
            تنبيه: توجد سجلات مالية تحتاج إلى مراجعة
          </h2>
          <p className="mt-1 text-sm">
            عدد الفواتير التي تحتوي على مبالغ غير متسقة:{" "}
            {formatAmount(inconsistentCount)}.
            تم استبعاد هذه السجلات من إجماليات التقرير لتجنب عرض
            أرقام مضللة.
          </p>
        </section>
      )}

      {!totalsAreSafe && (
        <section
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"
        >
          تعذر التأكد من سلامة الإجماليات المالية. يرجى مراجعة
          البيانات قبل الاعتماد على التقرير.
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">
            إجمالي قيمة الفواتير السليمة
          </p>
          <p className="mt-3 text-2xl font-bold text-gray-900">
            {formatAmount(totalAmount)}
          </p>
        </article>

        <article className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm text-green-800">
            إجمالي المبالغ المحصّلة
          </p>
          <p className="mt-3 text-2xl font-bold text-green-900">
            {formatAmount(paidAmount)}
          </p>
          <p className="mt-2 text-sm text-green-800">
            فواتير مسددة بالكامل: {formatAmount(paidCount)}
          </p>
        </article>

        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            المبالغ المتبقية للتحصيل
          </p>
          <p className="mt-3 text-2xl font-bold text-amber-900">
            {formatAmount(unpaidAmount)}
          </p>
          <p className="mt-2 text-sm text-amber-800">
            فواتير غير مدفوعة: {formatAmount(unpaidCount)}
          </p>
        </article>

        <article className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm text-blue-800">
            الفواتير المدفوعة جزئيًا
          </p>
          <p className="mt-3 text-2xl font-bold text-blue-900">
            {formatAmount(partialCount)}
          </p>
          <p className="mt-2 text-sm text-blue-800">
            فواتير إجماليها صفر: {formatAmount(zeroInvoiceCount)}
          </p>
          <p className="mt-1 text-sm text-blue-800">
            إجمالي الفواتير: {formatAmount(orders.length)}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            أحدث 20 فاتورة
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            المبالغ المحصّلة والمتبقية محسوبة من سجلات الدفعات
            الفعلية.
          </p>
        </div>

        {recentOrders.length === 0 ? (
          <p className="p-6 text-gray-500">
            لا توجد فواتير مسجلة حتى الآن.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="whitespace-nowrap p-4">
                    رقم الفاتورة
                  </th>
                  <th className="whitespace-nowrap p-4">
                    العميل
                  </th>
                  <th className="whitespace-nowrap p-4">
                    الجهاز
                  </th>
                  <th className="whitespace-nowrap p-4">
                    قيمة الفاتورة
                  </th>
                  <th className="whitespace-nowrap p-4">
                    المحصّل
                  </th>
                  <th className="whitespace-nowrap p-4">
                    المتبقي
                  </th>
                  <th className="whitespace-nowrap p-4">
                    حالة الدفع
                  </th>
                  <th className="whitespace-nowrap p-4">
                    التاريخ
                  </th>
                  <th className="whitespace-nowrap p-4">
                    الطلب
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => {
                  const summary = calculatePayments(
                    order.totalAmount,
                    order.payments
                  );

                  const status = summary.valid
                    ? getPaymentStatus(
                        summary.invoiceAmount,
                        summary.receivedAmount,
                        summary.remainingAmount
                      )
                    : {
                        label: "تحتاج إلى مراجعة",
                        className:
                          "bg-red-100 text-red-800",
                      };

                  return (
                    <tr
                      key={order.id}
                      className="border-t border-gray-100"
                    >
                      <td className="whitespace-nowrap p-4">
                        {order.invoiceNumber || "غير محدد"}
                      </td>

                      <td className="p-4">
                        <div>
                          {order.service.user.name || "غير محدد"}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {order.service.user.email}
                        </div>
                      </td>

                      <td className="whitespace-nowrap p-4">
                        {order.service.deviceType}
                      </td>

                      <td className="whitespace-nowrap p-4 font-medium">
                        {formatAmount(summary.invoiceAmount)}
                      </td>

                      <td className="whitespace-nowrap p-4 text-green-700">
                        {formatAmount(summary.receivedAmount)}
                      </td>

                      <td className="whitespace-nowrap p-4 text-amber-800">
                        {summary.valid
                          ? formatAmount(summary.remainingAmount)
                          : "—"}
                      </td>

                      <td className="whitespace-nowrap p-4">
                        <span
                          className={`rounded-full px-3 py-1 ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="whitespace-nowrap p-4">
                        {formatDate(order.createdAt)}
                      </td>

                      <td className="whitespace-nowrap p-4">
                        <Link
                          href={`/admin/services/${order.service.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          عرض الطلب
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
