/**
 * Utilitários de formatação para o parser da DEGIRO.
 * A DEGIRO exporta CSVs no formato europeu: separador decimal "," e
 * separador de milhares ".", datas "dd-mm-aaaa" e delimitador ";" (locale
 * PT/ES) ou "," (locale EN/US). O parser tem de lidar com ambos.
 */

/** Remove acentos e normaliza para minúsculas, para comparação "fuzzy" de headers. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Converte um número em formato europeu ("1.234,56" ou "1234,56" ou "-12,3")
 * para um `number` JS. Também aceita formato "americano" (1,234.56) como
 * fallback, caso o ficheiro tenha vindo doutro locale.
 */
export function parseEuroNumber(raw: string | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (s === "" || s === "-" ) return null;

  // Remove símbolos de moeda e espaços (incluindo espaços não-separáveis).
  s = s.replace(/[€$£\s\u00A0]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // O último separador encontrado é o decimal; o outro é milhares.
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // formato europeu: 1.234,56
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // formato US: 1,234.56
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Só vírgula -> assume decimal europeu: 1234,56
    s = s.replace(",", ".");
  }
  // Só ponto, ou nenhum separador -> já está em formato JS válido.

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Faz parse de uma data da DEGIRO em formato "dd-mm-aaaa" ou "dd/mm/aaaa".
 * Devolve uma string ISO "aaaa-mm-dd" pronta para gravar numa coluna `date`.
 */
export function parseDegiroDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (!m) {
    // já pode vir em ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return null;
  }
  const [, d, mo, yRaw] = m;
  const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
  return `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Combina data ISO ("aaaa-mm-dd") com hora ("hh:mm") num timestamp ISO. */
export function combineDateTime(isoDate: string, time?: string | null): string | null {
  if (!time || !/^\d{1,2}:\d{2}(:\d{2})?$/.test(time.trim())) return null;
  const t = time.trim().length === 5 ? `${time.trim()}:00` : time.trim();
  return `${isoDate}T${t}`;
}

/** Hash SHA-256 estável (hex) usando a Web Crypto API — funciona em browser, Node 19+ e edge runtime. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
