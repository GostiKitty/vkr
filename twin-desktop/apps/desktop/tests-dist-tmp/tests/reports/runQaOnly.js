import { runTests } from "../testHarness.js";
import "./exportGenerators.test.js";
import "./demoExportQa.test.js";
import "./demoDefaults.test.js";
runTests().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
