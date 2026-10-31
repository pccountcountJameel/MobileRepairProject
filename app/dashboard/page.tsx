"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const navigation = [
  {
    title: "طلبات الصيانة",
    description: "عرض ومتابعة طلبات الصيانة",
    href: "/admin/orders",
    icon: "📋",
  },
  {
    title: "استقبال جهاز",
    description: "تسجيل جهاز وفتح طلب جديد",
    href: "/services/new",
    icon: "📱",
  },
  {
    title: "خدمات الصيانة",
    description: "إدارة خدمات المركز",
    href: "/admin/services",
    icon: "🔧",
  },
  {
    title: "الفنيون",
    description: "إدارة الفنيين وتوزيع الأعمال",
    href: "/admin/technicians",
    icon: "👨‍🔧",
  },
  {
    title: "قطع الغيار",
    description: "متابعة المخزون وقطع الغيار",
    href: "/admin/inventory",
    icon: "⚙️",
  },
  {
    title: "الفواتير والمدفوعات",
    description: "إدارة الفواتير والعمليات المالية",
    href: "/admin/finance",
    icon: "💳",
  },
  {
    title: "التقارير",
    description: "عرض تقارير وأداء المركز",
    href: "/admin/reports",
    icon: "📊",
  },
  {
    title: "إدارة المستخدمين",
    description: "إضافة المسؤولين ومتابعة حساباتهم",
    href: "/admin/users",
    icon: "👥",
    superAdminOnly: true,
  },
];

function getRoleName(role: string) {
  if (role === "super_admin") return "مدير النظام";
  if (role === "admin") return "مدير";
  if (role === "customer") return "عميل";
  return role;
}

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadUser() {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "تعذر تحميل بيانات المستخدم."
          );
        }

        if (!cancelled) {
          setUser(data.user);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "تعذر الاتصال بالخادم."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("تعذر تسجيل الخروج. حاول مرة أخرى.");
      }

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "تعذر الاتصال بالخادم."
      );
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fc] text-slate-800"
        dir="rtl"
      >
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
        <h2 className="mt-5 text-xl font-extrabold">
          جارٍ تحميل لوحة التحكم
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          يرجى الانتظار قليلاً...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main
        className="flex min-h-screen flex-col items-center justify-center bg-[#f6f8fc] px-5 text-center"
        dir="rtl"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-bold text-red-600">
          !
        </div>

        <h2 className="mt-5 text-xl font-extrabold text-slate-900">
          تعذر فتح لوحة التحكم
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          {error || "جارٍ تحويلك إلى صفحة تسجيل الدخول..."}
        </p>

        {error && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800"
          >
            إعادة المحاولة
          </button>
        )}
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#f6f8fc] text-slate-800"
      dir="rtl"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <a href="/" className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-2xl text-white">
              🔧
            </span>

            <span>
              <span className="block text-lg font-extrabold text-slate-900">
                مركز صيانة الأجهزة
              </span>
              <span className="block text-xs text-slate-500">
                خدمة موثوقة، ومتابعة واضحة
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
            <a
              href="/dashboard"
              className="text-blue-700"
            >
              لوحة التحكم
            </a>
            <a
              href="/services/new"
              className="transition hover:text-blue-700"
            >
              طلب صيانة
            </a>
            <a
              href="/track"
              className="transition hover:text-blue-700"
            >
              تتبع الصيانة
            </a>
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {loggingOut ? "جارٍ الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      </header>

      {/* Main Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              بوابة إدارة خدمات الصيانة
            </span>

            <h1 className="mt-7 text-4xl font-extrabold leading-tight sm:text-5xl">
              مرحباً بعودتك،
              <span className="mt-2 block text-cyan-300">
                {user.name}
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-9 text-slate-300">
              يسعدنا وجودك معنا. يمكنك إدارة طلبات الصيانة،
              ومتابعة أعمال المركز، والوصول إلى جميع الخدمات
              من مكان واحد.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => router.push("/services/new")}
                className="rounded-xl bg-cyan-400 px-6 py-4 font-extrabold text-slate-950 transition hover:bg-cyan-300"
              >
                ＋ إنشاء طلب صيانة
              </button>

              <button
                type="button"
                onClick={() => router.push("/admin/orders")}
                className="rounded-xl border border-white/25 px-6 py-4 font-bold text-white transition hover:bg-white/10"
              >
                متابعة الطلبات
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span>✓ إدارة طلبات الصيانة</span>
              <span>✓ متابعة الأجهزة</span>
              <span>✓ تنظيم أعمال المركز</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
              <div className="rounded-3xl bg-white p-6 text-slate-800 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      حسابك الحالي
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold">
                      معلومات المستخدم
                    </h2>
                  </div>

                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                    👤
                  </span>
                </div>

                <div className="mt-7 space-y-3">
                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                      👤
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-500">
                        الاسم
                      </span>
                      <strong className="mt-1 block truncate font-extrabold">
                        {user.name}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-2xl">
                      ✉️
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-500">
                        البريد الإلكتروني
                      </span>
                      <strong className="mt-1 block truncate font-extrabold">
                        {user.email}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-2xl">
                      🛡️
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm text-slate-500">
                        نوع الحساب
                      </span>
                      <strong className="mt-1 block font-extrabold">
                        {getRoleName(user.role)}
                      </strong>
                    </span>
                  </div>
                </div>

                <p className="mt-5 text-center text-xs leading-6 text-slate-500">
                  مرحباً بك في نظام إدارة خدمات صيانة الأجهزة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-bold text-blue-700">
              أقسام النظام
            </p>

            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              إدارة المركز من مكان واحد
            </h2>
          </div>

          <p className="max-w-xl leading-8 text-slate-500">
            اختر القسم الذي تريد العمل عليه للوصول السريع
            إلى أدوات إدارة الصيانة وخدمات المركز.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {navigation
            .filter(
              (item) =>
                !("superAdminOnly" in item) ||
                user.role === "super_admin"
            )
            .map((item, index) => (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className="group rounded-3xl border border-slate-200 bg-white p-7 text-right shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl transition group-hover:bg-blue-100">
                    {item.icon}
                  </span>

                  <span className="text-sm font-extrabold text-slate-300">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-extrabold text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-3 leading-8 text-slate-500">
                  {item.description}
                </p>

                <span className="mt-6 inline-flex items-center gap-2 font-bold text-blue-700 group-hover:text-blue-900">
                  الانتقال إلى القسم ←
                </span>
              </button>
            ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-blue-700 p-8 text-white sm:flex-row sm:items-center sm:p-12">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              هل تريد تسجيل جهاز جديد؟
            </h2>

            <p className="mt-3 leading-8 text-blue-100">
              ابدأ بتسجيل بيانات الجهاز وإنشاء طلب الصيانة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/services/new")}
            className="shrink-0 rounded-xl bg-white px-6 py-4 font-extrabold text-blue-800 transition hover:bg-blue-50"
          >
            تسجيل طلب جديد
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-slate-800">
            مركز صيانة الأجهزة
          </p>

          <p>
            بوابة منظمة لإدارة طلبات الصيانة ومتابعتها.
          </p>

          <div className="flex gap-5">
            <a href="/" className="hover:text-blue-700">
              الصفحة الرئيسية
            </a>

            <a href="/track" className="hover:text-blue-700">
              تتبع الصيانة
            </a>
          </div>
        </div>
      </footer>

      {error && (
        <div
          role="alert"
          className="fixed bottom-5 left-5 z-50 flex max-w-md items-center gap-4 rounded-xl border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-xl"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="font-bold"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}