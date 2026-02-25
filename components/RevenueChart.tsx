"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface RevenueDataPoint {
  /** Short month label, e.g. "Jan", "Feb" */
  month: string;
  revenue: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-indigo-600 font-semibold">
        ${payload[0].value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export default function RevenueChart({ data }: { data: RevenueDataPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400">
        No revenue data yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
          dot={false}
          activeDot={{ r: 5, fill: "#6366f1", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
