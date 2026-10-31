"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

type Technician = {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  isActive: boolean;
  createdAt: string;
  assignedServicesCount: number;
  inProgressServicesCount: number;
  readyForPickupServicesCount: number;
  completedServicesCount: number;
};

const emptyForm = {
  name: "",
  phone: "",
  specialty: "",
};

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTechnicians = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/technicians", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر جلب الفنيين.");
      }

      if (!Array.isArray(data.technicians)) {
        throw new Error("استجابة قائمة الفنيين غير صحيحة.");
      }

      setTechnicians(
        data.technicians.map((technician: Technician) => ({
          ...technician,
          assignedServicesCount: technician.assignedServicesCount ?? 0,
          inProgressServicesCount:
            technician.inProgressServicesCount ?? 0,
          readyForPickupServicesCount:
            technician.readyForPickupServicesCount ?? 0,
          completedServicesCount:
            technician.completedServicesCount ?? 0,
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTechnicians();
  }, [loadTechnicians]);

  function startEditing(technician: Technician) {
    setEditingId(technician.id);
    setForm({
      name: technician.name,
      phone: technician.phone || "",
      specialty: technician.specialty || "",
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = form.name.trim();
    const phone = form.phone.trim();
    const specialty = form.specialty.trim();

    if (!name) {
      setError("يرجى إدخال اسم الفني.");
      return;
    }

    setSaving(true);

    try {
      const isEditing = editingId !== null;

      const response = await fetch(
        isEditing
          ? `/api/technicians/${editingId}`
          : "/api/technicians",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            phone,
            specialty,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (isEditing ? "تعذر تعديل الفني." : "تعذرت إضافة الفني.")
        );
      }

      setSuccess(
        isEditing
          ? "تم تعديل بيانات الفني بنجاح."
          : "تمت إضافة الفني بنجاح."
      );

      setEditingId(null);
      setForm(emptyForm);

      await loadTechnicians();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleTechnician(technician: Technician) {
    setError("");
    setSuccess("");
    setBusyId(technician.id);

    try {
      const response = await fetch(
        `/api/technicians/${technician.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isActive: !technician.isActive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تغيير حالة الفني.");
      }

      setSuccess(
        data.technician.isActive
          ? "تم تفعيل الفني بنجاح."
          : "تم تعطيل الفني بنجاح."
      );

      await loadTechnicians();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ غير متوقع."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"
    >
      <header>
        <h1 className="text-2xl font-bold">إدارة الفنيين</h1>
        <p className="mt-2 text-sm text-gray-600">
          إضافة الفنيين وتعديل بياناتهم وإدارة حالاتهم ومتابعة الطلبات
          المسندة لكل فني حسب حالة الصيانة.
        </p>
      </header>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? "تعديل بيانات الفني" : "إضافة فني جديد"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                اسم الفني *
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
                className="w-full rounded-lg border p-3"
                placeholder="أدخل اسم الفني"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                رقم الهاتف
              </span>
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                maxLength={30}
                className="w-full rounded-lg border p-3"
                placeholder="رقم الهاتف"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                التخصص
              </span>
              <input
                value={form.specialty}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    specialty: event.target.value,
                  }))
                }
                maxLength={100}
                className="w-full rounded-lg border p-3"
                placeholder="مثل: صيانة الهواتف"
              />
            </label>
          </div>

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

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              {saving
                ? "جارٍ الحفظ..."
                : editingId
                  ? "حفظ التعديلات"
                  : "إضافة الفني"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-lg border px-5 py-3"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">قائمة الفنيين</h2>
          <p className="mt-1 text-sm text-gray-600">
            إجمالي الفنيين: {technicians.length}
          </p>
        </div>

        {loading ? (
          <p className="p-5">جارٍ تحميل الفنيين...</p>
        ) : technicians.length === 0 ? (
          <p className="p-5 text-gray-600">
            لا يوجد فنيون حتى الآن.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="whitespace-nowrap p-3">الاسم</th>
                  <th className="whitespace-nowrap p-3">الهاتف</th>
                  <th className="whitespace-nowrap p-3">التخصص</th>
                  <th className="whitespace-nowrap p-3">إجمالي الطلبات</th>
                  <th className="whitespace-nowrap p-3">قيد التنفيذ</th>
                  <th className="whitespace-nowrap p-3">جاهزة للاستلام</th>
                  <th className="whitespace-nowrap p-3">مكتملة</th>
                  <th className="whitespace-nowrap p-3">الحالة</th>
                  <th className="whitespace-nowrap p-3">تاريخ الإضافة</th>
                  <th className="whitespace-nowrap p-3">الإجراءات</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {technicians.map((technician) => (
                  <tr key={technician.id}>
                    <td className="whitespace-nowrap p-3 font-medium">
                      {technician.name}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {technician.phone || "—"}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {technician.specialty || "—"}
                    </td>

                    <td className="p-3">
                      <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-blue-100 px-3 py-1 font-semibold text-blue-800">
                        {technician.assignedServicesCount}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                        {technician.inProgressServicesCount}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-800">
                        {technician.readyForPickupServicesCount}
                      </span>
                    </td>

                    <td className="p-3">
                      <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                        {technician.completedServicesCount}
                      </span>
                    </td>

                    <td className="whitespace-nowrap p-3">
                      <span
                        className={
                          technician.isActive
                            ? "rounded-full bg-green-100 px-2 py-1 text-green-800"
                            : "rounded-full bg-gray-100 px-2 py-1 text-gray-700"
                        }
                      >
                        {technician.isActive ? "نشط" : "غير نشط"}
                      </span>
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {new Date(
                        technician.createdAt
                      ).toLocaleDateString("ar")}
                    </td>

                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(technician)}
                          className="rounded-lg border px-3 py-2 hover:bg-gray-50"
                        >
                          تعديل
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void toggleTechnician(technician)
                          }
                          disabled={busyId === technician.id}
                          className={
                            technician.isActive
                              ? "rounded-lg bg-red-50 px-3 py-2 text-red-700 disabled:opacity-50"
                              : "rounded-lg bg-green-50 px-3 py-2 text-green-700 disabled:opacity-50"
                          }
                        >
                          {busyId === technician.id
                            ? "جارٍ التحديث..."
                            : technician.isActive
                              ? "تعطيل"
                              : "تفعيل"}
                        </button>
                      </div>
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
            onClick={() => void loadTechnicians()}
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