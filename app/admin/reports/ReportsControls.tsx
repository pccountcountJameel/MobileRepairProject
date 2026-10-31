
"use client";

import { useState } from "react";

export type ReportExportData = {
  services: {
    deviceType: string;
    technician: string;
    status: string;
    createdAt: string;
  }[];
  invoices: {
    invoiceNumber: string;
    totalAmount: number | null;
    received: number;
    remaining: number | null;
    status: string;
    createdAt: string;
  }[];
  inventory: {
    code: string;
    name: string;
    quantityOnHand: number;
    quantityReserved: number;
    available: number;
    minStock: number;
  }[];
};

type Props = {
  from: string;
  to: string;
  data: ReportExportData;
};

function csvCell(value: string | number | null) {
  let text = String(value ?? "");

  // منع تفسير النصوص التي تبدأ بصيغ Excel على أنها معادلات.
  if (/^[\s]*[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][]
) {
  const content = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  // BOM يساعد Excel على عرض اللغة العربية بصورة صحيحة.
  const blob = new Blob(["\uFEFF", content], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

export default function ReportsControls({
  from,
  to,
  data,
}: Props) {
  const [startDate, setStartDate] = useState(from);
  const [endDate, setEndDate] = useState(to);
  const [error, setError] = useState("");

  function validateDates() {
    if (startDate && endDate && startDate > endDate) {
      setError("تاريخ البداية يجب ألا يكون بعد تاريخ النهاية.");
      return false;
    }

    setError("");
    return true;
  }

  function exportServices() {
    downloadCsv(
      "maintenance-report.csv",
      ["نوع الجهاز", "الفني", "الحالة", "تاريخ الطلب"],
      data.services.map((item) => [
        item.deviceType,
        item.technician,
        item.status,
        item.createdAt,
      ])
    );
  }

  function exportInvoices() {
    downloadCsv(
      "invoices-report.csv",
      [
        "رقم الفاتورة",
        "الإجمالي",
        "المدفوع",
        "المتبقي",
        "الحالة",
        "التاريخ",
      ],
      data.invoices.map((item) => [
        item.invoiceNumber,
        item.totalAmount,
        item.received,
        item.remaining,
        item.status,
        item.createdAt,
      ])
    );
  }

  function exportInventory() {
    downloadCsv(
      "inventory-report.csv",
      [
        "رمز القطعة",
        "اسم القطعة",
        "الكمية الموجودة",
        "الكمية المحجوزة",
        "الكمية المتاحة",
        "الحد الأدنى",
      ],
      data.inventory.map((item) => [
        item.code,
        item.name,
        item.quantityOnHand,
        item.quantityReserved,
        item.available,
        item.minStock,
      ])
    );
  }

  return (
    <section
      dir="rtl"
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          تصفية التقارير وتصديرها
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          اختر الفترة الزمنية، ثم صدّر بيانات التقارير إلى ملفات CSV
          يمكن فتحها في Excel.
        </p>
      </div>

      <form
        action="/admin/reports"
        method="get"
        onSubmit={(event) => {
          if (!validateDates()) {
            event.preventDefault();
          }
        }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="space-y-1 text-sm">
          <span className="block font-medium text-gray-700">
            من تاريخ
          </span>
          <input
            type="date"
            name="from"
            value={startDate}
            max={endDate || undefined}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="block font-medium text-gray-700">
            إلى تاريخ
          </span>
          <input
            type="date"
            name="to"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-lg border border-gray-300 p-2"
          />
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            تطبيق التصفية
          </button>
        </div>

        <div className="flex items-end">
          <a
            href="/admin/reports"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-sm hover:bg-gray-50"
          >
            عرض جميع الفترات
          </a>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={exportServices}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          تصدير تقرير الصيانة CSV
        </button>

        <button
          type="button"
          onClick={exportInvoices}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          تصدير تقرير الفواتير CSV
        </button>

        <button
          type="button"
          onClick={exportInventory}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          تصدير تقرير المخزون CSV
        </button>
      </div>
    </section>
  );
}
