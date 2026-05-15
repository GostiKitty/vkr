import fs from "fs";
import path from "path";

const root = path.resolve("src/features/build/components");

const pairs = [
  ["hover:bg-emerald-100", "hover:brightness-95"],
  ["bg-emerald-50/60", "bg-[color:var(--success-bg)]"],
  ["bg-emerald-50 text-", "bg-[color:var(--success-bg)] text-"],
  ["bg-emerald-100", "bg-[color:var(--success-bg)]"],
  ["border-emerald-200", "border-[color:var(--success-border)]"],
  ["border-emerald-300", "border-[color:var(--success-border)]"],
  ["hover:border-emerald-400", "hover:border-[color:var(--success-border)]"],
  ["border border-emerald-500", "border border-[color:var(--success-border)]"],
  ["text-emerald-600", "text-[color:var(--success-fg)]"],
  ["text-emerald-950", "text-[color:var(--success-fg)]"],
  ["bg-emerald-500 text-white", "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"],
  ["bg-sky-100", "bg-[color:var(--info-bg)]"],
  ["bg-white/82", "bg-[color:var(--surface-overlay)]"],
  ["bg-amber-100 text-amber-700", "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"],
  ["bg-rose-100 text-", "bg-[color:var(--danger-bg)] text-"],
  ["bg-rose-100 ", "bg-[color:var(--danger-bg)] "],
  ["border-sky-300 bg-sky-50/90", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["ui-control-active bg-emerald-50", "ui-control-active"],
  ["shadow-[0_10px_20px_-18px_rgba(2,132,199,0.9)]", "shadow-[var(--shadow-panel)]"],
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
