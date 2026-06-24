import { BookOpen, ChevronRight, History, Search } from "lucide-react";
import { helpArticleCount, helpSections, HelpSection } from "../../lib/helpCenter";
import { cn } from "../ui/utils";

function SectionSummaryCard({ section }: { section: HelpSection }) {
  return (
    <a
      href={`#${section.id}`}
      className="group rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-4 shadow-[var(--financeos-shadow-card)] transition-colors hover:border-[var(--financeos-border-strong)] hover:bg-[var(--financeos-surface-hover)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: section.accent }}>
            {section.eyebrow}
          </p>
          <h2 className="mt-2 text-base font-semibold text-[var(--financeos-text-primary)]">{section.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--financeos-text-muted)]">{section.description}</p>
        </div>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-[var(--financeos-border)] transition-colors group-hover:bg-[var(--financeos-icon-container-hover)]"
          style={{ backgroundColor: `${section.accent}24`, color: section.accent }}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--financeos-border)] pt-3 text-xs text-[var(--financeos-text-muted)]">
        <span>{section.articles.length} articles</span>
        <span>Open section</span>
      </div>
    </a>
  );
}

function HelpSectionPanel({ section }: { section: HelpSection }) {
  const isChangelog = section.id === "changelog";

  return (
    <section
      id={section.id}
      className="scroll-mt-28 rounded-[28px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-5 shadow-[var(--financeos-shadow-card)] sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-[var(--financeos-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: section.accent }}>
            {section.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--financeos-text-primary)]">{section.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--financeos-text-secondary)]">{section.description}</p>
        </div>
        <span className="w-fit rounded-full border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--financeos-text-muted)]">
          {section.articles.length} {section.articles.length === 1 ? "article" : "articles"}
        </span>
      </div>

      <div className={cn("mt-5 grid gap-3", isChangelog ? "lg:grid-cols-1" : "md:grid-cols-2")}>
        {section.articles.map((article) => {
          const Icon = article.icon;
          return (
            <article
              key={article.id}
              className="rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4 transition-colors hover:bg-[var(--financeos-surface-hover)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-[var(--financeos-border)]"
                  style={{ backgroundColor: `${section.accent}22`, color: section.accent }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--financeos-text-primary)]">{article.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--financeos-text-muted)]">{article.summary}</p>
                  {article.tags?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[var(--financeos-border)] bg-[var(--financeos-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--financeos-text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {isChangelog && (
        <div className="mt-4 rounded-[22px] border border-dashed border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-[var(--financeos-icon-container)] text-[var(--financeos-text-secondary)]">
              <History className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-[var(--financeos-text-primary)]">Release notes architecture</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--financeos-text-muted)]">
                Future release notes can be added as structured HelpArticle records or expanded into dated release groups without changing the page layout.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function HelpCenter() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-1 py-4 sm:px-2 lg:px-0">
      <header className="rounded-[30px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] p-5 shadow-[var(--financeos-shadow-card)] sm:p-7">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex h-13 w-13 items-center justify-center rounded-[22px] border border-[var(--financeos-border)] bg-[var(--financeos-icon-container)] text-[#8B5CF6]">
            <BookOpen className="h-6 w-6" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8B5CF6]">FinanceOS Help</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-[var(--financeos-text-primary)] sm:text-4xl">
            Help Center
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--financeos-text-secondary)]">
            Learn core workflows, review product guidance, and keep up with future FinanceOS updates.
          </p>
        </div>

        <div className="mt-6 grid gap-3 rounded-[24px] border border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex min-h-12 items-center gap-3 rounded-[18px] border border-[var(--financeos-border)] bg-[var(--financeos-surface)] px-4 text-[var(--financeos-text-muted)]">
            <Search className="h-4 w-4" />
            <span className="text-sm">Browse {helpArticleCount} help articles across FinanceOS workflows</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {helpSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-[var(--financeos-border)] bg-[var(--financeos-surface)] px-3 py-2 text-xs font-semibold text-[var(--financeos-text-muted)] transition-colors hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]"
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {helpSections.map((section) => (
          <SectionSummaryCard key={section.id} section={section} />
        ))}
      </section>

      <div className="grid gap-5">
        {helpSections.map((section) => (
          <HelpSectionPanel key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}
