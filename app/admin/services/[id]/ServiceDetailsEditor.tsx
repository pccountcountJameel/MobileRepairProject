
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const statusOptions = [
  { value: "scheduled", label: "تمت الجدولة" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "awaiting_parts", label: "بانتظار قطع الغيار" },
  { value: "on_hold", label: "معلّق" },
  { value: "ready_for_pickup", label: "جاهز للاستلام" },
  { value: "completed", label: "مكتمل" },
  { value: "fixed", label: "تم الإصلاح" },
  { value: "payment_pending", label: "بانتظار الدفع" },
  { value: "dispatched", label: "تم التسليم" },
  { value: "assignToTechnican", label: "بانتظار تعيين فني" },
];

type Technician = {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
};

type Props = {
  serviceId: string;
  initialStatus: string;
  initialTechnician: string;
  initialTechnicianId?: string | null;
};

export default function ServiceDetailsEditor({
  serviceId,
  initialStatus,
  initialTechnician,
  initialTechnicianId = null,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState(initialStatus);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianId, setTechnicianId] = useState(
    initialTechnicianId || ""
  );
  const [loadingTechnicians, setLoadingTechnicians] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success"
  );
  const [saving, setSaving] = useState(false);

  const loadTechnicians = useCallback(async () => {
    setLoadingTechnicians(true);

    try {
      const response = await fetch("/api/technicians", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "تعذر تحميل قائمة الفنيين.");
      }

      const list: Technician[] = Array.isArray(result.technicians)
        ? result.technicians
        : [];

      setTechnicians(list);

      // استخدام المعرّف أولًا، والاسم كخيار احتياطي للبيانات القديمة.
      const currentTechnician =
        list.find((item) => item.id === initialTechnicianId) ||
        list.find((item) => item.name === initialTechnician);

      if (currentTechnician) {
        setTechnicianId(currentTechnician.id);
      } else if (initialTechnicianId || initialTechnician) {
        // إذا كان الفني القديم غير موجود في القائمة، لا نغيّر التعيين تلقائيًا.
        setTechnicianId(initialTechnicianId || "");
      } else {
        setTechnicianId("");
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تحميل الفنيين."
      );
      setMessageType("error");
    } finally {
      setLoadingTechnicians(false);
    }
  }, [initialTechnician, initialTechnicianId]);

  useEffect(() => {
    void loadTechnicians();
  }, [loadTechnicians]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          technicianId: technicianId || null,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || "تعذر تحديث طلب الصيانة."
        );
      }

      setMessage("تم تحديث طلب الصيانة بنجاح.");
      setMessageType("success");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر الاتصال بالخادم. حاول مرة أخرى."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  const selectedTechnician = technicians.find(
    (technician) => technician.id === technicianId
  );

  const activeTechnicians = technicians.filter(
    (technician) => technician.isActive
  );

  return (
    <section
      dir="rtl"
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        تحديث طلب الصيانة
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="technicianId"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            الفني المسؤول
          </label>

          <select
            id="technicianId"
            value={technicianId}
            onChange={(event) => setTechnicianId(event.target.value)}
            disabled={loadingTechnicians || saving}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">بدون فني — إلغاء التعيين</option>

            {selectedTechnician && !selectedTechnician.isActive && (
              <option value={selectedTechnician.id}>
                {selectedTechnician.name} — غير نشط (تعيين سابق)
              </option>
            )}

            {activeTechnicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}
                {technician.specialty
                  ? ` — ${technician.specialty}`
                  : ""}
              </option>
            ))}
          </select>

          {selectedTechnician && !selectedTechnician.isActive && (
            <p className="mt-2 text-sm text-amber-700">
              هذا الفني غير نشط. يمكنك الإبقاء على التعيين السابق أو إزالته،
              لكن لا يمكن تعيينه من جديد.
            </p>
          )}

          {loadingTechnicians && (
            <p className="mt-2 text-sm text-gray-500">
              جارٍ تحميل الفنيين...
            </p>
          )}

          {!loadingTechnicians && activeTechnicians.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              لا يوجد فنيون نشطون حاليًا.
            </p>
          )}

          {!loadingTechnicians && technicians.length > 0 && (
            <button
              type="button"
              onClick={() => void loadTechnicians()}
              disabled={saving}
              className="mt-2 text-sm text-blue-700 underline disabled:opacity-50"
            >
              تحديث قائمة الفنيين
            </button>
          )}
        </div>

        <div>
          <label
            htmlFor="status"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            حالة الصيانة
          </label>

          <select
            id="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={saving}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-blue-500 disabled:bg-gray-100"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <p
            role={messageType === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`text-sm ${
              messageType === "error"
                ? "text-red-600"
                : "text-green-700"
            }`}
          >
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || loadingTechnicians}
          className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
        </button>
      </form>
    </section>
  );
}
