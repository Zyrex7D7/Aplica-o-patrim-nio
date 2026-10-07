"use client";

import { ResponsiveContainer, Treemap } from "recharts";

export interface TreemapItem {
  name: string;
  size: number; // valor de mercado (define o tamanho do bloco)
  ret: number; // retorno em % (define a cor), ex: 106.5
}

interface CellProps { x: number; y: number; width: number; height: number; name?: string; ret?: number }

function color(ret: number): string {
  const strength = Math.min(1, Math.abs(ret) / 150);
  const alpha = 0.3 + strength * 0.6;
  return ret >= 0 ? `rgba(47, 210, 127, ${alpha})` : `rgba(240, 100, 107, ${alpha})`;
}

function Cell(props: CellProps) {
  const { x, y, width, height, name, ret } = props;
  if (width <= 0 || height <= 0 || ret === undefined) return null;
  const showText = width > 52 && height > 38;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={8} fill={color(ret)} stroke="var(--color-ink)" strokeWidth={3} />
      {showText && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 4} textAnchor="middle" fill="#fff" fontSize={13} fontWeight={700}>
            {name}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 13} textAnchor="middle" fill="#fff" fontSize={12} opacity={0.9}>
            {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
          </text>
        </>
      )}
    </g>
  );
}

/** Mapa: tamanho = peso na carteira, cor = retorno. Vê-se logo onde está o dinheiro e o que rende. */
export function WeightTreemap({ items }: { items: TreemapItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base font-bold text-text">Peso vs retorno</h2>
      <p className="text-xs text-text-faint mt-1">Tamanho = peso na carteira · cor = retorno</p>
      <div className="mt-3">
        <ResponsiveContainer width="100%" height={280}>
          <Treemap
            data={items as never}
            dataKey="size"
            isAnimationActive={false}
            content={((props: unknown) => <Cell {...(props as CellProps)} />) as never}
          />
        </ResponsiveContainer>
      </div>
    </section>
  );
}
