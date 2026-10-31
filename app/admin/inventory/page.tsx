
"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type SparePart = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unitPrice: number;
  quantityOnHand: number;
  quantityReserved: number;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type InventorySummary = {
  totalParts: number;
  activeParts: number;
  lowStockParts: number;
  totalAvailableQuantity: number;
};

type MovementType = "restock" | "adjustment_in" | "adjustment_out";

const emptyForm = {
  code: "",
  name: "",
  description: "",
  unitPrice: "0",
  quantityOnHand: "0",
  minStock: "0",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  boxSizing: "border-box" as const,
  fontSize: "14px",
  background: "#fff",
};

const buttonStyle = {
  padding: "10px 16px",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: 600 as const,
};

export default function InventoryPage() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalParts: 0,
    activeParts: 0,
    lowStockParts: 0,
    totalAvailableQuantity: 0,
  });

  const [form, setForm] = useState(emptyForm);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [movementType, setMovementType] =
    useState<MovementType>("restock");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementNote, setMovementNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const response = await fetch(
        `/api/inventory?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تحميل المخزون.");
      }

      setParts(data.parts);
      setSummary(data.summary);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ أثناء تحميل المخزون."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    if (
      selectedPartId &&
      !parts.some(
        (part) => part.id === selectedPartId && part.isActive
      )
    ) {
      setSelectedPartId("");
    }
  }, [parts, selectedPartId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const payload = {
        action: "create",
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        unitPrice: Number(form.unitPrice),
        quantityOnHand: Number(form.quantityOnHand),
        minStock: Number(form.minStock),
      };

      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذرت إضافة القطعة.");
      }

      setForm(emptyForm);
      setSearch("");
      setSearchInput("");
      setSuccess("تمت إضافة قطعة الغيار بنجاح.");
      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ أثناء إضافة القطعة."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "movement",
          sparePartId: selectedPartId,
          type: movementType,
          quantity: Number(movementQuantity),
          note: movementNote.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تسجيل حركة المخزون.");
      }

      setMovementQuantity("1");
      setMovementNote("");
      setSuccess("تم تسجيل حركة المخزون وتحديث الكمية بنجاح.");
      await loadInventory();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء تسجيل حركة المخزون."
      );
    } finally {
      setSaving(false);
    }
  }

  function isLowStock(part: SparePart) {
    return (
      part.isActive &&
      part.quantityOnHand - part.quantityReserved <= part.minStock
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: "1200px",
        margin: "32px auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        color: "#172033",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", margin: "0 0 8px" }}>
            إدارة مخزون قطع الغيار
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            متابعة الكميات والأسعار والتوريدات وتنبيهات المخزون.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadInventory()}
          disabled={loading || saving}
          style={{
            ...buttonStyle,
            background: "#e2e8f0",
            color: "#172033",
          }}
        >
          تحديث البيانات
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          {success}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "14px",
          marginBottom: "28px",
        }}
      >
        {[
          {
            label: "عدد الأصناف",
            value: summary.totalParts,
            color: "#eff6ff",
          },
          {
            label: "الأصناف النشطة",
            value: summary.activeParts,
            color: "#f0fdf4",
          },
          {
            label: "أصناف منخفضة المخزون",
            value: summary.lowStockParts,
            color: "#fff7ed",
          },
          {
            label: "إجمالي الكمية المتاحة",
            value: summary.totalAvailableQuantity,
            color: "#f5f3ff",
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              background: item.color,
              padding: "20px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <p style={{ margin: "0 0 10px", color: "#475569" }}>
              {item.label}
            </p>
            <strong style={{ fontSize: "26px" }}>{item.value}</strong>
          </div>
        ))}
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "21px", marginTop: 0 }}>
          إضافة قطعة غيار جديدة
        </h2>

        <form onSubmit={handleCreate}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "16px",
            }}
          >
            <label>
              رمز القطعة *
              <input
                required
                maxLength={50}
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value })
                }
                placeholder="مثال: SCR-001"
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>

            <label>
              اسم القطعة *
              <input
                required
                maxLength={150}
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
                placeholder="مثال: شاشة هاتف"
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>

            <label>
              سعر الوحدة
              <input
                required
                type="number"
                min="0"
                max="2000000000"
                step="1"
                value={form.unitPrice}
                onChange={(e) =>
                  setForm({ ...form, unitPrice: e.target.value })
                }
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>

            <label>
              الرصيد الافتتاحي
              <input
                required
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={form.quantityOnHand}
                onChange={(e) =>
                  setForm({ ...form, quantityOnHand: e.target.value })
                }
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>

            <label>
              الحد الأدنى للمخزون
              <input
                required
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={form.minStock}
                onChange={(e) =>
                  setForm({ ...form, minStock: e.target.value })
                }
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>

            <label>
              وصف القطعة
              <input
                maxLength={1000}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="وصف اختياري"
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              ...buttonStyle,
              background: "#1d4ed8",
              color: "#fff",
              marginTop: "18px",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "جارٍ الحفظ..." : "إضافة القطعة"}
          </button>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "21px", marginTop: 0 }}>
          تسجيل حركة مخزون
        </h2>

        <p style={{ color: "#64748b", fontSize: "14px" }}>
          استخدم التوريد أو الزيادة لإضافة كمية، والنقص لتسجيل خروج كمية.
          لا يمكن خفض الرصيد إلى أقل من الكمية المحجوزة.
        </p>

        <form onSubmit={handleMovement}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "16px",
            }}
          >
            <label>
              قطعة الغيار *
              <select
                required
                value={selectedPartId}
                onChange={(e) => setSelectedPartId(e.target.value)}
                style={{ ...inputStyle, marginTop: "6px" }}
              >
                <option value="">اختر القطعة</option>
                {parts
                  .filter((part) => part.isActive)
                  .map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.code} — {part.name}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              نوع الحركة *
              <select
                value={movementType}
                onChange={(e) =>
                  setMovementType(e.target.value as MovementType)
                }
                style={{ ...inputStyle, marginTop: "6px" }}
              >
                <option value="restock">توريد جديد</option>
                <option value="adjustment_in">تسوية بالزيادة</option>
                <option value="adjustment_out">تسوية بالنقص</option>
              </select>
            </label>

            <label>
              الكمية *
              <input
                required
                type="number"
                min="1"
                max="1000000000"
                step="1"
                value={movementQuantity}
                onChange={(e) => setMovementQuantity(e.target.value)}
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>

            <label>
              ملاحظة
              <input
                maxLength={500}
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
                placeholder="رقم فاتورة التوريد أو سبب التسوية"
                style={{ ...inputStyle, marginTop: "6px" }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving || parts.every((part) => !part.isActive)}
            style={{
              ...buttonStyle,
              background: "#0f766e",
              color: "#fff",
              marginTop: "18px",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "جارٍ التسجيل..." : "تسجيل الحركة"}
          </button>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px",
        }}
      >
        <h2 style={{ fontSize: "21px", marginTop: 0 }}>
          قائمة قطع الغيار
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchInput.trim());
          }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ابحث برمز القطعة أو اسمها..."
            style={{ ...inputStyle, flex: "1 1 250px" }}
          />

          <button
            type="submit"
            style={{
              ...buttonStyle,
              background: "#1d4ed8",
              color: "#fff",
            }}
          >
            بحث
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
            }}
            style={{
              ...buttonStyle,
              background: "#e2e8f0",
              color: "#172033",
            }}
          >
            عرض الكل
          </button>
        </form>

        {loading ? (
          <p>جارٍ تحميل المخزون...</p>
        ) : parts.length === 0 ? (
          <p style={{ color: "#64748b" }}>
            لا توجد قطع غيار مطابقة. يمكنك إضافة قطعة من النموذج أعلاه.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
                minWidth: "850px",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "رمز القطعة",
                    "اسم القطعة",
                    "السعر",
                    "الرصيد",
                    "المحجوز",
                    "المتاح",
                    "الحد الأدنى",
                    "الحالة",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid #e2e8f0",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {parts.map((part) => {
                  const available =
                    part.quantityOnHand - part.quantityReserved;

                  return (
                    <tr key={part.id}>
                      <td style={cellStyle}>{part.code}</td>
                      <td style={cellStyle}>
                        <strong>{part.name}</strong>
                        {part.description && (
                          <div
                            style={{
                              color: "#64748b",
                              marginTop: "4px",
                              maxWidth: "220px",
                              overflowWrap: "anywhere",
                            }}
                          >
                            {part.description}
                          </div>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {part.unitPrice.toLocaleString("en-US")}
                      </td>
                      <td style={cellStyle}>{part.quantityOnHand}</td>
                      <td style={cellStyle}>{part.quantityReserved}</td>
                      <td style={cellStyle}>
                        <strong>{available}</strong>
                      </td>
                      <td style={cellStyle}>{part.minStock}</td>
                      <td style={cellStyle}>
                        {!part.isActive ? (
                          <span style={{ color: "#64748b" }}>غير نشطة</span>
                        ) : isLowStock(part) ? (
                          <span
                            style={{
                              color: "#b91c1c",
                              background: "#fef2f2",
                              padding: "5px 8px",
                              borderRadius: "6px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            مخزون منخفض
                          </span>
                        ) : (
                          <span style={{ color: "#15803d" }}>متوفر</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p
        style={{
          marginTop: "18px",
          color: "#64748b",
          fontSize: "13px",
        }}
      >
        الأسعار معروضة بالقيمة المخزنة في قاعدة البيانات، دون افتراض عملة
        محددة. الكمية المتاحة هي الرصيد الفعلي ناقص الكمية المحجوزة.
      </p>
    </main>
  );
}

const cellStyle = {
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  textAlign: "right" as const,
  verticalAlign: "top" as const,
};
