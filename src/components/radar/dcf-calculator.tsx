"use client";

import { useState } from "react";
import { dcfFairValue } from "@/lib/analysis/dcf";
import { formatCurrency, formatPercent, cx } from "@/lib/format";

interface Props {
  price: number;
  currency: string;
  inputs: { baseFcf: number; netDebt: number; shares: number };
  initial: { growth: number; terminalGrowth: number; discountRate: number };
}

function Slider({ label, hint, value, min, max, step, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-text">{label}</span>
        <span className="tabular text-sm font-semibold text-gold">{value.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-gold)]"
        aria-label={label}
      />
      <span className="text-xs text-text-faint">{hint}</span>
    </label>
  );
}

/** Calculadora de DCF: mexe nos pressupostos e vê, na hora, quanto vale a ação. */
export function DcfCalculator({ price, currency, inputs, initial }: Props) {
  const start = {
    growth: Math.round(initial.growth * 1000) / 10,
    terminal: Math.round(initial.terminalGrowth * 1000) / 10,
    discount: Math.round(initial.discountRate * 1000) / 10,
  };
  const [growth, setGrowth] = useState(start.growth);
  const [terminal, setTerminal] = useState(start.terminal);
  const [discount, setDiscount] = useState(start.discount);

  const res = dcfFairValue({ ...inputs, growth: growth / 100, terminalGrowth: terminal / 100, discountRate: discount / 100 });
  const fair = res && res.perShare > 0 ? res.perShare : null;
  const upside = fair !== null && price > 0 ? fair / price - 1 : null;
  const changed = growth !== start.growth || terminal !== start.terminal || discount !== start.discount;

  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-text">Calculadora de valuation (DCF)</h2>
          <p className="text-xs text-text-faint mt-1">
            Mexe nos pressupostos e vê quanto passa a valer. É a tua “planilha” com cenários, sem sair da app.
          </p>
        </div>
        {changed && (
          <button
            onClick={() => { setGrowth(start.growth); setTerminal(start.terminal); setDiscount(start.discount); }}
            className="text-xs text-gold shrink-0"
          >
            Repor
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Slider label="Crescimento do caixa livre" hint="No 1.º ano; desce até ao crescimento terminal ao fim de 10 anos." value={growth} min={0} max={25} step={0.5} onChange={setGrowth} />
        <Slider label="Crescimento terminal" hint="Para sempre, depois do ano 10. Perto da inflação (2–3%)." value={terminal} min={0} max={4} step={0.25} onChange={setTerminal} />
        <Slider label="Taxa de desconto (WACC)" hint="Retorno mínimo que exiges. Mais risco = taxa mais alta." value={discount} min={6} max={14} step={0.25} onChange={setDiscount} />
      </div>

      <div className="mt-5 rounded-2xl bg-surface-alt p-4">
        {fair === null ? (
          <p className="text-sm text-text-muted">
            Com estes pressupostos o modelo não dá um valor válido. A taxa de desconto tem de ficar pelo menos 1 ponto acima do crescimento terminal.
          </p>
        ) : (
          <>
            <p className="text-xs text-text-muted">Valor estimado por ação</p>
            <p className="tabular text-3xl font-extrabold text-text">{formatCurrency(fair, currency)}</p>
            <p className={cx("tabular text-sm font-semibold mt-1", upside !== null && upside >= 0 ? "text-gain" : "text-loss")}>
              {upside !== null ? `${formatPercent(upside)} face ao preço atual (${formatCurrency(price, currency)})` : ""}
            </p>
            {res && res.terminalShare > 0.75 && (
              <p className="text-xs text-text-faint mt-2">
                {Math.round(res.terminalShare * 100)}% deste valor vem do período depois do ano 10: o resultado é muito sensível aos pressupostos.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
