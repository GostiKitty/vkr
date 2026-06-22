import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");

const W = 2260, H = 1180;
const INK = "#161616", GRAY = "#5f5f5f", FILLS = "#f0f0f0";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const NODES = {};
let body = "";

function node(id, x, y, w, h, title, lines = [], opt = {}) {
  NODES[id] = { x, y, w, h };
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${opt.fill ?? "#ffffff"}" stroke="${INK}" stroke-width="${opt.emphasis ? 2 : 1.4}"/>`;
  s += `<text x="${x + 11}" y="${y + 22}" style="font-size:${opt.titleSize ?? 14.5}px;font-weight:700">${esc(title)}</text>`;
  s += `<line x1="${x + 9}" y1="${y + 31}" x2="${x + w - 9}" y2="${y + 31}" stroke="${INK}" stroke-width="0.7" opacity="0.3"/>`;
  let ty = y + 49;
  for (const ln of lines) { s += `<text x="${x + 11}" y="${ty}" class="${opt.small ? "sln" : "ln"}">${esc(ln)}</text>`; ty += opt.small ? 17 : 19; }
  body += s;
}
// compact process step (registered so edges can target it)
function step(id, x, y, w, h, text) {
  NODES[id] = { x, y, w, h };
  body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${FILLS}" stroke="${INK}" stroke-width="1.2"/>` +
    `<text x="${x + 9}" y="${y + h / 2 + 4}" style="font-size:11.5px">${esc(text)}</text>`;
}
function A(id, side, off = 0) {
  const n = NODES[id];
  if (side === "l") return [n.x, n.y + n.h / 2 + off];
  if (side === "r") return [n.x + n.w, n.y + n.h / 2 + off];
  if (side === "t") return [n.x + n.w / 2 + off, n.y];
  return [n.x + n.w / 2 + off, n.y + n.h];
}
function edge(from, to, opt = {}) {
  const a = A(from, opt.fs ?? "r", opt.fo ?? 0);
  const b = A(to, opt.ts ?? "l", opt.to ?? 0);
  let pts;
  if (opt.mode === "cross") pts = [a, [opt.cA, a[1]], [opt.cA, opt.cY], [opt.cB, opt.cY], [opt.cB, b[1]], b];
  else if (opt.mode === "bus") pts = [a, [opt.lx, a[1]], [opt.lx, opt.by], [opt.rx, opt.by], [opt.rx, b[1]], b];
  else if (opt.via) pts = [a, ...opt.via, b];
  else { const cx = opt.cx ?? (a[0] + b[0]) / 2; pts = [a, [cx, a[1]], [cx, b[1]], b]; }
  body += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" class="flow${opt.dashed ? " dash" : ""}" marker-end="url(#ah)"/>`;
}
// step-to-step down arrow
function down(a, b) { const A1 = A(a, "b"), B1 = A(b, "t"); body += `<line x1="${A1[0]}" y1="${A1[1]}" x2="${B1[0]}" y2="${B1[1]}" class="flow" marker-end="url(#ah)"/>`; }
// feedback loop on the right side, from->to upward, with label
function loop(from, to, x, label) {
  const a = A(from, "r"), b = A(to, "r");
  body += `<polyline points="${a[0]},${a[1]} ${x},${a[1]} ${x},${b[1]} ${b[0]},${b[1]}" class="flow loop" marker-end="url(#ah)"/>`;
  body += `<text x="${x + 4}" y="${(a[1] + b[1]) / 2 + 4}" class="lbl">${esc(label)}</text>`;
}

// ---------- columns ----------
const C0 = 40, C1 = 360, C2 = 700, C3 = 980, C4 = 1560, C5 = 1880;
const wC0 = 280, wC1 = 296, wC2 = 232, wC3 = 470, wC4 = 270, wC5 = 340;
const g01 = 335, g12 = 672, g23 = 950, g34 = 1530, g45 = 1855;

// C0 inputs
node("bmodel", C0, 168, wC0, 116, "BuildingModel", ["геометрия · проёмы · уровни", "оборудование · инж. сети", "пресеты / материалы"], { titleSize: 15.5 });
node("scenario", C0, 308, wC0, 104, "Сценарии", ["уставки, смещение setpoint", "множители нагрузки / расхода", "тариф, источник тепла"]);
node("climate", C0, 436, wC0, 104, "Климат", ["t_н, t_от, ГСОП, z_от", "солнечная радиация I", "СП 131 / СП 50"]);
node("norms", C0, 564, wC0, 116, "Нормы (таблицы)", ["СП 50: R_норм, q_быт, β, ξ", "СП 230: ψ, χ мостов холода", "табл. Г / Д"]);

// C1 preprocessing
node("adj", C1, 168, wC1, 92, "Граф смежности", ["внутр. / наружные рёбра", "площади контактов L·H"]);
node("bim", C1, 282, wC1, 104, "Геометрия (BIM)", ["A=½|Σ(xy−xy)|, V=A·h", "центроиды, площади проёмов"]);
node("env", C1, 408, wC1, 120, "Ограждение · U, R", ["R₀=R_si+Σ(d/λ)+R_se; U=1/R₀", "ψ,χ → bridgeFactor", "R_пр приведённое"]);
node("moisture", C1, 550, wC1, 96, "Влажность / конденсация", ["точка росы (Магнус)", "R_пара = Σ d/μ", "проверка конденсации"]);
node("solar", C1, 668, wC1, 88, "Солнце", ["положение: высота, азимут", "доступ фасада → q_сол"]);
node("net", C1, 778, wC1, 110, "Контекст сетей", ["мощность приборов", "люди/техника/трубы", "приток мех. вентиляции"]);
node("inf", C1, 910, wC1, 92, "Инфильтрация", ["Δp = ветер + гравитация", "→ ACH → проводимость"]);

// C2 assembly
node("tm", C2, 286, wC2, 232, "Тепловая модель", ["зоны: C=ρ·V·c_p·k_m", "G_инф, G_вент·(1−k_ef)", "связи Вт/К: U·A", "×bridgeFactor", "кровля, пол ×0.4,", "перекрытия; UA=ΣU·A"], { small: true });

// C3 solver step-chains
const SW = wC3, SH = 30;
body += `<text x="${C3}" y="160" class="lane">А · RC-СОЛВЕР  (динамика / стационар)</text>`;
const rcY = 172;
step("rc1", C3, rcY + 0 * 38, SW, SH, "1 · старт T — пассивный баланс зоны");
step("rc2", C3, rcY + 1 * 38, SW, SH, "2 · итерация: T = Σ(Q + UA·T_сосед) / ΣUA");
step("rc3", C3, rcY + 2 * 38, SW, SH, "3 · отопление Q=(T_уст−T)·ΣUA ≤ P_прибора");
step("rc4", C3, rcY + 3 * 38, SW, SH, "4 · баланс зоны: T_возд, потери, Q_отоп");
step("rc5", C3, rcY + 4 * 38, SW, SH, "5 · поле температур (5-точечный шаблон)");
down("rc1", "rc2"); down("rc2", "rc3"); down("rc3", "rc4"); down("rc4", "rc5");
loop("rc4", "rc2", C3 + SW + 22, "×12");

body += `<text x="${C3}" y="${rcY + 5 * 38 + 26}" class="lane">Б · НОРМАТИВНЫЙ КОНТУР СП 50</text>`;
const spY = rcY + 5 * 38 + 38;
const spsteps = [
  "1 · R_пр = 1/(Σφ/R + Σψ·l + Σχ·n)",
  "2 · k_ob = Σ(n_t·A / R_пр) / V_от",
  "3 · n_возд, k_vent  (рекуперация k_ef)",
  "4 · β = 1/(1 + ξ·n)",
  "5 · q_быт = A·q_int/(V·ΔT);  q_сол = 11.6·I/(V·ГСОП)",
  "6 · q_от = k_ob + k_vent − β(q_быт + q_сол)",
  "7 · Q_год = 0.024·ГСОП·V·q_от  →  класс",
];
spsteps.forEach((t, i) => step("sp" + (i + 1), C3, spY + i * 38, SW, SH, t));
for (let i = 1; i < 7; i++) down("sp" + i, "sp" + (i + 1));
loop("sp3", "sp3", C3 + SW + 22, "k_ef");

// C4 analysis
node("trans", C4, 158, wC4, 96, "Transient 1D", ["слои d,λ,ρ,c → сетка", "явная FTCS, Fo ≤ 0.5", "min τ_si, риск конденсации"]);
node("unc", C4, 280, wC4, 150, "Неопределённость", ["Монте-Карло: N прогонов", "μ, σ, ДИ ±z·σ/√N", "Morris μ*, Pearson/Spearman", "VaR / CVaR"]);
node("cal", C4, 456, wC4, 138, "Калибровка", ["подбор параметров по замерам", "RMSE, MAPE, CVRMSE, MBE", "→ обратная связь в модель"]);

// C5 outputs
node("res", C5, 168, wC5, 210, "Результаты / отчёты", ["энергопаспорт, отчёт СП 50", "класс энергоэффективности", "графики потерь, профили T", "структура баланса", "3D-поле T · экспорт PDF/Word"], { small: true });
node("comfort", C5, 404, wC5, 120, "Комфорт", ["оперативная T, MRT", "часы недогрева / перегрева", "вероятность дискомфорта"]);
node("econ", C5, 548, wC5, 150, "Экономика / экология", ["окупаемость (прост./дискон.)", "NPV, индекс рентабельности", "годовая экономия энергии", "углеродный след CO₂"]);

// ---------- edges ----------
// inputs -> preprocessing
edge("bmodel", "adj", { cx: 338 });
edge("bmodel", "bim", { cx: 332 });
edge("bmodel", "env", { cx: 344 });
edge("bmodel", "net", { cx: 326 });
edge("bmodel", "inf", { cx: 322 });
edge("climate", "solar", { cx: 340 });
edge("climate", "inf", { cx: 350 });
edge("climate", "moisture", { cx: 346 });
edge("norms", "env", { cx: 344, to: 36 });
edge("env", "moisture", { fs: "b", ts: "t" });
edge("scenario", "tm", { mode: "cross", cA: 335, cY: 398, cB: 672, to: -16 });

// preprocessing -> thermal model
edge("adj", "tm", { cx: 666, to: -88 });
edge("bim", "tm", { cx: 670, to: -44 });
edge("env", "tm", { cx: 678, to: 6 });
edge("net", "tm", { cx: 682, to: 58 });
edge("inf", "tm", { cx: 686, to: 92 });

// tm + inputs -> solver steps
edge("tm", "rc1", { cx: 958, to: 0 });
edge("net", "rc3", { mode: "cross", cA: 690, cY: 600, cB: 940, to: 0 });
edge("solar", "rc4", { mode: "cross", cA: 694, cY: 612, cB: 944, to: 0 });
edge("env", "sp1", { mode: "cross", cA: 660, cY: 560, cB: 936, to: 0 });
edge("bim", "sp2", { mode: "cross", cA: 664, cY: 566, cB: 932, to: 0 });
edge("inf", "sp3", { mode: "cross", cA: 700, cY: 760, cB: 948, to: 0 });
edge("norms", "sp1", { mode: "bus", fs: "b", lx: 358, by: 1052, rx: 928, to: 0 });
edge("climate", "sp5", { mode: "bus", fs: "b", lx: 352, by: 1040, rx: 924, to: 0 });
edge("climate", "rc1", { mode: "bus", fs: "b", lx: 347, by: 1064, rx: 920, to: 0 });

// solvers -> analysis (both contours)
edge("rc5", "unc", { cx: 1535, fo: 0, to: -20 });
edge("sp7", "unc", { mode: "cross", cA: 1524, cY: 1090, cB: 1548, to: 30 });
edge("rc4", "cal", { cx: 1540, fo: 0, to: -30 });
edge("sp6", "cal", { cx: 1545, to: 24 });
// transient 1d
edge("env", "trans", { mode: "bus", fs: "b", lx: 356, by: 138, rx: 1548, to: -10, dashed: false });
edge("trans", "comfort", { mode: "cross", cA: 1834, cY: 150, cB: 1858, to: -40 });

// solvers / analysis -> outputs
edge("rc5", "res", { mode: "cross", cA: 1518, cY: 400, cB: 1858, fo: -8, to: -60 });
edge("sp7", "res", { mode: "cross", cA: 1522, cY: 410, cB: 1862, to: 30 });
edge("rc5", "comfort", { mode: "cross", cA: 1514, cY: 392, cB: 1852, fo: 8, to: 0 });
edge("sp7", "econ", { mode: "cross", cA: 1526, cY: 700, cB: 1866, to: 0 });
edge("unc", "res", { cx: 1858, to: -30 });
edge("scenario", "econ", { mode: "bus", fs: "b", lx: 343, by: 1076, rx: 1850, to: 40 });

// feedback: calibration -> thermal model (top channel)
edge("cal", "tm", { fs: "l", ts: "t", dashed: true, via: [[1546, A("cal", "l")[1]], [1546, 150], [A("tm", "t")[0], 150]] });

// ---------- frame / title ----------
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Georgia,'Times New Roman',serif">
<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="7.5" refY="5" orient="auto"><path d="M0,0 L9,5 L0,10 z" fill="${INK}"/></marker></defs>
<style>
  text{fill:${INK}}
  .ln{font-size:12.5px;fill:#1d1d1d}.sln{font-size:11.5px;fill:#1d1d1d}
  .flow{stroke:${INK};stroke-width:1.3;fill:none}.dash{stroke-dasharray:7 5}.loop{stroke:#444}
  .h1{font-size:28px;font-weight:700}.h2{font-size:14px;fill:${GRAY}}
  .col{font-size:13px;font-weight:700;fill:${GRAY};letter-spacing:1px}
  .lane{font-size:13px;font-weight:700;fill:${INK}}
  .lbl{font-size:11px;font-style:italic;fill:#444}
</style>
<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
<rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="${INK}" stroke-width="1.4"/>
<text x="${C0}" y="58" class="h1">Карта расчётных модулей и поток данных — TherNest</text>
<text x="${C0 + 2}" y="84" class="h2">цифровой двойник теплозащиты здания · СП 50/131/230 · 194 формулы · сплошная — поток данных, пунктир — обратная связь, петля — цикл</text>
<line x1="${C0}" y1="100" x2="${W - 36}" y2="100" stroke="${INK}" stroke-width="1"/>
`;
[[C0, "ВХОДНЫЕ ДАННЫЕ"], [C1, "ПРЕПРОЦЕССИНГ"], [C2, "СБОРКА"], [C3, "РАСЧЁТНЫЕ КОНТУРЫ (по шагам)"], [C4, "АНАЛИЗ"], [C5, "РЕЗУЛЬТАТЫ И ОЦЕНКА"]]
  .forEach(([x, t]) => { svg += `<text x="${x}" y="136" class="col">${esc(t)}</text>`; });
svg += body + `</svg>`;
writeFileSync(join(OUT, "TherNest-karta-modulej.svg"), svg, "utf8");
console.log("OK svg:", svg.length, "nodes:", Object.keys(NODES).length);
