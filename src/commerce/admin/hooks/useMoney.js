import { useCallback, useMemo } from "react";
import { useSettings } from "../context/SettingsContext";
import { CURRENCIES } from "../lib/constants";

/**
 * Currency formatter driven by the `general` settings group.
 * Returns { format(n), symbol, code, decimals }.
 */
export default function useMoney() {
  const settings = useSettings();

  const cfg = useMemo(() => {
    const get = settings?.get || (() => undefined);
    const code = get("general", "currency", "USD");
    const currency = CURRENCIES.find((cc) => cc.code === code);
    return {
      code,
      symbol: currency?.symbol || code,
      position: get("general", "currency_position", "left"),
      thousandSep: get("general", "thousand_sep", ","),
      decimalSep: get("general", "decimal_sep", "."),
      decimals: get("general", "num_decimals", currency?.decimals ?? 2),
    };
  }, [settings]);

  const format = useCallback(
    (n) => {
      const num = Number(n);
      const val = isNaN(num) ? 0 : num;
      const negative = val < 0;
      const fixed = Math.abs(val).toFixed(cfg.decimals);
      const [intPart, decPart] = fixed.split(".");
      const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, cfg.thousandSep);
      const amount = decPart ? grouped + cfg.decimalSep + decPart : grouped;
      const sign = negative ? "-" : "";
      switch (cfg.position) {
        case "right":
          return `${sign}${amount}${cfg.symbol}`;
        case "left_space":
          return `${sign}${cfg.symbol} ${amount}`;
        case "right_space":
          return `${sign}${amount} ${cfg.symbol}`;
        case "left":
        default:
          return `${sign}${cfg.symbol}${amount}`;
      }
    },
    [cfg]
  );

  return { format, symbol: cfg.symbol, code: cfg.code, decimals: cfg.decimals };
}
