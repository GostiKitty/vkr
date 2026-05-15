import React from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  disabled?: boolean;
  badge?: React.ReactNode;
  /** Краткая подсказка при наведении. */
  hint?: string;
}

interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
}

export function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div className="ui-tabs-track flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            title={tab.hint}
            className={`ui-tabs-tab shrink-0 whitespace-nowrap px-3 py-2 text-sm active:scale-[0.98] ${
              active ? "ui-tabs-tab-active" : tab.disabled ? "cursor-not-allowed text-[color:var(--text-disabled)] opacity-80" : "ui-tabs-tab-idle"
            }`}
            onClick={() => !tab.disabled && onChange(tab.id)}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {tab.label}
              {tab.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
