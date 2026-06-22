import { formulaRegistry, formulaModules, formulaContours, assumptions } from "./registry.mjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..");

const contourLabel = Object.fromEntries(formulaContours.map((c) => [c.id, c.label]));
const moduleLabelRu = {
  Geometry: "Геометрия",
  Envelope: "Ограждающие конструкции",
  Thermal: "Теплофизика и расчётные контуры",
  Uncertainty: "Неопределённость и чувствительность",
  Calibration: "Калибровка цифрового двойника",
};
const statusLabel = {
  "main-runtime": "ядро расчёта",
  "derived-only": "производная / диагностика",
  "normative-check": "норматив СП 50",
  "report-only": "только отчёт",
  heuristic: "эвристика",
  legacy: "legacy",
};

// ---- Курируемые куски кода ядра (реальные функции из исходников) ----
const CODE = {
  layer: {
    title: "Сопротивление слоя и U-значение конструкции",
    file: "src/core/thermal/formulas.ts",
    code: `export function layerResistance(thicknessM, lambdaWmK) {
  return thicknessM / lambdaWmK;                 // R = d / λ
}
export function assemblyResistance(layers, Rsi = 0, Rse = 0) {
  return Rsi + layers.reduce((s, l) => s + layerResistance(l.thicknessM, l.lambdaWmK), 0) + Rse;
}
export function uValue(resistance) {
  return 1 / resistance;                          // U = 1 / R_o
}`,
  },
  losses: {
    title: "Теплопотери: трансмиссия, вентиляция, инфильтрация",
    file: "src/core/thermal/formulas.ts",
    code: `export function transmissionLoss(U, areaM2, deltaT) {
  return U * areaM2 * deltaT;                      // Q = U·A·ΔT
}
export function airflowFromACH(ach, volumeM3) {
  return (ach * volumeM3) / 3600;                  // L = n·V / 3600, м³/с
}
export function ventilationLoss(flowM3s, rho, cp, deltaT) {
  return rho * cp * flowM3s * Math.max(0, deltaT); // Q = ρ·c_p·L·ΔT
}
export function infiltrationLoss(ach, volumeM3, rho, cp, deltaT) {
  return ventilationLoss(airflowFromACH(ach, volumeM3), rho, cp, deltaT);
}`,
  },
  gsop: {
    title: "ГСОП — градусо-сутки отопительного периода",
    file: "src/core/thermal/formulas.ts",
    code: `export function gsop(tIndoor, tHeatingPeriod, heatingPeriodDays) {
  return Math.max(0, tIndoor - tHeatingPeriod) * heatingPeriodDays;  // ГСОП = (t_в − t_от)·z_от
}`,
  },
  rc: {
    title: "RC-баланс помещения (стационарная итерация солвера)",
    file: "src/core/thermal/physics.ts",
    code: `// Числитель пассивного баланса: внутренние + солнечные поступления и приток через
// ограждение/воздухообмен/смежные помещения; знаменатель — суммарная проводимость UA.
const denominator = room.externalUA_W_K + room.ventilationUA_W_K + room.internalCouplingUA_W_K;
const passiveNumerator =
  room.lightingGainW + room.occupancyGainW + room.equipmentGainW + room.pipeGainW + room.solarGainW +
  room.externalUA_W_K   * options.outdoorTemperatureC +
  room.infiltrationUA_W_K * options.outdoorTemperatureC +
  (room.ventilationUA_W_K - room.infiltrationUA_W_K) * room.supplyAirTemperatureC +
  adjacencyNumerator;
const passiveTemperatureC = passiveNumerator / denominator;            // T при выключенном отоплении
const requiredHeatingW = Math.max(0, (room.setpointC - passiveTemperatureC) * denominator);
const heatingDeliveredW = Math.min(room.heatingCapacityW, requiredHeatingW); // ограничение мощностью прибора`,
  },
  kob: {
    title: "Удельная теплозащитная характеристика k_ob и годовая энергия (СП 50)",
    file: "src/core/thermal/sp50/calculations.ts",
    code: `export function calculateKob({ fragments, heatedVolumeM3 }) {
  // k_ob = (Σ n_t·A_i / R_pr,i) / V_от
  return fragments.reduce((s, f) => s + (f.nt * f.areaM2) / f.reducedResistance_m2K_W, 0) / heatedVolumeM3;
}
export function calculateHeatingEnergyCharacteristic(i) {
  // q_от = k_ob + k_vent − β·(q_быт + q_сол)
  return i.kob_W_m3K + i.ventilationCharacteristic_W_m3K
    - i.betaGainUseFactor * (i.internalGainCharacteristic_W_m3K + i.solarGainCharacteristic_W_m3K);
}
export function calculateAnnualHeatingEnergy(gsop, V, q) {
  return 0.024 * gsop * V * q;                     // Q_год = 0.024·ГСОП·V·q_от, кВт·ч
}`,
  },
  solar: {
    title: "Солнечный приток через остекление (preview-физика)",
    file: "src/core/thermal/physics.ts",
    code: `// Прямая составляющая масштабируется sin(высоты солнца); рассеянная — постоянная (зима, СП 131)
const directIrradiance  = 320 * Math.max(0, Math.sin(altitudeRad)); // Вт/м² на вертикаль
const diffuseIrradiance = 55 * 0.5;                                  // небо, коэф. видимости ≈ 0.5
const totalIrradiance   = directIrradiance * accessFactor + diffuseIrradiance;
return windowAreaM2 * totalIrradiance * solarGainFactor;             // SHGC заложен в factor (≈0.4–0.5)`,
  },
};
const CODE_ORDER = ["layer", "losses", "gsop", "rc", "kob", "solar"];

