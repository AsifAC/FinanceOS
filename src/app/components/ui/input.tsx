import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-[var(--financeos-text-primary)] placeholder:text-[var(--financeos-text-subtle)] selection:bg-[#8B5CF6] selection:text-white flex h-10 w-full min-w-0 rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 py-1 text-base text-[var(--financeos-text-primary)] transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[#8B5CF6]/70 focus-visible:ring-[#8B5CF6]/20 focus-visible:ring-[3px]",
        "aria-invalid:border-[#EF4444] aria-invalid:ring-[#EF4444]/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
