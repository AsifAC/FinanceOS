import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "group relative inline-flex items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl border text-sm font-medium shadow-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus-visible:border-slate-300/70 focus-visible:ring-slate-300/20 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white shadow-black/20 hover:border-blue-300/20",
        destructive:
          "border-transparent bg-gradient-to-r from-[#EF4444] to-[#DC2626] text-white shadow-black/20 hover:border-red-300/20 focus-visible:ring-red-300/25",
        outline:
          "border-[var(--financeos-border)] bg-[var(--financeos-surface)] text-[var(--financeos-text-primary)] shadow-black/10 hover:border-[var(--financeos-border-strong)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]",
        secondary:
          "border-[var(--financeos-border)] bg-[var(--financeos-surface-elevated)] text-[var(--financeos-text-primary)] shadow-black/10 hover:border-[var(--financeos-border-strong)] hover:bg-[var(--financeos-surface-hover)]",
        ghost:
          "border-transparent bg-transparent text-[var(--financeos-text-muted)] shadow-none hover:border-[var(--financeos-border)] hover:bg-[var(--financeos-surface-hover)] hover:text-[var(--financeos-text-primary)]",
        link: "border-transparent bg-transparent text-[var(--financeos-text-secondary)] shadow-none underline-offset-4 hover:text-[var(--financeos-text-primary)] hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 rounded-xl gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      type={asChild ? undefined : type ?? "button"}
      {...props}
    />
  );
}

export { Button, buttonVariants };
