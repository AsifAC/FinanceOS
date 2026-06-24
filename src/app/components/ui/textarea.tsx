import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-xl border border-[var(--financeos-input-border)] bg-[var(--financeos-input-bg)] px-3 py-2 text-base text-[var(--financeos-text-primary)] placeholder:text-[var(--financeos-text-subtle)] transition-[color,box-shadow] outline-none focus-visible:border-[#8B5CF6]/70 focus-visible:ring-[3px] focus-visible:ring-[#8B5CF6]/20 aria-invalid:border-[#EF4444] aria-invalid:ring-[#EF4444]/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
