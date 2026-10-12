import { formatCurrency, formatPercent, formatSignedCurrency, cx } from "@/lib/format";

const tone = (v: number) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-text-muted");

const TZ = "Europe/Lisbon";

function sameLisbonDay(a: Date, b: Date): boolean {
  const f = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
  return f(a) === f(b);
}

/** "Variação de hoje" ou "Variação da última sessão · sex., 9 out" (quando a bolsa está fechada). */
function sessionTitle(sessionIso: string | null): { title: string; isToday: boolean } {
  if (!sessionIso) return { title: "Variação diária", isToday: false };
  const d = new Date(sessionIso);
  if (sameLisbonDay(d, new Date())) return { title: "Variação de hoje", isToday: true };
  const label = d.toLocaleDateString("pt-PT", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
  return { title: `Variação da última sessão · ${label}`, isToday: false };
}

/** Cartão principal: património, variação da sessão, retorno total (depois de comissões) e dividendos. */
export function HeroCard({
  totalNetWorth, dayChangeEur, dayChangePct, hasQuotes, totalReturnEur, totalReturnPct, dividends, lastQuoteAt, lastSessionAt,
}: {
  totalNetWorth: number; dayChangeEur: number; dayChangePct: number; hasQuotes: boolean;
  totalReturnEur: number; totalReturnPct: number; dividends: number;
  lastQuoteAt: string | null; lastSessionAt: string | null;
}) {
  const { title, isToday } = sessionTitle(lastSessionAt);
  const updated = lastQuoteAt
    ? new Date(lastQuoteAt).toLocaleString("pt-PT", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
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
          <p className="text-sm text-text-muted">{title}</p>
          {hasQuotes ? (
            <>
              <p className={cx("tabular text-2xl font-bold mt-1", tone(dayChangeEur))}>
                {formatPercent(dayChangePct)} <span className="text-text-faint font-normal">·</span>{" "}
                {formatSignedCurrency(dayChangeEur)}
              </p>
              <p className="text-xs text-text-faint mt-1">
                {isToday
                  ? "Quanto a carteira subiu ou desceu hoje face ao fecho de ontem."
                  : "Bolsa fechada: é a subida ou descida do último dia de negociação face ao anterior."}
              </p>
            </>
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
            <p className="text-xs text-text-faint mt-1">Desde que compraste, depois de comissões.</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text-muted">Dividendos</p>
            <p className="tabular text-xl font-bold mt-1 text-text">{formatCurrency(dividends)}</p>
            <p className="text-sm text-text-faint">recebidos</p>
          </div>
        </div>

        {updated && <p className="text-xs text-text-faint mt-5">Preços atualizados a {updated}.</p>}
      </div>
    </section>
  );
}
