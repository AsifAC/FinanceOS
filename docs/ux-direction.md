# FinanceOS UX Direction

## Product Feel

FinanceOS should keep the Budget Sheet clarity, but behave like a seamless personal finance operating system. The main experience should feel connected through one app shell, consistent cards, responsive spacing, and smooth page transitions.

## Routing Flow

- `/` decides where to send the user.
- First visit routes to `/setup`.
- Completing setup stores `financeos:setup-completed` in local storage.
- After setup completion, FinanceOS shows a short loading transition and redirects to `/dashboard`.
- Returning users are sent from `/` to `/dashboard`.

## Layout Direction

- Replace the permanent sidebar with a top navigation shell.
- Keep FinanceOS branding visible in the header.
- Use a dropdown menu for all major sections.
- Keep the menu compact on desktop and thumb-friendly on mobile.

## Responsive Rules

- iPhone: one-column cards, single-column forms, larger tap targets, transaction cards instead of dense tables where possible.
- Laptop: compact dashboard grids with comfortable spacing.
- Desktop: spacious multi-column dashboard layout with chart and panel previews.

## Component Structure

- `AppShell`: global top-nav layout and content container.
- `TopNav`: logo, date/year context, user affordance, menu trigger.
- `MenuDropdown`: responsive navigation menu.
- `PageTransition`: route-level motion wrapper.
- `SetupWizard`: onboarding flow represented by `Setup`.
- `Dashboard`: post-setup home screen.
- `MetricCard`, `PendingTransactionsPanel`, `UpcomingPaymentsPanel`, `QuickLinksPanel`, `SummaryCard`, `ChartCard`, `MobileTransactionCard`: dashboard building blocks.
- `ResponsiveTable`: wrapper for future table-heavy screens on mobile.

## Next UI Passes

- Convert pending transaction tables into mobile-first cards.
- Wrap annual planner and report tables in `ResponsiveTable`.
- Convert add transaction and settings forms to consistent one-column mobile layouts.
- Add an intentional way to edit or reset setup after onboarding.
