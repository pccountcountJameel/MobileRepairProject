
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import PrintButton from "./PrintButton";
import PaymentSection from "./PaymentSection";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

function formatAmount(amount: number | null) {
  return new Intl.NumberFormat("ar").format(amount ?? 0);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default async function InvoicePage({ params }: Props) {
  await requireRole(["admin", "super_admin"]);

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          method: true,
          reference: true,
          note: true,
          createdAt: true,
        },
      },
      service: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              address: true,
            },
          },
          assignedTechnician: {
            select: {
              name: true,
              phone: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const totalPaid = order.payments.reduce(
    (sum, payment) => sum + payment.amount,
    0
  );

  const totalAmount = order.totalAmount ?? 0;
  const remainingAmount = Math.max(0, totalAmount - totalPaid);
  const isPaid = remainingAmount === 0 && totalAmount >= 0;

  return (
    <main dir="rtl" className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/orders"
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-800 hover:bg-gray-200"
        >
          العودة إلى الفواتير
        </Link>

        <PrintButton />
      </div>

      <article className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              فاتورة صيانة
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              رقم الفاتورة: {order.invoiceNumber || "غير محدد"}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              تاريخ الإصدار: {formatDate(order.createdAt)}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">حالة الدفع</p>

            <p
              className={`mt-1 font-bold ${
                isPaid ? "text-green-700" : "text-red-700"
              }`}
            >
              {isPaid ? "مدفوعة بالكامل" : totalPaid > 0 ? "مدفوعة جزئيًا" : "غير مدفوعة"}
            </p>
          </div>
        </header>

        <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
          <div>
            <h2 className="mb-3 font-bold text-gray-900">
              بيانات العميل
            </h2>

            <p className="text-gray-700">
              {order.service.user.name}
            </p>

            <p className="mt-1 break-all text-sm text-gray-500">
              {order.service.user.email}
            </p>

            {order.service.user.address && (
              <p className="mt-1 text-sm text-gray-500">
                {order.service.user.address}
              </p>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-bold text-gray-900">
              بيانات الجهاز
            </h2>

            <p className="text-gray-700">
              {order.service.deviceType}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              رقم طلب الصيانة: {order.service.id}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              الفني:{" "}
              {order.service.assignedTechnician?.name ??
                order.service.technician ??
                "لم يتم التعيين"}
            </p>
          </div>
        </section>

        <section className="py-6">
          <h2 className="mb-4 font-bold text-gray-900">
            تفاصيل الفاتورة
          </h2>

          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3">الوصف</th>
                <th className="p-3">المبلغ</th>
              </tr>
            </thead>

            <tbody>
              <tr className="border-b">
                <td className="p-3">تكاليف صيانة الجهاز</td>
                <td className="p-3 font-medium">
                  {formatAmount(order.totalAmount)}
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <td className="p-3 text-base font-bold">
                  الإجمالي
                </td>
                <td className="p-3 text-base font-bold">
                  {formatAmount(order.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-8 border-t pt-5 text-center text-sm text-gray-500">
            شكرًا لثقتكم بنا.
          </p>
        </section>
      </article>

      <div className="print:hidden">
        <PaymentSection
          orderId={order.id}
          totalAmount={totalAmount}
          initialPayments={order.payments.map((payment) => ({
            ...payment,
            createdAt: payment.createdAt.toISOString(),
          }))}
        />
      </div>
    </main>
  );
}
