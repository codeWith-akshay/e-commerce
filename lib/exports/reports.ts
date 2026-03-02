/**
 * lib/exports/reports.ts
 *
 * Raw-SQL report builders + CSV / Excel serialisers for admin analytics exports.
 *
 * Three reports are supported:
 *   • orders  — one row per order with customer, status and payment details
 *   • revenue — daily/weekly/monthly aggregate (gross, discounts, net, avg)
 *   • users   — customer list with lifetime value and order count
 *
 * Both CSV (RFC 4180) and .xlsx (ExcelJS) output formats are available.
 */

import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Column headers (shared between CSV and Excel)
// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_HEADERS = {
  orders: [
    "Order ID", "Created At", "Customer", "Email",
    "Status", "Items", "Subtotal (₹)", "Discount (₹)",
    "Tax (₹)", "Shipping (₹)", "Total (₹)",
    "Payment Provider", "Payment Status",
  ],
  revenue: [
    "Period", "Orders",
    "Gross Revenue (₹)", "Total Discounts (₹)",
    "Net Revenue (₹)", "Avg Order Value (₹)",
  ],
  users: [
    "User ID", "Name", "Email", "Role",
    "Registered At", "Active", "Banned",
    "Total Orders", "Lifetime Value (₹)", "Last Order At",
  ],
} as const;

export type ReportType = keyof typeof REPORT_HEADERS;

// ─────────────────────────────────────────────────────────────────────────────
// Raw query row types (private — only the serialised string[][] is exported)
// ─────────────────────────────────────────────────────────────────────────────

type OrderRow = {
  id:               string;
  created_at:       Date;
  customer_name:    string;
  customer_email:   string;
  status:           string;
  item_count:       bigint;
  subtotal:         number;
  discount_amount:  number;
  tax_amount:       number;
  shipping_amount:  number;
  total_amount:     number;
  payment_provider: string | null;
  payment_status:   string | null;
};

type RevenueRow = {
  period:           Date;
  order_count:      bigint;
  gross_revenue:    number;
  total_discounts:  number;
  net_revenue:      number;
  avg_order_value:  number;
};

