
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "super_admin";
  createdAt: string;
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });

      const data = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (response.status === 403) {
        router.replace("/dashboard");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.error || "تعذر تحميل حسابات المسؤولين."
        );
      }

      setUsers(data.users);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ غير متوقع."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!name || !email || !password) {
      setError("يرجى تعبئة جميع الحقول.");
      return;
    }

    if (password.length < 12) {
      setError("يجب ألا تقل كلمة المرور عن 12 حرفاً.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "تعذر إنشاء حساب المسؤول."
        );
      }

      setSuccess("تم إنشاء حساب المسؤول بنجاح.");
      setForm(emptyForm);

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ غير متوقع."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            إدارة المستخدمين والمسؤولين
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            إنشاء حسابات المسؤولين ومتابعة الحسابات الإدارية في النظام.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          العودة إلى لوحة التحكم
        </button>
      </header>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          إضافة مسؤول جديد
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                الاسم *
              </span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                maxLength={100}
                autoComplete="name"
                className="w-full rounded-lg border p-3"
                placeholder="اسم المسؤول"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                البريد الإلكتروني *
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                required
                maxLength={254}
                autoComplete="email"
                className="w-full rounded-lg border p-3"
                placeholder="admin@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                كلمة المرور *
              </span>
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                required
                minLength={12}
                autoComplete="new-password"
                className="w-full rounded-lg border p-3"
                placeholder="12 حرفاً على الأقل"
              />
            </label>
          </div>

          <p className="text-xs text-gray-500">
            سيتم إنشاء الحساب بصلاحية مدير (admin)، ويجب أن تكون كلمة المرور
            12 حرفاً على الأقل.
          </p>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {success && (
            <p role="status" className="text-sm text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white disabled:opacity-50"
          >
            {saving ? "جارٍ إنشاء الحساب..." : "إضافة المسؤول"}
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">
            قائمة المسؤولين
          </h2>

          <p className="mt-1 text-sm text-gray-600">
            إجمالي الحسابات الإدارية: {users.length}
          </p>
        </div>

        {loading ? (
          <p className="p-5">جارٍ تحميل الحسابات...</p>
        ) : users.length === 0 ? (
          <p className="p-5 text-gray-600">
            لا توجد حسابات إدارية.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="whitespace-nowrap p-3">الاسم</th>
                  <th className="whitespace-nowrap p-3">البريد الإلكتروني</th>
                  <th className="whitespace-nowrap p-3">الصلاحية</th>
                  <th className="whitespace-nowrap p-3">تاريخ الإضافة</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="whitespace-nowrap p-3 font-medium">
                      {user.name}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {user.email}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      <span
                        className={
                          user.role === "super_admin"
                            ? "rounded-full bg-purple-100 px-3 py-1 text-purple-800"
                            : "rounded-full bg-blue-100 px-3 py-1 text-blue-800"
                        }
                      >
                        {user.role === "super_admin"
                          ? "مدير النظام"
                          : "مدير"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {new Date(user.createdAt).toLocaleDateString("ar")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t p-4">
          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={loading}
            className="rounded-lg border px-4 py-2 disabled:opacity-50"
          >
            إعادة تحميل القائمة
          </button>
        </div>
      </section>
    </main>
  );
}