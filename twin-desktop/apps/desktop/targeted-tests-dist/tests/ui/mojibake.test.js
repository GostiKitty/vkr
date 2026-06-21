import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "../testHarness.js";
const ROOT = "c:\\Users\\Liza\\vkr\\twin-desktop\\apps\\desktop";
const TARGET_DIRS = [
    join(ROOT, "src", "features", "build"),
    join(ROOT, "src", "app"),
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
];
function collectSourceFiles(dir, bucket) {
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            collectSourceFiles(fullPath, bucket);
            continue;
        }
        if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            bucket.push(fullPath);
        }
    }
}
test("UI files do not contain mojibake sequences", () => {
    const files = [];
    TARGET_DIRS.forEach((dir) => collectSourceFiles(dir, files));
    const offenders = files
        .map((file) => {
        const text = readFileSync(file, "utf-8");
        const hits = MOJIBAKE_PATTERNS.filter((pattern) => text.includes(pattern));
        return hits.length > 0 ? `${file}: ${hits.join(", ")}` : null;
    })
        .filter((value) => value !== null);
    if (offenders.length > 0) {
        throw new Error(`Обнаружены строки с некорректной кодировкой:\n${offenders.join("\n")}`);
    }
});
