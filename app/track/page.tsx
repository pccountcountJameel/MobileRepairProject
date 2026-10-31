
"use client";

import { useState, type FormEvent } from "react";

type StatusHistory = {
  status: string;
  note: string | null;
  createdAt: string;
};

type QuoteStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

type PartRequirement = {
  id: string;
  name: string;
  code: string | null;
  quantityRequired: number;
  quantityReserved: number;
  status:
    | "requested"
    | "unavailable"
    | "partially_reserved"
    | "reserved";
};

type ServiceData = {
  trackingNumber: string | null;
  deviceType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  estimatedCompletionTime: string | null;
  pickupDate: string | null;
  quoteAmount: string | null;
  quoteStatus: QuoteStatus;
  statusHistory: StatusHistory[];
  partRequirements: PartRequirement[];
};

type QuoteDecision = "approved" | "rejected";
type DeliveryMethod = "email" | "whatsapp";
type Step = "request" | "verify" | "details";

const statusLabels: Record<string, string> = {
  scheduled: "تم استلام الطلب",
  in_progress: "الجهاز قيد الصيانة",
  awaiting_parts: "بانتظار قطع الغيار",
  on_hold: "الصيانة متوقفة مؤقتًا",
  ready_for_pickup: "الجهاز جاهز للاستلام",
  completed: "اكتملت الصيانة",
  fixed: "تم إصلاح الجهاز",
  payment_pending: "بانتظار الدفع",
  dispatched: "تم تسليم الجهاز للشحن",
  assignToTechnican: "بانتظار تعيين فني",
};

const quoteStatusLabels: Record<QuoteStatus, string> = {
  not_requested: "لم يُطلب عرض سعر",
  pending: "بانتظار موافقتك",
  approved: "تمت الموافقة على عرض السعر",
  rejected: "تم رفض عرض السعر",
};

const partStatusLabels: Record<
  PartRequirement["status"],
  { label: string; className: string }
> = {
  requested: {
    label: "بانتظار الحجز",
    className: "bg-slate-100 text-slate-700",
  },
  reserved: {
    label: "محجوزة بالكامل",
    className: "bg-green-100 text-green-800",
  },
  partially_reserved: {
    label: "محجوزة جزئيًا",
    className: "bg-amber-100 text-amber-800",
  },
  unavailable: {
    label: "غير متوفرة",
    className: "bg-red-100 text-red-800",
  },
};

