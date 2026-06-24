import {
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Clock,
  CreditCard,
  FileQuestion,
  History,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  PiggyBank,
  Rocket,
  Settings,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export type HelpArticleCategory = "getting-started" | "user-guide" | "faq" | "tips" | "changelog";

export type HelpArticle = {
  id: string;
  category: HelpArticleCategory;
  title: string;
  summary: string;
  icon: typeof BookOpen;
  tags?: string[];
};

export type HelpSection = {
  id: HelpArticleCategory;
  title: string;
  eyebrow: string;
  description: string;
  accent: string;
  articles: HelpArticle[];
};

export const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    eyebrow: "Start",
    description: "Set up the foundations FinanceOS uses for accurate planning.",
    accent: "#00D68F",
    articles: [
      {
        id: "initial-setup",
        category: "getting-started",
        title: "Initial Setup",
        summary: "Create your first budget workspace and confirm the basic profile details.",
        icon: Rocket,
        tags: ["Setup"],
      },
      {
        id: "choosing-year",
        category: "getting-started",
        title: "Choosing Year",
        summary: "Select the active planning year that drives monthly dashboards and reports.",
        icon: CalendarDays,
        tags: ["Planning"],
      },
      {
        id: "selecting-timezone",
        category: "getting-started",
        title: "Selecting Timezone",
        summary: "Keep live date, time, and budget context aligned with your local timezone.",
        icon: Clock,
        tags: ["Regional"],
      },
      {
        id: "choosing-week-start-day",
        category: "getting-started",
        title: "Choosing Week Start Day",
        summary: "Set Sunday or Monday as the first day for weekly planning habits.",
        icon: Settings,
        tags: ["Regional"],
      },
      {
        id: "adding-payment-methods",
        category: "getting-started",
        title: "Adding Payment Methods",
        summary: "Organize cards, bank accounts, and cash sources used across transactions.",
        icon: CreditCard,
        tags: ["Payments"],
      },
    ],
  },
  {
    id: "user-guide",
    title: "User Guide",
    eyebrow: "Guide",
    description: "Understand every major workspace in the FinanceOS flow.",
    accent: "#3B82F6",
    articles: [
      {
        id: "dashboard-overview",
        category: "user-guide",
        title: "Dashboard Overview",
        summary: "Read KPI cards, monthly progress, upcoming activity, and cash position.",
        icon: LayoutDashboard,
      },
      {
        id: "income-tracking",
        category: "user-guide",
        title: "Income Tracking",
        summary: "Track expected and received income for the active month.",
        icon: TrendingUp,
      },
      {
        id: "expense-tracking",
        category: "user-guide",
        title: "Expense Tracking",
        summary: "Manage bills, spending categories, paid status, and payment methods.",
        icon: CreditCard,
      },
      {
        id: "savings-goals",
        category: "user-guide",
        title: "Savings Goals",
        summary: "Use goal progress to understand deposits and remaining targets.",
        icon: PiggyBank,
      },
      {
        id: "debt-tracking",
        category: "user-guide",
        title: "Debt Tracking",
        summary: "Follow balances, payments, due dates, and payoff movement.",
        icon: TrendingDown,
      },
      {
        id: "reports",
        category: "user-guide",
        title: "Reports",
        summary: "Review category trends, income/expense movement, and planning signals.",
        icon: LineChart,
      },
      {
        id: "archives",
        category: "user-guide",
        title: "Archives",
        summary: "Save monthly and annual snapshots for long-term budget review.",
        icon: Archive,
      },
      {
        id: "notification-center",
        category: "user-guide",
        title: "Notification Center",
        summary: "Review alerts, toast history, unread state, and activity records.",
        icon: Bell,
      },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    eyebrow: "Answers",
    description: "Quick answers to common FinanceOS behavior questions.",
    accent: "#8B5CF6",
    articles: [
      {
        id: "transaction-not-appearing",
        category: "faq",
        title: "Why doesn't my transaction appear?",
        summary: "Check the active month/year, preview state, filters, and saved transaction status.",
        icon: FileQuestion,
      },
      {
        id: "month-year-filters",
        category: "faq",
        title: "How do month/year filters work?",
        summary: "The top-bar planning period controls dashboard context and month-specific views.",
        icon: CalendarDays,
      },
      {
        id: "archive-behavior",
        category: "faq",
        title: "How do archives work?",
        summary: "Archives store snapshots so current edits do not rewrite historical review points.",
        icon: Archive,
      },
      {
        id: "notification-behavior",
        category: "faq",
        title: "How do notifications work?",
        summary: "Toasts are saved to history, unread counts persist, and users manage read state.",
        icon: Bell,
      },
      {
        id: "payment-method-behavior",
        category: "faq",
        title: "How do payment methods work?",
        summary: "Payment methods label transactions and can be updated from Settings.",
        icon: CreditCard,
      },
      {
        id: "expected-transactions",
        category: "faq",
        title: "How does Expected Transactions work?",
        summary: "Expected items help compare planned activity against actual monthly transactions.",
        icon: CircleHelp,
      },
    ],
  },
  {
    id: "tips",
    title: "Tips & Best Practices",
    eyebrow: "Optimize",
    description: "Suggested workflows for consistent budget review and decision-making.",
    accent: "#F59E0B",
    articles: [
      {
        id: "monthly-budgeting-workflow",
        category: "tips",
        title: "Monthly Budgeting Workflow",
        summary: "Start with expected amounts, reconcile transactions, review KPIs, then archive.",
        icon: Target,
      },
      {
        id: "savings-strategies",
        category: "tips",
        title: "Savings Strategies",
        summary: "Track deposits against goals and review remaining amount before discretionary spend.",
        icon: PiggyBank,
      },
      {
        id: "debt-management-workflow",
        category: "tips",
        title: "Debt Management Workflow",
        summary: "Review due dates, payment progress, and payoff movement before month close.",
        icon: ShieldCheck,
      },
      {
        id: "report-review-workflow",
        category: "tips",
        title: "Report Review Workflow",
        summary: "Use reports to identify category drift, income changes, and budget adjustments.",
        icon: Lightbulb,
      },
    ],
  },
  {
    id: "changelog",
    title: "Changelog / What's New",
    eyebrow: "Releases",
    description: "A future-ready release notes structure for FinanceOS updates.",
    accent: "#EF4444",
    articles: [
      {
        id: "release-notes-placeholder",
        category: "changelog",
        title: "Release Notes Placeholder",
        summary: "Future FinanceOS release notes will appear here with dated changes and highlights.",
        icon: History,
        tags: ["Coming Soon"],
      },
    ],
  },
];

export const helpArticleCount = helpSections.reduce((total, section) => total + section.articles.length, 0);
