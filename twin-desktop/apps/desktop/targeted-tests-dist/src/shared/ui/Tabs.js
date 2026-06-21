import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function Tabs({ tabs, value, onChange }) {
    return (_jsx("div", { className: "ui-tabs-track flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", children: tabs.map((tab) => {
            const active = tab.id === value;
            return (_jsx("button", { type: "button", disabled: tab.disabled, title: tab.hint, className: `ui-tabs-tab shrink-0 whitespace-nowrap px-3 py-2 text-sm active:scale-[0.98] ${active ? "ui-tabs-tab-active" : tab.disabled ? "cursor-not-allowed text-[color:var(--text-disabled)] opacity-80" : "ui-tabs-tab-idle"}`, onClick: () => !tab.disabled && onChange(tab.id), children: _jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [tab.label, tab.badge] }) }, tab.id));
        }) }));
}
export default Tabs;
