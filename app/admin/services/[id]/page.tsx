
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import ServiceDetailsEditor from "./ServiceDetailsEditor";
import ServicePartsManager from "./ServicePartsManager";
import CreateInvoiceButton from "./CreateInvoiceButton";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

const statusLabels: Record<string, string> = {
  scheduled: "تمت الجدولة",
  in_progress: "قيد التنفيذ",
  awaiting_parts: "بانتظار قطع الغيار",
  on_hold: "معلّق",
  ready_for_pickup: "جاهز للاستلام",
  completed: "مكتمل",
  fixed: "تم الإصلاح",
  payment_pending: "بانتظار الدفع",
  dispatched: "تم التسليم",
  assignToTechnican: "بانتظار تعيين فني",
};

const quoteStatusLabels: Record<string, string> = {
  not_requested: "لم يُطلب عرض سعر",
  pending: "بانتظار الموافقة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "غير محدد";

  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatAmount(amount: number | null | undefined) {
  return new Intl.NumberFormat("ar").format(amount ?? 0);
}

export default async function ServiceDetailsPage({ params }: Props) {
  await requireRole(["admin", "super_admin"]);

  const { id } = await params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedTechnician: {
        select: {
          id: true,
          name: true,
          phone: true,
          specialty: true,
          isActive: true,
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!service) {
    notFound();
  }

  const existingOrder = await prisma.order.findUnique({
    where: { serviceId: service.id },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      isPaid: true,
    },
  });

  const technician = service.assignedTechnician;

  const technicianStats = technician
    ? await prisma.service.groupBy({
        by: ["status"],
        where: {
          technicianId: technician.id,
        },
        _count: {
          _all: true,
        },
      })
    : [];

  const counts = {
    total: 0,
    inProgress: 0,
    readyForPickup: 0,
    completed: 0,
  };

  for (const group of technicianStats) {
    const count = group._count._all;

    counts.total += count;

    if (group.status === "in_progress") {
      counts.inProgress = count;
    } else if (group.status === "ready_for_pickup") {
      counts.readyForPickup = count;
    } else if (group.status === "completed") {
      counts.completed = count;
    }
  }

  const technicianName =
    technician?.name || service.technician || "لم يتم التعيين";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            تفاصيل طلب الصيانة
          </h1>
          <p className="mt-2 break-all text-sm text-gray-500">
            رقم الطلب: {service.id}
          </p>
        </div>

        <Link
          href="/admin/services"
          className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-800 hover:bg-gray-300"
        >
          العودة إلى الطلبات
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          معلومات الطلب
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">نوع الجهاز</p>
            <p className="mt-1 font-medium text-gray-900">
              {service.deviceType || "غير محدد"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">حالة الطلب</p>
            <p className="mt-1 font-medium text-gray-900">
              {statusLabels[service.status] || service.status}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">رقم التتبع</p>
            <p className="mt-1 break-all font-medium text-gray-900" dir="ltr">
              {service.trackingNumber || "لم يتم إنشاء رقم تتبع"}
            </p>

            {service.trackingNumber && (
              <Link
                href="/track"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                فتح صفحة تتبع العميل
              </Link>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-500">موعد الصيانة</p>
            <p className="mt-1 text-gray-900">
              {formatDate(service.appointment_date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">تاريخ إنشاء الطلب</p>
            <p className="mt-1 text-gray-900">
              {formatDate(service.createdAt)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">آخر تحديث</p>
            <p className="mt-1 text-gray-900">
              {formatDate(service.updatedAt)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">الفني المسؤول</p>
            <p className="mt-1 font-medium text-gray-900">
              {technicianName}
            </p>

            {technician?.specialty && (
              <p className="mt-1 text-sm text-gray-500">
                التخصص: {technician.specialty}
              </p>
            )}

            {technician?.phone && (
              <p className="mt-1 text-sm text-gray-500">
                الهاتف: {technician.phone}
              </p>
            )}

            {technician && !technician.isActive && (
              <p className="mt-1 text-sm text-amber-700">
                هذا الفني غير نشط حاليًا.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-500">وصف العطل</p>
          <p className="mt-2 whitespace-pre-wrap text-gray-900">
            {service.issueDescription || "لا يوجد وصف"}
          </p>
        </div>

        {service.deviceIssue && (
          <div className="mt-4">
            <p className="text-sm text-gray-500">
              تفاصيل إضافية للعطل
            </p>
            <p className="mt-2 whitespace-pre-wrap text-gray-900">
              {service.deviceIssue}
            </p>
          </div>
        )}
      </section>

      {technician && (
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            إحصائيات الفني المسؤول
          </h2>

          <p className="mb-4 text-sm text-gray-500">
            عدد الطلبات المسندة إلى {technician.name} حسب الحالة الحالية.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">إجمالي الطلبات</p>
              <p className="mt-2 text-2xl font-bold text-blue-900">
                {counts.total}
              </p>
            </div>

            <div className="rounded-lg bg-amber-50 p-4">
              <p className="text-sm text-amber-800">قيد التنفيذ</p>
              <p className="mt-2 text-2xl font-bold text-amber-900">
                {counts.inProgress}
              </p>
            </div>

            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm text-purple-800">جاهزة للاستلام</p>
              <p className="mt-2 text-2xl font-bold text-purple-900">
                {counts.readyForPickup}
              </p>
            </div>

            <div className="rounded-lg bg-green-50 p-4">
              <p className="text-sm text-green-800">مكتملة</p>
              <p className="mt-2 text-2xl font-bold text-green-900">
                {counts.completed}
              </p>
            </div>
          </div>
        </section>
      )}

      <ServiceDetailsEditor
        serviceId={service.id}
        initialStatus={service.status}
        initialTechnician={technicianName}
        initialTechnicianId={service.technicianId}
      />

      <ServicePartsManager serviceId={service.id} />

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">
            سجل تغييرات الحالة
          </h2>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">
            {service.statusHistory.length} تغيير
          </span>
        </div>

        {service.statusHistory.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            لا توجد تغييرات مسجلة لهذه الخدمة حتى الآن.
          </p>
        ) : (
          <ol className="space-y-4">
            {service.statusHistory.map((entry) => (
              <li
                key={entry.id}
                className="relative rounded-lg border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {statusLabels[entry.status] || entry.status}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      تاريخ التغيير: {formatDate(entry.createdAt)}
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    حالة مسجلة
                  </span>
                </div>

                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-sm text-gray-500">الملاحظة</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                    {entry.note || "لا توجد ملاحظة"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          معلومات العميل
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">اسم العميل</p>
            <p className="mt-1 text-gray-900">
              {service.user?.name || "غير متوفر"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">البريد الإلكتروني</p>
            <p className="mt-1 break-all text-gray-900">
              {service.user?.email || "غير متوفر"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          معلومات الاستلام والدفع
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">موعد الانتهاء المتوقع</p>
            <p className="mt-1 text-gray-900">
              {formatDate(service.estimated_completion_time)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">تاريخ الاستلام</p>
            <p className="mt-1 text-gray-900">
              {formatDate(service.pickup_date)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">حالة الدفع في طلب الصيانة</p>
            <p className="mt-1 text-gray-900">
              {service.isPaid ? "تم الدفع" : "لم يتم الدفع"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">حالة الإصلاح</p>
            <p className="mt-1 text-gray-900">
              {service.isFixed ? "تم الإصلاح" : "لم يكتمل الإصلاح"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">جاهزية الجهاز</p>
            <p className="mt-1 text-gray-900">
              {service.isReady ? "جاهز" : "غير جاهز"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">قيمة عرض السعر</p>
            <p className="mt-1 text-gray-900">
              {service.quoteAmount == null
                ? "لم يُحدّد"
                : formatAmount(service.quoteAmount)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">حالة عرض السعر</p>
            <p className="mt-1 text-gray-900">
              {quoteStatusLabels[service.quoteStatus] ||
                service.quoteStatus}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          فاتورة طلب الصيانة
        </h2>

        {existingOrder && (
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-gray-500">رقم الفاتورة</p>
              <p className="mt-1 break-all font-medium text-gray-900">
                {existingOrder.invoiceNumber || "غير محدد"}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">إجمالي المبلغ</p>
              <p className="mt-1 font-medium text-gray-900">
                {formatAmount(existingOrder.totalAmount)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500">حالة الفاتورة</p>
              <p className="mt-1 font-medium text-gray-900">
                {existingOrder.isPaid ? "مدفوعة" : "غير مدفوعة"}
              </p>
            </div>
          </div>
        )}

        <CreateInvoiceButton
          serviceId={service.id}
          existingInvoice={Boolean(existingOrder)}
          quoteStatus={service.quoteStatus}
          quoteAmount={service.quoteAmount}
        />
      </section>
    </main>
  );
}
