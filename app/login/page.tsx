"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.message || "تعذر تسجيل الدخول.");
        return;
      }

      // الانتقال إلى لوحة التحكم بعد نجاح تسجيل الدخول
      window.location.href = "/dashboard";
    } catch {
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: "420px",
        margin: "60px auto",
        padding: "28px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center" }}>تسجيل الدخول</h1>

      <p style={{ textAlign: "center", color: "#666" }}>
        أدخل بيانات حسابك للمتابعة
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">البريد الإلكتروني</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <label htmlFor="password">كلمة المرور</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: "18px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "جارٍ تسجيل الدخول..." : "دخول"}
        </button>
      </form>

      {message && (
        <p
          role="status"
          style={{ marginTop: "16px", textAlign: "center" }}
        >
          {message}
        </p>
      )}

      <p style={{ textAlign: "center", marginTop: "20px" }}>
        ليس لديك حساب؟ <Link href="/register">إنشاء حساب جديد</Link>
      </p>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "11px",
  marginTop: "7px",
  marginBottom: "18px",
  border: "1px solid #ccc",
  borderRadius: "6px",
};
