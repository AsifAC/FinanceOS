"use client";

import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      expand
      visibleToasts={4}
      gap={10}
      offset={20}
      toastOptions={{
        classNames: {
          toast: "financeos-toast",
          title: "financeos-toast-title",
          description: "financeos-toast-description",
          actionButton: "financeos-toast-action",
          cancelButton: "financeos-toast-cancel",
          closeButton: "financeos-toast-close",
          success: "financeos-toast-success",
          error: "financeos-toast-error",
          warning: "financeos-toast-warning",
          info: "financeos-toast-info",
        },
      }}
      className="toaster financeos-toaster group"
      style={
        {
          "--normal-bg": "#16181D",
          "--normal-text": "#F8FAFC",
          "--normal-border": "#252933",
          "--success-bg": "#16181D",
          "--success-text": "#F8FAFC",
          "--success-border": "rgba(0, 214, 143, 0.35)",
          "--error-bg": "#16181D",
          "--error-text": "#F8FAFC",
          "--error-border": "rgba(239, 68, 68, 0.35)",
          "--warning-bg": "#16181D",
          "--warning-text": "#F8FAFC",
          "--warning-border": "rgba(245, 158, 11, 0.35)",
          "--info-bg": "#16181D",
          "--info-text": "#F8FAFC",
          "--info-border": "rgba(139, 92, 246, 0.35)",
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
