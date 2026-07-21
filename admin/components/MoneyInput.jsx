import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import useMoney from "../hooks/useMoney";

/**
 * Numeric input with the store currency symbol.
 * Props: { value: number|null, onChange(number|null), placeholder?, disabled?, className? }
 */
export default function MoneyInput({ value, onChange, placeholder = "0.00", disabled, className = "" }) {
  const { symbol } = useMoney();
  const [text, setText] = useState(value ?? value === 0 ? String(value) : "");

  // Keep local text in sync when the outer value changes (e.g. after save).
  useEffect(() => {
    const asNum = text === "" ? null : Number(text);
    if ((value ?? null) !== (isNaN(asNum) ? null : asNum)) {
      setText(value === null || value === undefined ? "" : String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setText(raw);
    if (raw.trim() === "") {
      onChange(null);
      return;
    }
    const num = Number(raw);
    if (!isNaN(num)) onChange(num);
  };

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        {symbol}
      </span>
      <Input
        type="number"
        step="any"
        inputMode="decimal"
        className="pl-9"
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
}
