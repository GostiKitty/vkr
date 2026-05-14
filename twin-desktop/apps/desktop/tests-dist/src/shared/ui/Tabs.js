import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
export function Tabs({ tabs, value, onChange }) {
    return (_jsx("div", { className: "flex min-w-0 gap-1 overflow-x-auto rounded-[16px] border border-slate-200/70 bg-slate-50/85 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", children: tabs.map((tab) => {
            const active = tab.id === value;
            return (_jsx("button", { type: "button", disabled: tab.disabled, className: `shrink-0 whitespace-nowrap rounded-[12px] px-3 py-2 text-sm font-semibold transition-all duration-200 ease-out active:scale-95 ${active
                    ? "border border-slate-900/10 bg-white text-slate-950 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.6)]"
                    : tab.disabled
                        ? "text-slate-400"
                        : "text-slate-600 hover:bg-white hover:text-slate-900"}`, onClick: () => !tab.disabled && onChange(tab.id), children: _jsxs("span", { className: "inline-flex items-center justify-center gap-2", children: [tab.label, tab.badge] }) }, tab.id));
        }) }));
}
export default Tabs;
