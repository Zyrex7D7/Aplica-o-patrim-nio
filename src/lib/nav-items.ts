import { LayoutGrid, Wallet, ArrowLeftRight, Repeat, PieChart, LineChart } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Património", icon: LayoutGrid },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/transacoes", label: "Movimentos", icon: ArrowLeftRight },
  { href: "/recorrentes", label: "Recorrências", icon: Repeat },
  { href: "/relatorios", label: "Relatórios", icon: PieChart },
  { href: "/portfolio", label: "Portefólio", icon: LineChart },
] as const;

/** Subconjunto mostrado na barra fixa de baixo no telemóvel — só cabem 5 sem ficar apertado. */
export const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.href !== "/recorrentes");
