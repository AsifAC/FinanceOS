import "../../../styles/branding.css";

type LogoProps = {
  variant?: "full" | "compact" | "icon";
  decorative?: boolean;
};

export function FinanceOSLogo({ variant = "full", decorative = false }: LogoProps) {
  return (
    <picture className={`financeos-brand-image financeos-brand-image-${variant}`}>
      {variant !== "icon" && <source media={`(max-width: ${variant === "compact" ? 1279 : 639}px)`} srcSet="/branding/financeos-favicon.png" />}
      <img
        src={variant === "icon" ? "/branding/financeos-favicon.png" : "/branding/financeos-logo.png"}
        alt={decorative ? "" : "FinanceOS"}
        width={variant === "icon" ? 357 : 2172}
        height={variant === "icon" ? 357 : 724}
      />
    </picture>
  );
}
