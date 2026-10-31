
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const statuses = [
  { value: "scheduled", label: "تمت الجدولة" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "awaiting_parts", label: "بانتظار قطع الغيار" },
  { value: "on_hold", label: "معلّق" },
  { value: "ready_for_pickup", label: "جاهز للاستلام" },
  { value: "completed", label: "مكتمل" },
  { value: "fixed", label: "تم الإصلاح" },
  { value: "payment_pending", label: "بانتظار الدفع" },
  { value: "dispatched", label: "تم التسليم" },
  { value: "assignToTechnican", label: "تعيين فني" },
];

type Props = {
  serviceId: string;
  currentStatus: string;
};

export default function ServiceStatusEditor({
  serviceId,
  currentStatus,
}: Props) {
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus);
  const [savedStatus, setSavedStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function saveStatus() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "تعذر تحديث الحالة.");
        return;
      }

      setSavedStatus(status);
      setMessage("تم تحديث الحالة بنجاح.");

      // تحديث بيانات الصفحة بعد حفظ الحالة
      router.refresh();
    } catch {
      setMessage("حدث خطأ في الاتصال بالخادم.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          setMessage("");
        }}
        disabled={saving}
        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900"
      >
        {statuses.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={saveStatus}
        disabled={saving || status === savedStatus}
        className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "جارٍ الحفظ..." : "حفظ الحالة"}
      </button>

      {message && (
        <p className="text-sm" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
