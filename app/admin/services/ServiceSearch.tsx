"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ServiceSearchRecord = {
  id: string;
  deviceType: string;
  issueDescription: string;
  status: string;
  technician: string | null;
  technicianId: string | null;
  technicianIsActive: boolean | null;
  appointment_date: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
};

type Technician = {
  id: string;
  name: string;
  isActive: boolean;
};

type Props = {
  services: ServiceSearchRecord[];
};

const statusOptions = [
  { value: "all", label: "كل الحالات" },
  { value: "scheduled", label: "مجدول" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "awaiting_parts", label: "بانتظار قطع الغيار" },
  { value: "on_hold", label: "متوقف مؤقتًا" },
  { value: "ready_for_pickup", label: "جاهز للاستلام" },
  { value: "completed", label: "مكتمل" },
  { value: "fixed", label: "تم الإصلاح" },
  { value: "payment_pending", label: "بانتظار الدفع" },
  { value: "dispatched", label: "تم التسليم" },
  { value: "assignToTechnican", label: "بانتظار تعيين فني" },
];

const statusLabels: Record<string, string> = Object.fromEntries(
  statusOptions
    .filter((option) => option.value !== "all")
    .map((option) => [option.value, option.label])
);

const cellStyle = {
  padding: "12px",
  border: "1px solid #cbd5e1",
  textAlign: "right" as const,
  verticalAlign: "top" as const,
};

