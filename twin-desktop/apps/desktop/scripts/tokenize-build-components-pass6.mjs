import fs from "fs";
import path from "path";

const root = path.resolve("src/features/build/components");

const pairs = [
  ["border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]"],
  ["border-amber-200 bg-amber-50 px-3 py-2 text-amber-900", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-[color:var(--warning-fg)]"],
  ["border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]"],
  ["border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]"],
  ["border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 whitespace-normal", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)] whitespace-normal"],
  ["border-amber-200 bg-amber-50/70", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]"],
  ["border-amber-200 bg-amber-50 text-amber-700", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"],
  ["border-amber-200/80 bg-amber-50/75 text-amber-900", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"],
  ["border-amber-300 bg-amber-50/90 text-amber-700", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"],
  ["border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900", "border-dashed border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]"],
  ["border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900", "border-dashed border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--warning-fg)]"],
  ["text-amber-900", "text-[color:var(--warning-fg)]"],
  ["text-amber-800", "text-[color:var(--warning-fg)]"],
  ["text-amber-700", "text-[color:var(--warning-fg)]"],
  ["text-amber-600", "text-[color:var(--warning-fg)]"],
  ["bg-amber-100 px-2 py-0.5 text-amber-700", "bg-[color:var(--warning-bg)] px-2 py-0.5 text-[color:var(--warning-fg)]"],
  ["rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700", "rounded-full bg-[color:var(--warning-bg)] px-2 py-1 text-xs font-semibold text-[color:var(--warning-fg)]"],
  ["rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700", "rounded-full bg-[color:var(--warning-bg)] px-2 py-1 text-xs font-semibold text-[color:var(--warning-fg)]"],
  ["rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800", "rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--warning-fg)]"],
  ["border-amber-200 bg-amber-50/92 text-amber-900", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"],
  ["border-amber-200 bg-amber-50/95 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--warning-fg)] shadow-sm"],
  ["border-amber-100/70 bg-amber-50/72", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]"],
  ["border-amber-200 bg-amber-50 px-3 py-3 text-amber-900", "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-3 text-[color:var(--warning-fg)]"],
  ["mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800", "mb-3 rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]"],
  ["mt-2 text-xs text-amber-700", "mt-2 text-xs text-[color:var(--warning-fg)]"],
  ["shadow-[0_10px_20px_-18px_rgba(217,119,6,0.9)]", "shadow-[var(--shadow-panel)]"],
  ["accent-amber-500", "accent-[color:var(--warning-fg)]"],
  ["text-amber-400", "text-[color:var(--warning-fg)]"],
];

function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith(".tsx")) {
      let s = fs.readFileSync(p, "utf8");
      const orig = s;
      for (const [a, b] of pairs) s = s.split(a).join(b);
      if (s !== orig) {
        fs.writeFileSync(p, s);
        console.log("updated", p);
      }
    }
  }
}

walk(root);
