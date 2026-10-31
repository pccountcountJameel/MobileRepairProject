
const services = [
  {
    number: "01",
    title: "صيانة الهواتف",
    description: "تشخيص الأعطال وإصلاح الشاشات والبطاريات ومشكلات الشحن.",
    icon: "📱",
  },
  {
    number: "02",
    title: "صيانة الحواسيب",
    description: "إصلاح الأعطال التقنية ومشكلات النظام والأداء.",
    icon: "💻",
  },
  {
    number: "03",
    title: "قطع الغيار",
    description: "إدارة قطع الغيار ومتابعة توفرها واحتياجات الإصلاح.",
    icon: "🔧",
  },
];

const steps = [
  ["01", "تسجيل الجهاز", "أدخل بيانات الجهاز ووصف المشكلة."],
  ["02", "الفحص والتشخيص", "يتولى الفني فحص الجهاز وتحديد العطل."],
  ["03", "متابعة الإصلاح", "تابع حالة الصيانة وعرض السعر."],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-800" dir="rtl">
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
            <a href="#services" className="transition hover:text-blue-700">
              خدماتنا
            </a>
            <a href="#steps" className="transition hover:text-blue-700">
              كيف نعمل؟
            </a>
            <a href="/track" className="transition hover:text-blue-700">
              تتبع الصيانة
            </a>
          </nav>

          <a
            href="/services/new"
            className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800"
          >
            طلب صيانة
          </a>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-600/30 blur-3xl" />
        <div className="absolute -bottom-32 right-1/3 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-400/10 px-4 py-2 text-sm font-semibold text-blue-200">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              حلول متكاملة لصيانة أجهزتك
            </span>

            <h1 className="mt-7 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
              جهازك يستحق
              <span className="mt-2 block text-cyan-300">
                عناية احترافية
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-9 text-slate-300">
              سجّل طلب الصيانة، وتابع حالة جهازك، واعرف تفاصيل التشخيص
              وعرض السعر من مكان واحد وبخطوات واضحة.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="/services/new"
                className="rounded-xl bg-cyan-400 px-6 py-4 font-extrabold text-slate-950 transition hover:bg-cyan-300"
              >
                ابدأ طلب الصيانة ←
              </a>
              <a
                href="/track"
                className="rounded-xl border border-white/25 px-6 py-4 font-bold text-white transition hover:bg-white/10"
              >
                تتبع جهازي
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span>✓ متابعة حالة الجهاز</span>
              <span>✓ عرض سعر واضح</span>
              <span>✓ بيانات منظمة</span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
              <div className="rounded-3xl bg-white p-6 text-slate-800 sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      بوابة خدمات الصيانة
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold">
                      كيف نساعدك؟
                    </h2>
                  </div>
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                    🛠️
                  </span>
                </div>

                <div className="mt-7 space-y-3">
                  <a
                    href="/services/new"
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-2xl">
                      📋
                    </span>
                    <span className="flex-1">
                      <span className="block font-extrabold">
                        تسجيل جهاز جديد
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        إنشاء طلب صيانة
                      </span>
                    </span>
                    <span className="text-xl text-blue-700">←</span>
                  </a>

                  <a
                    href="/track"
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-2xl">
                      🔍
                    </span>
                    <span className="flex-1">
                      <span className="block font-extrabold">
                        تتبع طلب الصيانة
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        اعرف آخر تحديث لجهازك
                      </span>
                    </span>
                    <span className="text-xl text-blue-700">←</span>
                  </a>

                  <a
                    href="/login"
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-2xl">
                      👤
                    </span>
                    <span className="flex-1">
                      <span className="block font-extrabold">
                        تسجيل الدخول
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        الوصول إلى حسابك
                      </span>
                    </span>
                    <span className="text-xl text-blue-700">←</span>
                  </a>
                </div>

                <p className="mt-5 text-center text-xs leading-6 text-slate-500">
                  احتفظ برقم التتبع الخاص بك للرجوع إلى طلب الصيانة.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-5 py-20">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-bold text-blue-700">خدماتنا</p>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              كل ما يحتاجه جهازك
            </h2>
          </div>
          <p className="max-w-xl leading-8 text-slate-500">
            من تسجيل الجهاز وحتى متابعة مراحل الإصلاح، تجد الخدمات الأساسية
            منظمة في واجهة واحدة سهلة الاستخدام.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.number}
              className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl transition group-hover:bg-blue-100">
                  {service.icon}
                </span>
                <span className="text-sm font-extrabold text-slate-300">
                  {service.number}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-extrabold text-slate-900">
                {service.title}
              </h3>
              <p className="mt-3 leading-8 text-slate-500">
                {service.description}
              </p>
              <a
                href="/services/new"
                className="mt-6 inline-flex items-center gap-2 font-bold text-blue-700 hover:text-blue-900"
              >
                ابدأ من هنا <span>←</span>
              </a>
            </article>
          ))}
        </div>
      </section>

      <section id="steps" className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-bold text-blue-700">خطوات بسيطة</p>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              من الاستلام إلى المتابعة
            </h2>
            <p className="mt-4 leading-8 text-slate-500">
              مسار واضح يساعدك على معرفة المرحلة التي وصل إليها جهازك.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-3xl bg-[#f6f8fc] p-7 text-center"
              >
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-lg font-extrabold text-white shadow-lg shadow-blue-700/20">
                  {number}
                </span>
                <h3 className="mt-5 text-xl font-extrabold text-slate-900">
                  {title}
                </h3>
                <p className="mt-3 leading-8 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-blue-700 p-8 text-white sm:flex-row sm:items-center sm:p-12">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              هل جهازك بحاجة إلى صيانة؟
            </h2>
            <p className="mt-3 leading-8 text-blue-100">
              ابدأ بتسجيل طلبك، ثم احتفظ برقم التتبع لمتابعة المستجدات.
            </p>
          </div>
          <a
            href="/services/new"
            className="shrink-0 rounded-xl bg-white px-6 py-4 font-extrabold text-blue-800 transition hover:bg-blue-50"
          >
            تسجيل طلب جديد
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-slate-800">مركز صيانة الأجهزة</p>
          <p>بوابة منظمة لإدارة طلبات الصيانة ومتابعتها.</p>
          <div className="flex gap-5">
            <a href="/login" className="hover:text-blue-700">
              تسجيل الدخول
            </a>
            <a href="/register" className="hover:text-blue-700">
              إنشاء حساب
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
