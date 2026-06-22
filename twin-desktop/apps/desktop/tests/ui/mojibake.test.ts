import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "../testHarness.js";

const ROOT = "c:\\Users\\Liza\\vkr\\twin-desktop\\apps\\desktop";
const SELF_PATH = join(ROOT, "tests", "ui", "mojibake.test.ts");

const TARGET_DIRS = [
  join(ROOT, "src"),
  join(ROOT, "tests"),
];

const MOJIBAKE_PATTERNS = [
  "\u0420\u040E",
  "\u0420\u045F",
  "\u0420\u045C",
  "\u0421\u0403",
  "\u0421\u201A",
  "\u0420\u00B5\u0420\u00B6",
  "\u0420\u0020\u0420\u00B5",
  "\u0420\u0020\u0420\u00B5\u0420\u00B7",
  "\u0420\u045F\u0420\u00BB\u0420\u00B0\u0420\u0405",
  "\u0420\u040E\u0420\u00B5\u0421\u201A\u0420\u0451",
  "РЎР",
  "РџР",
  "РќР",
  "РњР",
  "РўР",
  "РЁР",
  "Р“Р",
  "РљР",
  "Р’Р",
  "Р¤Р",
  "Р’С",
  "РђС",
  "РџС",
  "С‹С",
  "СЏР",
  "С„Р",
  "вЂ",
  "В°",
  "мВі/С",
];

function collectSourceFiles(dir: string, bucket: string[]) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectSourceFiles(fullPath, bucket);
      continue;
    }
    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      if (fullPath === SELF_PATH) {
        continue;
      }
      bucket.push(fullPath);
    }
  }
}

test("desktop source files do not contain mojibake sequences", () => {
  const files: string[] = [];
  TARGET_DIRS.forEach((dir) => collectSourceFiles(dir, files));

  const offenders = files
    .map((file) => {
      const text = readFileSync(file, "utf-8");
      const hits = MOJIBAKE_PATTERNS.filter((pattern) => text.includes(pattern));
      return hits.length > 0 ? `${file}: ${hits.join(", ")}` : null;
    })
    .filter((value): value is string => value !== null);

  if (offenders.length > 0) {
    throw new Error(`Обнаружены строки с некорректной кодировкой:\n${offenders.join("\n")}`);
  }
});
