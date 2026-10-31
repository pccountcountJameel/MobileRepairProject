
import Link from "next/link";
import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import ReportsControls, {
  type ReportExportData,
} from "./ReportsControls";

export const instant = false;

type SearchParams = Promise<{
  from?: string | string[];
  to?: string | string[];
}>;

const statusLabels: Record<string, string> = {
  scheduled: "مجدول",
  assignToTechnican: "بانتظار تعيين فني",
  in_progress: "قيد الصيانة",
  awaiting_parts: "بانتظار قطع الغيار",
  on_hold: "متوقف مؤقتًا",
  ready_for_pickup: "جاهز للاستلام",
  completed: "مكتمل",
  fixed: "تم الإصلاح",
  payment_pending: "بانتظار الدفع",
  dispatched: "تم التسليم",
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("ar", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function parseDate(value?: string | string[]): string {
  if (typeof value !== "string") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return "";
  }

  return value;
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description?: string;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>
      {description && (
        <p className="mt-2 text-xs text-gray-500">
          {description}
        </p>
      )}
    </section>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireRole(["admin", "super_admin"]);

  const params = await searchParams;

  let from = parseDate(params.from);
  let to = parseDate(params.to);

  // تجاهل الفترة كلها إذا كان ترتيب التاريخين غير صحيح.
  if (from && to && from > to) {
    from = "";
    to = "";
  }

  const createdAtFilter =
    from || to
      ? {
          createdAt: {
            ...(from
              ? { gte: new Date(`${from}T00:00:00.000Z`) }
              : {}),
            ...(to
              ? { lte: new Date(`${to}T23:59:59.999Z`) }
              : {}),
          },
        }
      : undefined;

  const [services, orders, spareParts] = await Promise.all([
    prisma.service.findMany({
      where: createdAtFilter,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        deviceType: true,
        status: true,
        technician: true,
        technicianId: true,
        createdAt: true,
        assignedTechnician: {
          select: { name: true },
        },
      },
    }),

    prisma.order.findMany({
      where: createdAtFilter,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        isPaid: true,
        createdAt: true,
        payments: {
          select: { amount: true },
        },
      },
    }),

    // المخزون يعرض الحالة الحالية، ولا يتأثر بفترة التاريخ.
    prisma.sparePart.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        quantityOnHand: true,
        quantityReserved: true,
        minStock: true,
      },
    }),
  ]);

  const statusCounts = new Map<string, number>();

  for (const service of services) {
    statusCounts.set(
      service.status,
      (statusCounts.get(service.status) ?? 0) + 1
    );
  }

  const servicesWithoutTechnician = services.filter(
    (service) =>
      !service.technicianId &&
      !service.technician &&
      !service.assignedTechnician
  ).length;

  let invoiceTotal = 0;
  let paymentsTotal = 0;
  let remainingTotal = 0;
  let invalidInvoices = 0;
  let fullyPaidInvoices = 0;
  let partiallyPaidInvoices = 0;
  let unpaidInvoices = 0;
  let zeroInvoices = 0;

  const invoiceRows = orders.map((order) => {
    const total = order.totalAmount;
    const received = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const valid =
      total !== null &&
      Number.isSafeInteger(total) &&
      total >= 0 &&
      Number.isSafeInteger(received) &&
      received >= 0 &&
      received <= total;

    let label = "بيانات غير متسقة";

    if (valid && total === 0) {
      label = "فاتورة بصفر";
      zeroInvoices++;
    } else if (valid && total !== null) {
      invoiceTotal += total;
      paymentsTotal += received;
      remainingTotal += total - received;

      if (received === total) {
        label = "مسددة بالكامل";
        fullyPaidInvoices++;
      } else if (received > 0) {
        label = "مسددة جزئيًا";
        partiallyPaidInvoices++;
      } else {
        label = "غير مسددة";
        unpaidInvoices++;
      }
    } else {
      invalidInvoices++;
    }

    return {
      ...order,
      received,
      remaining:
        valid && total !== null ? total - received : null,
      valid,
      label,
    };
  });

  const totalsAreSafe =
    Number.isSafeInteger(invoiceTotal) &&
    Number.isSafeInteger(paymentsTotal) &&
    Number.isSafeInteger(remainingTotal);

  const lowStockParts = spareParts.filter(
    (part) =>
      part.quantityOnHand - part.quantityReserved <=
      part.minStock
  );

  const inventoryAvailable = spareParts.reduce(
    (sum, part) =>
      sum + part.quantityOnHand - part.quantityReserved,
    0
  );

  const reservedParts = spareParts.reduce(
    (sum, part) => sum + part.quantityReserved,
    0
  );

  const invalidInventory = spareParts.some(
    (part) =>
      !Number.isSafeInteger(part.quantityOnHand) ||
      !Number.isSafeInteger(part.quantityReserved) ||
      !Number.isSafeInteger(part.minStock) ||
      part.quantityOnHand < 0 ||
      part.quantityReserved < 0 ||
      part.quantityReserved > part.quantityOnHand ||
      part.minStock < 0
  );

  const exportData: ReportExportData = {
    services: services.map((service) => ({
      deviceType: service.deviceType,
      technician:
        service.assignedTechnician?.name ??
        service.technician ??
        "غير معين",
      status: statusLabel(service.status),
      createdAt: service.createdAt.toISOString(),
    })),

    invoices: invoiceRows.map((invoice) => ({
      invoiceNumber: invoice.invoiceNumber ?? "بدون رقم",
      totalAmount: invoice.totalAmount,
      received: invoice.valid ? invoice.received : 0,
      remaining: invoice.remaining,
      status: invoice.label,
      createdAt: invoice.createdAt.toISOString(),
    })),

    inventory: spareParts.map((part) => ({
      code: part.code,
      name: part.name,
      quantityOnHand: part.quantityOnHand,
      quantityReserved: part.quantityReserved,
      available:
        part.quantityOnHand - part.quantityReserved,
      minStock: part.minStock,
    })),
  };

  const recentServices = services.slice(0, 10);
  const recentInvoices = invoiceRows.slice(0, 10);

  return (
    <main
      dir="rtl"
      className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            التقارير
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            ملخص عمليات الصيانة والفواتير والمدفوعات والمخزون.
          </p>
        </div>

        <Link
          href="/admin"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          العودة إلى الإدارة
        </Link>
      </header>

      <ReportsControls
        from={from}
        to={to}
        data={exportData}
      />

      {(from || to) && (
        <p className="text-sm text-gray-600">
          الفترة المطبقة: {from || "من البداية"} —{" "}
          {to || "حتى الآن"}. نتائج الصيانة والفواتير فقط هي التي
          تتأثر بالفترة المحددة.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          تقرير الصيانة
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="إجمالي طلبات الصيانة"
            value={formatAmount(services.length)}
          />
          <SummaryCard
            title="بانتظار تعيين فني"
            value={formatAmount(servicesWithoutTechnician)}
          />
          <SummaryCard
            title="قيد الصيانة"
            value={formatAmount(
              (statusCounts.get("in_progress") ?? 0) +
                (statusCounts.get("awaiting_parts") ?? 0) +
                (statusCounts.get("on_hold") ?? 0)
            )}
          />
          <SummaryCard
            title="جاهز للاستلام أو مكتمل"
            value={formatAmount(
              (statusCounts.get("ready_for_pickup") ?? 0) +
                (statusCounts.get("completed") ?? 0) +
                (statusCounts.get("fixed") ?? 0)
            )}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3">نوع الجهاز</th>
                <th className="p-3">الفني</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">تاريخ الطلب</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentServices.map((service) => (
                <tr key={service.id}>
                  <td className="p-3">{service.deviceType}</td>
                  <td className="p-3">
                    {service.assignedTechnician?.name ??
                      service.technician ??
                      "غير معين"}
                  </td>
                  <td className="p-3">
                    {statusLabel(service.status)}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {formatDate(service.createdAt)}
                  </td>
                </tr>
              ))}
              {recentServices.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-gray-500"
                  >
                    لا توجد طلبات صيانة في هذه الفترة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <h3 className="mb-3 font-semibold">
            توزيع حالات الصيانة
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(statusCounts.entries()).map(
              ([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                >
                  <span>{statusLabel(status)}</span>
                  <span className="font-bold">
                    {formatAmount(count)}
                  </span>
                </div>
              )
            )}
            {statusCounts.size === 0 && (
              <p className="text-sm text-gray-500">
                لا توجد حالات لعرضها.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          تقرير الفواتير والمدفوعات
        </h2>

        {!totalsAreSafe && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
          >
            تعذر اعتماد الإجماليات بسبب تجاوز النطاق العددي الآمن.
            يرجى مراجعة السجلات المالية.
          </p>
        )}

        {invalidInvoices > 0 && (
          <p
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
          >
            توجد {formatAmount(invalidInvoices)} فاتورة ببيانات
            غير متسقة، وقد استُبعدت من إجماليات التقرير.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="إجمالي قيم الفواتير السليمة"
            value={totalsAreSafe ? formatAmount(invoiceTotal) : "—"}
            description="يشمل الفواتير ذات الإجمالي الأكبر من صفر"
          />
          <SummaryCard
            title="إجمالي المدفوعات المسجلة"
            value={totalsAreSafe ? formatAmount(paymentsTotal) : "—"}
          />
          <SummaryCard
            title="إجمالي المبالغ المتبقية"
            value={totalsAreSafe ? formatAmount(remainingTotal) : "—"}
          />
          <SummaryCard
            title="مسددة بالكامل"
            value={formatAmount(fullyPaidInvoices)}
          />
          <SummaryCard
            title="مسددة جزئيًا"
            value={formatAmount(partiallyPaidInvoices)}
          />
          <SummaryCard
            title="غير مسددة"
            value={formatAmount(unpaidInvoices)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">الإجمالي</th>
                <th className="p-3">المدفوع</th>
                <th className="p-3">المتبقي</th>
                <th className="p-3">الحالة المالية</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="whitespace-nowrap p-3">
                    {invoice.invoiceNumber ?? "بدون رقم"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {invoice.totalAmount !== null &&
                    Number.isSafeInteger(invoice.totalAmount) &&
                    invoice.totalAmount >= 0
                      ? formatAmount(invoice.totalAmount)
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {invoice.valid
                      ? formatAmount(invoice.received)
                      : "—"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {invoice.remaining !== null
                      ? formatAmount(invoice.remaining)
                      : "—"}
                  </td>
                  <td className="p-3">{invoice.label}</td>
                  <td className="whitespace-nowrap p-3">
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/orders/${encodeURIComponent(invoice.id)}`}
                      className="text-blue-700 underline hover:text-blue-900"
                    >
                      فتح الفاتورة
                    </Link>
                  </td>
                </tr>
              ))}
              {recentInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-gray-500"
                  >
                    لا توجد فواتير في هذه الفترة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          عدد الفواتير ذات الإجمالي صفر: {formatAmount(zeroInvoices)}.
          حالة isPaid ليست بديلًا عن حساب الدفعات الفعلية.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">
          تقرير المخزون
        </h2>

        {invalidInventory && (
          <p
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
          >
            توجد كميات مخزون غير متسقة. راجع سجلات القطع قبل الاعتماد
            على الإجماليات.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            title="أصناف المخزون النشطة"
            value={formatAmount(spareParts.length)}
          />
          <SummaryCard
            title="مجموع الكميات المتاحة"
            value={invalidInventory ? "—" : formatAmount(inventoryAvailable)}
            description="الكميات الموجودة ناقص الكميات المحجوزة"
          />
          <SummaryCard
            title="مجموع الكميات المحجوزة"
            value={invalidInventory ? "—" : formatAmount(reservedParts)}
          />
          <SummaryCard
            title="أصناف عند الحد الأدنى أو أقل"
            value={formatAmount(lowStockParts.length)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="p-3">رمز القطعة</th>
                <th className="p-3">اسم القطعة</th>
                <th className="p-3">الموجود</th>
                <th className="p-3">المحجوز</th>
                <th className="p-3">المتاح</th>
                <th className="p-3">الحد الأدنى</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lowStockParts.map((part) => (
                <tr key={part.id}>
                  <td className="p-3">{part.code}</td>
                  <td className="p-3">{part.name}</td>
                  <td className="p-3">
                    {formatAmount(part.quantityOnHand)}
                  </td>
                  <td className="p-3">
                    {formatAmount(part.quantityReserved)}
                  </td>
                  <td className="p-3 font-semibold text-amber-700">
                    {formatAmount(
                      part.quantityOnHand - part.quantityReserved
                    )}
                  </td>
                  <td className="p-3">
                    {formatAmount(part.minStock)}
                  </td>
                </tr>
              ))}
              {lowStockParts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-gray-500"
                  >
                    لا توجد أصناف عند الحد الأدنى أو أقل.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/finance"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            فتح صفحة المالية
          </Link>
          <Link
            href="/admin/inventory"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            فتح إدارة المخزون
          </Link>
        </div>
      </section>

      <footer className="border-t pt-4 text-xs text-gray-500">
        يعرض التقرير أحدث عشرة طلبات صيانة وفواتير في الجداول،
        بينما يشمل التصدير جميع النتائج المطابقة للفترة المحددة.
        لا يغيّر التقرير بيانات النظام.
      </footer>
    </main>
  );
}
