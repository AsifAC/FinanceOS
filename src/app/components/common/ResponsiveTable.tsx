import { ReactNode } from "react";

export function ResponsiveTable({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <div className="min-w-[42rem]">{children}</div>
    </div>
  );
}
