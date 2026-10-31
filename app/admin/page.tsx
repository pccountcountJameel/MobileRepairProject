
import Link from "next/link";
import { requireRole } from "@/lib/authorization";

export const instant = false;

const adminSections = [
  {
    title: "طلبات الصيانة",
    description: "إدارة طلبات الإصلاح، ومتابعة الأجهزة ومراحل الصيانة.",
    href: "/admin/services",
    icon: "🔧",
    accent: "from-blue-500 to-cyan-500",
    surface: "bg-blue-50",
    label: "إدارة الطلبات",
  },
  {
    title: "الفواتير والمدفوعات",
    description: "مراجعة الفواتير والدفعات والمبالغ المستحقة.",
    href: "/admin/orders",
    icon: "🧾",
    accent: "from-violet-500 to-purple-500",
    surface: "bg-violet-50",
    label: "الفواتير والتحصيل",
  },
  {
    title: "المالية",
    description: "متابعة الإيرادات والمدفوعات والحركة المالية.",
    href: "/admin/finance",
    icon: "💰",
    accent: "from-emerald-500 to-teal-500",
    surface: "bg-emerald-50",
    label: "المتابعة المالية",
  },
  {
    title: "التقارير",
    description: "الاطلاع على تقارير الصيانة والمخزون والمعاملات.",
    href: "/admin/reports",
    icon: "📊",
    accent: "from-amber-500 to-orange-500",
    surface: "bg-amber-50",
    label: "عرض التقارير",
  },
  {
    title: "إدارة المخزون",
    description: "متابعة قطع الغيار والكميات المتاحة والمحجوزة.",
    href: "/admin/inventory",
    icon: "📦",
    accent: "from-rose-500 to-pink-500",
    surface: "bg-rose-50",
    label: "إدارة القطع",
  },
  {
    title: "إدارة الفنيين",
    description: "تنظيم بيانات الفنيين وتخصصاتهم ومعلوماتهم.",
    href: "/admin/technicians",
    icon: "🧑‍🔧",
    accent: "from-indigo-500 to-blue-500",
    surface: "bg-indigo-50",
    label: "إدارة الفريق",
  },
];

export default async function AdminPage() {
  const user = await requireRole(["admin", "super_admin"]);

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900"
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white shadow-xl shadow-slate-200 sm:px-9 sm:py-10">
          <div
            aria-hidden="true"
            className="absolute -left-16 -top-24 -z-10 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 right-1/3 -z-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl"
          />

          <div className="flex flex-col gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                نظام إدارة صيانة الأجهزة
              </div>

              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                لوحة تحكم صيانة بلس
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                كل أدوات إدارة الصيانة في مكان واحد، لتنظيم الطلبات
                والفريق والمخزون والمعاملات بسهولة.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-cyan-400 text-xl font-black text-slate-950 shadow-lg">
                {(user.name?.trim()?.charAt(0) || "م").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-300">مرحبًا بعودتك</p>
                <p className="mt-1 max-w-48 truncate font-bold">
                  {user.name}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  {user.role === "super_admin"
                    ? "مدير النظام"
                    : "مدير"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">البريد الإلكتروني</p>
              <p className="mt-1 break-words text-sm font-medium text-slate-100">
                {user.email}
              </p>
            </div>
            <div className="sm:text-left">
              <p className="text-xs text-slate-400">حالة الوصول</p>
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                تم التحقق من صلاحيات الحساب
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby="sections-heading" className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-700">
                مساحة العمل
              </p>
              <h2
                id="sections-heading"
                className="mt-1 text-2xl font-black tracking-tight text-slate-900"
              >
                أقسام النظام
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                اختر القسم المطلوب للوصول إلى أدوات الإدارة.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                {adminSections.length}
              </span>
              أقسام إدارية
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {adminSections.map((section, index) => (
              <Link
                key={section.href}
                href={section.href}
                className="group relative flex min-h-56 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:p-6"
              >
                <div
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${section.accent} opacity-70 transition-opacity group-hover:opacity-100`}
                />

                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${section.surface} text-3xl transition duration-200 group-hover:scale-105`}
                    aria-hidden="true"
                  >
                    {section.icon}
                  </div>

                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-blue-50 group-hover:text-blue-700">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12h14m-6-6 6 6-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>

                <div className="mt-5">
                  <h3 className="text-lg font-extrabold text-slate-900 transition group-hover:text-blue-700">
                    {section.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    {section.description}
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="text-sm font-bold text-blue-700">
                    {section.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {(index + 1).toString().padStart(2, "0")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-slate-200 py-5 text-xs leading-6 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>صيانة بلس — نظام إدارة خدمات صيانة الأجهزة.</p>
          <p>يخضع الوصول إلى الأقسام لصلاحيات حسابك.</p>
        </footer>
      </div>
    </main>
  );
}
