import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { fetchFundamentalsCached } from "@/lib/analysis/fetch";
import { computeAnalysis } from "@/lib/analysis/compute";
import { GROUP_LABEL, type Analysis, type Criterion, type Group, type Status, type VerdictKey } from "@/lib/analysis/types";
import { shortTicker } from "@/lib/ticker";
import { formatCurrency, formatPercent, cx } from "@/lib/format";
import { TickerAvatar } from "@/components/ui/ticker-avatar";
import { DcfCalculator } from "@/components/radar/dcf-calculator";

export const maxDuration = 30;

const VERDICT_STYLE: Record<VerdictKey, string> = {
  buy: "border-gain bg-gain-soft text-gain",
  expensive: "border-gold bg-gold-soft text-gold",
  watch: "border-gold bg-gold-soft text-gold",
  avoid: "border-loss bg-loss-soft text-loss",
  insufficient: "border-line bg-surface-alt text-text-muted",
};

const DOT: Record<Status, string> = { good: "bg-gain", ok: "bg-gold", bad: "bg-loss", na: "bg-text-faint" };
const STATUS_TEXT: Record<Status, string> = { good: "text-gain", ok: "text-text", bad: "text-loss", na: "text-text-faint" };
const GROUPS: Group[] = ["caixa", "saude", "negocio", "valuation"];

