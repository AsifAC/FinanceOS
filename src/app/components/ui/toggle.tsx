"use client";

import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium text-[#CBD5E1] outline-none transition-[color,box-shadow] hover:bg-[#1C1F26] hover:text-[#F8FAFC] focus-visible:border-[#8B5CF6]/70 focus-visible:ring-[3px] focus-visible:ring-[#8B5CF6]/20 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-[#8B5CF6]/20 data-[state=on]:text-[#F8FAFC] aria-invalid:border-[#EF4444] aria-invalid:ring-[#EF4444]/20 whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-[#252933] bg-[#0F1115] hover:bg-[#1C1F26] hover:text-[#F8FAFC]",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
