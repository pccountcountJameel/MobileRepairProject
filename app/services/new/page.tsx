"use client";

import { useEffect, useState } from "react";

type CreatedService = {
  id: string;
  trackingNumber: string | null;
  deviceType: string;
  issueDescription: string;
  appointment_date: string;
  status: string;
  createdAt: string;
};

type ApiResponse = {
  message?: string;
  error?: string;
  service?: Partial<CreatedService>;
};

export default function NewServicePage() {
  const [deviceType, setDeviceType] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [minAppointmentDate, setMinAppointmentDate] = useState("");
  const [createdService, setCreatedService] =
    useState<CreatedService | null>(null);
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    const updateMinimumDate = () => {
      const localNow = new Date(
        Date.now() - new Date().getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16);

      setMinAppointmentDate(localNow);
    };

    updateMinimumDate();
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setCopyMessage("");
    setCreatedService(null);

    const normalizedPhone = customerPhone.trim();

    if (!/^[+\d\s()-]{7,30}$/.test(normalizedPhone)) {
      setMessage("يرجى إدخال رقم هاتف صحيح يتكون من 7 إلى 30 خانة أو رمزًا مسموحًا.");
      return;
    }

    if (!appointmentDate) {
      setMessage("يرجى اختيار موعد الصيانة.");
      return;
    }

    if (new Date(appointmentDate).getTime() < Date.now()) {
      setMessage("يرجى اختيار موعد في المستقبل.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceType,
          customerPhone: normalizedPhone,
          issueDescription,
          appointment_date: new Date(
            appointmentDate
          ).toISOString(),
        }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setMessage(data.error || "تعذر إرسال الطلب.");
        return;
      }

      const service = data.service;

      if (!service || typeof service.id !== "string") {
        setMessage(
          "وصل رد نجاح من الخادم، لكن تفاصيل الطلب غير مكتملة. يرجى مراجعة الإدارة."
        );
        return;
      }

      const trackingNumber =
        typeof service.trackingNumber === "string" &&
        service.trackingNumber.trim()
          ? service.trackingNumber.trim()
          : null;

      setCreatedService({
        id: service.id,
        trackingNumber,
        deviceType:
          typeof service.deviceType === "string"
            ? service.deviceType
            : deviceType,
        issueDescription:
          typeof service.issueDescription === "string"
            ? service.issueDescription
            : issueDescription,
        appointment_date:
          typeof service.appointment_date === "string"
            ? service.appointment_date
            : "",
        status:
          typeof service.status === "string"
            ? service.status
            : "scheduled",
        createdAt:
          typeof service.createdAt === "string"
            ? service.createdAt
            : "",
      });

      setMessage(data.message || "تم إنشاء طلب الصيانة بنجاح.");

      setDeviceType("");
      setCustomerPhone("");
      setIssueDescription("");
      setAppointmentDate("");
    } catch {
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTrackingNumber() {
    const trackingNumber = createdService?.trackingNumber;

    if (!trackingNumber) {
      setCopyMessage("رقم التتبع غير متوفر لهذا الطلب.");
      return;
    }

    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopyMessage("تم نسخ رقم التتبع بنجاح.");
    } catch {
      const input = document.getElementById(
        "trackingNumber"
      ) as HTMLInputElement | null;

      if (input) {
        input.focus();
        input.select();
      }

      setCopyMessage(
        "حدد الرقم الظاهر وانسخه يدويًا باستخدام Ctrl+C."
      );
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 650,
        margin: "40px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <h1>طلب صيانة جديد</h1>

      <p>أدخل بيانات جهازك والمشكلة التي تواجهها.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="deviceType">نوع الجهاز</label>

        <input
          id="deviceType"
          type="text"
          value={deviceType}
          onChange={(event) => setDeviceType(event.target.value)}
          placeholder="مثال: هاتف سامسونج"
          maxLength={100}
          required
          style={inputStyle}
        />

        <label htmlFor="customerPhone">رقم هاتف العميل</label>

        <input
          id="customerPhone"
          type="tel"
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
          placeholder="أدخل رقم الهاتف المسجل للعميل"
          autoComplete="tel"
          maxLength={30}
          required
          dir="ltr"
          style={inputStyle}
        />

        <p style={{ marginTop: -12, fontSize: 13, color: "#475569" }}>
          ستحتاج إلى آخر أربعة أرقام من هذا الهاتف عند تتبع الطلب.
        </p>

        <label htmlFor="issueDescription">وصف المشكلة</label>

        <textarea
          id="issueDescription"
          value={issueDescription}
          onChange={(event) =>
            setIssueDescription(event.target.value)
          }
          placeholder="اشرح العطل الذي يعاني منه الجهاز"
          maxLength={3000}
          required
          rows={5}
          style={inputStyle}
        />

        <label htmlFor="appointmentDate">موعد الصيانة</label>

        <input
          id="appointmentDate"
          type="datetime-local"
          value={appointmentDate}
          onChange={(event) =>
            setAppointmentDate(event.target.value)
          }
          min={minAppointmentDate || undefined}
          required
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 13,
            marginTop: 20,
            backgroundColor: loading ? "#64748b" : "#0f766e",
            color: "white",
            border: 0,
            borderRadius: 8,
            cursor: loading ? "wait" : "pointer",
            fontSize: 16,
          }}
        >
          {loading ? "جارٍ إرسال الطلب..." : "إرسال طلب الصيانة"}
        </button>

        {message && (
          <p
            role="status"
            aria-live="polite"
            style={{
              marginTop: 16,
              color: message.includes("بنجاح")
                ? "#15803d"
                : "#b91c1c",
            }}
          >
            {message}
          </p>
        )}
      </form>

      {createdService && (
        <section
          aria-live="polite"
          style={{
            marginTop: 24,
            padding: 20,
            border: "2px solid #16a34a",
            borderRadius: 12,
            backgroundColor: "#f0fdf4",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#166534" }}>
            تم تسجيل طلب الصيانة بنجاح
          </h2>

          <p>
            احتفظ برقم التتبع وآخر أربعة أرقام من الهاتف لاستخدامهما عند الاستفسار عن حالة جهازك.
          </p>

          <div
            style={{
              padding: 16,
              marginTop: 16,
              marginBottom: 20,
              backgroundColor: "#ffffff",
              border: "1px solid #86efac",
              borderRadius: 10,
              textAlign: "center",
            }}
          >
            <label
              htmlFor="trackingNumber"
              style={{
                display: "block",
                fontWeight: "bold",
                marginBottom: 12,
              }}
            >
              رقم تتبع طلب الصيانة
            </label>

            {createdService.trackingNumber ? (
              <>
                <input
                  id="trackingNumber"
                  type="text"
                  value={createdService.trackingNumber}
                  readOnly
                  onFocus={(event) => event.currentTarget.select()}
                  style={{
                    ...inputStyle,
                    marginBottom: 12,
                    backgroundColor: "#f8fafc",
                    fontWeight: "bold",
                    color: "#166534",
                    direction: "ltr",
                    textAlign: "center",
                    fontSize: 21,
                    letterSpacing: 1,
                  }}
                />

                <button
                  type="button"
                  onClick={copyTrackingNumber}
                  style={{
                    width: "100%",
                    padding: 12,
                    backgroundColor: "#166534",
                    color: "#ffffff",
                    border: 0,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  نسخ رقم التتبع
                </button>
              </>
            ) : (
              <p style={{ color: "#b91c1c" }}>
                لم يصل رقم التتبع من الخادم. معرّف الطلب محفوظ أدناه.
                لا تنشئ طلبًا آخر؛ يمكننا فحص استجابة الخادم لمعرفة السبب.
              </p>
            )}

            {copyMessage && (
              <p
                role="status"
                aria-live="polite"
                style={{ color: "#166534", marginBottom: 0 }}
              >
                {copyMessage}
              </p>
            )}
          </div>

          <p>
            <strong>نوع الجهاز:</strong> {createdService.deviceType}
          </p>

          <p>
            <strong>معرّف الطلب:</strong>
          </p>

          <p
            dir="ltr"
            style={{
              overflowWrap: "anywhere",
              userSelect: "all",
              fontSize: 13,
            }}
          >
            {createdService.id}
          </p>
        </section>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  marginTop: 8,
  marginBottom: 20,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  fontFamily: "inherit",
  fontSize: 15,
};