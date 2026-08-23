import type { SavedYearlyBudget, YearlyBudgetSummary } from "../lib/financeStore";
import { calculateBudgetHealthScore } from "../lib/budgetHealthScore";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 48;
const TOP_MARGIN = 46;
const BOTTOM_MARGIN = 58;

const NAVY = [0.06, 0.09, 0.16] as const;
const TEXT = [0.12, 0.16, 0.23] as const;
const MUTED = [0.39, 0.45, 0.53] as const;
const BORDER = [0.83, 0.87, 0.92] as const;
const SOFT = [0.96, 0.98, 1] as const;
const ROW = [0.98, 0.99, 1] as const;
const WHITE = [1, 1, 1] as const;

export const PDF_ACTUAL_COLOR = "#3B82F6";
export const PDF_EXPECTED_COLOR = "#94A3B8";

const ACTUAL_RGB = [0.231, 0.51, 0.965] as const;
const EXPECTED_RGB = [0.58, 0.64, 0.72] as const;

type Rgb = readonly [number, number, number];

interface PdfCell {
  text: string;
  align?: "left" | "right" | "center";
  color?: Rgb;
}

interface PdfPage {
  commands: string[];
}

export interface AnnualReportData {
  year: string;
  generatedAt: Date;
  profileName: string;
  annualTotals: {
    income: number;
    expenses: number;
    savings: number;
    debt: number;
    amountLeft: number;
    expectedTotal: number;
    budgetHealthScore: number;
  };
  actualVsExpected: Array<{
    label: string;
    actual: number;
    expected: number;
    difference: number;
    differencePct: number | null;
  }>;
  monthlyBreakdown: YearlyBudgetSummary["yearly_monthly_breakdown"];
  categoryBreakdown: YearlyBudgetSummary["yearly_category_rankings"];
  highlights: Array<{ label: string; value: string }>;
  notes: string;
}

