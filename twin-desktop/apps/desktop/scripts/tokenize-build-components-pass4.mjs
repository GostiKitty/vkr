import fs from "fs";
import path from "path";

const root = path.resolve("src/features/build/components");

const pairs = [
  ["border-emerald-200 bg-emerald-50/70", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
  ["border-emerald-200 bg-emerald-50", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
  ["border-emerald-300 bg-emerald-50", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
  ["border-emerald-100 bg-emerald-50/70", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
  ["text-emerald-900", "text-[color:var(--success-fg)]"],
  ["text-emerald-800", "text-[color:var(--success-fg)]"],
  ["text-emerald-700", "text-[color:var(--success-fg)]"],
  ["bg-emerald-100 text-emerald-700", "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"],
  ["bg-emerald-50 text-emerald-700", "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"],
  ["bg-emerald-50/80", "bg-[color:var(--success-bg)]"],
  ["bg-emerald-50/70", "bg-[color:var(--success-bg)]"],
  ["ui-control-active bg-emerald-50 text-emerald-700", "ui-control-active"],
  ["border border-emerald-500 bg-emerald-50 text-emerald-700", "border border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"],
  ["hover:border-emerald-600", "hover:border-[color:var(--success-border)]"],
  ["border-emerald-300 px-3 py-1 font-semibold text-emerald-700", "border-[color:var(--success-border)] px-3 py-1 font-semibold text-[color:var(--success-fg)]"],
  ["hover:border-emerald-500", "hover:border-[color:var(--success-border)]"],

  ["border-rose-200 bg-rose-50/70", "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"],
  ["border-rose-200 bg-rose-50", "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"],
  ["text-rose-900", "text-[color:var(--danger-fg)]"],
  ["text-rose-700", "text-[color:var(--danger-fg)]"],
  ["text-rose-600", "text-[color:var(--danger-fg)]"],
  ["text-rose-500", "text-[color:var(--danger-fg)]"],
  ["bg-rose-100 px-2 py-0.5 text-rose-700", "bg-[color:var(--danger-bg)] px-2 py-0.5 text-[color:var(--danger-fg)]"],
  ["rounded-full bg-rose-100 px-2", "rounded-full bg-[color:var(--danger-bg)] px-2"],
  ["hover:bg-rose-100", "hover:bg-[color:var(--danger-bg)]"],
  ["hover:text-rose-600", "hover:opacity-90"],

  ["border-sky-200 bg-sky-50/70", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["border-sky-200 bg-sky-50", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["border-sky-100/80 bg-sky-50/70", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["border-sky-100/70 bg-sky-50/72", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["text-sky-900", "text-[color:var(--info-fg)]"],
  ["text-sky-800", "text-[color:var(--info-fg)]"],
  ["text-sky-700", "text-[color:var(--info-fg)]"],
  ["border-sky-200 bg-sky-50 px-4", "border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-4"],
  ["rounded-2xl bg-sky-50 px-4", "rounded-2xl bg-[color:var(--info-bg)] px-4"],
  ["border-sky-200 bg-sky-50/92 text-sky-800", "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-fg)]"],
  ["border-sky-200 bg-sky-50/95", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["border-sky-300 bg-sky-50/90 text-sky-700", "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-fg)]"],

  ["bg-emerald-50 text-emerald-800", "bg-[color:var(--success-bg)] text-[color:var(--success-fg)]"],
  ["bg-amber-50 text-amber-800", "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"],
  ["rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700", "rounded-full bg-[color:var(--success-bg)] px-2 py-1 text-xs font-semibold text-[color:var(--success-fg)]"],
  ["rounded-full bg-rose-100 px-2", "rounded-full bg-[color:var(--danger-bg)] px-2"],

  ["border-emerald-100 bg-emerald-50/70", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
  ["text-emerald-400", "text-[color:var(--success-fg)]"],
  ["text-sky-400", "text-[color:var(--info-fg)]"],

  ["border-rose-200 bg-rose-50/80", "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"],
  ["border-emerald-200 bg-emerald-50/80", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
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