type UserRow = {
  id:             string;
  name:           string;
  email:          string;
  role:           string;
  created_at:     Date;
  is_active:      boolean;
  is_banned:      boolean;
  order_count:    bigint;
  lifetime_value: number;
  last_order_at:  Date | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Orders report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per order within the date range, newest first.
 * Joins in customer and payment data.  Uses `orders` (@@map name).
 */
export async function fetchOrdersReport(
  from: Date,
  to:   Date,
): Promise<string[][]> {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    SELECT
      o.id,
      o."createdAt"             AS created_at,
      u.name                    AS customer_name,
      u.email                   AS customer_email,
      o.status::text            AS status,
      COUNT(oi.id)              AS item_count,
      o."subtotal",
      o."discountAmount"        AS discount_amount,
      o."taxAmount"             AS tax_amount,
      o."shippingAmount"        AS shipping_amount,
      o."totalAmount"           AS total_amount,
      pay.provider::text        AS payment_provider,
      pay.status::text          AS payment_status
    FROM   orders o
    JOIN   users       u   ON u.id         = o."userId"
    LEFT JOIN order_items oi ON oi."orderId" = o.id
    LEFT JOIN payments    pay ON pay."orderId" = o.id
    WHERE  o."createdAt" BETWEEN ${from} AND ${to}
    GROUP BY
      o.id, o."createdAt", u.name, u.email, o.status,
      o."subtotal", o."discountAmount", o."taxAmount",
      o."shippingAmount", o."totalAmount",
      pay.provider, pay.status
    ORDER BY o."createdAt" DESC
  `;

  return rows.map((r) => [
    r.id,
    r.created_at.toISOString().replace("T", " ").slice(0, 19),
    r.customer_name,
    r.customer_email,
    r.status,
    String(Number(r.item_count)),
    fmtNum(r.subtotal),
    fmtNum(r.discount_amount),
    fmtNum(r.tax_amount),
    fmtNum(r.shipping_amount),
    fmtNum(r.total_amount),
    r.payment_provider ?? "",
    r.payment_status   ?? "",
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue report
// ─────────────────────────────────────────────────────────────────────────────

export type RevenueGranularity = "day" | "week" | "month";

/**
 * Aggregated revenue grouped by `granularity`.
 * Excludes PENDING and CANCELLED orders from all totals.
 */
export async function fetchRevenueReport(
  from:        Date,
  to:          Date,
  granularity: RevenueGranularity = "day",
): Promise<string[][]> {
  // Prisma.raw is safe here — granularity is already validated against the enum
  const gran = Prisma.raw(`'${granularity}'`);

  const rows = await prisma.$queryRaw<RevenueRow[]>`
    SELECT
      DATE_TRUNC(${gran}, o."createdAt")           AS period,
      COUNT(*)                                     AS order_count,
      SUM(o."totalAmount")                         AS gross_revenue,
      SUM(o."discountAmount")                      AS total_discounts,
      SUM(o."totalAmount") - SUM(o."discountAmount") AS net_revenue,
      AVG(o."totalAmount")                         AS avg_order_value
    FROM   orders o
    WHERE  o."createdAt" BETWEEN ${from} AND ${to}
      AND  o.status::text NOT IN ('CANCELLED', 'PENDING')
    GROUP BY DATE_TRUNC(${gran}, o."createdAt")
    ORDER BY period ASC
  `;

  return rows.map((r) => [
    r.period.toISOString().slice(0, 10),
    String(Number(r.order_count)),
    fmtNum(r.gross_revenue),
    fmtNum(r.total_discounts),
    fmtNum(r.net_revenue),
    fmtNum(r.avg_order_value),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Users report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Customer list, sorted by lifetime value (highest first).
 * Only includes users registered within the date range.
 * Joins DELIVERED orders for revenue in lifetime_value.
 */
export async function fetchUsersReport(
  from: Date,
  to:   Date,
): Promise<string[][]> {
  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role::text                          AS role,
      u."createdAt"                         AS created_at,
      u."isActive"                          AS is_active,
      u."isBanned"                          AS is_banned,
      COUNT(DISTINCT o.id)                  AS order_count,
      COALESCE(SUM(o."totalAmount"), 0)     AS lifetime_value,
      MAX(o."createdAt")                    AS last_order_at
    FROM   users u
    LEFT JOIN orders o
           ON o."userId" = u.id
          AND o.status::text = 'DELIVERED'
    WHERE  u."createdAt" BETWEEN ${from} AND ${to}
      AND  u."deletedAt" IS NULL
    GROUP BY u.id, u.name, u.email, u.role,
             u."createdAt", u."isActive", u."isBanned"
    ORDER BY lifetime_value DESC
  `;

  return rows.map((r) => [
    r.id,
    r.name,
    r.email,
    r.role,
    r.created_at.toISOString().slice(0, 10),
    r.is_active ? "Yes" : "No",
    r.is_banned ? "Yes" : "No",
    String(Number(r.order_count)),
    fmtNum(r.lifetime_value),
    r.last_order_at ? r.last_order_at.toISOString().slice(0, 10) : "",
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV serialiser  (RFC 4180 — no external dependency)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a UTF-8 CSV string from a header row and data rows.
 *
 * RFC 4180 compliance:
 *  • Fields containing commas, double-quotes, or newlines are wrapped in "…"
 *  • Embedded double-quotes are escaped as ""
 *  • Lines are terminated with CRLF (\r\n)
 *
 * A UTF-8 BOM (0xEF 0xBB 0xBF) is prepended so Excel on Windows opens the
 * file in the correct encoding without an import wizard.
 */
export function buildCsv(
  headers: readonly string[],
  rows:    string[][],
): string {
  const escape = (v: string): string => {
    if (/[,"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ];

  // BOM + CRLF line endings
  return "\uFEFF" + lines.join("\r\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel builder  (ExcelJS)
// ─────────────────────────────────────────────────────────────────────────────

// 1-indexed column positions that should be formatted as currency numbers.
const CURRENCY_COLS: Record<ReportType, Set<number>> = {
  orders:  new Set([7, 8, 9, 10, 11]),   // Subtotal … Total
  revenue: new Set([3, 4, 5, 6]),        // Gross … Avg
  users:   new Set([9]),                 // Lifetime Value
};

/**
 * Generates an .xlsx workbook (single sheet).
 * Returns a Buffer suitable for a Next.js `Response` body.
 *
 * Visual features:
 *  • Frozen header row with a blue background
 *  • Alternating light-grey row fill
 *  • Currency columns formatted as `#,##0.00`
 *  • Auto-fit column widths capped at 40
 */
export async function buildExcel(
  reportType: ReportType,
  headers:    readonly string[],
  rows:       string[][],
  sheetTitle: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const wb       = new ExcelJS.Workbook();
  wb.creator     = "Ecommerce Admin";
  wb.created     = new Date();
  wb.lastModifiedBy = "Ecommerce Admin";

  const ws = wb.addWorksheet(sheetTitle, {
    views:      [{ state: "frozen", ySplit: 1 }],   // freeze header
    properties: { defaultRowHeight: 16 },
  });

  // ── Header row ──────────────────────────────────────────────────────────────
  const headerRow = ws.addRow(headers as string[]);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border    = { bottom: { style: "medium", color: { argb: "FF1E40AF" } } };
  });

  // ── Data rows ───────────────────────────────────────────────────────────────
  const currencyCols = CURRENCY_COLS[reportType];

  for (const [rowIdx, rowData] of rows.entries()) {
    const wsRow = ws.addRow(
      rowData.map((v, ci) =>
        currencyCols.has(ci + 1) ? (parseFloat(v) || 0) : v,
      ),
    );

    // Currency format
    currencyCols.forEach((colIdx) => {
      wsRow.getCell(colIdx).numFmt = "#,##0.00";
      wsRow.getCell(colIdx).alignment = { horizontal: "right" };
    });

    // Alternating row background (even data rows = light slate)
    if (rowIdx % 2 === 1) {
      wsRow.eachCell({ includeEmpty: true }, (cell) => {
        // Don't overwrite currency cells' alignment
        if (!cell.fill || cell.fill.type !== "gradient") {
          cell.fill = {
            type:    "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" },
          };
        }
      });
    }
  }

  // ── Auto-width columns ──────────────────────────────────────────────────────
  ws.columns.forEach((col, i) => {
    const headerLen = String(headers[i] ?? "").length;
    const maxDataLen = rows.reduce((max, row) => {
      return Math.max(max, (row[i] ?? "").length);
    }, headerLen);
    col.width = Math.min(Math.max(maxDataLen + 3, 12), 42);
  });

  // ── Summary row at bottom ───────────────────────────────────────────────────
  const summaryRow = ws.addRow([]);   // blank spacer
  ws.addRow([`Total rows: ${rows.length}`] as string[])
    .getCell(1).font = { italic: true, color: { argb: "FF64748B" } };

  void summaryRow; // suppress unused warning

  const raw = await wb.xlsx.writeBuffer();
  // writeBuffer() returns Buffer (Node) | ArrayBuffer. Normalise to Uint8Array<ArrayBuffer>
  // (valid BodyInit / BlobPart) — explicit cast is safe because:
  //   Buffer branch   → new Uint8Array(buf) copies bytes into a fresh ArrayBuffer
  //   ArrayBuffer branch → wraps the existing ArrayBuffer directly
  return Buffer.isBuffer(raw)
    ? (new Uint8Array(raw) as unknown as Uint8Array<ArrayBuffer>)
    : (new Uint8Array(raw as ArrayBuffer) as unknown as Uint8Array<ArrayBuffer>);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtNum(v: number | bigint | null | undefined): string {
  return Number(v ?? 0).toFixed(2);
}
