import { useEffect, useId, useRef, useState } from "react";

export interface SelectDropdownOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
}

interface SelectDropdownProps<T extends string> {
  label?: string;
  value: T;
  options: SelectDropdownOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

function SelectChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`ui-select__chevron${open ? " ui-select__chevron--open" : ""}`}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SelectCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="ui-select__check">
      <path
        d="M5 12.5l4.25 4.25L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SelectDropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SelectDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const rootClassName = className ? `ui-select ${className}` : "ui-select";

  const triggerLabelledBy = label ? labelId : undefined;

  return (
    <div ref={rootRef} className={rootClassName}>
      {label ? (
        <span id={labelId} className="ui-select__label">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        className={`ui-select__trigger${open ? " ui-select__trigger--open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={triggerLabelledBy}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="ui-select__value">{selected?.label ?? ""}</span>
        <SelectChevron open={open} />
      </button>
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerLabelledBy}
          className="ui-select__menu ui-scroll"
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <li key={option.value || "empty"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`ui-select__option${isActive ? " ui-select__option--active" : ""}${option.description ? " ui-select__option--rich" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="ui-select__option-content">
                    <span className="ui-select__option-label">{option.label}</span>
                    {option.description ? (
                      <span className="ui-select__option-desc">{option.description}</span>
                    ) : null}
                  </span>
                  {isActive ? <SelectCheckIcon /> : <span className="ui-select__check ui-select__check--placeholder" />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
