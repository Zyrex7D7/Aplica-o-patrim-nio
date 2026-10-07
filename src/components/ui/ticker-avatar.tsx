const COLORS = ["#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#0D9488", "#4F46E5", "#B45309", "#059669"];

/** Quadrado colorido com as iniciais do ticker (cor estável por ticker). */
export function TickerAvatar({ ticker, size = 40 }: { ticker: string; size?: number }) {
  let hash = 0;
  for (const ch of ticker) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
      style={{ width: size, height: size, background: COLORS[hash % COLORS.length], fontSize: size * 0.34 }}
      aria-hidden
    >
      {ticker.slice(0, 2)}
    </span>
  );
}
