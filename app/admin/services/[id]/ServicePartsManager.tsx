
"use client";

import { useCallback, useEffect, useState } from "react";

type SparePart = {
  id: string;
  code: string;
  name: string;
  unitPrice: number;
  quantityOnHand: number;
  quantityReserved: number;
  isActive: boolean;
};

type ServicePart = {
  id: string;
  sparePartId?: string | null;
  requestedPartName: string;
  requestedCode: string | null;
  quantityRequired: number;
  quantityReserved: number;
  unitPrice: number | null;
  status: string;
  note: string | null;
  sparePart: SparePart | null;
};

type Props = {
  serviceId: string;
};

type ApiError = {
  error?: string;
};

const statusLabels: Record<string, string> = {
  requested: "مطلوبة",
  unavailable: "غير متوفرة",
  partially_reserved: "محجوز جزء منها",
  reserved: "تم حجزها",
};

function formatAmount(amount: number | null | undefined) {
  return new Intl.NumberFormat("ar").format(amount ?? 0);
}

async function readApiResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.status === 401) {
      throw new Error("انتهت الجلسة أو يلزم تسجيل الدخول مجددًا.");
    }

    if (response.status === 403) {
      throw new Error("ليس لديك صلاحية الوصول إلى هذه البيانات.");
    }

    if (response.redirected) {
      throw new Error(
        "تم تحويل الطلب إلى صفحة أخرى. تحقق من تسجيل الدخول وصلاحيات الحساب."
      );
    }

    throw new Error(
      `أعاد الخادم استجابة غير متوقعة (HTTP ${response.status}) بدل JSON. تحقق من مسار API وسجل تشغيل المشروع.`
    );
  }

  try {
    return await response.json();
  } catch {
    throw new Error("تعذر قراءة استجابة الخادم بصيغة JSON.");
  }
}

function getApiError(data: unknown, fallback: string): string {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ApiError).error === "string"
  ) {
    return (data as ApiError).error!;
  }

  return fallback;
}

function isSparePart(value: unknown): value is SparePart {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const part = value as Partial<SparePart>;

  return (
    typeof part.id === "string" &&
    typeof part.code === "string" &&
    typeof part.name === "string" &&
    typeof part.unitPrice === "number" &&
    typeof part.quantityOnHand === "number" &&
    typeof part.quantityReserved === "number" &&
    typeof part.isActive === "boolean"
  );
}

