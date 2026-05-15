import fs from "fs";
import path from "path";

const root = path.resolve("src/features/build/components");

const pairs = [
  ["overflow-hidden bg-white", "overflow-hidden bg-[color:var(--surface-elevated)]"],
  ["border-slate-900 bg-[color:var(--accent-base)]", "border-[color:var(--accent-base)] bg-[color:var(--accent-base)]"],
  ["border-slate-800/75 bg-[color:var(--accent-base)]", "border-[color:var(--accent-muted)] bg-[color:var(--accent-base)]"],
  ["text-white/80", "text-[color:var(--accent-contrast)]/80"],
  ["text-white/70", "text-[color:var(--accent-contrast)]/70"],
  ["border-white/25 bg-white/10 text-white", "border-[color:var(--accent-contrast)]/20 bg-[color:var(--accent-contrast)]/10 text-[color:var(--accent-contrast)]"],
  ["bg-white/78", "bg-[color:var(--surface-overlay)]"],
  ["bg-white/60", "bg-[color:var(--surface-overlay)]"],
  ["bg-white ", "bg-[color:var(--surface-elevated)] "],
  [" bg-white\"", " bg-[color:var(--surface-elevated)]\""],
  ["hover:bg-slate-50", "hover:bg-[color:var(--surface-muted)]"],
  ["bg-slate-50 ", "bg-[color:var(--surface-muted)] "],
  ["bg-slate-50\"", "bg-[color:var(--surface-muted)]\""],
  ["rounded-xl bg-slate-50", "rounded-xl bg-[color:var(--surface-muted)]"],
  ["rounded-2xl bg-slate-50", "rounded-2xl bg-[color:var(--surface-muted)]"],
  ["checked ? \"bg-slate-900\"", "checked ? \"bg-[color:var(--accent-base)]\""],
  ["font-semibold text-white transition", "font-semibold text-[color:var(--accent-contrast)] transition"],
  ["font-semibold text-white\"", "font-semibold text-[color:var(--accent-contrast)]\""],
  ["text-white>", "text-[color:var(--accent-contrast)]>"],
  ["text-white ", "text-[color:var(--accent-contrast)] "],
  ["? \"border-rose-700 bg-rose-700 text-white\"", "? \"border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)]\""],
  ["? \"border-emerald-700 bg-emerald-700 text-white\"", "? \"border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)]\""],
  ["? \"border-sky-700 bg-sky-700 text-white\"", "? \"border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-fg)]\""],
  ["rounded-2xl bg-sky-700 px-4", "rounded-2xl bg-[color:var(--info-bg)] border border-[color:var(--info-border)] px-4"],
  ["hover:bg-sky-600", "hover:brightness-110"],
  ["border-sky-700 bg-sky-700", "border-[color:var(--info-border)] bg-[color:var(--info-bg)]"],
  ["border-rose-700 bg-rose-700", "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)]"],
  ["border-emerald-700 bg-emerald-700", "border-[color:var(--success-border)] bg-[color:var(--success-bg)]"],
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