// ----------------- helpers -----------------
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function mdCell(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const byModule = new Map(formulaModules.map((m) => [m, []]));
formulaRegistry.forEach((f) => {
  if (!byModule.has(f.module)) byModule.set(f.module, []);
  byModule.get(f.module).push(f);
});

// ============================================================ MARKDOWN
function buildMarkdown() {
  const L = [];
  L.push("# TherNest — Полный справочник расчётных формул");
  L.push("");
  L.push(`Автоматически сгенерировано из реестра формул \`src/entities/formulas/registry.ts\`. Всего формул: **${formulaRegistry.length}**. Формулы записаны в LaTeX (\`$$…$$\`); открывайте в редакторе с поддержкой математики (VS Code + Markdown Preview Enhanced, Typora, Obsidian) или конвертируйте в PDF/Word через \`pandoc\`.`);
  L.push("");
  // легенда модулей
  L.push("## Модули");
  L.push("");
  L.push("| Модуль | Назначение | Формул |");
  L.push("|---|---|---|");
  formulaModules.forEach((m) => {
    L.push(`| **${m}** | ${moduleLabelRu[m] ?? ""} | ${byModule.get(m)?.length ?? 0} |`);
  });
  L.push("");
  // легенда контуров
  L.push("## Контуры расчёта");
  L.push("");
  L.push("| Контур | Описание |");
  L.push("|---|---|");
  formulaContours.forEach((c) => L.push(`| \`${c.id}\` | ${c.label} |`));
  L.push("");
  // содержание
  L.push("## Содержание");
  L.push("");
  formulaModules.forEach((m) => {
    L.push(`- **${m} — ${moduleLabelRu[m] ?? ""}**`);
    (byModule.get(m) ?? []).forEach((f, i) => {
      L.push(`  - ${m[0]}${i + 1}. ${f.titleRu ?? f.title}`);
    });
  });
  L.push("- **Приложение: код ядра**");
  L.push("");
  L.push("---");
  L.push("");

  formulaModules.forEach((m) => {
    const list = byModule.get(m) ?? [];
    L.push(`## ${m} — ${moduleLabelRu[m] ?? ""}`);
    L.push("");
    list.forEach((f, i) => {
      const tag = `${m[0]}${i + 1}`;
      L.push(`### ${tag}. ${f.titleRu ?? f.title}`);
      L.push("");
      const badges = [];
      if (f.status) badges.push(statusLabel[f.status] ?? f.status);
      if (f.contour) badges.push(contourLabel[f.contour] ?? f.contour);
      if (f.affectsSolver) badges.push("влияет на солвер");
      if (badges.length) L.push(`*${badges.join(" · ")}*  \`${f.id}\``);
      else L.push(`\`${f.id}\``);
      L.push("");
      L.push("$$");
      L.push(f.formulaLatex ?? f.latex);
      L.push("$$");
      L.push("");
      if (f.description) L.push(f.description);
      if (f.physicalMeaning) L.push("");
      if (f.physicalMeaning) L.push(`**Физический смысл.** ${f.physicalMeaning}`);
      if (f.resultMeaning) L.push("");
      if (f.resultMeaning) L.push(`**Результат.** ${f.resultMeaning}`);
      L.push("");
      if (f.variables?.length) {
        L.push("| Обозн. | Величина | Ед. | Источник |");
        L.push("|---|---|---|---|");
        f.variables.forEach((v) => {
          const sym = v.symbolLatex ? `$${v.symbolLatex}$` : v.key;
          L.push(`| ${mdCell(sym)} | ${mdCell(v.label)} | ${mdCell(v.unit ?? "—")} | ${mdCell(v.source ?? "—")} |`);
        });
        L.push("");
      }
      const meta = [];
      if (f.methodName) meta.push(`**Метод:** ${f.methodName}`);
      if (f.applicability) meta.push(`**Применимость:** ${f.applicability}`);
      if (f.normReference) meta.push(`**Норматив/источник:** ${f.normReference}`);
      if (f.assumptions?.length) meta.push(`**Допущения:** ${f.assumptions.join("; ")}`);
      if (f.warnings?.length) meta.push(`**⚠ Ограничения:** ${f.warnings.join("; ")}`);
      if (f.sourceFiles?.length) meta.push(`**Код:** ${f.sourceFiles.map((s) => `\`${s}\``).join(", ")}`);
      if (f.relatedFormulaIds?.length) meta.push(`**См. также:** ${f.relatedFormulaIds.map((s) => `\`${s}\``).join(", ")}`);
      meta.forEach((line) => {
        L.push(line);
        L.push("");
      });
      L.push("");
    });
  });

  // приложение код
  L.push("## Приложение: код ядра");
  L.push("");
  L.push("Ключевые функции в исходном виде — для слайда «как это считается в коде».");
  L.push("");
  CODE_ORDER.forEach((k) => {
    const c = CODE[k];
    L.push(`### ${c.title}`);
    L.push("");
    L.push(`\`${c.file}\``);
    L.push("");
    L.push("```ts");
    L.push(c.code);
    L.push("```");
    L.push("");
  });

  // допущения-константы
  if (assumptions?.length) {
    L.push("## Принятые константы и допущения");
    L.push("");
    L.push("| Параметр | Значение | Ед. | Источник | Описание |");
    L.push("|---|---|---|---|---|");
    assumptions.forEach((a) => {
      L.push(`| ${mdCell(a.label)} | ${mdCell(a.value)} | ${mdCell(a.unit ?? "—")} | ${mdCell(a.source ?? "—")} | ${mdCell(a.description ?? "")} |`);
    });
    L.push("");
  }
  return L.join("\n");
}

// ============================================================ HTML
function buildHtml() {
  const card = (f, tag) => {
    const badges = [];
    if (f.status) badges.push(`<span class="badge b-${f.status}">${esc(statusLabel[f.status] ?? f.status)}</span>`);
    if (f.contour) badges.push(`<span class="badge b-contour">${esc(contourLabel[f.contour] ?? f.contour)}</span>`);
    if (f.affectsSolver) badges.push(`<span class="badge b-solver">влияет на солвер</span>`);
    const vars = f.variables?.length
      ? `<table class="vars"><thead><tr><th>Обозн.</th><th>Величина</th><th>Ед.</th><th>Источник</th></tr></thead><tbody>${f.variables
          .map(
            (v) =>
              `<tr><td class="sym">${v.symbolLatex ? `\\(${esc(v.symbolLatex)}\\)` : esc(v.key)}</td><td>${esc(v.label)}</td><td>${esc(v.unit ?? "—")}</td><td>${esc(v.source ?? "—")}</td></tr>`
          )
          .join("")}</tbody></table>`
      : "";
    const meta = [];
    if (f.methodName) meta.push(`<div><b>Метод:</b> ${esc(f.methodName)}</div>`);
    if (f.applicability) meta.push(`<div><b>Применимость:</b> ${esc(f.applicability)}</div>`);
    if (f.normReference) meta.push(`<div class="norm"><b>Норматив:</b> ${esc(f.normReference)}</div>`);
    if (f.assumptions?.length) meta.push(`<div><b>Допущения:</b> ${esc(f.assumptions.join("; "))}</div>`);
    if (f.warnings?.length) meta.push(`<div class="warn"><b>⚠ Ограничения:</b> ${esc(f.warnings.join("; "))}</div>`);
    if (f.sourceFiles?.length) meta.push(`<div class="files"><b>Код:</b> ${f.sourceFiles.map((s) => `<code>${esc(s)}</code>`).join(" ")}</div>`);
    return `<article class="card" id="${esc(f.id)}">
  <h3><span class="tag">${esc(tag)}</span> ${esc(f.titleRu ?? f.title)} <span class="fid">${esc(f.id)}</span></h3>
  <div class="badges">${badges.join("")}</div>
  <div class="math">\\[${esc(f.formulaLatex ?? f.latex)}\\]</div>
  <p class="desc">${esc(f.description ?? "")}</p>
  ${f.physicalMeaning ? `<p><b>Физический смысл.</b> ${esc(f.physicalMeaning)}</p>` : ""}
  ${f.resultMeaning ? `<p><b>Результат.</b> ${esc(f.resultMeaning)}</p>` : ""}
  ${vars}
  <div class="meta">${meta.join("")}</div>
</article>`;
  };

  const sections = formulaModules
    .map((m) => {
      const list = byModule.get(m) ?? [];
      return `<section class="module"><h2 id="mod-${esc(m)}">${esc(m)} — ${esc(moduleLabelRu[m] ?? "")} <span class="cnt">${list.length}</span></h2>${list
        .map((f, i) => card(f, `${m[0]}${i + 1}`))
        .join("\n")}</section>`;
    })
    .join("\n");

  const codeAppendix = `<section class="module"><h2>Приложение: код ядра</h2>${CODE_ORDER.map((k) => {
    const c = CODE[k];
    return `<article class="card code"><h3>${esc(c.title)}</h3><div class="files"><code>${esc(c.file)}</code></div><pre><code>${esc(c.code)}</code></pre></article>`;
  }).join("")}</section>`;

  const consts = assumptions?.length
    ? `<section class="module"><h2>Принятые константы и допущения</h2><article class="card"><table class="vars"><thead><tr><th>Параметр</th><th>Значение</th><th>Ед.</th><th>Источник</th><th>Описание</th></tr></thead><tbody>${assumptions
        .map(
          (a) =>
            `<tr><td>${esc(a.label)}</td><td><b>${esc(a.value)}</b></td><td>${esc(a.unit ?? "—")}</td><td>${esc(a.source ?? "—")}</td><td>${esc(a.description ?? "")}</td></tr>`
        )
        .join("")}</tbody></table></article></section>`
    : "";

  const moduleNav = formulaModules
    .map((m) => `<a href="#mod-${esc(m)}">${esc(m)} <small>${byModule.get(m)?.length ?? 0}</small></a>`)
    .join("");

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TherNest — справочник формул</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>
  :root{--ink:#1a2230;--muted:#5b6677;--line:#dfe5ee;--bg:#fff;--accent:#0b6;--card:#fff;}
  *{box-sizing:border-box}
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--ink);background:#eef1f6;margin:0;line-height:1.5}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:30px;margin:0 0 6px}
  .lede{color:var(--muted);margin:0 0 20px}
  .nav{position:sticky;top:0;background:#eef1f6ee;backdrop-filter:blur(6px);padding:10px 0;display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line);z-index:5}
  .nav a{font-size:13px;text-decoration:none;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:20px;padding:5px 12px}
  .nav a small{color:var(--accent);font-weight:700}
  table.leg{border-collapse:collapse;width:100%;margin:8px 0 24px}
  table.leg td,table.leg th{border:1px solid var(--line);padding:6px 10px;text-align:left;font-size:14px}
  section.module>h2{font-size:22px;border-bottom:3px solid var(--ink);padding-bottom:6px;margin:36px 0 16px}
  section.module>h2 .cnt{font-size:14px;color:#fff;background:var(--ink);border-radius:12px;padding:1px 9px;vertical-align:middle}
  .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:0 0 16px;box-shadow:0 1px 2px #0000000a}
  .card h3{margin:0 0 6px;font-size:17px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .tag{background:var(--ink);color:#fff;border-radius:6px;font-size:12px;padding:2px 7px;font-weight:700}
  .fid{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--muted);font-weight:400;margin-left:auto}
  .badges{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
  .badge{font-size:11px;border-radius:10px;padding:2px 8px;border:1px solid var(--line)}
  .b-main-runtime{background:#e6f7ee;border-color:#9ad9b8;color:#0a7a45}
  .b-solver{background:#fff0e6;border-color:#f0b990;color:#b8541a}
  .b-normative-check{background:#eaf0ff;border-color:#9fb6f0;color:#2a52b8}
  .b-contour{background:#f3f0ff;border-color:#c3b6f0;color:#5a3ab8}
  .b-derived-only,.b-report-only,.b-heuristic,.b-legacy{background:#f3f5f8;color:var(--muted)}
  .math{overflow-x:auto;padding:8px 0;font-size:18px}
  .desc{margin:6px 0}
  table.vars{border-collapse:collapse;margin:10px 0;font-size:13px;width:100%}
  table.vars th,table.vars td{border:1px solid var(--line);padding:5px 9px;text-align:left;vertical-align:top}
  table.vars th{background:#f5f7fa}
  table.vars td.sym{white-space:nowrap;text-align:center}
  .meta{font-size:13px;color:var(--muted);margin-top:8px;display:flex;flex-direction:column;gap:3px}
  .meta .norm{color:#2a52b8}.meta .warn{color:#b8541a}
  .meta code,.files code{font-family:ui-monospace,Consolas,monospace;font-size:11px;background:#f3f5f8;padding:1px 5px;border-radius:4px}
  pre{background:#0d1117;color:#e6edf3;padding:14px;border-radius:8px;overflow-x:auto;font-size:12.5px;line-height:1.45}
  pre code{font-family:ui-monospace,Consolas,monospace}
  @media print{body{background:#fff}.nav{display:none}.card{break-inside:avoid;box-shadow:none}}
</style></head>
<body><div class="wrap">
  <h1>TherNest — справочник расчётных формул</h1>
  <p class="lede">Сгенерировано из реестра <code>registry.ts</code>. Всего формул: <b>${formulaRegistry.length}</b>. Каждая формула: обозначения, единицы, <b>источник данных</b>, норматив и ссылка на код.</p>
  <table class="leg"><thead><tr><th>Модуль</th><th>Назначение</th><th>Формул</th></tr></thead><tbody>${formulaModules
    .map((m) => `<tr><td><b>${esc(m)}</b></td><td>${esc(moduleLabelRu[m] ?? "")}</td><td>${byModule.get(m)?.length ?? 0}</td></tr>`)
    .join("")}</tbody></table>
  <nav class="nav">${moduleNav}<a href="#mod-Geometry">▲ наверх</a></nav>
  ${sections}
  ${codeAppendix}
  ${consts}
</div>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'\\\\[',right:'\\\\]',display:true},{left:'\\\\(',right:'\\\\)',display:false}],throwOnError:false});"></script>
</body></html>`;
}

writeFileSync(join(OUT, "TherNest-formuly.md"), buildMarkdown(), "utf8");
writeFileSync(join(OUT, "TherNest-formuly.html"), buildHtml(), "utf8");
console.log("OK: TherNest-formuly.md + TherNest-formuly.html");
console.log("formulas:", formulaRegistry.length, "| assumptions:", assumptions?.length ?? 0);
