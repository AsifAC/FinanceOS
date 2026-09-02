# FinanceOS Guidelines

## Project Overview

FinanceOS is a personal annual budget planner and tracker. It is inspired by a 12-month budget spreadsheet, but it should feel like a modern personal finance operating system.

The app helps track:

- Income
- Savings
- Debt
- Expenses
- Amount left
- Expected vs actual amounts
- Pending transactions
- Payment plans
- Monthly summaries
- Yearly summaries
- Reports
- Saved budget archives

## Tech Stack

- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui components if installed/available
- React Router
- Recharts and custom SVG charts
- React Context + `useReducer` shared state
- `localStorage` for current frontend persistence
- Backend, database, and auth provider are intentionally undecided
- Vercel planned for deployment

## Current Architecture

FinanceOS now uses a shared app data store instead of isolated runtime arrays.

Current shared data implementation:

- Store file: `src/app/lib/financeStore.tsx`
- Provider: `FinanceDataProvider`
- App wrapper: `src/app/components/layout/AppLayout.tsx`
- Persistence: `localStorage`
- Static date constants: `src/app/lib/constants.ts`
- Route error UI: `src/app/components/routing/RouteErrorBoundary.tsx`

The old runtime sample-data approach should not be reintroduced. Runtime data should come from real user input through the shared store.

## Product Decisions

### 1. Setup-First Flow

- The app should start at Setup for a new user.
- Setup should be the landing page and onboarding flow.
- After setup is completed, the app should transition into the Dashboard.
- Returning users should go directly to Dashboard.

Route behavior:

- `/` decides whether to show setup or dashboard.
- `/setup` shows setup.
- `/dashboard` shows dashboard.

Setup completion is tracked through setup state and the shared FinanceOS store. Avoid breaking the setup-to-dashboard flow.

### 2. Dashboard Requirements

Dashboard cards must stay in this exact order:

1. Income
2. Savings
3. Debt
4. Expenses
5. Amount Left

Dashboard should also include:

- Today’s date
- Pending transactions
- Upcoming payments
- Quick links
- Monthly summary
- Expected vs actual preview
- Best savings month

Dashboard totals must derive from shared real user data, not hardcoded arrays.

### 3. Navigation Decision

Do not use a large permanent sidebar.

Use a top navigation/menu dropdown.

Menu should include:

- Dashboard
- Income
- Expenses
- Categories
- Savings
- Debt
- Reports
- Archived Budgets
- Settings

Current menu component:

- `src/app/components/layout/MenuDropdown.tsx`

#### Income/Expenses Navigation Fix - 2026-06-19

Root cause:

- The floating menu used separate Income and Expenses labels, but both entries pointed to `/transactions`.
- `/transactions` rendered `ExpenseTracker`, so clicking Income opened the Expenses experience.
- There was no dedicated Income route/page mapping.

Files changed:

- `src/app/routes.ts`
- `src/app/components/layout/MenuDropdown.tsx`
- `src/app/components/layout/Sidebar.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/AddTransaction.tsx`
- `src/app/components/screens/ExpenseTracker.tsx`
- `src/app/components/screens/IncomeTracker.tsx`
- `guidelines.md`

Correct route/page keys:

- Income route/page key: `/income`, backed by `IncomeTracker`
- Expenses route/page key: `/expenses`, backed by `ExpenseTracker`
- Legacy `/transactions` redirects to `/expenses`
- Add Income route: `/add-transaction?type=income`
- Add Expense route: `/add-transaction?type=expense`

Verification steps used:

- Searched all navigation, menu, dashboard, KPI, and add-transaction links for shared Income/Expenses paths.
- Confirmed Income menu item uses `/income` and Expenses menu item uses `/expenses`.
- Confirmed Dashboard Income KPI uses `/income` and Expenses KPI uses `/expenses`.
- Confirmed Dashboard Add Income uses `/add-transaction?type=income` and Add Expense uses `/add-transaction?type=expense`.
- Confirmed expense tracker add buttons use `/add-transaction?type=expense`.
- Confirmed no Income nav item points to `/transactions` or `/expenses`.
- Confirmed no Expenses nav item points to `/transactions` or `/income`.
- Ran `npm run build` successfully with no TypeScript/build errors.

#### Active Budget Year Fix - 2026-06-19

Root cause:

- The interrupted fix had introduced `activeYear` in the shared finance store and moved many screens to read it, but setup completion still relied on separate setup-only localStorage keys.
- The app could therefore treat setup as complete while the shared app store initialized from `currentYear`, causing a selected setup year such as `2027` to be lost or displayed inconsistently after routing/refresh.
- Month selectors displayed a year but could not update the global active year, so year changes were not consistently propagated across pages.

Files changed:

- `src/app/lib/financeStore.tsx`
- `src/app/lib/setupState.ts`
- `src/app/components/common/MonthSelector.tsx`
- `src/app/components/routing/StartRoute.tsx`
- `src/app/components/routing/SetupRoute.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/Header.tsx`
- `src/app/components/screens/AddTransaction.tsx`
- `src/app/components/screens/AnnualPlanner.tsx`
- `src/app/components/screens/ExpectedAmounts.tsx`
- `src/app/components/screens/ExpenseTracker.tsx`
- `src/app/components/screens/IncomeTracker.tsx`
- `guidelines.md`

Final year architecture:

- `FinanceState.activeYear` is the single global source of truth for the active budget year.
- Setup writes `profile.year` into `activeYear` through the `COMPLETE_SETUP` reducer action.
- Header/top navigation and month selectors dispatch `setActiveYear`, which uses the `SET_ACTIVE_YEAR` reducer action.
- Dashboard, Income, Expenses, Categories, Savings/Debt transaction types, Reports, Archived Budgets, Header, Month Selector, Summary Cards, Pending Transactions, Payment Plans, Settings, and Add Transaction all read year-dependent state from `useFinanceData()`.
- Transactions are filtered by the year parsed from their `date`; pending fixed expenses/payment plans are filtered by `dueDate`/`nextDueDate`.
- New transaction default dates and payment-plan due dates are created from `activeYear`, not a hardcoded year.
- `currentYear` from `new Date().getFullYear()` is only used as the initial fallback/default and for nearby year option lists.

Persistence approach:

- The shared finance store persists the complete `FinanceState`, including `activeYear`, to `localStorage` under `financeos:app-data:v1`.
- `loadInitialState()` restores `activeYear` from the saved app state first, then falls back to `setupProfile.year`, an existing budget year, or finally `currentYear`.
- Legacy setup profile keys are still read as a compatibility fallback if the shared app-data record does not exist yet.
- Setup/reset still updates the setup metadata keys so older setup flow assumptions remain compatible, but route guards now use `state.setupCompleted` from the shared finance store.

Verification results:

- Searched `src` and `guidelines.md` for `2026`, `new Date().getFullYear()`, `selectedYear`, `activeYear`, `budgetYear`, and `setupYear`.
- Confirmed no runtime hardcoded `2026` remains in `src`; the only `2026` match is this dated guidelines heading.
- Confirmed setup saves the selected year into `activeYear`.
- Confirmed app refresh restores `activeYear` from persisted localStorage state.
- Confirmed year selectors in top navigation and month selector surfaces dispatch the same `setActiveYear` action.
- Confirmed transactions remain year-associated through their transaction dates and are filtered by `activeYear`.
- Ran `npm run build` successfully. The project has no `lint` or `typecheck` npm scripts and no root eslint/tsconfig config files.

#### Batch Transaction Preview Workflow - 2026-06-19

Workflow:

- The Add Transaction screen uses a batch-entry flow instead of immediately saving each form submission.
- Left side: `BatchTransactionForm` collects one transaction draft at a time.
- Right side: `TransactionPreviewPanel` shows the local pending preview queue before anything is written to shared state.
- Clicking `Add to preview` validates the form, adds a stable draft row, clears the form for another entry, and leaves global app data unchanged.
- Clicking `Save all` revalidates every pending row and commits the full batch to the shared finance store in one reducer action.
- Clicking `Clear preview` or removing a row only affects local component state and never changes saved data.
- After a successful save, Dashboard, charts, Reports, month/year views, and localStorage persistence update through the shared store.

Preview panel design rules:

- Use the premium FinanceOS dark surfaces: `#0B0B0C`, `#121418`, `#16181D`, hover `#1C1F26`, border `#252933`.
- Use rounded `18px` to `24px` card/table hybrid rows with subtle borders and shadows.
- Avoid default browser table styling; preview rows should look like modern dense cards.
- Preview filters should support `All`, `Income`, `Expense`, `Savings`, and `Debt`.
- Type badges must use FinanceOS solid semantic colors:
  - Income: `#00D68F` to `#00C26E`
  - Savings: `#3B82F6` to `#2563EB`
  - Debt: `#F59E0B` to `#D97706`
  - Expenses: `#EF4444` to `#DC2626`
- `Save all` should use a solid primary accent color.
- `Clear preview` should be subtle danger styling, not a destructive full-red block.
- Desktop layout should be two columns; mobile should stack the form above the preview panel.

Components created/changed:

- `src/app/components/screens/AddTransaction.tsx`
  - `BatchTransactionForm`
  - `TransactionPreviewPanel`
  - `TransactionPreviewTable`
  - `TransactionTypeBadge`
- `src/app/lib/financeStore.tsx`
  - Added batch transaction reducer/action support while preserving `addTransaction`.

State functions added:

- `ADD_TRANSACTIONS` reducer action appends multiple transaction records to shared state in one commit.
- `addTransactions(transactions)` context function assigns stable persisted transaction IDs and dispatches `ADD_TRANSACTIONS`.
- Existing `addTransaction(transaction)` remains available for existing call sites.

Validation behavior:

- Drafts require name, amount, and date.
- Amount must be a finite value greater than `0`.
- Invalid drafts cannot be added to the preview.
- `Save all` revalidates all pending rows before committing.
- If a pending row is invalid at save time, saving is blocked and the row is highlighted in the preview.
- Draft transaction dates carry the selected year/month through the ISO date value; active-year filtering continues to happen through shared store selectors.
- No hardcoded budget year should be introduced.

Testing results:

- Confirmed income, expense, savings, and debt drafts can be added to the local preview queue.
- Confirmed mixed transaction types can be reviewed together and filtered by type.
- Confirmed preview rows show type, name/source/merchant, amount, category, date, notes, and remove action.
- Confirmed subtotal cards show pending income, expenses, savings, and debt totals.
- Confirmed row removal and clear preview do not dispatch to global state.

#### Backend Reset - 2026-09-02

Backend status:

- Previous backend scaffolding was removed so FinanceOS can restart backend work from a clean slate.
- The current app is frontend-only and persists user-entered data through `localStorage`.
- Do not add backend provider SDKs, migrations, service wrappers, or environment keys until a new backend architecture is chosen.
- Keep future backend code isolated from the active frontend store until a page or workflow is intentionally connected.

Removed backend scaffolding:

- Environment template with provider-specific variables.
- Backend setup documentation.
- Database migration and verification SQL files.
- Browser backend client.
- Service wrapper layer.
- Service-backed React hooks.

Next backend planning pass:

1. Choose backend provider and hosting model.
2. Define auth/session requirements.
3. Define database schema and ownership boundaries.
4. Define import/export and backup requirements.
5. Add a provider-specific integration only after the architecture is agreed.

Testing results:

- `npm.cmd run typecheck` passes.
- `npm.cmd run build` passes. Vite still reports the existing large chunk warning only.
- `npm.cmd audit --audit-level=moderate` reports zero vulnerabilities.

#### Settings Page UX/UI Redesign and Light Theme System - 2026-06-21

Light theme color system:

- Use a two-tone app background, not a flat white page.
- Primary background: `#F8FAFC`.
- Secondary background band: `#EEF2F7`.
- Surface cards: `#FFFFFF`.
- Elevated card/control surfaces: `#FAFBFD`.
- Borders: `#E2E8F0`.
- Primary text: `#0F172A`.
- Secondary text: `#475569`.
- Continue using FinanceOS solid semantic colors for Income, Savings, Debt, and Expenses accents.
- Chart labels, grid lines, legends, and tooltips must read from CSS variables so light and dark mode remain legible.
- Toast notifications keep bottom-right positioning and use matching light/dark premium surfaces.

Settings layout architecture:

- Settings is a centered account control panel, not a left-aligned form stack.
- Page content uses a max-width container around `max-w-6xl`.
- The page title and subtitle are centered above the controls.
- Top-level sections are separate cards:
  - Appearance: theme, accent color, UI preferences.
  - Regional: timezone, week start day, currency, budget year, start month.
  - Financial: payment methods and future bank linking.
  - Account: profile and notifications.
  - Data Management: export, import, delete, and developer preview controls.
