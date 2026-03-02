/**
 * app/admin/feature-flags/page.tsx
 *
 * Admin feature-flag management page.
 *
 * Renders all flags defined in lib/flags.ts, split into two groups:
 *   • "Core Features"   — flags that are ON by default (reviews, wishlist)
 *   • "Experimental"    — flags that are OFF by default (new UI, promos, etc.)
 *
 * Each card uses the <FeatureFlagToggle> client component for optimistic toggling.
 */

import { getAllFlags }        from "@/lib/actions/feature-flags";
import { FLAG_META }          from "@/lib/flags";
import FeatureFlagToggle      from "@/components/FeatureFlagToggle";

export const dynamic = "force-dynamic"; // always fetch current DB state

export default async function FeatureFlagsPage() {
  const flags = await getAllFlags();

  const coreFlags         = flags.filter((f) => FLAG_META[f.name].defaultValue === true);
  const experimentalFlags = flags.filter((f) => FLAG_META[f.name].defaultValue === false);

  const enabledCount = flags.filter((f) => f.enabled).length;

  return (
    <div className="space-y-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
          <p className="mt-1 text-sm text-gray-500">
            Toggle features without a re-deploy. Changes take effect within 5 minutes.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 shadow-sm">
          <span className="text-2xl font-bold text-blue-600">{enabledCount}</span>
          <span className="text-sm text-gray-500">
            / {flags.length} enabled
          </span>
        </div>
      </div>

      {/* ── Core features ──────────────────────────────────────────────────── */}
      {coreFlags.length > 0 && (
        <section>
          <SectionHeader
            title="Core Features"
            description="These features are on by default. Disable them to temporarily hide functionality."
          />
          <FlagGrid flags={coreFlags} />
        </section>
      )}

      {/* ── Experimental ───────────────────────────────────────────────────── */}
      {experimentalFlags.length > 0 && (
        <section>
          <SectionHeader
            title="Experimental"
            description="These features are off by default. Enable them to roll out new functionality."
          />
          <FlagGrid flags={experimentalFlags} />
        </section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function FlagGrid({
  flags,
}: {
  flags: Awaited<ReturnType<typeof getAllFlags>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {flags.map((flag) => (
        <FeatureFlagToggle key={flag.name} flag={flag} />
      ))}
    </div>
  );
}
