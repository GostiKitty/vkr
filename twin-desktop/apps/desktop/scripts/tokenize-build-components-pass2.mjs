import fs from "fs";
import path from "path";

const dir = path.join("src", "features", "build", "components");

const pairs = [
  ["bg-slate-900 text-white", "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"],
  [
    "border-slate-900 bg-slate-900 text-white",
    "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]",
  ],
  [
    "border-slate-800/75 bg-slate-900 text-white",
    "border-[color:var(--accent-muted)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]",
  ],
  ["hover:bg-slate-800", "hover:brightness-110"],
  ["bg-slate-50/90", "bg-[color:var(--surface-muted)]"],
  ["bg-slate-50/80", "bg-[color:var(--surface-muted)]"],
  ["bg-slate-50/72", "bg-[color:var(--surface-muted)]"],
  ["bg-slate-50/70", "bg-[color:var(--surface-muted)]"],
  ["bg-slate-50/60", "bg-[color:var(--surface-muted)]"],
  ["bg-slate-50 px-2.5", "bg-[color:var(--surface-muted)] px-2.5"],
  ["bg-slate-50 px-3", "bg-[color:var(--surface-muted)] px-3"],
  ["bg-slate-50 text-", "bg-[color:var(--surface-muted)] text-"],
  ["bg-slate-200", "bg-[color:var(--surface-strong)]"],
  ["bg-slate-300", "bg-[color:var(--surface-strong)]"],
  ["bg-slate-200/80", "bg-[color:var(--surface-strong)]"],
  ["focus:ring-slate-400", "focus:ring-[color:var(--accent-muted)]"],
  ["bg-white px-3", "bg-[color:var(--surface-elevated)] px-3"],
  ["bg-white p-3", "bg-[color:var(--surface-elevated)] p-3"],
  ["bg-white p-4", "bg-[color:var(--surface-elevated)] p-4"],
  ["bg-white shadow-sm", "bg-[color:var(--surface-elevated)] shadow-sm"],
  ["rounded-full bg-white ", "rounded-full bg-[color:var(--surface-elevated)] "],
  [
    "h-7 w-px shrink-0 rounded-full bg-slate-200/80",
    "h-7 w-px shrink-0 rounded-full bg-[color:var(--border-soft)]",
  ],
  ["rounded-full bg-slate-200", "rounded-full bg-[color:var(--surface-strong)]"],
  ["rounded-full bg-slate-900", "rounded-full bg-[color:var(--accent-base)]"],
  ["bg-slate-900 px-", "bg-[color:var(--accent-base)] px-"],
  ["text-white shadow-sm", "text-[color:var(--accent-contrast)] shadow-sm"],
  ["text-white shadow", "text-[color:var(--accent-contrast)] shadow"],
  [
    "text-white placeholder-white/70",
    "text-[color:var(--accent-contrast)] placeholder-[color:var(--accent-contrast)]/60",
  ],
  ["ui-control-active bg-slate-900 text-white", "ui-control-active"],
  ["bg-slate-900 text-white hover:bg-slate-800", "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] hover:brightness-110"],
];

function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) {
      walk(p);
    } else if (ent.name.endsWith(".tsx")) {
      let s = fs.readFileSync(p, "utf8");
      const orig = s;
      for (const [a, b] of pairs) {
        s = s.split(a).join(b);
      }
      if (s !== orig) {
        fs.writeFileSync(p, s);
        console.log("updated", p);
      }
    }
  }
}

walk(path.resolve(dir));
