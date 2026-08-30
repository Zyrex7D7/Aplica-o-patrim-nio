import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-line bg-surface p-5",
        className
      )}
      {...props}
    />
  );
}

export function CardLabel({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={clsx(
        "text-[11px] uppercase tracking-[0.14em] text-text-faint font-medium",
        className
      )}
      {...props}
    />
  );
}
