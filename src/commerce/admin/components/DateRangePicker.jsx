import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";

const toISO = (d) => (d ? d.toISOString().slice(0, 10) : null);

function presetRanges() {
  const today = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = startOfDay(today);
  const daysAgo = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() - n);
  return [
    { label: "Today", from: t, to: t },
    { label: "Last 7 days", from: daysAgo(6), to: t },
    { label: "This month", from: new Date(t.getFullYear(), t.getMonth(), 1), to: t },
    {
      label: "Last month",
      from: new Date(t.getFullYear(), t.getMonth() - 1, 1),
      to: new Date(t.getFullYear(), t.getMonth(), 0),
    },
    { label: "This year", from: new Date(t.getFullYear(), 0, 1), to: t },
  ];
}

/**
 * Date range picker with WooCommerce-style presets.
 * Props: { value: {from, to} (ISO yyyy-mm-dd) | null, onChange({from,to}|null), align? }
 */
export default function DateRangePicker({ value, onChange, align = "start" }) {
  const [open, setOpen] = useState(false);
  const presets = presetRanges();

  const label = value?.from
    ? `${value.from}${value.to && value.to !== value.from ? ` → ${value.to}` : ""}`
    : "All time";

  const applyPreset = (p) => {
    onChange({ from: toISO(p.from), to: toISO(p.to) });
    setOpen(false);
  };

  const applyCalendar = (range) => {
    if (!range?.from) return;
    onChange({ from: toISO(range.from), to: toISO(range.to || range.from) });
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="justify-start font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto p-0" align={align}>
          <div className="flex flex-col gap-0.5 border-r p-2">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={
              value?.from
                ? { from: new Date(value.from), to: value.to ? new Date(value.to) : undefined }
                : undefined
            }
            onSelect={applyCalendar}
          />
        </PopoverContent>
      </Popover>
      {value?.from && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(null)}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
