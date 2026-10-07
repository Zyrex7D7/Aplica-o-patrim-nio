import { formatCurrency, formatPercent, formatSignedCurrency, cx } from "@/lib/format";

const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-text-muted");

/** Cartão principal: património em azul grande, variação do dia, retorno total e dividendos. */
export function HeroCard({
  totalNetWorth, dayChangeEur, dayChangePct, hasQuotes, totalReturnEur, totalReturnPct, dividends, lastQuoteAt,
}: {
  totalNetWorth: number; dayChangeEur: number; dayChangePct: number; hasQuotes: boolean;
  totalReturnEur: number; totalReturnPct: number; dividends: number; lastQuoteAt: string | null;
}) {
  const date = lastQuoteAt
    ? new Date(lastQuoteAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })
    : null;

  return (
    <section
      className="overflow-hidden rounded-3xl border border-line"
      style={{ background: "linear-gradient(145deg, #12234A 0%, #101829 60%)" }}
    >
      <div className={cx("h-1 w-full", !hasQuotes ? "bg-line" : dayChangeEur >= 0 ? "bg-gain" : "bg-loss")} />
      <div className="p-6">
        <p className="text-sm text-text-muted">Património</p>
        <p className="text-[44px] leading-none sm:text-6xl font-extrabold tabular text-gold mt-2 break-words">
          {formatCurrency(totalNetWorth)}
        </p>

        <div className="mt-6">
          <p className="text-sm text-text-muted">Variação diária{date ? ` · ${date}` : ""}</p>
          {hasQuotes ? (
            <p className={cx("tabular text-2xl font-bold mt-1", tone(dayChangeEur))}>
              {formatPercent(dayChangePct)} <span className="text-text-faint font-normal">·</span>{" "}
              {formatSignedCurrency(dayChangeEur)}
            </p>
          ) : (
            <p className="text-sm text-text-faint mt-1">
              Sem cotações. Em Carteira, toca em &quot;Atualizar cotações&quot;.
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-sm text-text-muted">Retorno total</p>
            <p className={cx("tabular text-xl font-bold mt-1", tone(totalReturnEur))}>{formatPercent(totalReturnPct)}</p>
            <p className={cx("tabular text-sm", tone(totalReturnEur))}>{formatSignedCurrency(totalReturnEur)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-muted">Dividendos</p>
            <p className="tabular text-xl font-bold mt-1 text-text">{formatCurrency(dividends)}</p>
            <p className="text-sm text-text-faint">recebidos</p>
          </div>
        </div>
      </div>
    </section>
  );
}
