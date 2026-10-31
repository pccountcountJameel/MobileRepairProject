
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  serviceId: string;
  existingInvoice: boolean;
  quoteStatus: string;
  quoteAmount: number | null;
};

export default function CreateInvoiceButton({
  serviceId,
  existingInvoice,
  quoteStatus,
  quoteAmount,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canCreateInvoice =
    !existingInvoice &&
    quoteStatus === "approved" &&
    quoteAmount !== null &&
    Number.isSafeInteger(quoteAmount) &&
    quoteAmount >= 0;

  async function createInvoice() {
    if (!canCreateInvoice || loading) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceId,
          totalAmount: quoteAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error ?? "تعذر إنشاء الفاتورة."
        );
        return;
      }

      setMessage("تم إنشاء الفاتورة بنجاح.");
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }

  if (existingInvoice) {
    return (
      <p className="text-sm font-medium text-green-700">
        توجد فاتورة مرتبطة بطلب الصيانة هذا.
      </p>
    );
  }

  if (quoteStatus !== "approved" || quoteAmount === null) {
    return (
      <p className="text-sm text-amber-700">
        لا يمكن إنشاء الفاتورة قبل موافقة العميل على عرض السعر.
      </p>
    );
  }

  if (
    !Number.isSafeInteger(quoteAmount) ||
    quoteAmount < 0
  ) {
    return (
      <p className="text-sm text-red-600">
        مبلغ عرض السعر غير صالح. تحقق من بيانات الطلب.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm text-gray-500">
          المبلغ المعتمد من العميل
        </p>
        <p className="mt-1 text-xl font-bold text-gray-900">
          {new Intl.NumberFormat("ar").format(quoteAmount)}
        </p>
      </div>

      <button
        type="button"
        onClick={createInvoice}
        disabled={loading || !canCreateInvoice}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "جارٍ إنشاء الفاتورة..." : "إنشاء الفاتورة"}
      </button>

      {message && (
        <p role="status" className="text-sm text-gray-700">
          {message}
        </p>
      )}
    </div>
  );
}