export default function ServiceSearch({ services }: Props) {
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedTechnician, setSelectedTechnician] = useState("all");
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);

  // تحميل جميع الفنيين، وليس الفنيين المرتبطين بالطلبات المعروضة فقط.
  useEffect(() => {
    let cancelled = false;

    async function loadAllTechnicians() {
      try {
        const response = await fetch("/api/technicians", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "تعذر تحميل الفنيين.");
        }

        if (!Array.isArray(data.technicians)) {
          throw new Error("بيانات قائمة الفنيين غير صحيحة.");
        }

        if (!cancelled) {
          setAllTechnicians(data.technicians);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Load technicians filter error:", error);
        }
      }
    }

    void loadAllTechnicians();

    return () => {
      cancelled = true;
    };
  }, []);

  // استخدام معرّف الفني للفلترة، وإظهار جميع الفنيين.
  const technicians = useMemo(() => {
    return [...allTechnicians].sort((a, b) =>
      a.name.localeCompare(b.name, "ar")
    );
  }, [allTechnicians]);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");

    return services.filter((service) => {
      const technician = service.technician?.trim() ?? "";

      const searchableText = [
        service.id,
        service.deviceType,
        service.issueDescription,
        service.user.name ?? "",
        service.user.email,
        technician,
      ]
        .join(" ")
        .toLocaleLowerCase("ar");

      const matchesSearch = !query || searchableText.includes(query);

      const matchesStatus =
        selectedStatus === "all" || service.status === selectedStatus;

      const matchesTechnician =
        selectedTechnician === "all" ||
        (selectedTechnician === "unassigned" && !service.technicianId) ||
        service.technicianId === selectedTechnician;

      return matchesSearch && matchesStatus && matchesTechnician;
    });
  }, [services, search, selectedStatus, selectedTechnician]);

  const unassignedCount = services.filter(
    (service) => !service.technicianId
  ).length;

  const inactiveAssignedCount = services.filter(
    (service) =>
      Boolean(service.technicianId) &&
      service.technicianIsActive === false
  ).length;

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث بالعميل أو الجهاز أو رقم الطلب أو الفني..."
          aria-label="البحث في طلبات الصيانة"
          className="min-w-0 rounded border border-gray-300 p-3 text-sm"
        />

        <select
          value={selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value)}
          aria-label="تصفية حسب حالة الطلب"
          className="rounded border border-gray-300 bg-white p-3 text-sm"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          value={selectedTechnician}
          onChange={(event) => setSelectedTechnician(event.target.value)}
          aria-label="تصفية حسب الفني المسؤول"
          className="rounded border border-gray-300 bg-white p-3 text-sm"
        >
          <option value="all">كل الفنيين</option>
          <option value="unassigned">
            بدون فني ({unassignedCount})
          </option>

          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.name}
              {!technician.isActive ? " (غير نشط)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600" aria-live="polite">
          عدد الطلبات المطابقة: {filteredServices.length}
        </p>

        <div className="flex flex-wrap gap-4 text-sm">
          <p className="text-amber-700">
            الطلبات بدون فني: {unassignedCount}
          </p>

          {inactiveAssignedCount > 0 && (
            <p className="text-red-700">
              طلبات مرتبطة بفني غير نشط: {inactiveAssignedCount}
            </p>
          )}
        </div>
      </div>

      {filteredServices.length === 0 ? (
        <p className="rounded border border-gray-200 p-4 text-gray-600">
          لا توجد طلبات تطابق البحث أو عوامل التصفية المحددة.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full"
            style={{
              borderCollapse: "collapse",
              marginTop: "12px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9" }}>
                <th style={cellStyle}>العميل</th>
                <th style={cellStyle}>نوع الجهاز</th>
                <th style={cellStyle}>وصف المشكلة</th>
                <th style={cellStyle}>الفني المسؤول</th>
                <th style={cellStyle}>حالة الطلب</th>
                <th style={cellStyle}>تغيير الحالة</th>
                <th style={cellStyle}>موعد الصيانة</th>
                <th style={cellStyle}>تاريخ التسجيل</th>
                <th style={cellStyle}>التفاصيل</th>
              </tr>
            </thead>

            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.id}>
                  <td style={cellStyle}>
                    <div>{service.user.name || "غير محدد"}</div>
                    <small>{service.user.email}</small>
                  </td>

                  <td style={cellStyle}>{service.deviceType}</td>

                  <td style={cellStyle}>{service.issueDescription}</td>

                  <td style={cellStyle}>
                    <div className="min-w-44 space-y-2">
                      <div>
                        <p className="font-medium">
                          {service.technician || "لم يتم التعيين"}
                        </p>

                        {service.technicianId &&
                          service.technicianIsActive === false && (
                            <p className="mt-1 text-xs text-red-700">
                              فني غير نشط
                            </p>
                          )}
                      </div>

                      <TechnicianEditor
                        serviceId={service.id}
                        currentTechnicianId={service.technicianId}
                        currentTechnician={service.technician ?? ""}
                      />
                    </div>
                  </td>

                  <td style={cellStyle}>
                    {statusLabels[service.status] ?? service.status}
                  </td>

                  <td style={cellStyle}>
                    <StatusEditor
                      serviceId={service.id}
                      currentStatus={service.status}
                    />
                  </td>

                  <td style={cellStyle}>
                    {new Date(service.appointment_date).toLocaleDateString(
                      "ar"
                    )}
                  </td>

                  <td style={cellStyle}>
                    {new Date(service.createdAt).toLocaleDateString("ar")}
                  </td>

                  <td style={cellStyle}>
                    <a
                      href={`/admin/services/${service.id}`}
                      className="inline-block whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-white no-underline hover:bg-blue-700"
                    >
                      عرض التفاصيل
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TechnicianEditor({
  serviceId,
  currentTechnicianId,
  currentTechnician,
}: {
  serviceId: string;
  currentTechnicianId: string | null;
  currentTechnician: string;
}) {
  const router = useRouter();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [technicianId, setTechnicianId] = useState(
    currentTechnicianId ?? ""
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setTechnicianId(currentTechnicianId ?? "");
  }, [currentTechnicianId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTechnicians() {
      try {
        const response = await fetch("/api/technicians", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "تعذر تحميل الفنيين.");
        }

        if (!Array.isArray(data.technicians)) {
          throw new Error("بيانات قائمة الفنيين غير صحيحة.");
        }

        if (!cancelled) {
          setTechnicians(data.technicians);
          setMessage("");
          setIsError(false);
        }
      } catch (error) {
        if (!cancelled) {
          setIsError(true);
          setMessage(
            error instanceof Error
              ? error.message
              : "تعذر تحميل قائمة الفنيين."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTechnicians();

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveTechnician() {
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicianId: technicianId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر حفظ تعيين الفني.");
      }

      setMessage("تم حفظ الفني بنجاح.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ في الاتصال بالخادم."
      );
    } finally {
      setSaving(false);
    }
  }

  const selectedTechnician = technicians.find(
    (technician) => technician.id === technicianId
  );

  const currentTechnicianIsInList = technicians.some(
    (technician) => technician.id === currentTechnicianId
  );

  return (
    <div className="space-y-2">
      <select
        value={technicianId}
        onChange={(event) => {
          setTechnicianId(event.target.value);
          setMessage("");
          setIsError(false);
        }}
        disabled={loading || saving}
        aria-label="اختيار الفني المسؤول"
        className="w-full rounded border border-gray-300 bg-white p-2 text-sm"
      >
        <option value="">بدون فني</option>

        {currentTechnicianId && !currentTechnicianIsInList && (
          <option value={currentTechnicianId}>
            {currentTechnician || "الفني الحالي"}
          </option>
        )}

        {technicians.map((technician) => (
          <option
            key={technician.id}
            value={technician.id}
            disabled={
              !technician.isActive &&
              technician.id !== currentTechnicianId
            }
          >
            {technician.name}
            {!technician.isActive ? " (غير نشط)" : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => void saveTechnician()}
        disabled={
          loading ||
          saving ||
          technicianId === (currentTechnicianId ?? "")
        }
        className="rounded bg-indigo-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading
          ? "جارٍ تحميل الفنيين..."
          : saving
            ? "جارٍ الحفظ..."
            : "حفظ الفني"}
      </button>

      {selectedTechnician && !selectedTechnician.isActive && (
        <p className="text-xs text-amber-700">
          هذا الفني غير نشط. يمكنك إبقاء التعيين الحالي أو إزالته.
        </p>
      )}

      {message && (
        <p
          className={`text-xs ${
            isError ? "text-red-600" : "text-green-700"
          }`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function StatusEditor({
  serviceId,
  currentStatus,
}: {
  serviceId: string;
  currentStatus: string;
}) {
  const router = useRouter();

  const [status, setStatus] = useState(currentStatus);
  const [savedStatus, setSavedStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    setStatus(currentStatus);
    setSavedStatus(currentStatus);
  }, [currentStatus]);

  async function saveStatus() {
    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحديث الحالة.");
      }

      setSavedStatus(status);
      setMessage("تم تحديث الحالة بنجاح.");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ في الاتصال بالخادم."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        onChange={(event) => {
          setStatus(event.target.value);
          setMessage("");
          setIsError(false);
        }}
        disabled={saving}
        aria-label="تغيير حالة طلب الصيانة"
        className="w-full rounded border border-gray-300 bg-white p-2 text-sm text-gray-900"
      >
        {statusOptions
          .filter((option) => option.value !== "all")
          .map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>

      <button
        type="button"
        onClick={() => void saveStatus()}
        disabled={saving || status === savedStatus}
        className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? "جارٍ الحفظ..." : "حفظ الحالة"}
      </button>

      {message && (
        <p
          className={`text-sm ${
            isError ? "text-red-600" : "text-green-700"
          }`}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </div>
  );
}