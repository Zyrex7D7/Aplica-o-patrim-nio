"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTransaction } from "@/app/transacoes/actions";
import { createClient } from "@/lib/supabase/client";
import { addDaysLocalISO, todayLocalISO } from "@/lib/dates";
import { formatCurrency, cx } from "@/lib/format";
import type { Account, Category } from "@/types/database";

type Kind = "despesa" | "receita" | "transferencia";
type DateMode = "hoje" | "ontem" | "outra";

const LAST_ACCOUNT_KEY = "mc:lastAccount";
const KIND_LABEL: Record<Kind, string> = { despesa: "Despesa", receita: "Receita", transferencia: "Transferência" };
const VISIBLE_CATEGORIES = 8;

const field =
  "w-full rounded-xl border border-line bg-surface-alt px-3 py-2.5 text-sm outline-none focus:border-gold";

/**
 * Registo rápido: valor → categoria (1 toque) → registar.
 * A conta fica memorizada, a data é "Hoje" por omissão e as categorias mais usadas aparecem primeiro.
 */
export function QuickEntry({
  accounts,
  categories,
  usage = {},
  autoFocus = false,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  /** Quantas vezes cada categoria foi usada (para pôr as mais usadas primeiro). */
  usage?: Record<string, number>;
  autoFocus?: boolean;
  onSaved?: () => void;
}) {
  const amountRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const defaultAccount = useMemo(
    () => (accounts.find((a) => a.type === "banco") ?? accounts[0])?.id ?? "",
    [accounts]
  );

  const [kind, setKind] = useState<Kind>("despesa");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(defaultAccount);
  const [toAccountId, setToAccountId] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("hoje");
  const [customDate, setCustomDate] = useState("");
  const [description, setDescription] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Lembra a última conta usada (guardado só neste dispositivo).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_ACCOUNT_KEY);
      if (saved && accounts.some((a) => a.id === saved)) setAccountId(saved);
    } catch {
      /* sem localStorage: usa a conta por omissão */
    }
  }, [accounts]);

  useEffect(() => {
    if (autoFocus) amountRef.current?.focus();
  }, [autoFocus]);

  const kindCategories = useMemo(
    () =>
      categories
        .filter((c) => c.kind === (kind === "receita" ? "receita" : "despesa") && !c.exclude_from_reports)
        .sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0) || a.name.localeCompare(b.name, "pt")),
    [categories, kind, usage]
  );
  const visibleCategories = showAll ? kindCategories : kindCategories.slice(0, VISIBLE_CATEGORIES);

  async function suggestFromDescription() {
    const text = description.trim();
    if (!text || categoryId || kind === "transferencia") return;
    const { data, error } = await createClient().rpc("suggest_category", { p_description: text });
    if (!error && data && kindCategories.some((c) => c.id === data)) setCategoryId(data as string);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Escreve o valor.");
      amountRef.current?.focus();
      return;
    }
    if (!accountId) {
      toast.error("Cria primeiro uma conta.");
      return;
    }
    if (kind === "transferencia" && (!toAccountId || toAccountId === accountId)) {
      toast.error("Escolhe uma conta de destino diferente da de origem.");
      return;
    }

    const date =
      dateMode === "hoje" ? todayLocalISO() : dateMode === "ontem" ? addDaysLocalISO(-1) : customDate || todayLocalISO();

    const fd = new FormData();
    fd.set("type", kind);
    fd.set("amount", amount);
    fd.set("occurred_on", date);
    fd.set("account_id", accountId);
    if (kind === "transferencia") fd.set("transfer_account_id", toAccountId);
    else if (categoryId) fd.set("category_id", categoryId);
    fd.set("description", description);

    startTransition(async () => {
      const result = await createTransaction(fd);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      try {
        localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
      } catch {
        /* ignora */
      }
      const catName = kindCategories.find((c) => c.id === categoryId)?.name;
      toast.success(`${KIND_LABEL[kind]} de ${formatCurrency(value)} registada${catName ? ` · ${catName}` : ""}.`);
      setAmount("");
      setDescription("");
      setCategoryId("");
      amountRef.current?.focus();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {(["despesa", "receita", "transferencia"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setCategoryId("");
              setShowAll(false);
            }}
            className={cx(
              "rounded-xl border px-2 py-2 text-sm font-medium transition-colors truncate",
              kind === k ? "border-gold text-gold bg-surface-alt" : "border-line text-text-muted"
            )}
          >
            {k === "transferencia" ? (
              <>
                <span className="sm:hidden">Transf.</span>
                <span className="hidden sm:inline">Transferência</span>
              </>
            ) : (
              KIND_LABEL[k]
            )}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="sr-only">Valor</span>
        <div className="relative">
          <input
            ref={amountRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0,00"
            aria-label="Valor"
            className="w-full rounded-2xl border border-line bg-surface-alt px-4 py-4 pr-12 text-3xl font-bold tabular outline-none focus:border-gold"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-text-muted">€</span>
        </div>
      </label>

      {kind !== "transferencia" && (
        <div>
          <p className="text-xs text-text-muted mb-2">Categoria</p>
          <div className="flex flex-wrap gap-2">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(categoryId === c.id ? "" : c.id)}
                className={cx(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  categoryId === c.id ? "border-gold bg-gold-soft text-gold" : "border-line text-text-muted"
                )}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#8B93A1" }} />
                {c.name}
              </button>
            ))}
            {kindCategories.length > VISIBLE_CATEGORIES && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-text-faint"
              >
                {showAll ? "Menos" : `Mais (${kindCategories.length - VISIBLE_CATEGORIES})`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className={cx("grid gap-3", kind === "transferencia" || accounts.length > 1 ? "grid-cols-1 sm:grid-cols-2" : "")}>
        {(kind === "transferencia" || accounts.length > 1) && (
          <label className="block">
            <span className="text-xs text-text-muted">{kind === "transferencia" ? "De" : "Conta"}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={cx(field, "mt-1")}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === "transferencia" && (
          <label className="block">
            <span className="text-xs text-text-muted">Para</span>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={cx(field, "mt-1")}>
              <option value="">Escolhe a conta</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </label>
        )}
      </div>

      <div>
        <p className="text-xs text-text-muted mb-2">Data</p>
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: "hoje", label: "Hoje" },
            { key: "ontem", label: "Ontem" },
            { key: "outra", label: "Outra data" },
          ] as const).map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDateMode(d.key)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                dateMode === d.key ? "border-gold bg-gold-soft text-gold" : "border-line text-text-muted"
              )}
            >
              {d.label}
            </button>
          ))}
          {dateMode === "outra" && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              aria-label="Data do movimento"
              className="rounded-xl border border-line bg-surface-alt px-3 py-1.5 text-sm outline-none focus:border-gold tabular"
            />
          )}
        </div>
      </div>

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={suggestFromDescription}
        placeholder="Descrição (opcional) — ex: Continente, Netflix…"
        aria-label="Descrição"
        className={field}
      />

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-gold py-3.5 text-base font-bold text-ink hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "A guardar..." : `Registar ${KIND_LABEL[kind].toLowerCase()}`}
      </button>
    </form>
  );
}
