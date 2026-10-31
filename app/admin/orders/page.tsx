
import Link from "next/link";
import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const instant = false;

function formatAmount(amount: number | null) {
  return new Intl.NumberFormat("ar").format(amount ?? 0);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
  }).format(date);
}

export default async function OrdersPage() {
  await requireRole(["admin", "super_admin"]);

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      isPaid: true,
      createdAt: true,
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
  });

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            إدارة الفواتير
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            جميع الفواتير المسجلة في النظام.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/finance"
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            التقرير المالي
          </Link>

          <Link
            href="/admin"
            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-800 hover:bg-gray-200"
          >
            لوحة الإدارة
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">إجمالي الفواتير</p>
          <p className="mt-2 text-2xl font-bold">{orders.length}</p>
        </article>

        <article className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">الفواتير المدفوعة</p>
          <p className="mt-2 text-2xl font-bold text-green-700">
            {orders.filter((order) => order.isPaid).length}
          </p>
        </article>

        <article className="rounded-xl border bg-white p-5">
          <p className="text-sm text-gray-500">الفواتير غير المدفوعة</p>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {orders.filter((order) => !order.isPaid).length}
          </p>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">العميل</th>
                <th className="p-4">الجهاز</th>
                <th className="p-4">المبلغ</th>
                <th className="p-4">حالة الدفع</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">التفاصيل</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-gray-500"
                  >
                    لا توجد فواتير مسجلة حتى الآن.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">
                      {order.invoiceNumber ?? "بدون رقم"}
                    </td>

                    <td className="p-4">
                      <div>{order.service.user.name}</div>
                      <div className="text-xs text-gray-500">
                        {order.service.user.email}
                      </div>
                    </td>

                    <td className="p-4">
                      {order.service.deviceType}
                    </td>

                    <td className="p-4 font-semibold">
                      {formatAmount(order.totalAmount)}
                    </td>

                    <td className="p-4">
                      <span
                        className={
                          order.isPaid
                            ? "rounded-full bg-green-100 px-3 py-1 text-green-700"
                            : "rounded-full bg-red-100 px-3 py-1 text-red-700"
                        }
                      >
                        {order.isPaid ? "مدفوعة" : "غير مدفوعة"}
                      </span>
                    </td>

                    <td className="p-4">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          عرض الفاتورة
                        </Link>

                        <Link
                          href={`/admin/services/${order.service.id}`}
                          className="font-medium text-gray-600 hover:underline"
                        >
                          طلب الصيانة
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
