import { firstDisplayText, looksLikeInternalId, sanitizeDisplayText } from "./displayText";
import {
  DEMO_PROJECT_NAME,
  DEMO_PROJECT_SOURCE,
  isCanonicalDemoProjectId,
} from "./demoProject";

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

  if (isCanonicalDemoProjectId(token) || token === DEMO_PROJECT_SOURCE) {
    return DEMO_PROJECT_NAME;
  }

  if (token.startsWith("local:")) {
    return "Локальный проект";
  }

  if (looksLikeInternalId(token)) {
    return options?.fallback ?? "Инженерная модель здания";
  }

  return sanitizeDisplayText(token, options?.fallback ?? "Текущий проект");
}
