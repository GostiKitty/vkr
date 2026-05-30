import { useBuildStore } from "../../build/build.store";
import { useTwinStore } from "../../../entities/twin/twin.store";
import { useWorkflowStore } from "../../../entities/workflow/workflow.store";
import { useProjectStore } from "../../../entities/project/project.store";
import { useWorkspaceStore } from "../../../entities/workspace/workspace.store";
import { loadReportMeta } from "../../build/reports/reportMetaPersistence";
import { buildReportBaseData, } from "./data/buildReportBaseData";
import { buildProjectOvTsData } from "./data/buildProjectOvTsData";
import { buildThermalProtectionData } from "./data/buildThermalProtectionData";
import { buildEnergyPassportData } from "./data/buildEnergyPassportData";
import { buildOperationPassportData } from "./data/buildOperationPassportData";
import { buildEngineeringSummaryData } from "./data/buildEngineeringSummaryData";
import { generateProjectOvTsHtml } from "./generators/projectOvTs";
import { generateThermalProtectionHtml } from "./generators/thermalProtection";
import { generateEnergyPassportHtml } from "./generators/energyPassport";
import { generateOperationTechnicalPassportHtml } from "./generators/operationTechnicalPassport";
import { generateEngineeringSummaryHtml } from "./generators/engineeringSummary";
import { prepareExportReportInput } from "./prepareExportReportInput";
import { loadExpertiseInputs } from "./store/expertiseInputs.store";
import { REPORT_EXPORT_FILE_PREFIX, REPORT_EXPORT_TITLE, } from "./types";
import { escapeHtml, renderDataTable, renderGostStamp, renderGostTitlePage, renderSignatureBlock, wrapHtmlDocument, } from "./helpers";
import { getResultSyncState } from "../../../shared/utils/modelSync";
const FINAL_RELEASE_CONTENT_RULES = [
    { label: "Черновик", pattern: /черновик/i },
    { label: "demo", pattern: /\bdemo\b/i },
    { label: "Демонстрационный", pattern: /демонстрацион/i },
    { label: "не заполнено пользователем", pattern: /не заполнено пользователем/i },
    { label: "не заполнено", pattern: /не заполнено/i },
    { label: "недостаточно данных", pattern: /недостаточно данных/i },
    { label: "placeholder", pattern: /placeholder/i },
    { label: "требует уточнения", pattern: /требует уточнения/i },
    { label: "не соответствует", pattern: /не соответствует/i },
    { label: "предварительный", pattern: /предварительн/i },
    { label: "не заменяет нормативную проверку", pattern: /не заменяет нормативную проверку/i },
    { label: "проектный демонстрационный сценарий", pattern: /проектный демонстрационный сценарий/i },
];
export const REPORT_RELEASE_BLOCKER_KIND = "release-blocker";
export const REPORT_RELEASE_BLOCKER_FILENAME = "00-komplekt-ne-gotov-k-vypusku.html";
export const REPORT_RELEASE_BLOCKER_TITLE = "Комплект не готов к выпуску";
export const REPORT_EXPORT_BUNDLE_FILENAME = {
    "project-ov-ts": "01-razdel-5-ov-ts.html",
    "thermal-protection": "02-raschet-teplovoy-zashchity.html",
    "energy-passport": "03-energeticheskiy-pasport-proekta-zdaniya.html",
    "operation-technical-passport": "04-pasport-proektnyh-teplotehnicheskih-harakteristik.html",
    "engineering-summary": "05-inzhenernoe-zaklyuchenie.html",
};
export const ALL_REPORT_EXPORT_KINDS = [
    "project-ov-ts",
    "thermal-protection",
    "energy-passport",
    "operation-technical-passport",
    "engineering-summary",
];
export function renderReportHtml(kind, base) {
    return resolveRenderedReport(kind, base, buildFinalReleaseAudit(base)).html;
}
export function buildFinalReleaseAudit(base) {
    const preflight = base.preflight;
    if (preflight.generationMode !== "final") {
        return {
            generationMode: preflight.generationMode,
            status: preflight.status,
            statusLabel: preflight.statusLabel,
            summary: preflight.summary,
            readyForFinalRelease: false,
            blockingIssues: preflight.blockingIssues,
            warningIssues: preflight.warningIssues,
            documentFindings: [],
            requiresReleaseBlocker: false,
        };
    }
    const standardDocuments = renderAllStandardDocuments(base);
    const documentIssues = new Map(ALL_REPORT_EXPORT_KINDS.map((kind) => [kind, []]));
    for (const issue of preflight.blockingIssues) {
        const affected = issue.affectedDocuments.length
            ? issue.affectedDocuments
            : ALL_REPORT_EXPORT_KINDS;
        for (const kind of affected) {
            documentIssues.get(kind)?.push(issue.message);
        }
    }
    const contentIssues = [];
    for (const kind of ALL_REPORT_EXPORT_KINDS) {
        const matches = findForbiddenContentMatches(standardDocuments[kind]);
        if (!matches.length) {
            continue;
        }
        const message = `В документе "${REPORT_EXPORT_TITLE[kind]}" обнаружены запрещённые формулировки: ${matches
            .map((match) => `«${match}»`)
            .join(", ")}.`;
        contentIssues.push({
            code: `final-content-${kind}`,
            severity: "error",
            message,
            affectedDocuments: [kind],
        });
        documentIssues.get(kind)?.push(message);
    }
    const blockingIssues = mergeIssues([...preflight.blockingIssues, ...contentIssues]);
    const readyForFinalRelease = blockingIssues.length === 0;
    const documentFindings = ALL_REPORT_EXPORT_KINDS.map((kind) => {
        const issues = uniqueStrings(documentIssues.get(kind) ?? []);
        if (!issues.length) {
            return null;
        }
        return {
            kind,
            title: REPORT_EXPORT_TITLE[kind],
            filename: REPORT_EXPORT_BUNDLE_FILENAME[kind],
            issues,
        };
    }).filter((finding) => Boolean(finding));
    const status = readyForFinalRelease ? "ready" : "not-ready";
    return {
        generationMode: "final",
        status,
        statusLabel: status === "ready" ? "Готово к выпуску" : "Не готово к выпуску",
        summary: readyForFinalRelease
            ? "Комплект готов к финальной выгрузке."
            : `Финальная выгрузка заблокирована: ${blockingIssues.length} критических замечаний.`,
        readyForFinalRelease,
        blockingIssues,
        warningIssues: preflight.warningIssues,
        documentFindings,
        requiresReleaseBlocker: !readyForFinalRelease,
    };
}
function renderStandardReportHtml(kind, base) {
    const options = {
        appliedAssumptions: base.expertise.showAssumptionsBlock ? base.appliedAssumptions : [],
    };
    switch (kind) {
        case "project-ov-ts":
            return generateProjectOvTsHtml(buildProjectOvTsData(base), options);
        case "thermal-protection":
            return generateThermalProtectionHtml(buildThermalProtectionData(base), options);
        case "energy-passport":
            return generateEnergyPassportHtml(buildEnergyPassportData(base), options);
        case "operation-technical-passport":
            return generateOperationTechnicalPassportHtml(buildOperationPassportData(base), options);
        case "engineering-summary":
            return generateEngineeringSummaryHtml(buildEngineeringSummaryData(base), options);
        default: {
            const exhaustive = kind;
            throw new Error(`Unknown report kind: ${String(exhaustive)}`);
        }
    }
}
function renderAllStandardDocuments(base) {
    return {
        "project-ov-ts": renderStandardReportHtml("project-ov-ts", base),
        "thermal-protection": renderStandardReportHtml("thermal-protection", base),
        "energy-passport": renderStandardReportHtml("energy-passport", base),
        "operation-technical-passport": renderStandardReportHtml("operation-technical-passport", base),
        "engineering-summary": renderStandardReportHtml("engineering-summary", base),
    };
}
function resolveRenderedReport(kind, base, audit) {
    if (audit.requiresReleaseBlocker) {
        return {
            kind: REPORT_RELEASE_BLOCKER_KIND,
            html: generateReleaseBlockerHtml(base, audit),
            filename: REPORT_RELEASE_BLOCKER_FILENAME,
            title: REPORT_RELEASE_BLOCKER_TITLE,
            isReleaseBlocker: true,
        };
    }
    return {
        kind,
        html: renderStandardReportHtml(kind, base),
        filename: buildFilename(kind, base.source.generatedAt),
        title: REPORT_EXPORT_TITLE[kind],
        isReleaseBlocker: false,
    };
}
function generateReleaseBlockerHtml(base, audit) {
    const titlePage = renderGostTitlePage(base.meta, REPORT_RELEASE_BLOCKER_TITLE, "Отчёт final-preflight");
    const objectRows = [
        ["Объект", base.expertise.fieldMap.projectName.value],
        ["Адрес", base.expertise.fieldMap.objectAddress.value],
        ["Шифр проекта", base.expertise.fieldMap.projectCipher.value],
        ["Основание для проектирования", base.expertise.fieldMap.designBasis.value],
        ["Номер договора / задания", base.expertise.fieldMap.contractNumber.value],
        ["Статус выпуска", audit.statusLabel],
    ];
    const blockerRows = audit.documentFindings.length > 0
        ? audit.documentFindings
        : ALL_REPORT_EXPORT_KINDS.map((kind) => ({
            kind,
            title: REPORT_EXPORT_TITLE[kind],
            filename: REPORT_EXPORT_BUNDLE_FILENAME[kind],
            issues: audit.blockingIssues.map((issue) => issue.message),
        }));
    const body = `
${titlePage}
<section class="rx-status-block rx-status-not-ready">
  <h3 class="rx-section-title">Статус выпуска</h3>
  <p><strong>Статус документа:</strong> ${escapeHtml(audit.statusLabel)}</p>
  <p>${escapeHtml(audit.summary)}</p>
</section>
<section id="rb-1">
  <h3 class="rx-section-title">1 Сведения о комплекте</h3>
  ${renderDataTable(null, [
        { label: "Параметр", width: "36%" },
        { label: "Значение", width: "64%" },
    ], objectRows.map((row) => ({ cells: row })))}
</section>
<section id="rb-2">
  <h3 class="rx-section-title">2 Критические замечания комплекта</h3>
  <ul class="rx-status-list">${audit.blockingIssues
        .map((issue) => `<li>${escapeHtml(issue.message)}</li>`)
        .join("")}</ul>
</section>
<section id="rb-3">
  <h3 class="rx-section-title">3 Замечания по файлам</h3>
  ${renderDataTable(null, [
        { label: "Файл", width: "22%" },
        { label: "Документ", width: "28%" },
        { label: "Статус", width: "16%", align: "center" },
        { label: "Критические замечания", width: "34%" },
    ], blockerRows.map((row) => ({
        cells: [row.filename, row.title, "не готово", row.issues.join("; ")],
    })))}
</section>
${renderSignatureBlock(base.meta)}
${renderGostStamp(base.meta, REPORT_RELEASE_BLOCKER_TITLE)}
`;
    return wrapHtmlDocument("<!-- Export template: release-blocker v1 -->", REPORT_RELEASE_BLOCKER_TITLE, body);
}
function findForbiddenContentMatches(html) {
    const text = html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    return uniqueStrings(FINAL_RELEASE_CONTENT_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.label));
}
function mergeIssues(issues) {
    const result = new Map();
    for (const issue of issues) {
        const key = `${issue.code}:${issue.message}:${issue.affectedDocuments.join("|")}`;
        if (!result.has(key)) {
            result.set(key, issue);
        }
    }
    return Array.from(result.values());
}
function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        if (!value || seen.has(value)) {
            continue;
        }
        seen.add(value);
        result.push(value);
    }
    return result;
}
function buildBaseFromStores() {
    const buildState = useBuildStore.getState();
    const twinState = useTwinStore.getState();
    const workflowState = useWorkflowStore.getState();
    const projectState = useProjectStore.getState();
    const workspaceState = useWorkspaceStore.getState();
    const projectId = projectState.projectId ?? null;
    const projectKey = buildState.projectKey || projectId || "local-project";
    const thermalResultState = getResultSyncState(Boolean(twinState.lastThermalResult), twinState.lastThermalResultBinding, buildState.projectKey, buildState.modelRevision);
    const monteCarloResultState = getResultSyncState(Boolean(workflowState.monteCarloResult), workflowState.monteCarloResultBinding, buildState.projectKey, buildState.modelRevision);
    const rawInput = {
        model: buildState.model,
        projectId,
        scenarioConfig: workflowState.scenarioConfig ?? null,
        thermalResult: thermalResultState === "current" ? twinState.lastThermalResult ?? null : null,
        monteCarloResult: monteCarloResultState === "current" ? workflowState.monteCarloResult ?? null : null,
        reportMeta: loadReportMeta(projectKey),
        generatedAt: new Date(),
        expertiseInputs: loadExpertiseInputs(projectKey),
    };
    const prepared = prepareExportReportInput(rawInput, {
        applyDemoDefaults: workspaceState.applyDemoDefaults,
    });
    return buildReportBaseData({
        ...prepared.input,
        appliedAssumptions: prepared.appliedAssumptions,
    });
}
function buildFilename(kind, generatedAt) {
    const year = generatedAt.getFullYear();
    const month = String(generatedAt.getMonth() + 1).padStart(2, "0");
    const day = String(generatedAt.getDate()).padStart(2, "0");
    return `${REPORT_EXPORT_FILE_PREFIX[kind]}-${year}${month}${day}.html`;
}
export function exportReportDocument(kind, options = {}) {
    const base = buildBaseFromStores();
    const audit = buildFinalReleaseAudit(base);
    const rendered = resolveRenderedReport(kind, base, audit);
    const openInWindow = options.openInWindow ?? true;
    const shouldDownload = options.download ?? false;
    let printableWindow = null;
    if (typeof window !== "undefined" && openInWindow) {
        try {
            const blob = new Blob([rendered.html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            printableWindow = window.open(url, "_blank", "noopener,noreferrer");
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch (error) {
            console.error("Failed to open report export window", error);
        }
    }
    if (typeof window !== "undefined" && shouldDownload) {
        try {
            const blob = new Blob([rendered.html], { type: "text/html;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = rendered.filename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
        }
        catch (error) {
            console.error("Failed to download report export", error);
        }
    }
    return {
        kind: rendered.kind,
        html: rendered.html,
        filename: rendered.filename,
        title: rendered.title,
        printableWindow,
        isReleaseBlocker: rendered.isReleaseBlocker,
    };
}
export function downloadAllReportDocuments(options = {}) {
    const base = buildBaseFromStores();
    const audit = buildFinalReleaseAudit(base);
    const items = audit.requiresReleaseBlocker
        ? [
            {
                kind: REPORT_RELEASE_BLOCKER_KIND,
                html: generateReleaseBlockerHtml(base, audit),
                filename: REPORT_RELEASE_BLOCKER_FILENAME,
                title: REPORT_RELEASE_BLOCKER_TITLE,
                isReleaseBlocker: true,
            },
        ]
        : ALL_REPORT_EXPORT_KINDS.map((kind) => {
            const rendered = resolveRenderedReport(kind, base, audit);
            return {
                kind: rendered.kind,
                html: rendered.html,
                filename: REPORT_EXPORT_BUNDLE_FILENAME[kind],
                title: rendered.title,
                isReleaseBlocker: false,
            };
        });
    const shouldTrigger = options.trigger ?? true;
    if (shouldTrigger && typeof window !== "undefined") {
        items.forEach((item, index) => {
            try {
                const blob = new Blob([item.html], { type: "text/html;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = item.filename;
                document.body.appendChild(anchor);
                window.setTimeout(() => {
                    anchor.click();
                    document.body.removeChild(anchor);
                    window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
                }, index * 250);
            }
            catch (error) {
                console.error(`Failed to download ${item.filename}`, error);
            }
        });
    }
    return items;
}
