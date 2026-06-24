import { useMemo, useState } from "react";
import type { ReactNode } from "react";

export interface ExpenseDonutDatum {
  category: string;
  amount: number;
}

interface PreparedDatum extends ExpenseDonutDatum {
  percentage: number;
  startAngle: number;
  endAngle: number;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  elevation: number;
}

const PALETTE = [
  { color: "#ef4444", gradientFrom: "#EF4444", gradientTo: "#DC2626" },
  { color: "#f59e0b", gradientFrom: "#F59E0B", gradientTo: "#D97706" },
  { color: "#3b82f6", gradientFrom: "#3B82F6", gradientTo: "#2563EB" },
  { color: "#8b5cf6", gradientFrom: "#8B5CF6", gradientTo: "#6366F1" },
  { color: "#00d68f", gradientFrom: "#00D68F", gradientTo: "#00C26E" },
  { color: "#64748b", gradientFrom: "#94A3B8", gradientTo: "#64748B" },
];

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(radians),
    y: cy + r * Math.sin(radians),
  };
}

function createDonutSlicePath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function getOffset(startAngle: number, endAngle: number, amount: number) {
  const midAngle = ((startAngle + endAngle) / 2 - 90) * (Math.PI / 180);
  return {
    x: Math.cos(midAngle) * amount,
    y: Math.sin(midAngle) * amount,
  };
}

function formatCurrency(value: number) {
  return `$${value.toLocaleString()}`;
}