- Desktop layout may use two balanced columns for peer sections.
- Mobile layout stacks cards full width with controls wrapping before text overlaps.

Card sizing rules:

- Top-level Settings cards should share the same premium FinanceOS radius and card shadow as the rest of the app.
- Avoid nested cards inside cards. Use bordered elevated panels inside a card only for grouped controls.
- Form rows use consistent gaps and responsive grids.
- Payment method cards and timezone popovers must use semantic FinanceOS theme classes rather than hard-coded dark colors.

Theme switching behavior:

- Theme preference is stored in `localStorage` under `financeos:theme`.
- The document root receives either `financeos-theme-light` or `financeos-theme-dark`.
- Toggling theme in Settings updates the document class immediately.
- Dark mode remains the default when no theme has been saved.

Files changed:

- `src/app/components/screens/Settings.tsx`
- `src/styles/theme.css`
- `src/app/components/layout/AppShell.tsx`
- `src/app/components/common/TimezoneSelector.tsx`
- `src/app/components/common/PaymentMethodCards.tsx`
- `src/app/components/charts/chartTheme.ts`
- `guidelines.md`

Testing results:

- Ran `npm run build` successfully.
- The project currently has no `lint` or `typecheck` npm scripts in `package.json`, so separate lint/typecheck commands were not available.
- Verified by implementation review that the Settings content is centered, cards align through the max-width layout, mobile grids stack, theme switching writes the stored theme and document class, chart styles use light/dark variables, and notifications remain configured at bottom-right.

#### Global Theme Switching Architecture - 2026-06-21

Dark mode default rule:

- FinanceOS defaults to dark mode for new users.
- If `localStorage["financeos:theme"]` is missing or any value other than `light`, initialize `theme` as `dark`.
- Light mode is used only after the user explicitly selects it.
- Refreshes restore the saved theme.
- Clearing localStorage returns the app to dark mode.

Theme token architecture:

- Global theme state lives in `src/app/lib/theme.tsx`.
- `FinanceOSThemeProvider` exposes `theme: "dark" | "light"`, `setTheme`, and `toggleTheme`.
- `AppShell` owns the provider and applies `data-theme` on the app root.
- The document root receives `data-theme`, `financeos-theme-light`, or `financeos-theme-dark`.
- CSS variables in `src/styles/theme.css` are the source of truth for surfaces, borders, text, inputs, overlays, shadows, and charts.
- Use token classes such as `bg-[var(--financeos-surface)]`, `text-[var(--financeos-text-primary)]`, and `border-[var(--financeos-border)]`.
- Portal-rendered components must also use root-level variables because dropdowns, dialogs, sheets, and toasts can render outside `.financeos-premium`.

Light mode palette:

- `appBackground`: `#F8FAFC`
- `appBackgroundSecondary`: `#EEF2F7`
- `surface`: `#FFFFFF`
- `surfaceElevated`: `#FAFBFD`
- `surfaceHover`: `#F1F5F9`
- `border`: `#E2E8F0`
- `borderStrong`: `#CBD5E1`
- `textPrimary`: `#0F172A`
- `textSecondary`: `#475569`
- `textMuted`: `#64748B`
- `inputBackground`: `#FFFFFF`
- `inputBorder`: `#CBD5E1`
- `overlay`: `rgba(15, 23, 42, 0.35)`

Dark mode palette:

- `appBackground`: `#0B0B0C`
- `appBackgroundSecondary`: `#121418`
- `surface`: `#16181D`
- `surfaceElevated`: `#1C1F26`
- `surfaceHover`: `#252933`
- `border`: `#252933`
- `borderStrong`: `#334155`
- `textPrimary`: `#F8FAFC`
- `textSecondary`: `#CBD5E1`
- `textMuted`: `#94A3B8`
- `inputBackground`: `#0F1115`
- `inputBorder`: `#252933`
- `overlay`: `rgba(0, 0, 0, 0.65)`

Accent colors:

- Income: `#00D68F` to `#00C26E`
- Savings: `#3B82F6` to `#2563EB`
- Debt: `#F59E0B` to `#D97706`
- Expenses: `#EF4444` to `#DC2626`
- Amount Left: `#8B5CF6` to `#6366F1`

Components updated:

- `src/app/lib/theme.tsx`
- `src/app/components/layout/AppShell.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `src/app/components/screens/Settings.tsx`
- `src/app/components/screens/AddTransaction.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/SavedBudgets.tsx`
- `src/app/components/screens/Setup.tsx`
- `src/app/components/screens/Categories.tsx`
- `src/app/components/screens/PaymentPlans.tsx`
- `src/app/components/screens/ExpectedAmounts.tsx`
- `src/app/components/archive/SaveSnapshotActions.tsx`
- `src/app/components/common/MonthSelector.tsx`
- `src/app/components/common/DateTimeDisplay.tsx`
- `src/app/components/common/TimezoneSelector.tsx`
- `src/app/components/common/PaymentMethodCards.tsx`
- `src/app/components/charts/chartTheme.ts`
- `src/app/components/charts/ElevatedExpenseDonutChart.tsx`
- `src/app/components/ui/card.tsx`
- `src/app/components/ui/input.tsx`
- `src/app/components/ui/textarea.tsx`
- `src/app/components/ui/button.tsx`
- `src/app/components/ui/dialog.tsx`
- `src/app/components/ui/dropdown-menu.tsx`
- `src/styles/theme.css`

Testing results:

- Ran `npm run build` successfully.
- `npm run lint` failed because no `lint` script exists in `package.json`.
- `npm run typecheck` failed because no `typecheck` script exists in `package.json`.
- Verified implementation paths for dark default, explicit light persistence, refresh restoration, root `data-theme`, root theme classes, chart variables, modal/dropdown root variables, and bottom-right toast theme variants.

#### Light Mode Readability Fixes - 2026-06-21

Scope:

- Dark Mode is approved and must remain visually unchanged.
- Light Mode fixes should be light-only when possible, or use CSS variables whose dark values match the approved dark palette.
- Do not redesign layouts while fixing readability.

Light Mode readability rules:

- Main headings and card titles use `var(--financeos-text-primary)`.
- Body text uses `var(--financeos-text-secondary)`.
- Helper, metadata, and empty-state text use `var(--financeos-text-muted)`.
- Avoid `text-white`, `text-slate-100`, and `fill-white` on light cards unless the element sits on a strong accent background.
- Chart titles, SVG labels, Recharts labels, and chart tooltips must resolve through theme variables or light-mode overrides.
- Portal-rendered surfaces must be readable in Light Mode because they can render outside `.financeos-premium`.

Circle and icon container rules:

- Light Mode icon containers use `--financeos-icon-container: #EEF2F7`.
- Light Mode icon hover containers use `--financeos-icon-container-hover: #E2E8F0`.
- Black circular backgrounds should not appear in Light Mode except as part of an intentional logo mark.
- Calendar/today circles in Light Mode use a soft violet surface instead of `bg-slate-900`.
- Icons inside solid accent containers may remain white when contrast is strong.

Dashboard text rules:

- Dashboard hero title uses `var(--financeos-text-primary)`.
- Dashboard amount-left text uses `var(--financeos-text-primary)` unless placed on a strong accent fill.
- KPI labels and helper text must remain readable on light cards.
- KPI icon glyphs may remain white inside solid icon tiles.
- Chart empty states, labels, axis ticks, legends, and tooltips must remain readable in Light Mode.

Files changed:

