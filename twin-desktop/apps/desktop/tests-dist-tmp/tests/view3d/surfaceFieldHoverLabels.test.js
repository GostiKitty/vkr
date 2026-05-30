import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "../testHarness.js";
test("surface field hover tooltips use Russian labels", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/view3d/surfaceFieldScene.ts"), "utf8");
    const forbidden = [
        "Ceiling surface",
        "Wall surface",
        "Floor surface",
        'label: "Air"',
        'label: "Heat flux"',
        'label: "Heat loss"',
        'label: "Dew point"',
        'label: "Condensation"',
        'label: "Room range"',
        "`safe (+",
        "`risk (",
        '?? "n/a"',
    ];
    const missing = ["Поверхность потолка", "Тепловой поток", "Точка росы", "безопасно (+"];
    forbidden.forEach((snippet) => {
        if (source.includes(snippet)) {
            throw new Error(`surfaceFieldScene still contains English hover snippet: ${snippet}`);
        }
    });
    missing.forEach((snippet) => {
        if (!source.includes(snippet)) {
            throw new Error(`surfaceFieldScene is missing Russian hover snippet: ${snippet}`);
        }
    });
});
