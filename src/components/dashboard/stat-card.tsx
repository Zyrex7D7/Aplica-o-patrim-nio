import { Card, CardLabel } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cx } from "@/lib/format";

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: number;
  tone?: "default" | "gain" | "loss" | "gold";
  hint?: string;
}) {
  const toneClass =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : tone === "gold" ? "text-gold" : "text-text";

  return (
    <Card className="p-4 sm:p-5">
      <CardLabel>{label}</CardLabel>
      <p className={cx("tabular text-xl sm:text-2xl mt-2 font-medium", toneClass)}>
        {formatCurrency(value)}
      </p>
      {hint && <p className="text-xs text-text-faint mt-1">{hint}</p>}
    </Card>
  );
}
