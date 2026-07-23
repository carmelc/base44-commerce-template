/**
 * Monetary helpers. Every money value in this template flows through round2()
 * so stored totals are always 2-dp numbers (Base44-idiomatic, unlike Woo's strings).
 */
import { CURRENCIES } from "./data/currencies.ts";

/** Round to 2 decimal places (half-up, EPSILON-guarded against FP drift). */
export function round2(n: number): number {
  const v = Number(n) || 0;
  return Math.round((v + (v >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100;
}

/**
 * Distribute `total` across `weights` proportionally and cents-exact using the
 * largest-remainder method, so the shares always sum to exactly round2(total).
 * Woo does the same when spreading a fixed_cart coupon across eligible lines.
 */
export function distributeProportionally(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + (Number(b) || 0), 0);
  const totalCents = Math.round(round2(total) * 100);
  if (sum <= 0 || totalCents <= 0 || !weights.length) return weights.map(() => 0);
  const raw = weights.map((w) => ((Number(w) || 0) / sum) * totalCents);
  const cents = raw.map((r) => Math.floor(r));
  let remainder = totalCents - cents.reduce((a, b) => a + b, 0);
  // hand leftover cents to the largest fractional parts first
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    cents[i] += 1;
    remainder -= 1;
  }
  return cents.map((c) => c / 100);
}

/**
 * Format an amount per the store's `general` settings values:
 * {currency, currency_position, thousand_sep, decimal_sep, num_decimals}.
 * Positions: left | right | left_space | right_space (Woo options).
 */
export function formatMoney(amount: number, general: Record<string, unknown> = {}): string {
  const code = String(general.currency ?? "USD");
  const currency = CURRENCIES.find((c) => c.code === code);
  const symbol = currency?.symbol ?? code;
  const decimals = Number(general.num_decimals ?? currency?.decimals ?? 2);
  const thousandSep = String(general.thousand_sep ?? ",");
  const decimalSep = String(general.decimal_sep ?? ".");
  const position = String(general.currency_position ?? "left");

  const negative = amount < 0;
  const fixed = Math.abs(round2(amount)).toFixed(decimals);
  const [intPart, fracPart] = fixed.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  const num = fracPart ? `${grouped}${decimalSep}${fracPart}` : grouped;

  let out: string;
  switch (position) {
    case "right":       out = `${num}${symbol}`; break;
    case "left_space":  out = `${symbol} ${num}`; break;
    case "right_space": out = `${num} ${symbol}`; break;
    case "left":
    default:            out = `${symbol}${num}`;
  }
  return negative ? `-${out}` : out;
}