export function ElevatedExpenseDonutChart({ data }: { data: ExpenseDonutDatum[] }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const prepared = useMemo<PreparedDatum[]>(() => {
    const filtered = data.filter((item) => item.amount > 0);
    const total = filtered.reduce((sum, item) => sum + item.amount, 0);
    let cursor = 0;

    return filtered
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((item, index) => {
        const percentage = total > 0 ? (item.amount / total) * 100 : 0;
        const startAngle = cursor;
        const endAngle = cursor + (percentage / 100) * 360;
        cursor = endAngle;
        const palette = PALETTE[index % PALETTE.length];
        const elevation = percentage >= 45 ? 14 : percentage >= 20 ? 9 : percentage >= 10 ? 6 : 3;

        return {
          ...item,
          percentage,
          startAngle,
          endAngle,
          elevation,
          ...palette,
        };
      });
  }, [data]);

  const total = prepared.reduce((sum, item) => sum + item.amount, 0);
  const hovered = prepared.find((item) => item.category === hoveredCategory) ?? prepared[0];

  if (!prepared.length) {
    return (
      <CardShell>
        <div className="financeos-muted-panel flex min-h-[22rem] items-center justify-center rounded-3xl border p-8 text-center">
          <p className="max-w-xs text-sm text-[var(--financeos-text-muted)]">
            No expense data yet. Add transactions to see your spending breakdown.
          </p>
        </div>
      </CardShell>
    );
  }

  return (
    <CardShell>
      <div className="rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] sm:p-5">
        <div>
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--financeos-text-muted)]">Expense distribution</p>
              <h3 className="text-lg text-[var(--financeos-text-primary)]" style={{ fontWeight: 700 }}>Category Breakdown</h3>
            </div>
            <p className="text-sm text-[var(--financeos-text-secondary)]">Total {formatCurrency(total)}</p>
          </div>

          <div className="relative mx-auto flex max-w-[26rem] items-center justify-center">
            <svg
              viewBox="0 0 320 320"
              className="h-auto w-full max-w-[20rem] overflow-visible drop-shadow-2xl sm:max-w-[22rem]"
              role="img"
              aria-label="Expense category distribution donut chart"
            >
              <defs>
                <filter id="slice-depth" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#050506" floodOpacity="0.42" />
                </filter>
                {prepared.map((item) => (
                  <linearGradient key={item.category} id={`gradient-${item.category.replace(/\W/g, "-")}`} x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor={item.gradientFrom} />
                    <stop offset="100%" stopColor={item.gradientTo} />
                  </linearGradient>
                ))}
              </defs>

              <circle cx="160" cy="160" r="111" fill="var(--financeos-surface-elevated)" stroke="var(--financeos-border)" strokeWidth="1" />

              {prepared.map((item) => {
                const isHovered = item.category === hoveredCategory;
                const isLargest = item.category === prepared[0].category;
                const offset = getOffset(item.startAngle, item.endAngle, item.elevation + (isHovered ? 6 : 0));
                const labelOffset = getOffset(item.startAngle, item.endAngle, 124 + item.elevation);
                const path = createDonutSlicePath(160, 160, 104, 58, item.startAngle, item.endAngle);
                const gradientId = `gradient-${item.category.replace(/\W/g, "-")}`;

                return (
                  <g
                    key={item.category}
                    className="cursor-pointer outline-none"
                    tabIndex={0}
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${isHovered ? 1.035 : 1})`,
                      transformOrigin: "160px 160px",
                      transition: "transform 220ms ease, opacity 220ms ease",
                    }}
                    onMouseEnter={() => setHoveredCategory(item.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onFocus={() => setHoveredCategory(item.category)}
                    onBlur={() => setHoveredCategory(null)}
                    aria-label={`${item.category}: ${formatCurrency(item.amount)}, ${item.percentage.toFixed(1)} percent`}
                  >
                    <path d={path} fill={`url(#${gradientId})`} opacity="0.28" transform="translate(0 12)" />
                    <path
                      d={path}
                      fill={`url(#${gradientId})`}
                      filter="url(#slice-depth)"
                      stroke={isLargest ? "rgba(255,255,255,0.38)" : "rgba(255,255,255,0.22)"}
                      strokeWidth={isHovered || isLargest ? 2 : 1}
                    />
                    <path d={path} fill="rgba(255,255,255,0.18)" transform="translate(-3 -5) scale(0.985)" style={{ transformOrigin: "160px 160px" }} />
                    {item.percentage >= 5 && (
                      <text
                        x={160 + labelOffset.x}
                        y={160 + labelOffset.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white text-[11px]"
                        style={{ fontWeight: 700 }}
                      >
                        {item.percentage.toFixed(0)}%
                      </text>
                    )}
                  </g>
                );
              })}

              <circle cx="160" cy="160" r="51" fill="var(--financeos-surface)" stroke="var(--financeos-border)" strokeWidth="1" />
              <text x="160" y="150" textAnchor="middle" className="fill-[var(--financeos-text-muted)] text-[10px] uppercase tracking-[0.18em]">
                {hovered?.category ?? "Total"}
              </text>
              <text x="160" y="171" textAnchor="middle" className="fill-[var(--financeos-text-primary)] text-[18px]" style={{ fontWeight: 800 }}>
                {hovered ? formatCurrency(hovered.amount) : formatCurrency(total)}
              </text>
              <text x="160" y="188" textAnchor="middle" className="fill-[var(--financeos-text-muted)] text-[11px]">
                {hovered ? `${hovered.percentage.toFixed(1)}% of spend` : "tracked spend"}
              </text>
            </svg>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {prepared.map((item) => (
              <button
                key={item.category}
                type="button"
                className="flex min-h-14 items-center gap-3 rounded-2xl border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-3 py-2 text-left transition-all hover:-translate-y-0.5 hover:bg-[var(--financeos-surface-hover)] focus:outline-none focus:ring-2 focus:ring-slate-300/40"
                onMouseEnter={() => setHoveredCategory(item.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                onFocus={() => setHoveredCategory(item.category)}
                onBlur={() => setHoveredCategory(null)}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})` }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[var(--financeos-text-primary)]" style={{ fontWeight: 600 }}>{item.category}</span>
                  <span className="block text-xs text-[var(--financeos-text-muted)]">{formatCurrency(item.amount)}</span>
                </span>
                <span className="text-sm text-[var(--financeos-text-secondary)]" style={{ fontWeight: 700 }}>{item.percentage.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[22px] text-[var(--financeos-text-primary)]">
      {children}
    </section>
  );
}
