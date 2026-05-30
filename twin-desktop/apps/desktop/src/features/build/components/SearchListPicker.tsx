import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

export interface SearchListOption {
  value: string;
  label: string;
  hint?: string;
  accentColor?: string;
}

function useDismissOnOutside(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, open, ref]);
}

export interface SearchListPickerProps {
  value: string;
  options: SearchListOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  compact?: boolean;
  defaultAccentColor?: string;
}

export function SearchListPicker({
  value,
  options,
  onChange,
  placeholder = "Выберите…",
  searchPlaceholder = "Поиск…",
  compact = false,
  defaultAccentColor = "var(--accent-base)",
}: SearchListPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const accent = selected?.accentColor ?? defaultAccentColor;

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(normalizedQuery) ||
        option.hint?.toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useDismissOnOutside(rootRef, open, close);

  return (
    <div ref={rootRef} className="min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`group flex w-full min-w-0 items-center gap-2 rounded-[11px] border bg-[color:var(--surface-elevated)] text-left transition ${
          open
            ? "border-[color:var(--accent-muted)] ring-2 ring-[color:var(--accent-soft)]"
            : "border-[color:var(--border-soft)] hover:border-[color:var(--border-base)]"
        } ${compact ? "px-2 py-1.5" : "px-2.5 py-2"}`}
        style={{ boxShadow: open ? undefined : `inset 3px 0 0 ${accent}` }}
      >
        <span
          className={`min-w-0 flex-1 truncate font-medium text-[color:var(--text-base)] ${compact ? "text-[12px]" : "text-[13px]"}`}
          title={selected?.label}
        >
          {selected?.label ?? placeholder}
        </span>
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 tabular-nums text-[color:var(--text-soft)] transition group-hover:text-[color:var(--text-muted)] ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open ? (
        <div className="mt-1.5 overflow-hidden rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]">
          <div className="border-b border-[color:var(--border-soft)] px-2 py-1.5">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="ui-field w-full rounded-[9px] border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-2.5 py-1.5 text-[12px] text-[color:var(--text-base)] placeholder:text-[color:var(--text-soft)]"
            />
          </div>
          <ul className="ui-scroll max-h-[220px] overflow-y-auto p-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const active = option.value === value;
                const itemAccent = option.accentColor ?? defaultAccentColor;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        close();
                      }}
                      className={`flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition ${
                        active ? "bg-[color:var(--accent-soft)]" : "hover:bg-[color:var(--surface-muted)]"
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: itemAccent }}
                        aria-hidden
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-[12px] leading-snug ${
                          active ? "font-semibold text-[color:var(--text-base)]" : "text-[color:var(--text-muted)]"
                        }`}
                        title={option.label}
                      >
                        {option.label}
                      </span>
                      {option.hint ? (
                        <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--text-soft)]">{option.hint}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-2 py-3 text-center text-[12px] text-[color:var(--text-soft)]">Ничего не найдено</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
