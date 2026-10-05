import Link from "next/link";
import { ChevronRight, FileClock, LogOut, type LucideIcon } from "lucide-react";
import { ArrowLeftRight, PieChart, Repeat, Wallet } from "lucide-react";
import { signOut } from "./actions";

const ITEMS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/contas", label: "Contas", hint: "Bancos, poupança, corretoras e numerário", icon: Wallet },
  { href: "/transacoes", label: "Movimentos", hint: "Receitas, despesas e transferências", icon: ArrowLeftRight },
  { href: "/recorrentes", label: "Recorrências", hint: "Renda, salário e subscrições automáticas", icon: Repeat },
  { href: "/relatorios", label: "Relatórios", hint: "Despesas por categoria e orçamentos", icon: PieChart },
  { href: "/portfolio/importacoes", label: "Importações DEGIRO", hint: "Histórico de extratos carregados", icon: FileClock },
];

export default function MaisPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 md:py-10 flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold text-text">Mais</h1>
      <ul className="flex flex-col gap-3">
        {ITEMS.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-soft text-gold">
                <Icon size={22} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-text">{label}</span>
                <span className="block text-sm text-text-muted">{hint}</span>
              </span>
              <ChevronRight size={18} className="text-text-faint" />
            </Link>
          </li>
        ))}
      </ul>
      <form action={signOut}>
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3.5 text-sm font-semibold text-text-muted">
          <LogOut size={16} />
          Terminar sessão
        </button>
      </form>
    </div>
  );
}