function formatDate(value: string | null) {
  if (!value) return "لم يُحدّد بعد";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "غير متاح";

  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function TrackPage() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("email");
  const [code, setCode] = useState("");
  const [trackingToken, setTrackingToken] = useState("");
  const [step, setStep] = useState<Step>("request");
  const [service, setService] = useState<ServiceData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [decisionLoading, setDecisionLoading] =
    useState<QuoteDecision | null>(null);

  async function requestOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const number = trackingNumber.trim().toUpperCase();

    if (!number || number.length > 100) {
      setError("يرجى إدخال رقم تتبع صحيح.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    setService(null);
    setTrackingToken("");
    setCode("");

    try {
      const response = await fetch("/api/services/track/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: number,
          method: deliveryMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر طلب رمز التحقق.");
      }

      setTrackingNumber(number);
      setStep("verify");
      setNotice(
        data.message ||
          "إذا كان الطلب مؤهلًا للتحقق، فسيتم إرسال رمز التحقق عبر الوسيلة المختارة."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء طلب رمز التحقق."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const number = trackingNumber.trim().toUpperCase();
    const cleanCode = code.replace(/\D/g, "");

    if (!/^\d{6}$/.test(cleanCode)) {
      setError("يرجى إدخال رمز التحقق المكوّن من 6 أرقام.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/services/track/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: number,
          code: cleanCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر التحقق من الرمز.");
      }

      if (
        typeof data.trackingToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(data.trackingToken)
      ) {
        throw new Error("استجابة التحقق غير صالحة. حاول مجددًا.");
      }

      setTrackingToken(data.trackingToken);

      const trackResponse = await fetch("/api/services/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: number,
          trackingToken: data.trackingToken,
        }),
      });

      const trackData = await trackResponse.json();

      if (!trackResponse.ok) {
        setTrackingToken("");
        throw new Error(
          trackData.error || "تعذر تحميل بيانات طلب الصيانة."
        );
      }

      setService({
        ...trackData.service,
        partRequirements: trackData.service.partRequirements ?? [],
      } as ServiceData);

      setStep("details");
      setNotice("تم التحقق بنجاح.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء التحقق. حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleQuoteDecision(decision: QuoteDecision) {
    if (!service || !trackingToken || decisionLoading || loading) return;

    const confirmed = window.confirm(
      decision === "approved"
        ? "هل أنت متأكد من الموافقة على عرض سعر الإصلاح؟ لا يمكن تغيير القرار بعد تسجيله."
        : "هل أنت متأكد من رفض عرض سعر الإصلاح؟ لا يمكن تغيير القرار بعد تسجيله."
    );

    if (!confirmed) return;

    setDecisionLoading(decision);
    setError("");
    setNotice("");

    const number =
      service.trackingNumber || trackingNumber.trim().toUpperCase();

    try {
      const response = await fetch("/api/services/track/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: number,
          trackingToken,
          decision,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "تعذر تسجيل قرار عرض السعر."
        );
      }

      setNotice(data.message || "تم تسجيل القرار بنجاح.");

      const refreshResponse = await fetch("/api/services/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: number,
          trackingToken,
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        throw new Error(
          refreshData.error || "تم تسجيل القرار، لكن تعذر تحديث البيانات."
        );
      }

      setService({
        ...refreshData.service,
        partRequirements: refreshData.service.partRequirements ?? [],
      } as ServiceData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تسجيل القرار."
      );
    } finally {
      setDecisionLoading(null);
    }
  }

  function startOver() {
    setCode("");
    setTrackingToken("");
    setService(null);
    setError("");
    setNotice("");
    setStep("request");
    setDeliveryMethod("email");
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800 sm:py-16"
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white shadow-lg">
            🔧
          </div>

          <h1 className="text-3xl font-bold sm:text-4xl">
            تتبّع طلب الصيانة
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            أدخل رقم التتبع واختر طريقة استلام رمز التحقق، ثم تابع حالة طلب الصيانة.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {step === "request" && (
            <form onSubmit={requestOtp} className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-semibold">
                  اختر طريقة إرسال رمز التحقق
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("email")}
                    disabled={loading}
                    aria-pressed={deliveryMethod === "email"}
                    className={`rounded-xl border-2 p-4 text-right transition disabled:opacity-60 ${
                      deliveryMethod === "email"
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-2xl">📧</div>
                    <p className="mt-2 font-bold">البريد الإلكتروني</p>
                    <p className="mt-1 text-xs text-slate-500">
                      إرسال الرمز عبر SendGrid
                    </p>

                    {deliveryMethod === "email" && (
                      <p className="mt-2 text-sm font-semibold text-blue-700">
                        ✓ تم الاختيار
                      </p>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("whatsapp")}
                    disabled={loading}
                    aria-pressed={deliveryMethod === "whatsapp"}
                    className={`rounded-xl border-2 p-4 text-right transition disabled:opacity-60 ${
                      deliveryMethod === "whatsapp"
                        ? "border-green-600 bg-green-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-2xl">💬</div>
                    <p className="mt-2 font-bold">WhatsApp</p>
                    <p className="mt-1 text-xs text-slate-500">
                      إرسال الرمز عبر Twilio
                    </p>

                    {deliveryMethod === "whatsapp" && (
                      <p className="mt-2 text-sm font-semibold text-green-700">
                        ✓ تم الاختيار
                      </p>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="trackingNumber"
                  className="mb-2 block text-sm font-semibold"
                >
                  رقم التتبع
                </label>

                <input
                  id="trackingNumber"
                  type="text"
                  value={trackingNumber}
                  onChange={(event) =>
                    setTrackingNumber(event.target.value)
                  }
                  placeholder="مثال: MR-XXXXXXXX"
                  autoComplete="off"
                  maxLength={100}
                  required
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-left outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full rounded-xl px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  deliveryMethod === "email"
                    ? "bg-blue-600 hover:bg-blue-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {loading
                  ? "جارٍ إرسال رمز التحقق..."
                  : deliveryMethod === "email"
                    ? "إرسال الرمز إلى البريد الإلكتروني"
                    : "إرسال الرمز عبر WhatsApp"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <div className="rounded-xl bg-blue-50 p-4 text-sm leading-7 text-blue-800">
                إذا كان الطلب مؤهلًا للتحقق، فسيصل رمز التحقق عبر{" "}
                {deliveryMethod === "email"
                  ? "البريد الإلكتروني"
                  : "WhatsApp"}{" "}
                حسب اختيارك. الرمز صالح لمدة 5 دقائق.
              </div>

              <div>
                <label
                  htmlFor="otpCode"
                  className="mb-2 block text-sm font-semibold"
                >
                  رمز التحقق المكوّن من 6 أرقام
                </label>

                <input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) =>
                    setCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-xl tracking-[0.4em] outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "جارٍ التحقق..."
                  : "تحقق واعرض حالة الطلب"}
              </button>

              <button
                type="button"
                onClick={startOver}
                disabled={loading}
                className="w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                العودة وإدخال رقم تتبع آخر
              </button>
            </form>
          )}

          {step === "details" && (
            <button
              type="button"
              onClick={startOver}
              disabled={loading || decisionLoading !== null}
              className="w-full rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              إنهاء جلسة التتبع
            </button>
          )}

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-7 text-green-700"
            >
              {notice}
            </div>
          )}
        </section>

        {service && step === "details" && (
          <section className="mt-7 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">رقم التتبع</p>
                  <p className="mt-1 break-all text-lg font-bold" dir="ltr">
                    {service.trackingNumber || "غير متاح"}
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                  {statusLabels[service.status] || service.status}
                </span>
              </div>

              <div className="my-6 border-t border-slate-100" />

              <h2 className="mb-4 text-xl font-bold">تفاصيل الجهاز</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">نوع الجهاز</p>
                  <p className="mt-2 font-semibold">
                    {service.deviceType}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">تاريخ استلام الطلب</p>
                  <p className="mt-2 font-semibold">
                    {formatDate(service.createdAt)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">
                    موعد الإنجاز المتوقع
                  </p>
                  <p className="mt-2 font-semibold">
                    {formatDate(service.estimatedCompletionTime)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">موعد الاستلام</p>
                  <p className="mt-2 font-semibold">
                    {formatDate(service.pickupDate)}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                آخر تحديث: {formatDate(service.updatedAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="mb-4 text-xl font-bold">
                عرض سعر الإصلاح
              </h2>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">
                  مبلغ عرض السعر
                </p>
                <p className="mt-2 break-words text-2xl font-bold text-blue-700">
                  {service.quoteAmount !== null &&
                  service.quoteAmount !== ""
                    ? service.quoteAmount
                    : "لم يُحدّد بعد"}
                </p>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                حالة عرض السعر
              </p>
              <p className="mt-2 font-semibold">
                {quoteStatusLabels[service.quoteStatus] ||
                  service.quoteStatus}
              </p>

              {service.quoteStatus === "pending" && (
                <div className="mt-5 space-y-4">
                  <p className="text-sm leading-7 text-slate-600">
                    راجع مبلغ عرض السعر قبل اتخاذ القرار. بعد تسجيل القرار
                    لن تتمكن من تغييره من هذه الصفحة.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuoteDecision("approved")
                      }
                      disabled={
                        decisionLoading !== null || loading
                      }
                      className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {decisionLoading === "approved"
                        ? "جارٍ تسجيل الموافقة..."
                        : "الموافقة على عرض السعر"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuoteDecision("rejected")
                      }
                      disabled={
                        decisionLoading !== null || loading
                      }
                      className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {decisionLoading === "rejected"
                        ? "جارٍ تسجيل الرفض..."
                        : "رفض عرض السعر"}
                    </button>
                  </div>
                </div>
              )}

              {service.quoteStatus === "approved" && (
                <p className="mt-4 rounded-xl bg-green-50 p-4 text-sm leading-7 text-green-700">
                  تمت الموافقة على عرض السعر. تابع حالة طلبك لمعرفة آخر
                  مستجدات الصيانة.
                </p>
              )}

              {service.quoteStatus === "rejected" && (
                <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-700">
                  تم رفض عرض السعر. يُرجى التواصل مع مركز الصيانة إذا رغبت
                  في مناقشة خيارات الإصلاح.
                </p>
              )}

              {service.quoteStatus === "not_requested" && (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  لم يصدر عرض سعر لهذا الطلب حتى الآن.
                </p>
              )}

              {service.quoteStatus === "approved" && (
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <h3 className="mb-4 text-lg font-bold text-slate-800">
                    قطع الغيار المطلوبة
                  </h3>

                  {service.partRequirements.length === 0 ? (
                    <p className="text-sm leading-7 text-slate-500">
                      لا توجد قطع غيار مسجلة لهذا الطلب حاليًا.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {service.partRequirements.map((part) => {
                        const info =
                          partStatusLabels[part.status] ??
                          partStatusLabels.requested;

                        return (
                          <div
                            key={part.id}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {part.name}
                                </p>
                                {part.code && (
                                  <p className="mt-1 text-xs text-slate-500">
                                    رمز القطعة: {part.code}
                                  </p>
                                )}
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${info.className}`}
                              >
                                {info.label}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                              <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-slate-500">
                                  الكمية المطلوبة
                                </p>
                                <p className="mt-1 font-bold">
                                  {part.quantityRequired}
                                </p>
                              </div>

                              <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-slate-500">
                                  الكمية المحجوزة
                                </p>
                                <p className="mt-1 font-bold">
                                  {part.quantityReserved}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <h2 className="mb-6 text-xl font-bold">
                سجل مراحل الصيانة
              </h2>

              {service.statusHistory?.length > 0 ? (
                <ol className="space-y-5">
                  {service.statusHistory.map((item, index) => (
                    <li
                      key={`${item.createdAt}-${index}`}
                      className="relative border-r-2 border-blue-200 pr-6 pb-2 last:border-r-0"
                    >
                      <span className="absolute -right-[7px] top-1 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-blue-50" />

                      <p className="font-semibold">
                        {statusLabels[item.status] || item.status}
                      </p>

                      {item.note && (
                        <p className="mt-2 text-sm leading-7 text-slate-600">
                          {item.note}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-500">
                        {formatDate(item.createdAt)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm leading-7 text-slate-500">
                  لا توجد تحديثات إضافية مسجلة حتى الآن.
                </p>
              )}
            </div>
          </section>
        )}

        <footer className="mt-8 text-center text-xs leading-6 text-slate-500">
          إذا واجهت مشكلة في التحقق، يُرجى التواصل مع مركز الصيانة.
        </footer>
      </div>
    </main>
  );
}


