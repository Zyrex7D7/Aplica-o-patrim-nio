import { formatCurrency, formatPercent, formatSignedCurrency, cx } from "@/lib/format";

function tone(value: number): string {
  return value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-text-muted";
}

/**
 * Cartão principal: um número grande (património), a variação do dia logo
 * por baixo, e dois indicadores secundários. Tudo o que importa à primeira
 * vista, sem abrir nada.
 */
export function HeroCard({
  totalNetWorth,
  dayChangeEur,
  dayChangePct,
  hasQuotes,
  totalReturnEur,
  totalReturnPct,
  dividends,
  lastQuoteAt,
}: {
  totalNetWorth: number;
  dayChangeEur: number;
  dayChangePct: number;
  hasQuotes: boolean;
  totalReturnEur: number;
  totalReturnPct: number;
  dividends: number;
  lastQuoteAt: string | null;
}) {
  const topLine = !hasQuotes ? "bg-line" : dayChangeEur >= 0 ? "bg-gain" : "bg-loss";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-surface">
      <div className={cx("h-0.5 w-full", topLine)} />
      <div className="p-5 sm:p-7">
        <p className="text-sm text-text-muted">Património</p>
        <p className="font-display text-4xl sm:text-5xl md:text-6xl tabular text-text mt-1 break-words">
          {formatCurrency(totalNetWorth)}
        </p>

        <div className="mt-5">
          <p className="text-sm text-text-muted">Hoje</p>
          {hasQuotes ? (
            <p className={cx("tabular text-xl sm:text-2xl mt-0.5", tone(dayChangeEur))}>
              {formatPercent(dayChangePct)}
              <span className="text-text-faint mx-2">·</span>
              {formatSignedCurrency(dayChangeEur)}
            </p>
          ) : (
            <p className="text-sm text-text-faint mt-1">
              Sem cotações ainda. Em Portefólio, toca em &quot;Atualizar cotações&quot;.
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line-soft pt-5">
          <div className="min-w-0">
            <p className="text-sm text-text-muted">Retorno total</p>
            <p className={cx("tabular text-lg sm:text-xl mt-0.5", tone(totalReturnEur))}>
              {formatPercent(totalReturnPct)}
            </p>
            <p className={cx("tabular text-sm", tone(totalReturnEur))}>{formatSignedCurrency(totalReturnEur)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-muted">Dividendos recebidos</p>
            <p className="tabular text-lg sm:text-xl mt-0.5 text-text">{formatCurrency(dividends)}</p>
            {lastQuoteAt && (
              <p className="text-xs text-text-faint mt-1">
                Cotações de {new Date(lastQuoteAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