function finite(value: number | undefined | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function money(value: number | undefined | null) {
  const safe = finite(value);
  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not available";
  return `${value.toFixed(1)}%`;
}

function clean(value: unknown) {
  if (value === null || value === undefined) return "Not available";
  const text = String(value).replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
  return text || "Not available";
}

function pdfText(value: unknown) {
  return clean(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function rgb(color: Rgb) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function hexToRgb(hex: string): Rgb {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function wrapText(text: string, width: number, fontSize: number) {
  const words = clean(text).split(" ");
  const maxChars = Math.max(8, Math.floor(width / (fontSize * 0.5)));
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    line = word.length > maxChars ? `${word.slice(0, maxChars - 3)}...` : word;
  });

  if (line) lines.push(line);
  return lines;
}

function truncate(text: string, width: number, fontSize: number) {
  const value = clean(text);
  const maxChars = Math.max(4, Math.floor(width / (fontSize * 0.5)));
  return value.length > maxChars ? `${value.slice(0, maxChars - 3)}...` : value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

class PdfBuilder {
  private pages: PdfPage[] = [{ commands: [] }];
  private y = TOP_MARGIN;

  private get page() {
    return this.pages[this.pages.length - 1];
  }

  private pdfY(y: number) {
    return PAGE_HEIGHT - y;
  }

  addPage() {
    this.pages.push({ commands: [] });
    this.y = TOP_MARGIN;
    this.documentHeader();
  }

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - BOTTOM_MARGIN) {
      this.addPage();
    }
  }

  move(amount: number) {
    this.y += amount;
  }

  fillRect(x: number, y: number, width: number, height: number, color: Rgb) {
    this.page.commands.push(`q ${rgb(color)} rg ${x} ${this.pdfY(y + height)} ${width} ${height} re f Q`);
  }

  strokeRect(x: number, y: number, width: number, height: number, color: Rgb, lineWidth = 0.7) {
    this.page.commands.push(`q ${rgb(color)} RG ${lineWidth} w ${x} ${this.pdfY(y + height)} ${width} ${height} re S Q`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, lineWidth = 1) {
    this.page.commands.push(`q ${rgb(color)} RG ${lineWidth} w ${x1} ${this.pdfY(y1)} m ${x2} ${this.pdfY(y2)} l S Q`);
  }

  text(value: string, x: number, y: number, size = 10, color: Rgb = TEXT, font = "F1") {
    this.page.commands.push(`BT /${font} ${size} Tf ${rgb(color)} rg ${x} ${this.pdfY(y)} Td (${pdfText(value)}) Tj ET`);
  }

  wrappedText(value: string, x: number, y: number, width: number, size = 10, color: Rgb = TEXT, lineHeight = size + 4) {
    const lines = wrapText(value, width, size);
    lines.forEach((line, index) => this.text(line, x, y + index * lineHeight, size, color));
    return lines.length * lineHeight;
  }

  documentHeader() {
    this.text("FinanceOS", MARGIN_X, 30, 11, ACTUAL_RGB, "F2");
    this.line(MARGIN_X, 38, PAGE_WIDTH - MARGIN_X, 38, ACTUAL_RGB, 1.3);
    this.y = 56;
  }

  section(title: string) {
    this.ensureSpace(48);
    this.move(18);
    this.text(title, MARGIN_X, this.y, 13, NAVY, "F2");
    this.line(MARGIN_X, this.y + 8, PAGE_WIDTH - MARGIN_X, this.y + 8, BORDER, 0.6);
    this.move(24);
  }

  paragraph(text: string) {
    this.ensureSpace(42);
    const used = this.wrappedText(text, MARGIN_X, this.y, PAGE_WIDTH - MARGIN_X * 2, 9, MUTED, 13);
    this.move(used + 4);
  }

  kpiCards(cards: Array<{ label: string; value: string; accent?: Rgb }>) {
    const gap = 10;
    const columns = 3;
    const width = (PAGE_WIDTH - MARGIN_X * 2 - gap * (columns - 1)) / columns;
    const height = 54;

    cards.forEach((card, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      if (col === 0) this.ensureSpace(height + 12);
      const x = MARGIN_X + col * (width + gap);
      const y = this.y + row * (height + gap);
      this.fillRect(x, y, width, height, SOFT);
      this.strokeRect(x, y, width, height, BORDER);
      this.line(x, y, x, y + height, card.accent ?? ACTUAL_RGB, 3);
      this.text(card.label, x + 12, y + 18, 8, MUTED, "F2");
      this.text(card.value, x + 12, y + 39, 12, NAVY, "F2");
    });

    this.move(Math.ceil(cards.length / columns) * (height + gap) + 4);
  }

  table(headers: string[], rows: PdfCell[][], widths: number[]) {
    const rowHeight = 24;
    const tableWidth = widths.reduce((sum, width) => sum + width, 0);

    const drawRow = (cells: PdfCell[], y: number, isHeader: boolean, index: number) => {
      this.fillRect(MARGIN_X, y, tableWidth, rowHeight, isHeader ? NAVY : index % 2 === 0 ? WHITE : ROW);
      this.strokeRect(MARGIN_X, y, tableWidth, rowHeight, BORDER, 0.45);
      let x = MARGIN_X;
      cells.forEach((cell, cellIndex) => {
        const width = widths[cellIndex];
        const color = isHeader ? WHITE : cell.color ?? TEXT;
        const size = isHeader ? 8 : 8.2;
        const font = isHeader ? "F2" : "F1";
        const text = truncate(cell.text, width - 12, size);
        const textWidth = text.length * size * 0.48;
        const align = cell.align ?? (cellIndex === 0 ? "left" : "right");
        const tx = align === "right" ? x + width - 8 - textWidth : align === "center" ? x + width / 2 - textWidth / 2 : x + 8;
        this.text(text, tx, y + 15.5, size, color, font);
        x += width;
      });
    };

    this.ensureSpace(rowHeight * 2);
    drawRow(headers.map((text) => ({ text })), this.y, true, 0);
    this.move(rowHeight);

    rows.forEach((row, index) => {
      this.ensureSpace(rowHeight + 4);
      drawRow(row, this.y, false, index);
      this.move(rowHeight);
    });

    this.move(8);
  }

  footer(year: string, generatedAt: Date) {
    const total = this.pages.length;
    const generated = generatedAt.toLocaleDateString();
    this.pages.forEach((page, index) => {
      page.commands.push(`q ${rgb(BORDER)} RG 0.6 w ${MARGIN_X} 40 m ${PAGE_WIDTH - MARGIN_X} 40 l S Q`);
      page.commands.push(`BT /F1 8 Tf ${rgb(MUTED)} rg ${MARGIN_X} 25 Td (FinanceOS) Tj ET`);
      page.commands.push(`BT /F1 8 Tf ${rgb(MUTED)} rg 250 25 Td (Report year ${pdfText(year)}) Tj ET`);
      page.commands.push(`BT /F1 8 Tf ${rgb(MUTED)} rg 400 25 Td (Generated ${pdfText(generated)}) Tj ET`);
      page.commands.push(`BT /F1 8 Tf ${rgb(MUTED)} rg 526 25 Td (Page ${index + 1} of ${total}) Tj ET`);
    });
  }

  build(year: string, generatedAt: Date) {
    this.footer(year, generatedAt);

    const objects: string[] = [];
    const add = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageRefs: number[] = [];

    this.pages.forEach((page) => {
      const stream = page.commands.join("\n");
      const contentRef = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageRef = add(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentRef} 0 R >>`);
      pageRefs.push(pageRef);
    });

    const pagesRef = add(`<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`);
    const catalogRef = add(`<< /Type /Catalog /Pages ${pagesRef} 0 R >>`);

    pageRefs.forEach((ref) => {
      objects[ref - 1] = objects[ref - 1].replace("/Parent 0 0 R", `/Parent ${pagesRef} 0 R`);
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return new Blob([pdf], { type: "application/pdf" });
  }
}

export function buildAnnualReportData(snapshot: SavedYearlyBudget, profileName?: string): AnnualReportData {
  const summary = snapshot.summary_json;
  const expectedAmountLeft = summary.expected_yearly_income - summary.expected_yearly_savings - summary.expected_yearly_debt - summary.expected_yearly_expenses;
  const budgetHealthScore = calculateBudgetHealthScore({
    actualIncome: summary.total_income,
    expectedIncome: summary.expected_yearly_income,
    actualExpenses: summary.total_expenses,
    expectedExpenses: summary.expected_yearly_expenses,
    actualSavings: summary.total_savings,
    expectedSavings: summary.expected_yearly_savings,
    actualDebtPayments: summary.total_debt,
    expectedDebtPayments: summary.expected_yearly_debt,
    selectedYear: summary.year,
  }).score;

  const comparisons = [
    ["Income", summary.total_income, summary.expected_yearly_income],
    ["Expenses", summary.total_expenses, summary.expected_yearly_expenses],
    ["Savings", summary.total_savings, summary.expected_yearly_savings],
    ["Debt payments", summary.total_debt, summary.expected_yearly_debt],
  ] as const;

  return {
    year: summary.year,
    generatedAt: new Date(),
    profileName: clean(profileName || "Not available"),
    annualTotals: {
      income: summary.total_income,
      expenses: summary.total_expenses,
      savings: summary.total_savings,
      debt: summary.total_debt,
      amountLeft: summary.total_amount_left,
      expectedTotal: summary.expected_yearly_income + summary.expected_yearly_expenses + summary.expected_yearly_savings + summary.expected_yearly_debt,
      budgetHealthScore,
    },
    actualVsExpected: comparisons.map(([label, actual, expected]) => {
      const difference = actual - expected;
      return {
        label,
        actual,
        expected,
        difference,
        differencePct: expected ? (difference / expected) * 100 : null,
      };
    }).concat([{
      label: "Amount left",
      actual: summary.total_amount_left,
      expected: expectedAmountLeft,
      difference: summary.total_amount_left - expectedAmountLeft,
      differencePct: expectedAmountLeft ? ((summary.total_amount_left - expectedAmountLeft) / expectedAmountLeft) * 100 : null,
    }]),
    monthlyBreakdown: summary.yearly_monthly_breakdown ?? [],
    categoryBreakdown: summary.yearly_category_rankings ?? [],
    highlights: [
      { label: "Best savings month", value: summary.best_savings_month },
      { label: "Highest income month", value: summary.highest_income_month },
      { label: "Highest expense month", value: summary.highest_expense_month },
      { label: "Highest debt payoff", value: summary.highest_debt_payoff_month },
    ],
    notes: summary.notes,
  };
}

function statusForAmountLeft(value: number) {
  if (value > 0) return "Positive";
  if (value < 0) return "Deficit";
  return "Balanced";
}

function generateAnnualReportPdf(data: AnnualReportData) {
  const pdf = new PdfBuilder();
  const generatedLabel = data.generatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  pdf.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, WHITE);
  pdf.fillRect(0, 0, PAGE_WIDTH, 112, SOFT);
  pdf.line(MARGIN_X, 112, PAGE_WIDTH - MARGIN_X, 112, ACTUAL_RGB, 2);
  pdf.text("FinanceOS", MARGIN_X, 60, 18, ACTUAL_RGB, "F2");
  pdf.text("Annual Budget Report", MARGIN_X, 88, 28, NAVY, "F2");
  pdf.text(`Report year ${data.year}`, MARGIN_X, 112, 12, MUTED);
  pdf.text(`Generated ${generatedLabel}`, 372, 60, 10, MUTED);
  pdf.text(`Profile: ${data.profileName}`, 372, 78, 10, MUTED);
  pdf.text("Generated from FinanceOS archived budget data", 372, 96, 9, MUTED);
  pdf.move(104);

  pdf.section("Executive Summary");
  pdf.kpiCards([
    { label: "Total income", value: money(data.annualTotals.income), accent: ACTUAL_RGB },
    { label: "Total expenses", value: money(data.annualTotals.expenses), accent: [0.9, 0.27, 0.27] },
    { label: "Total savings", value: money(data.annualTotals.savings), accent: ACTUAL_RGB },
    { label: "Debt payments", value: money(data.annualTotals.debt), accent: [0.96, 0.62, 0.04] },
    { label: "Amount left", value: money(data.annualTotals.amountLeft), accent: data.annualTotals.amountLeft >= 0 ? [0.07, 0.72, 0.51] : [0.9, 0.27, 0.27] },
    { label: "Budget Health Score", value: `${data.annualTotals.budgetHealthScore}/100`, accent: ACTUAL_RGB },
  ]);

  pdf.paragraph(`Expected transactions total: ${money(data.annualTotals.expectedTotal)}. This report is generated from the archived annual snapshot and does not blend in current dashboard data.`);

  pdf.section("Actual vs Expected Summary");
  pdf.paragraph(`Actual indicators use ${PDF_ACTUAL_COLOR}. Expected indicators use ${PDF_EXPECTED_COLOR}.`);
  pdf.table(
    ["Metric", "Actual", "Expected", "Difference", "Diff %"],
    data.actualVsExpected.map((item) => [
      { text: item.label },
      { text: money(item.actual), color: ACTUAL_RGB },
      { text: money(item.expected), color: EXPECTED_RGB },
      { text: money(item.difference), color: item.difference >= 0 ? [0.07, 0.55, 0.36] : [0.78, 0.16, 0.16] },
      { text: percent(item.differencePct) },
    ]),
    [130, 96, 96, 96, 78],
  );

  pdf.section("Monthly Breakdown");
  pdf.table(
    ["Month", "Income", "Expenses", "Savings", "Debt", "Left", "Expected", "Status"],
    data.monthlyBreakdown.map((month) => [
      { text: month.month_label },
      { text: money(month.income) },
      { text: money(month.expenses) },
      { text: money(month.savings) },
      { text: money(month.debt) },
      { text: money(month.amount_left) },
      { text: "Not available" },
      { text: statusForAmountLeft(month.amount_left), align: "center" },
    ]),
    [76, 72, 72, 72, 62, 72, 82, 62],
  );

  pdf.section("Category Breakdown");
  const categoryTotal = data.categoryBreakdown.reduce((sum, item) => sum + finite(item.amount), 0);
  pdf.table(
    ["Category", "Type", "Annual Amount", "% of Total", "Indicator"],
    data.categoryBreakdown.length
      ? data.categoryBreakdown.map((item, index) => [
        { text: item.category },
        { text: "Expense" },
        { text: money(item.amount) },
        { text: categoryTotal ? percent((item.amount / categoryTotal) * 100) : "Not available" },
        { text: index < 3 ? "Top category" : "Tracked" },
      ])
      : [[{ text: "Not available" }, { text: "Not available" }, { text: "Not available" }, { text: "Not available" }, { text: "Not available" }]],
    [170, 82, 110, 82, 72],
  );

  pdf.section("Savings Report");
  pdf.table(
    ["Goal", "Target", "Saved", "Progress", "Status"],
    [[
      { text: "Annual savings" },
      { text: money(data.actualVsExpected.find((item) => item.label === "Savings")?.expected) },
      { text: money(data.annualTotals.savings) },
      { text: percent(data.actualVsExpected.find((item) => item.label === "Savings")?.expected ? (data.annualTotals.savings / finite(data.actualVsExpected.find((item) => item.label === "Savings")?.expected)) * 100 : null) },
      { text: data.annualTotals.savings >= finite(data.actualVsExpected.find((item) => item.label === "Savings")?.expected) ? "On track" : "Behind" },
    ], [
      { text: "Detailed goals" },
      { text: "Not available" },
      { text: "Not available" },
      { text: "Not available" },
      { text: "Not available" },
    ]],
    [150, 92, 92, 92, 90],
  );

  pdf.section("Debt Report");
  pdf.table(
    ["Debt", "Starting Balance", "Payments Made", "Remaining", "Minimum", "Interest"],
    [[
      { text: "Annual debt payments" },
      { text: "Not available" },
      { text: money(data.annualTotals.debt) },
      { text: "Not available" },
      { text: "Not available" },
      { text: "Not available" },
    ]],
    [120, 88, 92, 82, 70, 64],
  );

  pdf.section("Transaction Summary");
  pdf.table(
    ["Summary", "Value", "Notes"],
    data.highlights.map((item) => [
      { text: item.label },
      { text: item.value },
      { text: "Archived annual highlight" },
    ]).concat([[
      { text: "Top transactions" },
      { text: "Not available" },
      { text: "Annual archive snapshots store summary totals, not individual transaction rows." },
    ]]),
    [150, 130, 236],
  );

  pdf.section("Archive Notes");
  pdf.paragraph(data.notes || "Not available");

  return pdf.build(data.year, data.generatedAt);
}

export async function downloadAnnualReportPdf(snapshot: SavedYearlyBudget, profileName?: string) {
  const data = buildAnnualReportData(snapshot, profileName);
  const blob = generateAnnualReportPdf(data);
  downloadBlob(blob, `FinanceOS-Annual-Report-${data.year}.pdf`);
}
