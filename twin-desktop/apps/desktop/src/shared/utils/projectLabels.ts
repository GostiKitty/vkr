import { firstDisplayText, looksLikeInternalId, sanitizeDisplayText } from "./displayText";

const DEMO_VIDEO_PROJECT_IDS = new Set(["local:demo-video", "demo-video"]);

/**
 * Человекочитаемое имя проекта для шапки и подписей (без raw `local:…`).
 */
export function formatProjectDisplayLabel(
  projectId: string | null | undefined,
  options?: {
    modelName?: string | null;
    fallback?: string;
  }
): string {
  const fromModel = firstDisplayText([options?.modelName], "", { allowInternalId: false });
  if (fromModel) {
    return fromModel;
  }

  const token = (projectId ?? "").trim();
  if (!token) {
    return options?.fallback ?? "Текущий проект";
  }

  if (DEMO_VIDEO_PROJECT_IDS.has(token) || /demo[-_]?video/i.test(token)) {
    return "Демонстрационный дом · 2 этажа";
  }

  if (/^(?:local:)?demo/i.test(token) || /(?:^|[-_:])video(?:[-_:]|$)/i.test(token)) {
    return "Демонстрационный дом";
  }

  if (token.startsWith("local:")) {
    return "Локальный проект";
  }

  if (looksLikeInternalId(token)) {
    return options?.fallback ?? "Инженерная модель здания";
  }

  return sanitizeDisplayText(token, options?.fallback ?? "Текущий проект");
}
