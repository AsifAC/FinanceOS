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
}

const PALETTE = [
  { color: "#DC2626" },
  { color: "#D97706" },
  { color: "#2563EB" },
  { color: "#7C3AED" },
  { color: "#00A676" },
  { color: "#64748B" },
];

const ACTIVE_SLICE_OFFSET = 9;
const DONUT_OUTER_RADIUS = 104;
const DONUT_INNER_RADIUS = 58;

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

        return {
          ...item,
          percentage,
          startAngle,
          endAngle,
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
              className="h-auto w-full max-w-[20rem] overflow-visible sm:max-w-[22rem]"
              role="img"
              aria-label="Expense category distribution donut chart"
            >
              <circle cx="160" cy="160" r="111" fill="var(--financeos-surface-elevated)" stroke="var(--financeos-border)" strokeWidth="1" />

              {prepared.map((item) => {
                const isHovered = item.category === hoveredCategory;
                const offset = getOffset(item.startAngle, item.endAngle, isHovered ? ACTIVE_SLICE_OFFSET : 0);
                const labelOffset = getOffset(item.startAngle, item.endAngle, 124);
                const path = createDonutSlicePath(160, 160, DONUT_OUTER_RADIUS, DONUT_INNER_RADIUS, item.startAngle, item.endAngle);

                return (
                  <g
                    key={item.category}
                    className="financeos-donut-slice cursor-pointer outline-none"
                    tabIndex={0}
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                      transformOrigin: "160px 160px",
                    }}
                    onMouseEnter={() => setHoveredCategory(item.category)}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onFocus={() => setHoveredCategory(item.category)}
                    onBlur={() => setHoveredCategory(null)}
                    aria-label={`${item.category}: ${formatCurrency(item.amount)}, ${item.percentage.toFixed(1)} percent`}
                  >
                    <path
                      d={path}
                      fill={item.color}
                      stroke="var(--financeos-surface)"
                      strokeLinejoin="round"
                      strokeWidth={isHovered ? 4 : 3}
                      style={{
                        filter: isHovered ? "drop-shadow(0 10px 18px rgba(0, 0, 0, 0.22))" : "none",
                        transition: "filter 180ms ease, stroke-width 180ms ease",
                      }}
                    />
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

              <style>
                {`
                  .financeos-donut-slice {
                    transition: transform 180ms ease;
                    will-change: transform;
                    backface-visibility: hidden;
                    transform-box: fill-box;
                  }

                  @media (prefers-reduced-motion: reduce) {
                    .financeos-donut-slice {
                      transition: none !important;
                      transform: none !important;
                    }

                    .financeos-donut-slice path {
                      transition: none !important;
                    }
                  }
                `}
              </style>

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
                  style={{ backgroundColor: item.color }}
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