- `src/styles/theme.css`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/Reports.tsx`
- `src/app/components/screens/SavedBudgets.tsx`
- `src/app/components/screens/PendingTransactions.tsx`
- `src/app/components/ui/chart.tsx`
- `guidelines.md`

Testing results:

- Ran targeted search for hardcoded dark/white classes including `text-white`, `text-[#F8FAFC]`, `text-slate-100`, `bg-black`, `bg-[#0B0B0C]`, `bg-[#121418]`, `bg-[#16181D]`, `bg-slate-900`, and `fill-white`.
- Converted dashboard, reports, archive, pending calendar, and chart tooltip readability issues to theme tokens or light-only overrides.
- Ran `npm run build` successfully.
- `npm run lint` failed because no `lint` script exists in `package.json`.
- `npm run typecheck` failed because no `typecheck` script exists in `package.json`.
- Confirmed `Save all` calls the shared batch add function only after all preview rows validate.
- Confirmed transaction dates remain the basis for month/year filtering, so transactions dated in one year/month do not appear in another.
- Ran `npm run build` successfully.
- Ran `npm run lint --if-present` and `npm run typecheck --if-present`; no scripts are currently defined, so both completed without output.

#### Developer Preview Mode - 2026-06-19

Goal:

- Provide a temporary FinanceOS developer preview mode for visual testing of dashboard cards, charts, graphs, reports, trends, category breakdowns, and archive views.
- Preview data must stay isolated from real user data and must be easy to remove.

Exact file locations:

- Feature flag and preview storage key: `src/config/devPreview.ts`
- Mock data module: `src/mock/mockFinanceData.ts`
- Store overlay and toggle state: `src/app/lib/financeStore.tsx`
- Visible preview badge: `src/app/components/layout/TopNav.tsx`
- Settings toggle: `src/app/components/screens/Settings.tsx`
- Documentation: `guidelines.md`

Feature flags:

- `DEV_PREVIEW_MODE = true` enables the temporary developer preview feature.
- `DEV_PREVIEW_YEAR = "2027"` is the mock data year.
- `DEV_PREVIEW_STORAGE_KEY = "financeos:dev-preview-enabled"` stores only the on/off preference, not mock data.

Mock data contents:

- Mock year: `2027`
- Income categories:
  - Software Engineering Salary
  - Tutoring
  - Freelance Project
  - Interest Income
- Expense categories:
  - Rent
  - Utilities
  - Internet
  - Phone
  - Groceries
  - Dining
  - Transportation
  - Entertainment
  - Shopping
  - Healthcare
- Savings categories:
  - Emergency Fund
  - House Fund
  - Vacation Fund
  - Investment Contributions
- Debt categories:
  - Student Loan
  - Car Loan
  - Credit Card
- The dataset generates month-to-month variation across January through December, with realistic income, expenses, savings, debt payments, payment plans, monthly archive snapshots, and a yearly archive snapshot.

Data architecture:

- Mock data is never written into `financeos:app-data:v1`.
- The finance reducer state remains the source for real user data.
- `withPreviewData(state, previewModeEnabled)` overlays mock data into context selectors only when preview mode is enabled.
- The context exposes `previewModeEnabled` and `setPreviewModeEnabled(enabled)`.
- When preview mode is enabled, `activeYear` is exposed as `2027` so all year-filtered dashboard/report/chart views populate immediately.
- When preview mode is disabled, the context returns to the normal reducer-backed user data immediately.
- User-created data and mock data are merged by stable IDs for display, but mock records are not persisted into production app data.

UI behavior:

- Top navigation shows `Preview Data Enabled` only when preview mode is active.
- Settings contains `Developer > Enable Preview Data`.
- The developer toggle writes only the preference key `financeos:dev-preview-enabled`.
- The preview badge and Settings notice make it clear when mock data is currently visible.

Testing results:

- Confirmed `npm run build` succeeds with preview mode enabled.
- Confirmed `npm run lint --if-present` and `npm run typecheck --if-present` complete; no scripts are currently defined.
- Confirmed mock records are isolated in `src/mock/mockFinanceData.ts` and are not embedded in dashboard/chart/report components.
- Confirmed runtime 2027 mock data comes from `DEV_PREVIEW_YEAR`, not hardcoded component values.
- Confirmed only the developer toggle preference is persisted; mock data is not written into `financeos:app-data:v1`.
- Confirmed archive preview data is supplied through mock saved monthly/yearly snapshots for archive layout testing.

How to remove preview mode later:

1. Delete `src/config/devPreview.ts`.
2. Delete `src/mock/mockFinanceData.ts`.
3. Remove the preview imports, `loadPreviewEnabled`, `mergeUniqueById`, `withPreviewData`, `previewModeEnabled`, and `setPreviewModeEnabled` from `src/app/lib/financeStore.tsx`.
4. Change finance context reads back to direct reducer `state` reads in `FinanceDataProvider`.
5. Remove the preview badge from `src/app/components/layout/TopNav.tsx`.
6. Remove the `Developer` card from `src/app/components/screens/Settings.tsx`.
7. Remove `financeos:dev-preview-enabled` from browser localStorage if it exists.

#### Dashboard Setup Link And Expected Transactions - 2026-06-19

Dashboard setup quick link behavior:

- The Dashboard quick links include `Budget Setup`.
- The link routes to `/setup?edit=true`.
- `SetupRoute` allows `/setup?edit=true` to render the setup page even when setup has already been completed.
- Normal `/setup` behavior remains protected: completed users are redirected to `/dashboard` unless the edit query is present.
- The quick link uses the same dark card/pill visual style as the other FinanceOS quick actions.

Expected Transactions calculation:

- The Dashboard shows a secondary premium KPI card labeled `Expected Transactions`.
- Formula: `expected income + expected expenses + expected savings + expected debt payments`.
- The KPI reads from the selected dashboard month’s `expectedAmounts` record.
- The helper text is `Planned for this month`, represented as `Planned for {month} {activeYear}` in the UI.
- The primary KPI row order remains unchanged:
  1. Income
  2. Savings
  3. Debt
  4. Expenses
  5. Amount Left
- Dashboard now has a month/year selector in the hero. Changing month updates the Expected Transactions card, KPI cards, chart preview, and best-savings calculation for the selected month.
- Changing year dispatches the shared `setActiveYear` action, so the card follows normal active-year filtering and works with Developer Preview Mode.

Files changed:

- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/routing/SetupRoute.tsx`
- `guidelines.md`

Testing results:

- Confirmed `Budget Setup` quick link points to `/setup?edit=true`.
- Confirmed `SetupRoute` opens setup for the edit query and preserves redirect behavior otherwise.
- Confirmed Expected Transactions is calculated from the selected month’s expected plan.
- Confirmed the Dashboard month/year selector updates the displayed month/year and expected KPI inputs.
- Confirmed no dashboard value is hardcoded to a budget year.
- Confirmed Developer Preview Mode continues to populate 2027 expected data through the shared finance context.
- Ran `npm run build` successfully.
- Ran `npm run lint --if-present` and `npm run typecheck --if-present`; no scripts are currently defined, so both completed without output.

#### Preferences, Timezone, And Payment Methods - 2026-06-19

Start day of week preference:

- Global preference: `startDayOfWeek: "sunday" | "monday"`.
- Default for migrated/old data is `"sunday"`.
- Startup/setup includes a `Start week on` segmented control.
- Settings includes the same preference for later changes.
- Weekly/calendar layout code should use `getWeekStartOffset(...)` from `src/app/lib/datePreferences.ts`.
- The Pending Transactions mini calendar respects this preference and rotates weekday labels/offsets for Sunday or Monday starts.

Timezone architecture:

- Global preference: `timezone: string`.
- Default uses `Intl.DateTimeFormat().resolvedOptions().timeZone`; fallback is `UTC`.
- Startup/setup includes timezone selection.
- Settings includes timezone selection for later changes.
- Date/time display should format through `formatDateInTimezone(...)` from `src/app/lib/datePreferences.ts`.
- Stored transaction dates remain stable ISO date strings (`YYYY-MM-DD`).
- Core transaction month/year filtering parses ISO date strings directly instead of relying on `new Date("YYYY-MM-DD")`, preventing timezone changes from shifting transactions across month/year boundaries.
- Timezone currently affects header/dashboard date display and archive saved-date formatting. New report/calendar/date displays should use the same helper.

Payment method data model:

```ts
type PaymentMethod = {
  id: string;
  nickname: string;
  type: "checking" | "savings" | "credit_card" | "debit_card" | "cash" | "other";
  institutionName?: string;
  last4?: string;
  network?: "visa" | "mastercard" | "amex" | "discover" | "other";
  colorTheme?: string;
  isLinked?: boolean;
  institutionId?: string;
  institutionLogo?: string;
  brandColor?: string;
  linkedAccountId?: string;
};
```

- Payment methods persist inside the shared FinanceOS app data store.
- Setup can add/remove payment methods during onboarding.
- Settings can add, edit, and remove payment methods later.
- Transactions support optional `paymentMethodId`; the batch transaction form includes a non-required payment method selector.

Payment method card design:

- Component location: `src/app/components/common/PaymentMethodCards.tsx`.
- Cards use dark premium FinanceOS surfaces, rounded 20-24px corners, subtle borders, soft shadow, type badge, institution/bank name, nickname, optional network, and masked last four digits.
- Type accent colors:
  - Checking: blue/purple
  - Savings: green/blue
  - Credit Card: purple/indigo
  - Debit Card: teal/blue
  - Cash: amber/orange
  - Other: slate

Future bank-linking TODO:

- Bank linking is intentionally not implemented yet.
- UI shows `Coming soon: Bank linking`.
- Future Plaid or bank API integration should populate `institutionId`, `institutionLogo`, `brandColor`, `linkedAccountId`, and `isLinked`.
- Card UI is already shaped to render linked metadata without changing the payment method model.

Files changed:

- `src/app/data/data.ts`
- `src/app/lib/datePreferences.ts`
- `src/app/lib/financeStore.tsx`
- `src/app/lib/setupState.ts`
- `src/app/components/common/PaymentMethodCards.tsx`
- `src/app/components/screens/Setup.tsx`
- `src/app/components/screens/Settings.tsx`
- `src/app/components/screens/AddTransaction.tsx`
- `src/app/components/screens/PendingTransactions.tsx`
- `src/app/components/screens/IncomeTracker.tsx`
- `src/app/components/screens/ExpenseTracker.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/SavedBudgets.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/Header.tsx`
- `guidelines.md`

Testing results:

- Confirmed build passes with `npm run build`.
- Ran `npm run lint --if-present` and `npm run typecheck --if-present`; no scripts are currently defined, so both completed without output.
- Confirmed old localStorage data receives defaults for `startDayOfWeek`, `timezone`, and `paymentMethods`.
- Confirmed setup can save Monday/Sunday preference, timezone, and payment methods.
- Confirmed Settings can change start week, timezone, and payment methods after setup.
- Confirmed payment methods render as premium cards and support edit/remove in Settings.
- Confirmed batch transaction form can optionally reference a payment method without breaking existing transaction creation.
- Confirmed stable ISO transaction dates remain the filtering source for month/year behavior.
- Confirmed no hardcoded `2026` was introduced.

#### Timezone Selector And Live Clock - 2026-06-19

Timezone selector design:

- Native/plain timezone dropdowns are replaced by `TimezoneSelector`.
- Component location: `src/app/components/common/TimezoneSelector.tsx`.
- The selector uses FinanceOS dark surfaces, rounded 18-24px corners, subtle border, soft shadow, accent focus state, searchable list, and selected/hover states.
- Friendly labels are shown where available, for example:
  - Eastern Time — `America/New_York`
  - Central Time — `America/Chicago`
  - Mountain Time — `America/Denver`
  - Pacific Time — `America/Los_Angeles`
  - London — `Europe/London`
  - Dubai — `Asia/Dubai`
  - Dhaka — `Asia/Dhaka`
  - Tokyo — `Asia/Tokyo`
- Browser-detected timezone is included in the option list and marked as detected.
- Each option includes an offset label such as `UTC-04:00` or `UTC+06:00`.

DateTimeDisplay behavior:

- Component location: `src/app/components/common/DateTimeDisplay.tsx`.
- Displays selected-timezone date, live time, timezone abbreviation, IANA timezone, and UTC offset.
- Uses a `setInterval` that updates once per second and cleans up on unmount.
- Re-renders immediately when global timezone changes.
- Top navigation uses a compact live clock.
- Dashboard hero uses the full live date/time pill near month/year controls.
- Legacy `Header` also uses the live clock component.

Global timezone state architecture:

- The single source of truth remains `FinanceState.timezone` in `src/app/lib/financeStore.tsx`.
- Setup writes timezone into the shared setup profile and finance state.
- Settings updates the same global timezone through `updatePreferences`.
- Timezone persists in `financeos:app-data:v1` and is restored on app load.
- `America/New_York` is not hardcoded as the app default; browser timezone is preferred and `UTC` is the fallback.
- Transaction dates remain stable ISO date strings. Timezone is used for display, with a documented TODO for deeper timezone-aware report boundary handling where needed.

Formatting utilities:

- `formatDateInTimezone(value, timezone, options)`
- `formatTimeInTimezone(value, timezone)`
- `getTimezoneOffsetLabel(timezone, date)`
- `getTimezoneAbbreviation(timezone, date)`
- Utility location: `src/app/lib/datePreferences.ts`

Files changed:

- `src/app/lib/datePreferences.ts`
- `src/app/components/common/TimezoneSelector.tsx`
- `src/app/components/common/DateTimeDisplay.tsx`
- `src/app/components/screens/Setup.tsx`
- `src/app/components/screens/Settings.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/Header.tsx`
- `guidelines.md`

Testing results:

- Confirmed `npm run build` succeeds.
- Ran `npm run lint --if-present` and `npm run typecheck --if-present`; no scripts are currently defined, so both completed without output.
- Confirmed Setup and Settings use `TimezoneSelector` rather than native timezone selects.
- Confirmed the dashboard/top nav live clock uses selected timezone and updates every second.
- Confirmed changing timezone in Settings updates displayed time immediately through shared context.
- Confirmed selected timezone persists through the existing localStorage app-data path.
- Confirmed no hardcoded runtime `2026` was introduced.
- Confirmed Developer Preview Mode year `2027` remains isolated to preview config/mock data.

### 4. Responsive Design

FinanceOS must look good on:

- iPhone
- Laptop
- Desktop

Mobile behavior:

- Cards stack vertically.
- Tables become cards or scroll horizontally only when necessary.
- Forms become single-column.
- Buttons are thumb-friendly.
- Charts resize properly.
- No broken horizontal overflow.

### 5. Visual Aesthetic

The app should follow a premium minimal fintech dashboard aesthetic inspired by Linear, Mercury, Ramp, and modern executive SaaS dashboards.

Design language:

- Minimal two-tone dark background
- Top background: `#0B0B0C`
- Main/body background: `#121418`
- Floating dark dashboard cards
- Card background: `#16181D` or nearby values
- Card border: `1px solid #252933`
- Soft shadows
- Card radius: `20px` to `24px`
- Solid colors only for buttons, charts, KPI accents, and important status elements
- Premium finance dashboard style, not cyberpunk
- Modern SaaS feel
- No old plain/default UI elements
- No loud full-page effects, neon orbs, or glow-heavy backgrounds

Color mapping:

- Income: `#00D68F` to `#00C26E`
- Savings: `#3B82F6` to `#2563EB`
- Debt: `#F59E0B` to `#D97706`
- Expenses: `#EF4444` to `#DC2626`
- Amount Left: `#8B5CF6` to `#6366F1`
- Neutral borders and inactive UI: `#252933`

### 6. Scroll Animation

Dashboard should include a scroll-triggered top summary animation.

Behavior:

- Initial state shows a larger FinanceOS dashboard summary with title, date, month, amount left, and KPI cards.
- On scroll, the top summary smoothly collapses into a compact sticky header.
- Compact state shows FinanceOS, current month/year, amount left, and a quick add action.
- Use CSS transitions or React state. Do not add animation dependencies unless already present and needed.
- Respect `prefers-reduced-motion`.

### 7. Buttons

All buttons should use the premium minimal fintech design system.

Button requirements:

- Dark base or restrained accent color
- Smooth hover transition
- Hover pop-out effect
- Slight translate-up on hover
- No excessive glow
- Active pressed-down effect
- Clean focus-visible ring
- No dead buttons
- Non-submit buttons inside forms must use `type="button"`
- Submit buttons should use `type="submit"`

Shared button component:

- `src/app/components/ui/button.tsx`

### 8. Month Dropdowns

Month-changing controls must use the custom FinanceOS month selector, not a native browser `<select>`.

Design rules:

- Use a dark pill/card trigger with `#16181D` surface, `#1C1F26` hover, `#252933` border, `#F8FAFC` primary text, `#94A3B8` muted text, and `#8B5CF6` accent.
- Use soft rounded corners, subtle glass/card surface treatment, and a floating dark menu.
- The closed trigger should show the selected month and year when applicable, for example `June YYYY`.
- The open menu should use a compact grid/list of months, with selected month highlighted by accent border/background.
- Dropdowns must close when a month is selected, when the user clicks outside, or when Escape is pressed.
- Keyboard behavior should support Enter/Space to open/select and arrow keys to move the focused month while open.
- On mobile, the menu width must be constrained to the viewport and remain tap-friendly.
- If a year selector appears next to a month selector, keep the surrounding control surface visually aligned with this dark selector style.

Component:

- `src/app/components/common/MonthSelector.tsx`

Props:

- `selectedMonth: number`
- `onMonthChange(month: number): void`
- `months: string[]`
- `year?: number | string`
- `currentMonth?: number`
- `label?: string`
- `className?: string`

Files changed for the month dropdown refresh:

- `src/app/components/common/MonthSelector.tsx`
- `src/app/components/screens/IncomeTracker.tsx`
- `src/app/components/screens/ExpenseTracker.tsx`
- `src/app/components/screens/ExpectedAmounts.tsx`
- `src/app/components/screens/AnnualPlanner.tsx`
- `src/app/components/archive/SaveSnapshotActions.tsx`
- `guidelines.md`

Testing steps used:

- Replaced native month-changing selects in Income, Expenses, Expected Amounts, Annual Planner, and Save Snapshot controls.
- Confirmed each replacement still calls the existing month state setters: `setSelectedMonth`, `setStartMonth`, or `setEndMonth`.
- Searched the changed files to confirm the remaining native select is the archive year selector, not a month-changing selector.
- Ran `npm run build` successfully.
- Attempted `npx tsc --noEmit`, but the project has no local `tsc` binary and network is blocked, so `npx` could not download one.

## Reports And Charts

### Reports Pie Chart

The Reports page pie chart should use a modern premium donut/pie chart style.

Pie chart requirements:

- Dark premium chart card
- Colorful but restrained solid slices
- Slight elevated feel
- Slices visually emphasized based on percentage
- Hover expansion/elevation
- Legend/list at the bottom with color, category, amount, and percentage
- Mobile-friendly layout
- Empty state if no expense data exists

Current component:

- `src/app/components/charts/ElevatedExpenseDonutChart.tsx`

### Expected vs Actual Bar Chart

Expected vs Actual annual bar chart requirements:

- Must fill its chart card properly.
- Use `ResponsiveContainer` if using Recharts.
- Parent container must have explicit responsive height.
- Dark rounded tooltip and subtle legend.
- Rounded solid bars.
- No tiny squeezed chart.
- No old/default chart style.

## Empty-State Decision

All dummy/mock/sample financial data should be removed from runtime.

When empty:

- Dashboard shows `$0` values.
- Pending transactions shows `No pending transactions yet.`
- Transactions shows `No transactions yet.`
- Categories shows `No categories yet.`
- Reports charts show empty-state messages.
- Tracker shows `0%` progress.
- Annual Planner shows `$0` values or setup messaging.
- Do not show fake rent, Netflix, salary, food, or other sample data.

Runtime financial arrays in `src/app/data/data.ts` should remain empty unless used only as types/helpers. Real app data comes from the shared store.

## Shared Data Flow

### Problem Addressed

Submitted data was not updating other components.

Examples of the old issue:

- Adding a category did not update dropdowns or lists.
- Adding salary did not update income totals.
- Adding expenses did not update charts or fields.
- Charts and summary cards were reading stale or isolated state.
- Some pages were using local component state for app-wide data.

### Current Decision

FinanceOS needs a single source of truth for app data.

Current implementation:

- React Context + `useReducer`
- Store: `src/app/lib/financeStore.tsx`
- Provider: `FinanceDataProvider`
- Temporary persistence: `localStorage`

### Required Shared State

- Setup status
- Budget years
- Categories
- Transactions
- Monthly expected amounts
- Payment plans
- Saved monthly budgets
- Saved yearly budgets
- Savings goals if they exist
- Debt accounts if they exist
- Monthly notes if they exist

### Shared Actions

The shared store should support:

- `addCategory`
- `updateCategory`
- `deleteCategory`
- `addTransaction`
- `updateTransaction`
- `deleteTransaction`
- `updateMonthlyPlan`
- `addPaymentPlan`
- `updatePaymentPlan`
- `deletePaymentPlan`
- `markTransactionPaid`
- `completeSetup`
- `saveMonthlyBudgetSnapshot`
- `saveYearlyBudgetSnapshot`
- `deleteSavedMonthlyBudget`
- `deleteSavedYearlyBudget`
- `updateSavedMonthlyBudgetNotes`
- `updateSavedYearlyBudgetNotes`
- `resetAppData` for development only if needed

### Persistence Rules

- Persist real user-entered data to `localStorage` until a new backend is selected.
- Do not persist dummy/sample data.
- App should reload user-entered data after refresh.
- Backend selection is intentionally open.

## Core Calculations

Amount Left:

```text
Income - Savings - Debt - Expenses
```

Expected Left:

```text
Expected Income - Expected Savings - Expected Debt - Expected Expenses
```

Actual Left:

```text
Actual Income - Actual Savings - Actual Debt - Actual Expenses
```

Savings Rate:

```text
Savings / Income * 100
```

Expense Rate:

```text
Expenses / Income * 100
```

Debt Payment Rate:

```text
Debt / Income * 100
```

Expense Difference:

```text
Expected Expenses - Actual Expenses
```

Fixed expense rule:

- Pending/unpaid fixed expenses should show in Pending Transactions.
- Pending/unpaid fixed expenses should not count as actual expenses until marked paid/cleared.

Variable expense rule:

- Variable expenses count immediately when added.

## Archived Budgets / Archive

### Goal

Users can save a completed budget month after the month ends and save the completed budget year after the year ends.

This works like an archive/snapshot system. A saved summary is frozen at the time it is saved.

### Route

- `/saved-budgets`

### Directory Format And UI

```text
Year
  Month
    Monthly Summary
  Month
    Monthly Summary
  Annual Summary
```

Example:

```text
YYYY
  January
    January Summary
  February
    February Summary
  Annual Summary
```

Archive UI behavior:

- Use expandable year cards.
- Year rows should look like clean Notion-style cards, not plain folders.
- Expanded years reveal monthly summaries and an `Annual Summary` item.
- Selecting a month or annual summary opens the frozen snapshot detail panel.
- Empty state should say `No archived budgets yet.`

### Current Implementation

Store additions:

- `savedMonthlyBudgets`
- `savedYearlyBudgets`

Screens/components:

- `src/app/components/screens/SavedBudgets.tsx`
- `src/app/components/archive/SaveSnapshotActions.tsx`

Save controls were added to:

- Reports
- Annual Planner

### Monthly Snapshot Data

Saved monthly snapshot should store:

- `budget_year_id`
- `year`
- `month`
- `month_label`
- `saved_at`
- income total
- savings total
- debt total
- expenses total
- amount left
- expected income
- expected savings
- expected debt
- expected expenses
- expected amount left
- actual amount left
- savings rate
- expense rate
- debt payment rate
- category breakdowns
- transaction count
- pending transaction count
- notes if available

### Yearly Snapshot Data

Saved yearly snapshot should store:

- `budget_year_id`
- `year`
- `saved_at`
- total income
- total savings
- total debt
- total expenses
- total amount left
- expected yearly income
- expected yearly savings
- expected yearly debt
- expected yearly expenses
- best savings month
- highest income month
- highest expense month
- highest debt payoff month
- yearly category rankings
- yearly monthly breakdown
- notes if available

### Archive Rule

Saved snapshots should be frozen.

If a user edits a transaction later, the saved snapshot should not change unless the user chooses to overwrite or re-save it.

### Duplicate Handling

If a snapshot already exists for the same year/month:

- Do not create confusing duplicates by default.
- Show options:
  - Overwrite existing
  - Save as new version
  - Cancel

## Backend / Database Plan

Backend work is intentionally reset. Do not assume a provider, SDK, auth model, migration system, or storage system.

Potential domain entities:

- Profiles
- Budget years
- Categories
- Monthly plans
- Monthly category plans
- Transactions
- Payment plans
- Saved monthly budgets
- Saved yearly budgets

### Saved Snapshot Tables

`saved_monthly_budgets` fields:

- `id`
- `user_id`
- `budget_year_id`
- `year`
- `month`
- `month_label`
- `saved_at`
- `summary_json`
- `created_at`
- `updated_at`

`saved_yearly_budgets` fields:

- `id`
- `user_id`
- `budget_year_id`
- `year`
- `saved_at`
- `summary_json`
- `created_at`
- `updated_at`

### Security Plan

- Each user should only see their own financial data.
- Do not hardcode secrets or provider keys.
- Keep server-only credentials out of the frontend app.
- Use environment variables for any future provider configuration.

## Important Bugs And Fixes

### `MONTHS is not defined`

Issue:

- App crashed with `MONTHS is not defined`.

Fix:

- Create/import a shared `MONTHS` constant.
- Avoid duplicate month arrays.
- Add route error boundary.

Related files:

- `src/app/lib/constants.ts`
- `src/app/components/routing/RouteErrorBoundary.tsx`

### Setup `+ Add` Button Not Working

Issue:

- Setup `+ Add` button did not add an editable category row.

Fix direction:

- Check missing `onClick`.
- Check button `type`.
- Check disabled states.
- Check form submit behavior.
- Ensure state updates correctly.
- Ensure setup completion saves added categories.

### Submitted Data Did Not Update Other Components

Issue:

- Forms were saving data locally or only showing toasts.
- Charts/cards were reading stale arrays or empty module-level replacements.

Fix direction:

- Move app-wide data into shared state/store.
- Make forms dispatch shared actions.
- Make charts/cards derive data from shared state.
- Persist real data to `localStorage` until a backend is selected.

## Completed Work So Far

- Vite app setup was fixed enough for builds.
- Setup-first routing flow was added.
- Top navigation dropdown replaced the permanent sidebar direction.
- Dark/glow premium visual system was added across major surfaces.
- Shared button styling was updated.
- Setup `+ Add` behavior was fixed.
- Runtime dummy/sample financial data was removed.
- Reports elevated donut/pie chart was added.
- Reports expected vs actual chart sizing/style was improved.
- Shared date constants were added.
- Route error boundary was added.
- Shared FinanceOS data store was added.
- Categories now update shared state.
- Add Transaction now writes to shared state.
- Dashboard, Reports, Planner, Tracker, and Pending panels now read derived shared data.
- Payment plans now write to shared state and contribute to pending/upcoming views.
- Expected amounts now save to shared state.
- Archived Budgets feature was added.
- Saved monthly and yearly snapshots persist through `localStorage`.
- Premium minimal fintech UI pass was added:
  - Two-tone dark app shell using `#0B0B0C` and `#121418`.
  - Shared cards use `#16181D`, `#252933` borders, 20-24px radius, subtle shadows, and small translate hover.
  - Shared buttons use restrained dark styling and solid colors for primary/destructive actions.
  - Dashboard hero/summary collapses into a compact sticky header on scroll.
  - Dashboard KPI cards preserve Income, Savings, Debt, Expenses, Amount Left order and use the approved solid colors.
  - Reports, donut chart, planner chart, tracker, and route error surfaces were toned down from neon/glow styling.
  - Archived Budgets now uses expandable Notion-style year cards with month and Annual Summary entries.

### Recent UI Files Changed

- `src/app/components/layout/AppShell.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `src/app/components/ui/button.tsx`
- `src/app/components/ui/card.tsx`
- `src/app/components/ui/input.tsx`
- `src/app/components/ui/progress.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/Reports.tsx`
- `src/app/components/screens/SavedBudgets.tsx`
- `src/app/components/screens/AnnualPlanner.tsx`
- `src/app/components/screens/TrackerUI.tsx`
- `src/app/components/screens/ExpenseTracker.tsx`
- `src/app/components/charts/chartTheme.ts`
- `src/app/components/charts/ElevatedExpenseDonutChart.tsx`
- `src/app/components/archive/SaveSnapshotActions.tsx`
- `src/app/components/routing/RouteErrorBoundary.tsx`
- `guidelines.md`

## Current Verification Checklist

Before continuing, verify:

- [ ] App starts at Setup for a new user.
- [ ] Setup can be completed.
- [ ] App transitions to Dashboard.
- [ ] Dashboard cards show correct totals.
- [ ] Adding a category updates category lists and dropdowns.
- [ ] Adding income updates dashboard, reports, tracker, and annual planner.
- [ ] Adding expenses updates dashboard, pie chart, reports, and amount left.
- [ ] Adding savings updates dashboard, tracker, rankings, and reports.
- [ ] Adding debt updates dashboard, tracker, and annual planner.
- [ ] Expected amounts update expected vs actual charts.
- [ ] Payment plans update upcoming/pending panels.
- [ ] Archived Budgets page exists in menu.
- [ ] Saving a month creates a saved month under Year > Month.
- [ ] Saving a year creates a year summary under that year.
- [ ] Data persists after refresh.
- [ ] No dummy data appears.
- [ ] No old-style buttons remain.
- [ ] Charts match the premium minimal fintech aesthetic.
- [ ] App looks good on iPhone, laptop, and desktop.
- [ ] No console errors.
- [ ] `npm run build` passes.

## Development Notes

Useful commands:

```bash
npm run dev
npm run build
npm run lint --if-present
```

## Next Steps

1. Finish shared state/store cleanup if any isolated app-wide data remains.
2. Make sure all forms write to shared state.
3. Make sure every chart reads from derived real data.
4. Continue checking mobile spacing and dense table/card layouts after the premium UI pass.
5. Choose a backend architecture later.
6. Add auth after backend architecture is selected.
7. Add export/import backup later.
8. Add more polish to mobile layouts.
9. Add tests or a manual QA checklist.
10. Deploy to Vercel after core features work.

## Remaining TODOs

- Run browser QA for the scroll-collapsing dashboard header on desktop and mobile.
- Review older setup/category/forms screens for any remaining plain generated styles.
- Consider code-splitting if the Vite chunk-size warning becomes a deployment concern.

## Popup And Modal Dark Theme - 2026-06-19

Root cause:

- Several popup primitives used theme aliases such as `bg-background`, `bg-popover`, `text-popover-foreground`, `bg-input-background`, and default border/input tokens.
- Radix portals can render outside the normal FinanceOS page wrapper, so those aliases could resolve to white/light popup surfaces even while the app shell was dark.
- A few modal-adjacent native selects still had explicit `bg-white` and `border-slate-200`, which made text and controls inconsistent in category, payment plan, and settings/payment method workflows.

Popup/modal theme rules:

- Dialogs, alert dialogs, sheets, drawers, popovers, dropdowns, select menus, context menus, hover cards, tooltips, navigation menu flyouts, command palette surfaces, and chart tooltips must use explicit dark tokens.
- Modal background: `#16181D`.
- Elevated panel/hover: `#1C1F26`.
- Border: `#252933`.
- Text primary: `#F8FAFC`.
- Text secondary/helper: `#CBD5E1` or `#94A3B8`.
- Backdrop overlays use `rgba(0, 0, 0, 0.65)` equivalent with optional blur.
- Popup corners should stay in the 20-24px range unless a smaller control requires tighter rounding.
- Danger states use soft red `#EF4444`; success states use green `#00D68F`.

Input/textarea color rules:

- Text inputs, textareas, and select triggers use input background `#0F1115`, border `#252933`, text `#F8FAFC`, and placeholder `#64748B`.
- Focus states use the FinanceOS accent `#8B5CF6` with a subtle ring.
- Invalid fields use `#EF4444` border/ring styling.
- Do not introduce `bg-white`, `background: white`, `#fff`, `#ffffff`, `text-black`, or `text-gray-900` inside popup/modal/dropdown UI.

Files changed:

- `src/app/components/ui/dialog.tsx`
- `src/app/components/ui/alert-dialog.tsx`
- `src/app/components/ui/popover.tsx`
- `src/app/components/ui/dropdown-menu.tsx`
- `src/app/components/ui/select.tsx`
- `src/app/components/ui/context-menu.tsx`
- `src/app/components/ui/hover-card.tsx`
- `src/app/components/ui/tooltip.tsx`
- `src/app/components/ui/command.tsx`
- `src/app/components/ui/menubar.tsx`
- `src/app/components/ui/navigation-menu.tsx`
- `src/app/components/ui/sheet.tsx`
- `src/app/components/ui/drawer.tsx`
- `src/app/components/ui/input.tsx`
- `src/app/components/ui/textarea.tsx`
- `src/app/components/ui/checkbox.tsx`
- `src/app/components/ui/radio-group.tsx`
- `src/app/components/ui/toggle.tsx`
- `src/app/components/ui/tabs.tsx`
- `src/app/components/ui/slider.tsx`
- `src/app/components/ui/input-otp.tsx`
- `src/app/components/ui/chart.tsx`
- `src/app/components/ui/sidebar.tsx`
- `src/app/components/screens/Categories.tsx`
- `src/app/components/screens/PaymentPlans.tsx`
- `src/app/components/screens/Settings.tsx`

Verification results:

- Targeted popup/light-style search was rerun after the shared primitive updates. Remaining `bg-white`/light hits are layout/table surfaces, translucent dark-theme accents, or unrelated non-popup generated controls.
- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint --if-present` exits successfully; no lint script is configured.
- `npm run typecheck --if-present` exits successfully; no typecheck script is configured.

## Header And Notification Polish - 2026-06-19

Header design rules:

- The top navigation should read as one unified floating control center, not separate unrelated buttons.
- Header container uses `#16181D` with glass blur, `#252933` border, rounded 28px corners, and balanced horizontal spacing.
- Left group owns FinanceOS identity and current page context.
- Center group owns planning period, live date/time, and selected timezone context.
- Right group owns icon-only notifications, settings, profile, and menu controls with consistent 40px action sizing.
- Mobile layout wraps the planning/date group below the identity/actions row without overlapping controls.

Notification positioning rules:

- The shared Sonner wrapper sets the global default position to `bottom-right`.
- Individual pages should call `toast.*` only; they should not configure toast position.
- Toast cards must use dark premium surfaces, `#252933` borders, readable `#F8FAFC`/`#94A3B8` text, and no white backgrounds.
- Toast motion enters with slide-up plus fade-in and exits with fade-out plus slight downward movement.
- Multiple toasts stack from the bottom-right with compact spacing.

Date/time display rules:

- Header date/time appears as a compact pill/card: `Date | live time abbreviation`.
- The selected IANA timezone and UTC offset remain visible in the same date/time component.
- Date/time formatting uses the global timezone preference and updates every second.
- Timezone changes in settings/setup must immediately affect the header display.

Header component architecture:

- `TopNav` is the active app header.
- Legacy `Header` delegates to `TopNav` so older imports cannot reintroduce the previous light/disconnected header.
- `MenuDropdown` is icon-only in the header and uses the same 40px action footprint as notification/settings/profile.
- `selectedMonth` is now part of the FinanceOS store and persists with app data, allowing the header month/year selector and dashboard to share the same planning period.
- Profile and notification menus use shared dark dropdown primitives.

Files changed:

- `src/app/components/layout/AppShell.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/Header.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `src/app/components/common/DateTimeDisplay.tsx`
- `src/app/components/ui/sonner.tsx`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/lib/financeStore.tsx`
- `src/styles/theme.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint --if-present` exits successfully when no lint script is configured.
- `npm run typecheck --if-present` exits successfully when no typecheck script is configured.

## Notification History Architecture - 2026-06-21

Notification routing behavior:

- The top-bar notification bell navigates directly to `/notifications`.
- The bell no longer opens a static dropdown; notification review happens on the dedicated Notifications page.
- The Notifications page is part of the app router and is also available from the main navigation menu.
- Opening the page does not automatically mark notifications as read. Users control read state manually with per-item `Mark read` and page-level `Mark all as read`.

Notification history architecture:

- Notification history is centralized in `src/app/lib/notifications.ts`.
- Notification records use `id`, `title`, `message`, `type`, `createdAt`, `read`, optional `actionLink`, and optional `source`.
- Supported notification types are `success`, `error`, `warning`, and `info`.
- History persists to `localStorage` under `financeos:notifications:v1` and restores on refresh.
- History is capped at the latest 100 notifications.
- Rapid duplicate toast notifications with the same type/title/message/source are deduped within a short window.
- The unread badge reads from the centralized history store and caps visible display at `99+`.

Toast-to-history behavior:

- `AppShell` patches the shared Sonner `toast` API once at startup.
- Existing `toast.success`, `toast.error`, `toast.warning`, `toast.info`, and `toast.message` calls continue to show bottom-right toast popups.
- Those toast calls are automatically recorded into notification history with `source: "toast"`.
- Toast positioning remains bottom-right through the shared Sonner wrapper.

Notification page design rules:

- Notification surfaces use theme tokens: `var(--financeos-surface)`, `var(--financeos-surface-elevated)`, `var(--financeos-text-primary)`, `var(--financeos-text-secondary)`, `var(--financeos-text-muted)`, and `var(--financeos-border)`.
- Light mode icon containers use `var(--financeos-icon-container)` and `var(--financeos-icon-container-hover)` so black circular UI does not appear on light surfaces.
- Notification cards use rounded 22px corners, subtle borders, type icon badges, readable timestamp/source metadata, and a subtle accent indicator for unread state.
- Type accents remain consistent: success `#00D68F`, error `#EF4444`, warning `#F59E0B`, info `#8B5CF6`.
- Filter tabs include All, Unread, Success, Warning, Error, and Info.
- Empty history uses a dedicated empty state rather than a blank page.

Files changed:

- `src/app/lib/notifications.ts`
- `src/app/components/screens/Notifications.tsx`
- `src/app/routes.ts`
- `src/app/components/layout/AppShell.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Implementation review confirms the bell navigates to `/notifications`, unread badge state comes from persisted notification history, toasts are recorded automatically, and the Notifications page uses light/dark theme tokens.

## Help Center Architecture - 2026-06-21

Help Center architecture:

- The Help Center is a full routed app page at `/help`, not a simple FAQ page.
- The page is centered with a max-width layout matching the Settings and Notifications page architecture.
- The page includes top-level help navigation cards plus detailed sections for Getting Started, User Guide, FAQ, Tips & Best Practices, and Changelog / What's New.
- Help surfaces use FinanceOS theme tokens for dark and light mode: `var(--financeos-surface)`, `var(--financeos-surface-elevated)`, `var(--financeos-surface-hover)`, `var(--financeos-border)`, `var(--financeos-text-primary)`, `var(--financeos-text-secondary)`, and `var(--financeos-text-muted)`.
- Card corners stay in the 22-30px range, with subtle borders and existing FinanceOS accent colors.
- Mobile layout stacks cards and article panels into a single column.

Navigation updates:

- Help Center is registered in the router at `/help`.
- The main navigation menu includes `Help Center` near `Notifications` and `Settings`.
- The top header page title resolver maps `/help` to `Help Center`.

Help article structure:

- Help content lives in `src/app/lib/helpCenter.ts`.
- `HelpArticle` supports `id`, `category`, `title`, `summary`, `icon`, and optional `tags`.
- `HelpSection` supports `id`, `title`, `eyebrow`, `description`, `accent`, and `articles`.
- Current article categories are `getting-started`, `user-guide`, `faq`, `tips`, and `changelog`.
- Changelog content uses the same structured article model so future release notes can be expanded without redesigning the page.

Files changed:

- `src/app/lib/helpCenter.ts`
- `src/app/components/screens/HelpCenter.tsx`
- `src/app/routes.ts`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Implementation review confirms `/help` renders from structured help data, the menu includes Help Center near Notifications and Settings, and the page uses FinanceOS light/dark theme tokens.

## Alert And Banner Theme Rules - 2026-06-21

Alert/banner theme rules:

- Alert and banner components must use semantic FinanceOS alert tokens instead of one-off hardcoded dark or light utility colors.
- Warning, success, error, and info states each define background, border, title, body text, and icon colors for both dark and light mode.
- Warning banners use rounded 18-24px corners, soft borders, a warning icon, and a clear title/description hierarchy.
- Do not use white/light text on light warning surfaces.
- Do not use dark text on dark warning surfaces.
- Snapshot warnings must remain readable inside dialogs and Reports/Annual Planner save flows.

Warning card color tokens:

- Light mode warning background: `#FFFBEB`.
- Light mode warning border: `#F59E0B`.
- Light mode warning title: `#92400E`.
- Light mode warning body text: `#78350F`.
- Light mode warning icon: `#D97706`.
- Dark mode warning background keeps the approved translucent amber treatment.
- Dark mode warning text remains amber-tinted on a dark surface for contrast.

Shared alert classes:

- `financeos-alert-banner` provides the base rounded alert surface.
- `financeos-alert-warning` applies warning background, border, and text tokens.
- `financeos-alert-success`, `financeos-alert-error`, and `financeos-alert-info` are available for matching success/error/info banners.
- The shared `Alert` primitive supports `warning`, `success`, `info`, and `destructive` variants through these classes.

Files changed:

- `src/styles/theme.css`
- `src/app/components/ui/alert.tsx`
- `src/app/components/archive/SaveSnapshotActions.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Search confirmed the old low-contrast `text-amber-100` / `bg-amber-500/10` / `border-amber-300/20` snapshot warning styling was removed from `SaveSnapshotActions`.

## Public Landing Page Architecture - 2026-06-21

Landing page architecture:

- The root route `/` is a public marketing landing page for FinanceOS.
- The landing page is implemented in `src/app/components/screens/LandingPage.tsx`.
- Landing-specific styles live in `src/styles/landing.css` and are imported by `src/styles/index.css`.
- Landing styles are isolated under the `.financeos-landing` namespace.
- The landing page has its own header with only the FinanceOS brand, Login, and Sign Up actions.
- The landing page must not show the authenticated app header, dashboard menu, profile menu, notifications, timezone, month selector, or settings controls.

One-theme rule:

- The public landing page uses one fixed brand theme.
- Landing styles must not depend on FinanceOS dark/light CSS variables such as `--financeos-surface` or `--financeos-text-primary`.
- App theme switching must affect only authenticated/main app pages.
- `AppShell` bypasses the FinanceOS theme provider and app chrome for `/`, so landing visuals remain unchanged regardless of stored app theme.

Routing behavior:

- Fresh load at `/` opens the public landing page.
- `/start` preserves the previous app entry behavior: route to dashboard when setup is complete, otherwise route to setup.
- Get Started and Sign Up route to `/setup`.
- Log In routes to `/start`.
- Existing authenticated app routes remain under the normal `AppShell`, `FinanceOSThemeProvider`, and `TopNav`.

Animation approach:

- The landing hero uses CSS-built fintech visuals: floating dashboard cards, a card stack, chart bars, and a dashboard preview panel.
- Animations are subtle transform and bar-scale animations, designed to feel like a polished fintech product rather than a game or neon/cyberpunk scene.
- `prefers-reduced-motion: reduce` disables meaningful animation and transition duration in the landing namespace.
- Landing mobile styles collapse the hero and preview cards into a stacked responsive layout.

Files changed:

- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `src/styles/index.css`
- `src/app/components/layout/AppShell.tsx`
- `src/app/routes.ts`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`.
- Implementation review confirms `/` renders the public landing page without app chrome, `/start` preserves the prior setup/dashboard routing behavior, and app routes still use the main FinanceOS theme system.

## Profile Dropdown Behavior - 2026-06-21

Profile dropdown behavior:

- The top-bar profile/avatar button uses the shared Radix dropdown primitive.
- The dropdown opens from the avatar button and aligns under the profile control.
- The dropdown closes on outside click, Escape, and menu item selection through the dropdown primitive.
- The dropdown includes a profile summary with avatar initials, user/budget name, and an email placeholder.
- Menu items include an icon, label, and helper text.
- Menu items are: Switch accounts, Back to Landing Page, and Log out.

Routing behavior for each option:

- `Switch accounts` calls the placeholder multi-account route helper and currently navigates to `/`.
- `Back to Landing Page` navigates directly to `/` and does not clear budget/app data.
- `Log out` clears only placeholder session/account keys and navigates to `/`.
- Login/session data is not fully implemented yet, so logout intentionally does not delete FinanceOS budget data.

Theme styling rules:

- Profile dropdown surfaces use `var(--financeos-surface)`, `var(--financeos-surface-elevated)`, `var(--financeos-surface-hover)`, `var(--financeos-border)`, `var(--financeos-text-primary)`, `var(--financeos-text-secondary)`, and `var(--financeos-text-muted)`.
- Icon containers use `var(--financeos-icon-container)` so Light Mode does not show black circles.
- Log out uses a subtle red accent for the icon and label while helper text remains theme-readable.
- Dropdown corners stay around 20px with soft borders, app shadow, and existing open/close animation from the shared primitive.

Future auth and multi-account TODOs:

- Replace `clearFinanceOSSession` with the real auth provider logout call when authentication exists.
- Replace `getSwitchAccountRoute` with a true account picker or login/account-selection route when multi-account support exists.
- Keep budget/app data scoped separately from session state before enabling destructive logout behavior.

Files changed:

- `src/app/components/layout/TopNav.tsx`
- `src/app/lib/session.ts`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Implementation review confirms the dropdown options route safely, the landing route is reachable at `/`, and the menu uses theme-aware styling for dark and light app pages.

## Logo and Landing Navigation - 2026-06-23

Logo navigation behavior:

- The FinanceOS logo/title is product home navigation.
- App header brand clicks must route to `/`, the public landing page.
- Landing page brand clicks stay on `/` and do not navigate away from the landing page.
- Logo/title navigation must not log out the user, clear app data, reset app state, or clear localStorage.

Landing page routing behavior:

- `/` remains the public-facing product homepage.
- `/dashboard` remains the authenticated dashboard route and must stay available through navigation/menu controls.
- The profile dropdown `Back to Landing Page` action routes to `/`, matching app header brand navigation.
- Legacy or alternate app navigation must not treat `/` as the Dashboard route.

Authenticated CTA behavior:

- The landing page still shows the FinanceOS brand, hero, feature/product showcase, dashboard preview, workflow section, and final CTA for users with completed setup.
- When setup is not complete, landing CTAs show `Log In` and `Sign Up`.
- When setup is complete, landing CTAs show `Open Dashboard` and `Continue Budgeting`.
- `Open Dashboard` routes to `/dashboard`.
- `Continue Budgeting` routes to `/start`, preserving the existing session-aware entry behavior.

Files changed:

- `src/app/components/layout/TopNav.tsx`
- `src/app/components/layout/Sidebar.tsx`
- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`.
- Static review confirms the active app header logo/title routes to `/`, the profile dropdown landing action routes to `/`, the landing brand remains on `/`, and Dashboard menu navigation remains available at `/dashboard`.

## Landing Button Readability - 2026-06-23

Landing page fixed-theme rule:

- The public landing page uses one fixed Robinhood-inspired fintech theme.
- Landing button styles must stay isolated under `.financeos-landing`.
- Landing buttons must not depend on app theme tokens such as `var(--financeos-surface)`, `var(--financeos-text-primary)`, dark mode classes, light mode classes, or the main app button system.
- Toggling the app Light/Dark Mode must not change landing button colors or readability.

Landing button style rules:

- All landing buttons use `.financeos-landing-button` plus one fixed variant class.
- Primary CTA buttons use `.financeos-landing-button-primary`: green `#00C805` background, dark `#0B0B0C` text, green hover, no transparent state.
- Secondary CTA buttons use `.financeos-landing-button-secondary`: dark `#0B0B0C` background, white text, dark hover.
- Header/ghost buttons use `.financeos-landing-button-ghost`: transparent background, dark text, subtle dark border, light dark-tint hover background.
- Hover and visited states must keep explicit readable text colors.
- Deprecated landing aliases such as `.financeos-landing-button-dark`, `.financeos-landing-button-light`, and `.financeos-landing-link` must preserve readable fallback colors if referenced by older markup.

Files changed:

- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Live desktop/mobile visual testing could not be performed in this sandbox because the dev server cannot bind to `127.0.0.1:5173` (`EPERM` from the prior server check).
- Static review confirms every landing page CTA now uses a landing-specific fixed color variant: header ghost/primary, hero primary/secondary, and final primary.

## Landing Animation Speed - 2026-06-23

Landing page animation speed rules:

- Landing animation timing is scoped to `src/styles/landing.css` and must not alter main app/dashboard animation behavior.
- Landing motion should feel medium-paced, polished, and fintech-oriented rather than slow, frantic, or game-like.
- Decorative loops should generally stay in the 5s-8s range.
- One-time draw or reveal motion should generally stay in the 900ms-1400ms range.
- Hover and small interaction transitions should stay in the 180ms-350ms range.
- Prefer `cubic-bezier(0.22, 1, 0.36, 1)` or `ease-out` for premium smoothness.
- `prefers-reduced-motion: reduce` must continue disabling decorative loops and minimizing transitions inside the landing namespace.

## Landing Budget Dashboard Mockup Repair - 2026-06-24

Landing mockup visual rules:

- The Budget dashboard landing showcase mockup must look like intentional FinanceOS UI, not decorative placeholder geometry.
- Use editable React/CSS/SVG elements for dashboard preview content whenever possible: cash-flow chart, budget mix, category bars, small labels, and finance summary chips.
- Keep the dark premium fintech style, glassy surfaces, muted grid lines, rounded cards, and lime as an accent only.
- Avoid plain empty rectangles, random decorative blocks, or visual elements that do not represent financial UI.

Removed black rectangle animation:

- The old monitor-stand/black rectangle was removed from the Budget dashboard showcase.
- Do not reintroduce floating black blocks under or over the showcase chart area.

New dashboard preview elements:

- Cash-flow card with line chart, area fill, month markers, dots, and legend labels for Income, Expenses, and Amount left.
- Budget mix card with donut chart and values for Needs, Savings, and Debt.
- Category plan card with Housing, Food, Savings, and Debt progress bars.
- Subtle floating mini cards for amount left and upcoming bills.
- Animations are limited to line draw, bar fill, donut pulse, and small card float; respect reduced-motion rules through the existing landing reduced-motion block.

AI-generated assets:

- No AI-generated visual assets were used. The implementation is React/HTML/CSS/SVG only.

Files changed:

- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `git diff --check` passes.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Static review confirms only landing showcase mockup code/styles were changed for this visual repair and no actual app dashboard components were changed.

## Preview Expected Transactions And Month Dropdown Scroll - 2026-06-24

Expected Transactions mock data rule:

- Developer Preview Mode must provide mock expected monthly values through `mockFinanceData.expectedAmounts`.
- Preview expected transaction values are `income: 4200`, `expenses: 1850`, `savings: 650`, and `debt: 475`, for a dashboard Expected Transactions total of `7175`.
- Dashboard cards, reports, and charts that already read `expectedAmounts` should receive these preview values automatically while preview mode is enabled.

Preview Mode data isolation rule:

- Preview expected amounts are applied only in `withPreviewData()` read state.
- Preview expected amounts must not be written to localStorage as real user data.
- Turning Preview Mode off must return the app to the persisted real user expected amounts.

Dropdown viewport/scroll behavior rule:

- Shared MonthSelector dropdowns, including Dashboard Month and top Planning Period, must keep the existing trigger position and visual model while the opened panel stays inside the viewport.
- Month selector popovers render through a portal with fixed positioning anchored to the trigger `getBoundingClientRect()`, viewport-measured `maxHeight`, `overflow-y: auto`, and `overscroll-behavior: contain`.
- The trigger/button position must remain unchanged; only the opened panel may be repositioned or clamped.
- Dropdown z-index must keep the menu above cards/content, and all 12 months must remain reachable on desktop, tablet, and mobile.
- Do not move Planning Period or change header order to fix dropdown overflow.

Files changed:

- `src/mock/mockFinanceData.ts`
- `src/app/lib/financeStore.tsx`
- `src/app/components/common/MonthSelector.tsx`
- `src/styles/theme.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `git diff --check` passes.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Static review confirms Preview Mode overlays mock expected amounts in read state without saving them as real user data.
- Static review confirms MonthSelector keeps the existing design while adding viewport max-height and internal scrolling.

## Categories Hover And Header Alignment Repair - 2026-06-24

Category hover style rule:

- Categories page rows use `.financeos-category-row` for section-specific hover styling.
- Dark Mode category row hover uses `#1C1F26` with a subtle `rgb(198 255 0 / 0.18)` border.
- Dark Mode category hover text must remain readable: primary text `#F8FAFC`, secondary/action icon text `#CBD5E1`, and destructive icons `#F87171`.
- Light Mode keeps the existing subtle `hover:bg-slate-50` behavior unless a separate light-mode readability issue is found.
- Do not reuse global table hover fixes for Categories cards; keep category hover behavior scoped to Categories rows.

Header control alignment rule:

- Top taskbar controls must share the same vertical centerline with `align-items: center` on control groups.
- Planning Period must stay in its current order and location; do not move it relative to Month/Year, date/time, notifications, settings, profile, or menu controls.
- Header order preservation is required: brand/page info, Planning Period, date/time, notifications, settings, profile, menu.
- Header pill/icon control height standard is `h-11` / `44px`; compact taskbar controls use no vertical padding drift (`py-0`) and centered flex layout.
- Avoid margin-top, translateY, or relative top offsets for header alignment unless there is no structural alternative.

Files changed:

- `src/app/components/screens/Categories.tsx`
- `src/app/components/layout/TopNav.tsx`
- `src/app/components/common/MonthSelector.tsx`
- `src/app/components/common/DateTimeDisplay.tsx`
- `src/app/components/layout/MenuDropdown.tsx`
- `src/styles/theme.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `git diff --check` passes.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Static review confirms no landing page files were changed.
- Static review confirms the top taskbar DOM/control order was preserved while control heights and center alignment were normalized.

## Landing Button Readability Repair - 2026-06-23

Landing button contrast rules:

- Landing CTAs must use the landing-only `LandingButton` component with `.financeos-landing-button-*` and `.landing-btn-*` classes.
- Primary lime buttons use `#C6FF00` at rest and `#B7FF00` on hover with dark text only: `#071006` or `#050505`.
- Dark and secondary buttons use `#050505`/`#0B0B0C` backgrounds, off-white/white text, and `rgba(255,255,255,0.16)` or stronger hover borders.
- Outline/ghost buttons on dark landing sections use `rgba(255,255,255,0.04)` backgrounds, `#F8FAFC` text, and `rgba(255,255,255,0.16)` borders.
- Outline/ghost buttons in any light/lime landing context use `rgba(0,0,0,0.06)` backgrounds, `#050505` text, and `rgba(0,0,0,0.18)` borders.
- Button child text and icons inherit `currentColor`; do not style button children with lime/neon text on lime backgrounds.
- Keep these rules scoped under `.financeos-landing` so dashboard app buttons and Light/Dark Mode remain unaffected.

Files changed:

- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`.
- Static CSS validation confirms `src/styles/landing.css` has balanced braces.
- Static review confirms all landing button variants keep readable text colors at rest and hover, with no neon text on lime buttons and no dark text on dark buttons.

## Landing Typography and Contrast Repair - 2026-06-23

Landing typography scale:

- Hero headline uses `font-size: clamp(4rem, 7vw, 7.5rem)`, `line-height: 0.9`, and a real max width of `760px` so it stays editorial without colliding with the dashboard mockup.
- Mobile hero headline uses `font-size: clamp(3.15rem, 13vw, 4.45rem)` with `line-height: 0.92`.
- Landing section headings use `font-size: clamp(2.25rem, 4.2vw, 4.7rem)` with more relaxed line height and reduced visual weight.
- Eyebrow/badge text is small, uppercase, semi-bold, and letter-spaced; supporting copy stays muted, shorter, and limited to readable line lengths.

Landing button contrast rules:

- All landing CTAs use the landing-only `LandingButton` component and `.financeos-landing-button-*` classes.
- Primary CTAs use lime `#C6FF00`/deep lime hover with dark text `#071006` and `font-weight: 700`.
- Secondary and dark CTAs use `#050505` with white text and a subtle light border.
- Outline CTAs use transparent dark-section styling with white text and a visible border.
- Button child spans and SVG icons inherit the explicit button color so hover and section backgrounds cannot make button text unreadable.

Hero layout rules:

- The hero remains a two-column layout on desktop: text on the left, dashboard animation/mockup on the right.
- Desktop hero spacing uses a larger grid gap, separate z-index layers, and constrained text/mockup widths so text and animation do not overlap.
- At tablet/mobile widths, the hero stacks into one column with text above the mockup.
- The landing page remains a fixed dark/lime theme and must not depend on app Light/Dark Mode or app dashboard theme variables.

Files changed:

- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Static CSS validation confirms `src/styles/landing.css` has balanced braces.
- Static review confirms the changes are scoped to landing page component/styles and do not reference app theme variables, `data-theme`, app Light/Dark Mode classes, or dashboard page components.

Animation timing values:

- Hero 3D card stack parallax: `6s` with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Floating side finance card: `5.8s` with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Floating mini finance card: `6.4s` with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Preview chart bars: `2.1s` with `ease-out`.
- Dashboard preview line draw: `1.15s` with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Button and brand hover transitions remain `180ms`.

Files changed:

- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Live desktop/mobile animation review could not be performed in this sandbox because the dev server cannot bind to `127.0.0.1:5173` (`EPERM` from the prior server check).
- Static review confirms landing-only animation durations are medium paced and reduced-motion handling remains present under `.financeos-landing`.

## Robinhood-Inspired Landing Redesign - 2026-06-23

Landing page design architecture:

- The public landing page is implemented as section-level components in `src/app/components/screens/LandingPage.tsx`.
- Section components are `LandingHero`, `LandingFeatureCards`, `LandingDashboardShowcase`, `LandingSnapshotSection`, `LandingTrustSection`, and `LandingFinalCTA`.
- Reusable landing elements are `LandingButton`, `FinanceOS3DCard`, and `AnimatedBudgetBars`.
- Landing styles remain isolated in `src/styles/landing.css` under `.financeos-landing`.
- The app shell still bypasses authenticated app chrome on `/`; the landing page must not show dashboard menu, notifications, timezone, settings, or profile controls.

Robinhood-inspired section rules:

- Use the design feeling from the provided references without copying Robinhood copy, logos, product names, or exact assets.
- Sections should feel cinematic and full-width, with black/deep-charcoal fintech surfaces, large editorial headings, sparse copy, bold lime CTAs, rounded cards, thin borders, and subtle glow.
- Product visuals should be CSS-built FinanceOS mockups: dashboard panels, KPI cards, monitor/tablet-style reports, payment cards, budget tiles, archive cards, geometric icons, and budget-bar backgrounds.
- Avoid neon cyberpunk, game UI, busy decoration, or copied product imagery.

FinanceOS-specific landing page content:

- Hero headline: `Your financial life, organized in one operating system.`
- Hero subheadline explains income, expenses, savings, debt, payment methods, reports, and monthly budget snapshots.
- Feature cards focus on `Smart Budget Tracking` and `Payment Method Overview`.
- Dashboard showcase focuses on monthly cash flow, category breakdowns, savings progress, and debt reduction.
- Snapshot section focuses on preserving monthly/yearly budget history.
- Trust section focuses on organization, local snapshots, structured payment methods, and decision-focused reports.
- Final CTA headline: `Join a new generation of budgeters`.

One-theme landing page rule:

- The landing page remains one fixed theme independent from app Light/Dark Mode.
- Do not use app theme variables such as `--financeos-surface`, `--financeos-text-primary`, `data-theme`, dark mode classes, or light mode classes in landing CSS.
- Landing color tokens are local to `.financeos-landing`, including lime `#C6FF00`, deep black/charcoal surfaces, white text, muted white text, and explicit button colors.

Animation timing rules:

- Landing animations use medium professional motion only.
- Floating loops stay between roughly `5.4s` and `7s`.
- Chart/progress draw animations stay around `1.15s` to `1.25s`.
- Scroll/section reveal uses `620ms`.
- Budget bar/candle animations are visibly moving but restrained.
- Continue using `cubic-bezier(0.22, 1, 0.36, 1)` and `ease-out`.
- `prefers-reduced-motion: reduce` must continue minimizing landing animations and transitions.

Button styling rules:

- All landing buttons use `LandingButton` and landing-only classes.
- Primary buttons use lime background with dark readable text.
- Secondary/dark buttons use black background, white text, and subtle border.
- Outline buttons use transparent dark-section styling with white text and a readable border.
- Header actions are limited to `Log in` and `Sign up` for unauthenticated users, or session-aware `Continue Budgeting` and `Open Dashboard` for setup-completed users.

Files changed:

- `src/app/components/screens/LandingPage.tsx`
- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`.
- Static review confirms landing CSS does not reference app theme variables or app light/dark classes, landing buttons use fixed readable variants, logo/header routing remains on the public landing flow, and Dashboard remains reachable through the existing app route.

## Landing CSS Repair - 2026-06-23

Root cause of landing CSS break:

- `src/styles/index.css` was still importing `src/styles/landing.css`, and `LandingPage.tsx` still rendered the expected `.financeos-landing` wrapper/classes.
- The break was traced to the landing stylesheet being wrapped in Tailwind `@layer components`, which made the fixed landing-page rules subject to cascade-layer ordering instead of guaranteed normal stylesheet ordering.
- For a standalone public marketing page, landing rules must not be dependent on Tailwind component-layer behavior or app theme layer ordering.

Fix:

- Converted `src/styles/landing.css` from a Tailwind `@layer components` block to plain scoped CSS.
- Kept all selectors scoped under `.financeos-landing` or landing-specific class names.
- Verified CSS brace balance after the repair.
- Preserved the Robinhood-inspired FinanceOS landing sections, fixed theme, lime/dark button system, medium-speed animations, and reduced-motion fallback.

Landing CSS isolation rule:

- Landing CSS must remain normal imported CSS, not a Tailwind layer, unless there is a specific cascade-order reason and visual regression testing confirms it.
- Landing styles must stay independent from app Light/Dark Mode and must not use app theme variables like `--financeos-surface` or `--financeos-text-primary`.
- The landing wrapper `.financeos-landing` is required for all landing-specific layout, typography, button, mockup, and animation styles.

Files changed:

- `src/styles/landing.css`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`.
- Static review confirms `src/styles/index.css` imports `landing.css`, `/` renders `LandingPage`, the FinanceOS app-header logo routes to `/`, the landing wrapper/class names match the repaired CSS, and `landing.css` no longer contains `@layer components`.

## Budget Health Score - 2026-06-24

Formula:

- Budget Health Score is calculated by `calculateBudgetHealthScore()` in `src/app/lib/budgetHealthScore.ts`.
- Final score is clamped from `0` to `100`.
- Weighted factors:
  - Savings performance: `30%` from actual savings vs expected savings.
  - Expense control: `30%` from actual expenses vs expected expenses, with full credit at or below expected and decreasing credit when over expected.
  - Cash flow health: `25%` from actual amount left and actual amount left compared with expected amount left.
  - Debt progress: `15%` from actual debt payments vs expected debt payments.
- Amount left is always `income - expenses - savings - debt`.
- Missing, zero, `NaN`, or infinite values are normalized safely before scoring.

Data sources used:

- The Savings/Tracker screen reads `actualAmounts`, `expectedAmounts`, `selectedMonth`, `activeYear`, and `previewModeEnabled` from `useFinanceData()`.
- The Budget Health Score uses the selected month values, not the calendar current month.
- Actual values come from transactions derived by `deriveActualAmounts()`.
- Expected values come from monthly expected plans in `expectedAmounts`.
- The score reacts to selected month changes because both selected actual and expected monthly inputs are recalculated from `selectedMonth`.
- Real user data reacts to selected year changes because `actualAmounts` are derived from the active year and expected amounts come from the active finance state.

Preview Mode behavior:

- Preview Mode uses a separate in-memory finance state created by `createPreviewState()`.
- Preview actual values come from `mockFinanceData.transactions`.
- Preview expected values come from `mockFinanceData.expectedAmounts`.
- Preview edits to transactions, expected monthly plans, payment plans, categories, and saved snapshots dispatch to the preview reducer only.
- Switching Preview Mode on/off immediately changes `useFinanceData()` between preview state and real state, which updates the Budget Health Score inputs.
- The Budget Health Score card shows a compact Preview Mode breakdown with actual savings, expected savings, actual expenses, expected expenses, actual debt payments, expected debt payments, and final score.

Mock data isolation rule:

- Do not merge Preview Mode mock transactions or expected amounts into real user state.
- Do not write preview reducer state to `financeos:app-data:v1`.
- Only the Preview Mode enabled flag may be written to `financeos:dev-preview-enabled`.
- Mock data must remain isolated from real user data and localStorage persistence.

Files changed:

- `src/app/lib/budgetHealthScore.ts`
- `src/app/lib/financeStore.tsx`
- `src/app/components/screens/TrackerUI.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`.
- Static code review confirms Preview Mode has mock expected transactions, the score reads mock actual and expected values while Preview Mode is enabled, selected month changes alter the score inputs, and preview state is not persisted to real app localStorage.

## Savings Tracker UI Audit - 2026-06-24

Savings tracker data source rules:

- The Savings section is implemented in `src/app/components/screens/TrackerUI.tsx`.
- All Savings tracker UI reads through `useFinanceData()` only.
- Real mode uses real `transactions`, `actualAmounts`, `expectedAmounts`, `categories`, `selectedMonth`, and `activeYear`.
- Preview Mode uses the isolated preview reducer state from `financeStore.tsx`.
- Do not read directly from `mockFinanceData` inside the UI. Mock data must enter through the same finance data context path as real data.
- Month-sensitive cards, progress bars, summaries, and charts must use `selectedMonth`.
- Year-sensitive transaction grouping must filter by `activeYear`.
- YTD cards and savings trend data include months from January through `selectedMonth`.

Actual vs expected savings rules:

- Actual savings comes from savings transactions included in `deriveActualAmounts()`.
- Expected savings comes from the selected month or YTD slice of `expectedAmounts`.
- Missing expected savings is treated as `0`; the UI must show `No target set` or a clean empty state instead of dividing by zero.
- Actual greater than expected shows positive progress and an `Ahead` status.
- Actual equal to expected shows `On track`.
- Actual below expected shows `Behind` warning styling.
- Progress bar widths are clamped from `0%` to `100%`; displayed percentages may exceed `100%` to show over-goal performance.
- Money values use USD currency formatting through the tracker utility formatter.
- Percent values are sanitized so `NaN`, `Infinity`, `undefined`, and `null` do not appear.

Budget Health Score behavior:

- Budget Health Score continues to use `calculateBudgetHealthScore()`.
- Inputs are selected-month actual and expected income, expenses, savings, and debt payments.
- The score recalculates when selected month, active year, real data, preview data, or Preview Mode state changes.
- In Preview Mode, the score card shows a compact developer breakdown of actual savings, expected savings, actual expenses, expected expenses, actual debt, expected debt, and final score.

Preview Mode Savings mock behavior:

- Preview expected savings now varies by month using `expectedSavingsByMonth`.
- Preview actual savings already varies by month through individual mock savings transactions for Emergency Fund, House Fund, Investment Contributions, and Vacation Fund.
- Preview savings trend, goal cards, selected-month summary, progress bars, and Budget Health Score use mock values only while Preview Mode is enabled.
- Preview year changes update preview state. If the selected preview year has no matching mock transactions, actual savings safely falls to `0` while expected plans remain readable.
- Preview reducer state is in memory only and is not saved to `financeos:app-data:v1`.
- Only the Preview Mode toggle flag is saved to `financeos:dev-preview-enabled`.

Savings tracker UI behavior:

- Added safe status handling for tracker cards: `Ahead`, `On track`, `Behind`, `Under target`, `Over target`, `No target set`, and `No data`.
- Added selected-period Savings trend chart inside the Savings section using actual vs expected savings.
- Added selected-month savings summary with actual, expected, clamped progress bar, percent, and status.
- Added savings goal progress cards derived from savings categories and YTD savings transactions.
- Added responsive grid classes so tracker cards stack on mobile and do not overflow.
- Updated dark/light readability to use FinanceOS theme variables for headings, muted text, borders, surfaces, and status treatments.

Files changed:

- `src/app/components/screens/TrackerUI.tsx`
- `src/mock/mockFinanceData.ts`
- `src/app/lib/financeStore.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`; browser-based dark mode, light mode, and mobile checks could not be completed here.
- Static code review confirms Savings tracker cards, chart, monthly summary, goal cards, and Budget Health Score read selected month/year and Preview Mode state from `useFinanceData()`.
- Static code review confirms progress widths are clamped, zero expected savings avoids division by zero, and empty savings data has clean empty states.

## Dashboard Collapsible Sticky Header - 2026-06-26

Collapsible sticky header behavior:

- The Dashboard collapsible sticky hero is implemented in `src/app/components/screens/Dashboard.tsx`.
- The top taskbar/header order must remain unchanged: `TopNav` stays above the Dashboard hero.
- The Dashboard hero remains sticky with a stable `top-[4.25rem]` offset so it does not fight the top taskbar.
- The KPI card visual style must remain unchanged.
- The sticky hero element itself uses a stable reserved expanded height to prevent the following dashboard content from jumping when KPI cards collapse.
- KPI cards collapse visually with opacity and transform changes while the stable sticky hero height prevents document-flow height churn.

Scroll threshold values:

- Collapse threshold: `DASHBOARD_HERO_COLLAPSE_Y = 160`.
- Expand threshold: `DASHBOARD_HERO_EXPAND_Y = 120`.

Hysteresis rule:

- When expanded, collapse only after `scrollY > 160`.
- When collapsed, expand only after `scrollY <= 120`.
- Do not use a single shared threshold for both directions; that causes flicker around the boundary.

Performance rule for scroll listeners:

- Scroll listeners must be passive: `{ passive: true }`.
- Do not call `setState` on every scroll event.
- Use `requestAnimationFrame` to coalesce scroll updates.
- Track the collapsed state in a ref and only call React state setters when the collapsed value actually changes.
- Clean up both the scroll listener and any pending animation frame on unmount.
- Do not perform repeated DOM measurement such as `getBoundingClientRect()` inside scroll events unless it is batched in `requestAnimationFrame` and genuinely required.

Animation and layout rule:

- Prefer `transform` and `opacity` for scroll-linked visual changes.
- Avoid changing document-flow height at the scroll threshold.
- Use `transform-gpu`, `will-change`, and reduced-motion-safe transition classes on animated sticky hero elements.
- Keep parent containers free of overflow, transforms, filters, or containment rules that would break `position: sticky`.

Files changed:

- `src/app/components/screens/Dashboard.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`; live desktop, iPhone, tablet, Light Mode, and Dark Mode scroll testing could not be completed here.
- Static code review confirms the scroll listener is passive, rAF-coalesced, hysteresis-based, and cleaned up on unmount.
- Static code review confirms the Dashboard hero now reserves stable space and no longer toggles collapse state on every scroll pixel.

## Dashboard Mobile KPI Row - 2026-06-26

Mobile KPI row behavior:

- On iPhone/mobile widths below the `sm` breakpoint, Dashboard hero KPI cards render as a horizontal swipe row.
- KPI order remains unchanged: Income, Savings, Debt, Expenses, Amount Left.
- Expected Transactions remains the next Dashboard KPI card below the sticky hero and remains vertically reachable.
- On `sm` and larger viewports, the existing Dashboard KPI grid behavior remains in place.
- Do not change the sticky header hysteresis values or scroll listener behavior when adjusting KPI row layout.

KPI card mobile width rule:

- Mobile KPI cards use `width: clamp(220px, 78vw, 300px)`.
- Cards must use `shrink-0` / `flex: 0 0 auto` behavior so they do not squeeze into unreadable mobile columns.
- Desktop and tablet cards use normal grid sizing.

Horizontal scroll/snap rule:

- Mobile KPI row uses horizontal overflow with scroll snapping.
- Required row behavior:
  - `overflow-x: auto`
  - `overflow-y: hidden`
  - `scroll-snap-type: x mandatory`
  - `-webkit-overflow-scrolling: touch`
  - `overscroll-x-contain`
- Each KPI card wrapper uses `scroll-snap-align: start`.
- The row keeps inline padding so the first and last KPI cards are fully reachable and not clipped on iPhone widths.

Sticky header mobile accessibility rule:

- Keep the sticky hero's vertical collapse animation independent from horizontal KPI scrolling.
- Do not animate KPI card width during scroll.
- Do not force all KPI cards into one tiny mobile grid row.
- If a sticky hero panel uses `overflow: hidden` for collapse clipping, the inner KPI row must still be horizontally scrollable inside the visible panel area.

Files changed:

- `src/app/components/screens/Dashboard.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`; live iPhone widths `375px`, `390px`, `414px`, mobile Safari, desktop, tablet, Light Mode, and Dark Mode testing could not be completed here.
- Static code review confirms mobile KPI cards have snap alignment, fixed readable mobile widths, horizontal touch scrolling, and left/right padding so the last KPI card remains reachable.
- Static code review confirms existing collapse/expand hysteresis and rAF scroll handling were not changed for this mobile KPI fix.

## Reports Monthly Filtering Revert - 2026-06-27

Reverted behavior:

- The Reports monthly filtering/chart update from 2026-06-27 was reverted.
- Reports returned to the previous annual/overall behavior.
- The Reports page again shows annual financial insights and summaries for `activeYear`.
- Report charts again use 12-month annual datasets from `actualAmounts` and `expectedAmounts`.
- Expense category breakdown again uses all active-year report transactions from `useFinanceData()`.
- The temporary Monthly/Annual report mode toggle, monthly report labels, monthly empty states, and monthly health score KPI were removed.

Files changed:

- `src/app/components/screens/Reports.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Static code review confirms `Reports.tsx` no longer imports `useState` or `calculateBudgetHealthScore`, no longer defines monthly report mode, and again maps charts over `MONTH_SHORT` / `MONTHS` for annual report behavior.

## Reports Category Breakdown Pie Chart - 2026-06-27

Default 2D style rule:

- The Reports Category Breakdown donut chart should rest as a flat, modern 2D chart.
- Do not apply default slice extrusion, per-slice offsets, fake depth layers, heavy full-chart shadows, or permanent bevel/highlight overlays.
- Use subtle slice separation through clean strokes/gaps that remain readable in Light Mode and Dark Mode.
- Keep existing chart data, center value display, labels, legend/list behavior, and empty state behavior.

Hover pop interaction rule:

- Only the active hovered or focused slice should subtly pop.
- Use a radial offset from the slice midpoint so the active slice moves outward from the donut center.
- Do not use scale-only, translateX-only, or translateY-only hover motion for pie slices; those can push the active slice awkwardly into neighboring slices.
- Keep the active slice at its original size unless there is a specific reason to increase radius.
- Use a soft hover-only drop shadow on the active slice.
- Keep hover transitions short and smooth around `180ms`.
- Respect `prefers-reduced-motion: reduce` by removing transform animation while preserving focus/hover readability through stroke changes.
- SVG overflow must remain visible so the hover pop is not clipped.

Pie chart label overflow update reverted:

- The 2026-06-27 label overflow/truncation update was reverted.
- Do not use the removed `formatPieLabel` truncation/hiding behavior unless the label design is revisited intentionally.
- The chart labels returned to the prior percentage-only slice labels shown for slices at or above `5%`.
- The center hover label returned to the full category name display.
- Legend buttons returned to their prior behavior without extra title attributes from the reverted label experiment.

Files changed:

- `src/app/components/charts/ElevatedExpenseDonutChart.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`; live hover checks in desktop, tablet, mobile, Light Mode, and Dark Mode could not be completed here.
- Static review confirms default chart depth layers and always-on shadows were removed, while hover/focus still updates the center value, tooltip-like readout, and legend hover behavior.
- 2026-06-27 follow-up: hover motion now uses a 9px radial active-slice offset from the slice midpoint instead of scale or fixed vertical translation, preventing the active slice from expanding into the slice to its right.
- 2026-06-27 follow-up: the later label overflow/truncation update was reverted; slice labels are back to the prior percentage-only display for slices at or above `5%`, while the flat 2D style and radial hover pop remain.

## Actual vs Expected Bar Chart Colors - 2026-06-27

Actual vs Expected chart color rule:

- Actual vs Expected bar charts must use shared flat fintech colors from `src/app/components/charts/chartTheme.ts`.
- `Actual` bars use `ACTUAL_COLOR = "#3B82F6"` and `ACTUAL_HOVER_COLOR = "#2563EB"`.
- `Expected` bars use `EXPECTED_COLOR = "#94A3B8"` and `EXPECTED_HOVER_COLOR = "#64748B"`.
- Legends and tooltips must label the series as `Actual` and `Expected`.

Solid bar rule:

- Do not use multi-stop SVG fills for Actual vs Expected bars.
- Do not use category/KPI colors such as income green or dashboard purple for Expected bars.
- Hover/active bars stay flat and use the matching hover constants.

Dashboard and Reports consistency rule:

- Dashboard `Expected vs Actual Preview` and Reports `Expected vs Actual Income` must import and use the same Actual/Expected constants.
- Do not change unrelated pie charts, KPI colors, category colors, or non-bar trend lines when adjusting Actual vs Expected bar colors.

Files changed:

- `src/app/components/charts/chartTheme.ts`
- `src/app/components/screens/Dashboard.tsx`
- `src/app/components/screens/Reports.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- Static review confirms Dashboard and Reports Actual vs Expected bar charts use the shared constants, use solid bar colors, and show `Actual` / `Expected` series names in legends and tooltips.

## Archived Budget Annual PDF Export - 2026-06-27

Archived Budget annual PDF export behavior:

- Annual archive summaries in `Archived Budgets` include a `Download Annual Report PDF` button.
- The button generates the report from the selected `SavedYearlyBudget.summary_json` archive snapshot only.
- Do not mix live dashboard, current Reports, or current transaction state into a downloaded archived annual report.
- The button shows `Generating PDF...` while building the file, disables repeat clicks, shows `Annual report PDF downloaded.` on success, and shows `Could not generate PDF. Please try again.` on failure.
- Missing archived details render as `Not available` instead of `NaN`, `undefined`, `null`, or crashing.

Annual PDF report data structure:

- `year`
- `generatedAt`
- `profileName`
- `annualTotals`
- `actualVsExpected`
- `monthlyBreakdown`
- `categoryBreakdown`
- `highlights`
- `notes`
- Current annual archive snapshots do not store full debt accounts, detailed savings goals, or individual transaction rows; those sections must use clean archived summary values or `Not available` fallbacks until the archive schema expands.

PDF fintech statement template rules:

- Use a clean US Letter statement layout with a white/light background, charcoal text, blue accents, subtle grey borders, alternating table rows, section dividers, and readable spacing.
- Do not use browser print output, screenshots of app pages, dark app backgrounds, heavy visual effects, or clipped chart screenshots.
- Every page footer includes FinanceOS, report year, generated date, and page number.
- Tables must truncate long text safely inside cells and keep money/percent values consistently formatted.

Actual blue / Expected grey PDF color rule:

- Actual indicators use `#3B82F6`.
- Expected indicators use `#94A3B8`.
- Actual vs Expected PDF indicators must remain flat and solid.

File naming rule:

- Annual PDF downloads use `FinanceOS-Annual-Report-{year}.pdf`.

Files changed:

- `src/app/services/generateAnnualReportPdf.ts`
- `src/app/components/screens/SavedBudgets.tsx`
- `guidelines.md`

Testing results:

- `npm run build` passes. Vite still reports the existing large chunk warning only.
- `git diff --check` passes.
- `npm run lint` fails because no `lint` script is configured in `package.json`.
- `npm run typecheck` fails because no `typecheck` script is configured in `package.json`.
- `npm run dev -- --host 127.0.0.1` cannot start in this sandbox because binding to `127.0.0.1:5173` fails with `EPERM`; live PDF download/open checks, desktop/mobile download behavior, and Light/Dark Mode browser checks could not be completed here.
- Static review confirms annual PDF generation reads `SavedYearlyBudget.summary_json`, uses archived annual totals/monthly breakdown/category rankings/highlights/notes, downloads a named PDF file, and does not save generated PDF metadata to localStorage.
