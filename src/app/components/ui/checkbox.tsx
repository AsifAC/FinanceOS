"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";

import { cn } from "./utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-[#252933] bg-[#0F1115] text-[#F8FAFC] shadow-xs outline-none transition-shadow data-[state=checked]:border-[#8B5CF6] data-[state=checked]:bg-[#8B5CF6] focus-visible:border-[#8B5CF6]/70 focus-visible:ring-[3px] focus-visible:ring-[#8B5CF6]/20 aria-invalid:border-[#EF4444] aria-invalid:ring-[#EF4444]/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
