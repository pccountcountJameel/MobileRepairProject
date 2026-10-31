
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PaymentItem = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
};

type Props = {
  orderId: string;
  totalAmount: number;
  initialPayments: PaymentItem[];
};

const paymentMethods = [
  { value: "cash", label: "نقدًا" },
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "card", label: "بطاقة" },
  { value: "other", label: "أخرى" },
];

const methodLabels: Record<string, string> = {
  cash: "نقدًا",
  bank_transfer: "تحويل بنكي",
  card: "بطاقة",
  other: "أخرى",
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("ar").format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isValidPayment(payment: PaymentItem) {
  return (
    typeof payment.id === "string" &&
    Number.isSafeInteger(payment.amount) &&
    payment.amount > 0 &&
    typeof payment.method === "string" &&
    (payment.reference === null ||
      typeof payment.reference === "string") &&
    (payment.note === null ||
      typeof payment.note === "string") &&
    typeof payment.createdAt === "string" &&
    !Number.isNaN(Date.parse(payment.createdAt))
  );
}

export default function PaymentSection({
  orderId,
  totalAmount,
  initialPayments,
}: Props) {
  const router = useRouter();

  const [payments, setPayments] = useState(initialPayments);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validTotal =
    Number.isSafeInteger(totalAmount) && totalAmount >= 0;

  const validPayments = payments.every(isValidPayment);

  const totalPaid = validPayments
    ? payments.reduce((sum, payment) => sum + payment.amount, 0)
    : 0;

  const validPaidTotal = Number.isSafeInteger(totalPaid);

  const financialDataValid =
    validTotal &&
    validPayments &&
    validPaidTotal &&
    totalPaid <= totalAmount;

  const remaining = financialDataValid
    ? totalAmount - totalPaid
    : 0;

  const isZeroInvoice = validTotal && totalAmount === 0;

  const isPaid =
    financialDataValid &&
    totalAmount > 0 &&
    remaining === 0;

  async function submitPayment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!financialDataValid) {
      setError(
        "بيانات الفاتورة أو الدفعات غير متسقة. راجع السجلات المالية قبل المتابعة."
      );
      return;
    }

    if (totalAmount === 0) {
      setError("هذه الفاتورة لا تحتاج إلى دفعة.");
      return;
    }

    if (remaining <= 0) {
      setError("لا يوجد مبلغ متبقٍ للتحصيل.");
      return;
    }

    const parsedAmount = Number(amount);

    if (
      !Number.isSafeInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setError("أدخل مبلغًا صحيحًا أكبر من صفر.");
      return;
    }

    if (parsedAmount > remaining) {
      setError("المبلغ أكبر من الرصيد المتبقي.");
      return;
    }

    if (!paymentMethods.some((item) => item.value === method)) {
      setError("اختر طريقة دفع صحيحة.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: parsedAmount,
            method,
            reference: reference.trim() || null,
            note: note.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "تعذر تسجيل الدفعة."
        );
      }

      const payment = result.payment as PaymentItem;

      if (!payment || !isValidPayment(payment)) {
        throw new Error(
          "استجاب الخادم ببيانات دفعة غير متوقعة. حدّث الصفحة للتحقق من الحالة."
        );
      }

      setPayments((current) => [payment, ...current]);
      setAmount("");
      setReference("");
      setNote("");
      setMessage("تم تسجيل الدفعة بنجاح.");

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تسجيل الدفعة."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6 rounded-xl border bg-white p-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          الدفعات
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-500">
              إجمالي الفاتورة
            </p>
            <p className="mt-1 text-lg font-bold">
              {validTotal ? formatAmount(totalAmount) : "—"}
            </p>
          </div>

          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-sm text-gray-500">
              المبلغ المدفوع
            </p>
            <p className="mt-1 text-lg font-bold text-green-700">
              {financialDataValid ? formatAmount(totalPaid) : "—"}
            </p>
          </div>

          <div className="rounded-lg bg-amber-50 p-4">
            <p className="text-sm text-gray-500">
              المبلغ المتبقي
            </p>
            <p className="mt-1 text-lg font-bold text-amber-700">
              {financialDataValid ? formatAmount(remaining) : "—"}
            </p>
          </div>
        </div>
      </div>

      {!financialDataValid ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800"
        >
          بيانات الفاتورة أو الدفعات غير متسقة. تم تعطيل تسجيل
          دفعات جديدة حتى تتم مراجعة السجلات المالية.
        </div>
      ) : isZeroInvoice ? (
        <p className="rounded-lg bg-gray-50 p-4 text-gray-700">
          إجمالي هذه الفاتورة صفر؛ لا تحتاج إلى تسجيل دفعة.
        </p>
      ) : isPaid ? (
        <p className="rounded-lg bg-green-50 p-4 text-green-800">
          تم سداد الفاتورة بالكامل.
        </p>
      ) : (
        <form onSubmit={submitPayment} className="space-y-4">
          <h3 className="font-bold text-gray-800">
            تسجيل دفعة جديدة
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block">مبلغ الدفعة</span>
              <input
                type="number"
                min="1"
                max={remaining}
                step="1"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-lg border p-3"
                disabled={loading}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block">طريقة الدفع</span>
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="w-full rounded-lg border p-3"
                disabled={loading}
              >
                {paymentMethods.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block">
                مرجع الدفع (اختياري)
              </span>
              <input
                type="text"
                maxLength={200}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="w-full rounded-lg border p-3"
                disabled={loading}
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block">
                ملاحظات (اختياري)
              </span>
              <textarea
                maxLength={1000}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-lg border p-3"
                disabled={loading}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p role="status" className="text-sm text-green-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || remaining <= 0}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "جارٍ التسجيل..." : "تسجيل الدفعة"}
          </button>

          <p className="text-xs text-gray-500">
            يسجل هذا الإجراء دفعة مستلمة بالفعل؛ لا ينفذ خصمًا
            من بطاقة ولا يتصل ببوابة دفع.
          </p>
        </form>
      )}

      {error && !financialDataValid && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {message && !isPaid && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}

      <div>
        <h3 className="mb-3 font-bold text-gray-800">
          سجل الدفعات
        </h3>

        {payments.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
            لا توجد دفعات مسجلة لهذه الفاتورة.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المبلغ</th>
                  <th className="p-3">الطريقة</th>
                  <th className="p-3">المرجع والملاحظات</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="whitespace-nowrap p-3">
                      {formatDate(payment.createdAt)}
                    </td>

                    <td className="whitespace-nowrap p-3 font-semibold">
                      {formatAmount(payment.amount)}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {methodLabels[payment.method] ?? payment.method}
                    </td>

                    <td className="p-3">
                      {payment.reference && (
                        <p>المرجع: {payment.reference}</p>
                      )}

                      {payment.note && (
                        <p className="mt-1 text-gray-500">
                          {payment.note}
                        </p>
                      )}

                      {!payment.reference && !payment.note && "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
