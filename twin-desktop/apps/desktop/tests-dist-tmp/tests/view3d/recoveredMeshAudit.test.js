import { readFileSync } from "node:fs";
import * as THREE from "three";
import { DISABLE_ALL_3D_TEMPERATURE, resolveRecoveredTemperatureRuntime, USE_ROOM_FLOOR_TEMPERATURE_COLORING, } from "../../src/features/build/view3d/Build3DRecoveredPreview.js";
import { collectRecoveredSceneMeshAudit } from "../../src/features/build/view3d/recoveredMeshAudit.js";
import { test } from "../testHarness.js";
function createShellScene() {
    const scene = new THREE.Scene();
    const shellRoot = new THREE.Group();
    shellRoot.name = "group:shell";
    scene.add(shellRoot);
    const shellMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), new THREE.MeshStandardMaterial({ color: 0x94a3b8 }));
    shellMesh.name = "wall:shell";
    shellMesh.position.set(0, 1.5, 0);
    shellMesh.userData = { category: "shell", sourceType: "wall", sourceId: "shell" };
    shellRoot.add(shellMesh);
    return { scene, shellRoot };
}
test("recovered 3D runtime keeps only room-floor temperature coloring", () => {
    const runtime = resolveRecoveredTemperatureRuntime(true, true);
    if (!USE_ROOM_FLOOR_TEMPERATURE_COLORING) {
        throw new Error("Recovered 3D should keep room-floor temperature coloring mode enabled.");
    }
    if (DISABLE_ALL_3D_TEMPERATURE && runtime.showTemperature) {
        throw new Error("Recovered 3D emergency disable flag should suppress room-floor temperature coloring.");
    }
    if (!DISABLE_ALL_3D_TEMPERATURE && !runtime.showTemperature) {
        throw new Error("Recovered 3D runtime should allow room-floor temperature coloring when the emergency flag is off.");
    }
    if (runtime.showWallTemperature) {
        throw new Error("Recovered 3D runtime should never enable wall temperature boxes in room-floor coloring mode.");
    }
});
test("mesh audit finds suspicious temperature plane outside shell bbox", () => {
    const { scene, shellRoot } = createShellScene();
    const rogueTemperature = new THREE.Mesh(new THREE.BoxGeometry(4, 0.02, 3), new THREE.MeshStandardMaterial({ color: 0xf97316, transparent: true, opacity: 0.58 }));
    rogueTemperature.name = "temperature:room:rogue";
    rogueTemperature.position.set(12, 0.04, 0);
    rogueTemperature.userData = { category: "temperature", sourceType: "room", sourceId: "rogue" };
    scene.add(rogueTemperature);
    const audit = collectRecoveredSceneMeshAudit(scene, shellRoot);
    if (!audit.rows.length) {
        throw new Error("Recovered mesh audit should enumerate scene meshes.");
    }
    if (!audit.suspiciousRows.some((row) => row.name === "temperature:room:rogue")) {
        throw new Error("Recovered mesh audit should flag suspicious red temperature planes.");
    }
    if (!audit.outsideShellRows.some((row) => row.name === "temperature:room:rogue")) {
        throw new Error("Recovered mesh audit should flag suspicious planes outside shell bbox.");
    }
});
test("mesh audit preserves room-floor category metadata for large colored planes", () => {
    const { scene, shellRoot } = createShellScene();
    const temperatureMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.02, 2), new THREE.MeshStandardMaterial({ color: 0xd946ef, transparent: true, opacity: 0.62 }));
    temperatureMesh.name = "roomFloor:test-room";
    temperatureMesh.position.set(0, 0.04, 0);
    temperatureMesh.userData = { category: "room-floor", sourceType: "room", sourceId: "test-room" };
    shellRoot.add(temperatureMesh);
    const audit = collectRecoveredSceneMeshAudit(scene, shellRoot);
    const row = audit.rows.find((item) => item.name === "roomFloor:test-room");
    if (!row) {
        throw new Error("Recovered mesh audit should keep room floor meshes in the row list.");
    }
    if (row.category !== "room-floor") {
        throw new Error("Recovered room floor meshes should keep userData.category = room-floor.");
    }
});
test("mesh audit flags unnamed large red planes", () => {
    const { scene, shellRoot } = createShellScene();
    const unnamedPlane = new THREE.Mesh(new THREE.BoxGeometry(5, 0.02, 4), new THREE.MeshStandardMaterial({ color: 0xef4444, transparent: true, opacity: 0.72 }));
    unnamedPlane.position.set(10, 0.04, 2);
    scene.add(unnamedPlane);
    const audit = collectRecoveredSceneMeshAudit(scene, shellRoot);
    if (!audit.suspiciousRows.some((row) => row.name === "(unnamed)")) {
        throw new Error("Recovered mesh audit should expose unnamed red planes as suspicious.");
    }
});
test("Build3DRecoveredPreview source uses room-floor coloring without separate temperature meshes", () => {
    const source = readFileSync("src/features/build/view3d/Build3DRecoveredPreview.tsx", "utf8");
    if (source.includes('category: "temperature"')) {
        throw new Error("Recovered preview should not create dedicated temperature meshes in room-floor coloring mode.");
    }
    if (!source.includes("Температурное поле в 3D временно отключено. Используйте 2D или результаты расчета.")) {
        throw new Error("Recovered preview should explain that 3D temperature is shown through room floors.");
    }
    if (source.includes("temperature:${surface.sourceType}:${surface.sourceId}")) {
        throw new Error("Recovered preview should not create named temperature overlay meshes.");
    }
    if (!source.includes("roomFloor:")) {
        throw new Error("Recovered preview should keep named room floor meshes for temperature coloring.");
    }
    if (!source.includes("Температура отображается по помещениям.")) {
        throw new Error("Recovered preview should explain that 3D temperature is shown through room floors.");
    }
});