function RangeBar({ a }: { a: Analysis }) {
  const v = a.valuation;
  if (!v || a.price === null) return null;
  const pess = v.scenarios[0].fairValue;
  const opt = v.scenarios[2].fairValue;
  if (pess === null || opt === null || v.fairValue === null) return null;
  const lo = Math.min(pess, a.price) * 0.9;
  const hi = Math.max(opt, a.price) * 1.1;
  const pos = (x: number) => `${Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="mt-5">
      <div className="relative h-2 rounded-full bg-surface-alt">
        <div className="absolute h-2 rounded-full bg-gold-soft" style={{ left: pos(pess), width: `calc(${pos(opt)} - ${pos(pess)})` }} />
        <div className="absolute -top-1 h-4 w-1 rounded bg-gold" style={{ left: pos(v.fairValue) }} title="Valor estimado" />
        <div className="absolute -top-1.5 h-5 w-1.5 rounded bg-text" style={{ left: pos(a.price) }} title="Preço atual" />
      </div>
      <div className="mt-2 flex justify-between text-xs text-text-faint tabular">
        <span>Pessimista {formatCurrency(pess, a.currency)}</span>
        <span>Otimista {formatCurrency(opt, a.currency)}</span>
      </div>
      <p className="text-xs text-text-faint mt-1">
        <span className="inline-block h-2 w-2 rounded-sm bg-text mr-1" />preço atual ·{" "}
        <span className="inline-block h-2 w-2 rounded-sm bg-gold mx-1" />valor estimado (realista)
      </p>
    </div>
  );
}

function MetricRow({ c }: { c: Criterion }) {
  return (
    <li className="py-3 border-b border-line-soft last:border-0">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-text min-w-0">
          <span className={cx("inline-block h-2 w-2 rounded-full shrink-0", DOT[c.status])} />
          <span className="truncate">{c.label}</span>
        </span>
        <span className={cx("tabular text-sm font-semibold shrink-0", STATUS_TEXT[c.status])}>{c.display}</span>
      </div>
      <p className="text-xs text-text-faint mt-1 pl-4 leading-relaxed">{c.what}</p>
    </li>
  );
}

export default async function AnalisePage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: encoded } = await params;
  const symbol = decodeURIComponent(encoded);

  let a: Analysis | null = null;
  let error: string | null = null;
  try {
    a = computeAnalysis(await fetchFundamentalsCached(symbol));
  } catch (err) {
    error = err instanceof Error ? err.message : "Não foi possível obter os dados.";
  }

  const back = (
    <Link href="/radar" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-gold">
      <ArrowLeft size={15} /> Radar
    </Link>
  );

  if (!a) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
        {back}
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h1 className="text-xl font-bold text-text">{symbol}</h1>
          <p className="text-sm text-text-muted mt-2">{error}</p>
          <Link href={`/radar/${encodeURIComponent(symbol)}`} className="inline-block mt-3 text-sm text-gold font-semibold">Tentar novamente</Link>
        </section>
      </div>
    );
  }

  const t = shortTicker(a.symbol, a.name);
  const v = a.valuation;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
      {back}

      {/* Cabeçalho + veredicto */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <div className="flex items-center gap-3">
          <TickerAvatar ticker={t} size={48} />
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-text leading-tight">{t}</h1>
            <p className="text-sm text-text-muted truncate">{a.name}</p>
          </div>
          {a.price !== null && <p className="ml-auto tabular text-xl font-bold text-text shrink-0">{formatCurrency(a.price, a.currency)}</p>}
        </div>
        {(a.sector || a.industry) && <p className="text-xs text-text-faint mt-2">{[a.sector, a.industry].filter(Boolean).join(" · ")}</p>}

        <div className={cx("mt-4 rounded-2xl border px-4 py-3", VERDICT_STYLE[a.verdict.key])}>
          <p className="text-base font-bold">{a.verdict.title}</p>
          <p className="text-sm mt-1 opacity-90 leading-relaxed">{a.verdict.summary}</p>
          {a.qualityScore !== null && (
            <p className="text-xs mt-2 opacity-80 tabular">
              Qualidade {a.qualityScore}/100{a.valueScore !== null ? ` · Preço ${a.valueScore}/100` : ""}
            </p>
          )}
        </div>
      </section>

      {/* Quanto vale */}
      {v && v.fairValue !== null && a.price !== null && (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-base font-bold text-text">Quanto vale?</h2>
          <p className="text-xs text-text-faint mt-1">Estimativa por fluxo de caixa descontado (DCF), cenário realista.</p>
          <p className="tabular text-4xl font-extrabold text-gold mt-3">{formatCurrency(v.fairValue, a.currency)}</p>
          {v.upside !== null && (
            <p className={cx("tabular text-sm font-semibold mt-1", v.upside >= 0 ? "text-gain" : "text-loss")}>
              {v.upside >= 0
                ? `A cotação está ${formatPercent(v.upside / (1 + v.upside)).replace("+", "")} abaixo do valor estimado`
                : `A cotação está ${formatPercent(-v.upside / (1 + v.upside)).replace("+", "")} acima do valor estimado`}
            </p>
          )}
          <RangeBar a={a} />
          <p className="text-xs text-text-faint mt-4 leading-relaxed">
            Pressupostos: crescimento do caixa livre de {formatPercent(v.assumptions.growth).replace("+", "")} ({v.assumptions.growthSource}),
            crescimento terminal de {formatPercent(v.assumptions.terminalGrowth).replace("+", "")} e taxa de desconto de {formatPercent(v.assumptions.discountRate).replace("+", "")}
            {v.assumptions.beta !== null ? ` (beta ${v.assumptions.beta.toLocaleString("pt-PT", { maximumFractionDigits: 2 })}; taxa sem risco 4%, prémio de risco 5%)` : ""}.
          </p>
          {a.analyst && a.analyst.mean !== null && (
            <p className="text-xs text-text-muted mt-3 border-t border-line-soft pt-3">
              Para comparar: os analistas{a.analyst.count ? ` (${a.analyst.count})` : ""} têm um preço-alvo médio de{" "}
              <span className="tabular text-text">{formatCurrency(a.analyst.mean, a.currency)}</span>
              {a.analyst.low !== null && a.analyst.high !== null ? ` (entre ${formatCurrency(a.analyst.low, a.currency)} e ${formatCurrency(a.analyst.high, a.currency)})` : ""}
              {a.analyst.recommendation ? `, recomendação: ${a.analyst.recommendation}` : ""}. É uma referência, não entra na estimativa.
            </p>
          )}
        </section>
      )}

      {/* Razões */}
      {a.criteria.some((c) => c.status !== "na") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-gain flex items-center gap-2"><Check size={18} /> Razões para comprar</h2>
            {a.reasonsFor.length === 0 ? (
              <p className="text-sm text-text-faint mt-3">Nenhuma razão forte encontrada nos números.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {a.reasonsFor.map((r) => <li key={r} className="text-sm text-text leading-relaxed">{r}</li>)}
              </ul>
            )}
          </section>
          <section className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-loss flex items-center gap-2"><X size={18} /> Razões para não comprar</h2>
            {a.reasonsAgainst.length === 0 ? (
              <p className="text-sm text-text-faint mt-3">Nenhum alerta forte encontrado nos números.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {a.reasonsAgainst.map((r) => <li key={r} className="text-sm text-text leading-relaxed">{r}</li>)}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* Calculadora */}
      {v && a.price !== null && (
        <DcfCalculator
          price={a.price}
          currency={a.currency}
          inputs={v.inputs}
          initial={{ growth: v.assumptions.growth, terminalGrowth: v.assumptions.terminalGrowth, discountRate: v.assumptions.discountRate }}
        />
      )}

      {/* Cenários */}
      {v && (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h2 className="text-base font-bold text-text">Cenários</h2>
          <ul className="mt-3">
            {v.scenarios.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 py-2.5 border-b border-line-soft last:border-0">
                <div>
                  <p className="text-sm text-text">{s.label}</p>
                  <p className="text-xs text-text-faint tabular">
                    crescimento {formatPercent(s.growth).replace("+", "")} · terminal {formatPercent(s.terminalGrowth).replace("+", "")} · desconto {formatPercent(s.discountRate).replace("+", "")}
                  </p>
                </div>
                <p className="tabular text-sm font-semibold text-text">{s.fairValue !== null ? formatCurrency(s.fairValue, a.currency) : "n/d"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Métricas */}
      {GROUPS.map((g) => {
        const items = a.criteria.filter((c) => c.group === g);
        if (items.length === 0) return null;
        return (
          <section key={g} className="rounded-3xl border border-line bg-surface p-5">
            <h2 className="text-base font-bold text-text">{GROUP_LABEL[g]}</h2>
            <ul className="mt-2">{items.map((c) => <MetricRow key={c.key} c={c} />)}</ul>
          </section>
        );
      })}

      {/* Qualitativo */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-base font-bold text-text">O que os números não dizem</h2>
        <p className="text-xs text-text-faint mt-1">Vantagem competitiva, gestão e setor exigem leitura tua. Estes são só os indícios que os números dão.</p>
        <ul className="mt-3 flex flex-col gap-3">
          {a.qualitative.map((q) => (
            <li key={q.label}>
              <p className="text-sm font-semibold text-text">{q.label}</p>
              <p className="text-sm text-text-muted leading-relaxed">{q.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Notas */}
      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-sm font-bold text-text">Como ler isto</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-xs text-text-faint leading-relaxed list-disc pl-4">
          <li>Verde = bom, amarelo = razoável, vermelho = fraco, cinzento = sem dados. Os limites seguem os da tua lista (ex: ROIC acima de 15%, dívida líquida abaixo de 2–3× EBITDA, liquidez corrente acima de 1).</li>
          <li>O veredicto cruza duas notas: a qualidade do negócio e se o preço é razoável. Uma boa empresa pode ser má compra se estiver cara.</li>
          <li>O que é “caro” varia por setor, e o DCF depende dos pressupostos: usa a calculadora para ver o que acontece se estiverem errados.</li>
          {a.dataNotes.map((n) => <li key={n}>{n}</li>)}
          <li>Ferramenta de estudo, não aconselhamento financeiro. Os dados vêm do Yahoo Finance e podem ter erros, atrasos ou campos em falta.</li>
        </ul>
      </section>
    </div>
  );
}
