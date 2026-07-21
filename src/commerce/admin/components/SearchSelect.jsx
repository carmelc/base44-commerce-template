import React, { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import useDebounce from "../hooks/useDebounce";

/**
 * Async searchable picker (single or multi).
 *
 * Props:
 * - search(q) → Promise<[{ value, label, meta? }]>
 * - value: {value,label} | null   (single)  |  [{value,label}] (multiple)
 * - onChange(next)
 * - multiple?: boolean
 * - placeholder?: string
 * - disabled?, className?
 */
export default function SearchSelect({
  search,
  value,
  onChange,
  multiple = false,
  placeholder = "Search…",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.resolve(search(debouncedQuery))
      .then((opts) => !cancelled && setOptions(opts || []))
      .catch(() => !cancelled && setOptions([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, debouncedQuery, search]);

  const selectedValues = multiple ? (value || []).map((v) => v.value) : value ? [value.value] : [];

  const pick = (opt) => {
    if (multiple) {
      const exists = (value || []).some((v) => v.value === opt.value);
      onChange(exists ? (value || []).filter((v) => v.value !== opt.value) : [...(value || []), opt]);
    } else {
      onChange(value?.value === opt.value ? null : opt);
      setOpen(false);
    }
  };

  const removeChip = (v) => onChange((value || []).filter((x) => x.value !== v));

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-left">
              {multiple
                ? (value || []).length
                  ? `${value.length} selected`
                  : placeholder
                : value?.label || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <CommandEmpty>No results.</CommandEmpty>
                  <CommandGroup>
                    {options.map((opt) => (
                      <CommandItem key={opt.value} value={String(opt.value)} onSelect={() => pick(opt)}>
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedValues.includes(opt.value) ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="truncate">{opt.label}</div>
                          {opt.meta && (
                            <div className="truncate text-xs text-muted-foreground">{opt.meta}</div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {multiple && (value || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v.value} variant="secondary" className="gap-1 pr-1">
              {v.label}
              <button
                type="button"
                onClick={() => removeChip(v.value)}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
