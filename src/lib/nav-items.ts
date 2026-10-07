import { LayoutGrid, Wallet, Radar, Newspaper, MoreHorizontal, ArrowLeftRight, Repeat, PieChart } from "lucide-react";

/** Menu do desktop (barra lateral): tudo à vista. */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutGrid },
  { href: "/portfolio", label: "Carteira", icon: Wallet },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/noticias", label: "Notícias", icon: Newspaper },
  { href: "/contas", label: "Contas", icon: Wallet },
  { href: "/transacoes", label: "Movimentos", icon: ArrowLeftRight },
  { href: "/recorrentes", label: "Recorrências", icon: Repeat },
  { href: "/relatorios", label: "Relatórios", icon: PieChart },
] as const;

/** Barra inferior do telemóvel: 4 atalhos + "Mais" com o resto. */
export const BOTTOM_NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutGrid },
  { href: "/portfolio", label: "Carteira", icon: Wallet },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/noticias", label: "Notícias", icon: Newspaper },
  { href: "/mais", label: "Mais", icon: MoreHorizontal },
];

/** Rotas que "vivem" dentro do separador Mais. */
export const MORE_PATHS = ["/mais", "/contas", "/transacoes", "/recorrentes", "/relatorios"];