export default function ServicePartsManager({ serviceId }: Props) {
  const [parts, setParts] = useState<ServicePart[]>([]);
  const [inventory, setInventory] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [sparePartId, setSparePartId] = useState("");
  const [requestedPartName, setRequestedPartName] = useState("");
  const [requestedCode, setRequestedCode] = useState("");
  const [quantityRequired, setQuantityRequired] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [note, setNote] = useState("");

  const selectedSparePart =
    inventory.find((part) => part.id === sparePartId) ?? null;

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [serviceResponse, inventoryResponse] = await Promise.all([
        fetch(
          `/api/services/${encodeURIComponent(serviceId)}/parts`,
          {
            cache: "no-store",
            headers: { Accept: "application/json" },
          }
        ),
        fetch("/api/inventory", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        }),
      ]);

      const [serviceData, inventoryData] = await Promise.all([
        readApiResponse(serviceResponse),
        readApiResponse(inventoryResponse),
      ]);

      if (!serviceResponse.ok) {
        throw new Error(
          getApiError(serviceData, "تعذر تحميل قطع غيار طلب الصيانة.")
        );
      }

      if (!inventoryResponse.ok) {
        throw new Error(
          getApiError(inventoryData, "تعذر تحميل قطع المخزون.")
        );
      }

      if (
        typeof serviceData !== "object" ||
        serviceData === null ||
        !("parts" in serviceData)
      ) {
        throw new Error("استجابة قطع غيار طلب الصيانة غير صحيحة.");
      }

      if (
        typeof inventoryData !== "object" ||
        inventoryData === null ||
        !("parts" in inventoryData) ||
        !Array.isArray(inventoryData.parts)
      ) {
        throw new Error("استجابة المخزون لا تحتوي على قائمة قطع صحيحة.");
      }

      const serviceParts =
        "parts" in serviceData && Array.isArray(serviceData.parts)
          ? serviceData.parts
          : [];

      setParts(serviceParts as ServicePart[]);
      setInventory(
        inventoryData.parts.filter(isSparePart).filter((part) => part.isActive)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تحميل البيانات."
      );
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    void loadParts();
  }, [loadParts]);

  function handleSparePartChange(id: string) {
    setSparePartId(id);
    setError("");
    setMessage("");

    const selected = inventory.find((part) => part.id === id);

    if (selected) {
      setRequestedPartName(selected.name);
      setRequestedCode(selected.code);
      setUnitPrice(String(selected.unitPrice));
    } else {
      setRequestedPartName("");
      setRequestedCode("");
      setUnitPrice("");
    }
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const quantity = Number(quantityRequired);
    const price =
      unitPrice.trim() === "" ? undefined : Number(unitPrice);

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 10000
    ) {
      setError("أدخل كمية صحيحة بين 1 و10000.");
      return;
    }

    if (
      price !== undefined &&
      (!Number.isSafeInteger(price) ||
        price < 0 ||
        price > 2_000_000_000)
    ) {
      setError("أدخل سعرًا صحيحًا غير سالب.");
      return;
    }

    if (
      !sparePartId &&
      (!requestedPartName.trim() ||
        requestedPartName.trim().length > 150)
    ) {
      setError("أدخل اسم القطعة، بحد أقصى 150 حرفًا.");
      return;
    }

    if (requestedCode.trim().length > 50) {
      setError("رمز القطعة يجب ألا يتجاوز 50 حرفًا.");
      return;
    }

    if (note.trim().length > 1000) {
      setError("الملاحظات يجب ألا تتجاوز 1000 حرف.");
      return;
    }

    if (
      sparePartId &&
      !inventory.some((part) => part.id === sparePartId)
    ) {
      setError("قطعة المخزون المختارة غير موجودة ضمن القطع النشطة. حدّث القائمة.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `/api/services/${encodeURIComponent(serviceId)}/parts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sparePartId: sparePartId || undefined,
            requestedPartName: sparePartId
              ? undefined
              : requestedPartName.trim(),
            requestedCode: sparePartId
              ? undefined
              : requestedCode.trim(),
            quantityRequired: quantity,
            unitPrice: price,
            note: note.trim(),
          }),
        }
      );

      const data = await readApiResponse(response);

      if (!response.ok) {
        throw new Error(getApiError(data, "تعذرت إضافة القطعة."));
      }

      setMessage("تمت إضافة القطعة بنجاح.");
      setSparePartId("");
      setRequestedPartName("");
      setRequestedCode("");
      setQuantityRequired("1");
      setUnitPrice("");
      setNote("");

      await loadParts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء إضافة القطعة."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      dir="rtl"
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            قطع الغيار المطلوبة
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            اختر قطعة من المخزون أو سجّل قطعة غير موجودة فيه.
            إضافة القطعة لا تحجز المخزون تلقائيًا.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadParts()}
          disabled={loading || saving}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loading ? "جارٍ التحديث..." : "تحديث البيانات"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
        >
          {message}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg bg-gray-50 p-4"
      >
        <div>
          <label
            htmlFor="sparePartId"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            اختر مصدر القطعة
          </label>

          <select
            id="sparePartId"
            value={sparePartId}
            onChange={(event) =>
              handleSparePartChange(event.target.value)
            }
            disabled={loading || saving}
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900"
          >
            <option value="">قطعة غير مرتبطة بالمخزون</option>

            {inventory.map((part) => {
              const available =
                part.quantityOnHand - part.quantityReserved;

              return (
                <option key={part.id} value={part.id}>
                  {part.name} — {part.code} — المتاح: {available} — السعر:{" "}
                  {formatAmount(part.unitPrice)}
                </option>
              );
            })}
          </select>

          {selectedSparePart && (
            <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
              <p>
                رمز القطعة: <strong>{selectedSparePart.code}</strong>
              </p>
              <p>
                الكمية الموجودة:{" "}
                <strong>{selectedSparePart.quantityOnHand}</strong>
              </p>
              <p>
                الكمية المحجوزة:{" "}
                <strong>{selectedSparePart.quantityReserved}</strong>
              </p>
              <p>
                الكمية المتاحة:{" "}
                <strong>
                  {selectedSparePart.quantityOnHand -
                    selectedSparePart.quantityReserved}
                </strong>
              </p>
              <p>
                سعر الوحدة:{" "}
                <strong>
                  {formatAmount(selectedSparePart.unitPrice)}
                </strong>
              </p>
            </div>
          )}

          {!loading && inventory.length === 0 && !error && (
            <p className="mt-2 text-sm text-amber-700">
              لم تُرجع واجهة المخزون أي قطع نشطة. تحقق من تسجيل الدخول وصلاحيات الإدارة.
            </p>
          )}
        </div>

        {!sparePartId && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="requestedPartName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  اسم القطعة
                </label>
                <input
                  id="requestedPartName"
                  value={requestedPartName}
                  onChange={(event) =>
                    setRequestedPartName(event.target.value)
                  }
                  maxLength={150}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900"
                  placeholder="مثال: شاشة هاتف"
                />
              </div>

              <div>
                <label
                  htmlFor="requestedCode"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  رمز القطعة (اختياري)
                </label>
                <input
                  id="requestedCode"
                  value={requestedCode}
                  onChange={(event) =>
                    setRequestedCode(event.target.value)
                  }
                  maxLength={50}
                  className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="unitPrice"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                سعر الوحدة (اختياري)
              </label>
              <input
                id="unitPrice"
                type="number"
                min={0}
                max={2_000_000_000}
                step={1}
                value={unitPrice}
                onChange={(event) =>
                  setUnitPrice(event.target.value)
                }
                className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900"
              />
            </div>
          </>
        )}

        <div>
          <label
            htmlFor="quantityRequired"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            الكمية المطلوبة
          </label>
          <input
            id="quantityRequired"
            type="number"
            min={1}
            max={10000}
            step={1}
            required
            value={quantityRequired}
            onChange={(event) =>
              setQuantityRequired(event.target.value)
            }
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900"
          />

          {selectedSparePart &&
            Number(quantityRequired) >
              selectedSparePart.quantityOnHand -
                selectedSparePart.quantityReserved && (
              <p className="mt-1 text-sm text-amber-700">
                الكمية المطلوبة أكبر من الرصيد المتاح حاليًا. يمكنك تسجيل
                الطلب، لكن قد لا تتوفر القطعة كاملة عند الحجز.
              </p>
            )}
        </div>

        <div>
          <label
            htmlFor="partNote"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            ملاحظات
          </label>
          <textarea
            id="partNote"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={2}
            className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900"
          />
        </div>

        <button
          type="submit"
          disabled={saving || loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "إضافة القطعة"}
        </button>
      </form>

      <div>
        <h3 className="mb-3 font-semibold text-gray-900">
          القطع المسجلة ({parts.length})
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500">جارٍ تحميل القطع...</p>
        ) : parts.length === 0 ? (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            لم تتم إضافة قطع غيار لهذا الطلب بعد.
          </p>
        ) : (
          <div className="space-y-3">
            {parts.map((part) => {
              const available = part.sparePart
                ? part.sparePart.quantityOnHand -
                  part.sparePart.quantityReserved
                : null;

              const price =
                part.unitPrice ?? part.sparePart?.unitPrice ?? 0;

              return (
                <article
                  key={part.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {part.requestedPartName}
                      </p>
                      {part.requestedCode && (
                        <p className="mt-1 text-sm text-gray-500">
                          الرمز: {part.requestedCode}
                        </p>
                      )}
                    </div>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                      {statusLabels[part.status] || part.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <p>
                      الكمية المطلوبة:{" "}
                      <strong>{part.quantityRequired}</strong>
                    </p>
                    <p>
                      الكمية المحجوزة:{" "}
                      <strong>{part.quantityReserved}</strong>
                    </p>
                    <p>
                      سعر الوحدة: <strong>{formatAmount(price)}</strong>
                    </p>
                    <p>
                      الإجمالي التقديري:{" "}
                      <strong>
                        {formatAmount(price * part.quantityRequired)}
                      </strong>
                    </p>
                    {available !== null && (
                      <p>
                        المتاح حاليًا في المخزون:{" "}
                        <strong>{available}</strong>
                      </p>
                    )}
                  </div>

                  {part.note && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">
                      الملاحظات: {part.note}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
