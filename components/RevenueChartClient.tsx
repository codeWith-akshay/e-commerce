"use client";

import dynamic from "next/dynamic";
import type { RevenueDataPoint } from "./RevenueChart";

// ── Dynamic import lives here (Client Component) so that `ssr: false` is valid.
// The admin Server Component imports *this* wrapper, not RevenueChart directly.
const RevenueChart = dynamic(() => import("./RevenueChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-70 items-center justify-center text-sm text-slate-400">
      Loading chart…
    </div>
  ),
});

export default function RevenueChartClient({ data }: { data: RevenueDataPoint[] }) {
  return <RevenueChart data={data} />;
}
