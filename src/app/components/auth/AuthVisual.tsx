import type { CSSProperties } from "react";

// Deterministic composition: never regenerate positions on form renders.
const bars = Array.from({ length: 48 }, (_, index) => {
  const column = index % 16;
  const row = Math.floor(index / 16);
  const seed = ((index * 73 + 29) % 101) / 101;
  return {
    x: 5 + column * 5.8 + seed * 1.8,
    y: 19 + row * 25 + Math.sin(column * 0.44 + row) * 13,
    arc: 63 - column * 2.4 + row * 17 + Math.sin(column * 0.4) * 8,
    height: 19 + seed * 64,
    duration: 8 + seed * 8,
    delay: -(index * 1.73),
    drift: 12 + seed * 26,
    opacity: 0.38 + seed * 0.55,
    accent: index % 8 === 3,
  };
});

export function AuthVisual({ variant }: { variant: "login" | "signup" }) {
  return (
    <div className="auth-cash-field" aria-hidden="true">
      {bars.map((bar, index) => (
        <span key={index} className={`auth-cash-bar${bar.accent ? " auth-cash-bar-accent" : ""}`}
          style={{
            left: `${bar.x}%`, top: `${variant === "signup" ? bar.arc : bar.y}%`,
            height: `${bar.height}px`, "--cash-duration": `${bar.duration}s`,
            "--cash-delay": `${bar.delay}s`, "--cash-drift": `${bar.drift}px`,
            "--cash-opacity": bar.opacity,
          } as CSSProperties} />
      ))}
    </div>
  );
}
