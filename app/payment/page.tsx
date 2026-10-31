"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentPage() {
  const router = useRouter();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePayment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    const normalizedTrackingNumber =
      trackingNumber.trim().toUpperCase();
    const normalizedTrackingToken = trackingToken.trim();

    if (!normalizedTrackingNumber) {
      setError("يرجى إدخال رقم التتبع.");
      return;
    }

    if (!/^[a-f0-9]{64}$/i.test(normalizedTrackingToken)) {
      setError(
        "جلسة التتبع غير صالحة. ارجع إلى صفحة التتبع وأعد التحقق."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/payments/stripe/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackingNumber: normalizedTrackingNumber,
            trackingToken: normalizedTrackingToken,
          }),
        }
      );

      const result: unknown = await response.json();

      if (
        !response.ok ||
        typeof result !== "object" ||
        result === null ||
        !("url" in result) ||
        typeof result.url !== "string"
      ) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "تعذر بدء عملية الدفع.";

        setError(message);
        return;
      }

      let checkoutUrl: URL;

      try {
        checkoutUrl = new URL(result.url);
      } catch {
        setError("رابط الدفع غير صالح.");
        return;
      }

      if (
        checkoutUrl.protocol !== "https:" ||
        checkoutUrl.hostname !== "checkout.stripe.com"
      ) {
        setError("رابط الدفع غير صالح.");
        return;
      }

      window.location.assign(checkoutUrl.toString());
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-gray-50 px-4 py-12 text-gray-900"
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl">
            🔒
          </div>

          <h1 className="text-2xl font-bold">
            الدفع الإلكتروني
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-600">
            أدخل بيانات جلسة التتبع لبدء دفع فاتورة الصيانة عبر
            Stripe. سيُحدد الخادم مبلغ الفاتورة بعد التحقق منها.
          </p>
        </div>

        <form onSubmit={handlePayment} className="space-y-5">
          <div>
            <label
              htmlFor="trackingNumber"
              className="mb-2 block text-sm font-medium"
            >
              رقم تتبع الصيانة
            </label>

            <input
              id="trackingNumber"
              type="text"
              autoComplete="off"
              required
              maxLength={100}
              value={trackingNumber}
              onChange={(event) =>
                setTrackingNumber(event.target.value)
              }
              placeholder="أدخل رقم التتبع"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="trackingToken"
              className="mb-2 block text-sm font-medium"
            >
              رمز جلسة التتبع
            </label>

            <input
              id="trackingToken"
              type="password"
              autoComplete="off"
              required
              value={trackingToken}
              onChange={(event) =>
                setTrackingToken(event.target.value)
              }
              placeholder="رمز الجلسة الذي أعاده التحقق"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <p className="mt-2 text-xs leading-5 text-gray-500">
              يمكنك الحصول على هذا الرمز بعد التحقق من طلبك في صفحة
              التتبع. لا تشاركه مع الآخرين.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "جارٍ تجهيز الدفع..."
              : "المتابعة إلى الدفع"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/track")}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
          >
            العودة إلى تتبع الصيانة
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-gray-500">
          لا تُدخل بيانات البطاقة في هذه الصفحة. ستنتقل إلى صفحة
          الدفع المستضافة من Stripe عند نجاح التحقق.
        </p>
      </div>
    </main>
  );
}