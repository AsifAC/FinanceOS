import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { AlertTriangle, Bug, Home, Settings } from "lucide-react";
import { Button } from "../ui/button";

function getErrorDetails(error: unknown) {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText}${error.data ? `: ${String(error.data)}` : ""}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }

  return String(error);
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const details = getErrorDetails(error);

  return (
    <main className="financeos-premium flex min-h-screen items-center justify-center bg-[linear-gradient(to_bottom,#0B0B0C_0,#0B0B0C_18rem,#121418_18rem,#121418_100%)] px-4 py-10 text-slate-100">
      <section className="w-full max-w-xl rounded-[24px] border border-[#252933] bg-[#16181D] p-6 shadow-[0_22px_54px_rgba(0,0,0,0.28)] sm:p-8">
        <div>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-300/25 bg-rose-500/12 shadow-lg shadow-rose-500/20">
            <AlertTriangle className="h-7 w-7 text-rose-200" />
          </div>

          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">FinanceOS</p>
          <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">Something went wrong.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The app hit a route error. You can return to your dashboard or restart setup while the issue is being fixed.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="gap-2">
              <Link to="/dashboard">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/setup">
                <Settings className="h-4 w-4" />
                Go to Setup
              </Link>
            </Button>
          </div>

          <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-200">
              <Bug className="h-4 w-4 text-cyan-200" />
              Developer details
            </summary>
            <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
              {details}
            </pre>
          </details>
        </div>
      </section>
    </main>
  );
}
