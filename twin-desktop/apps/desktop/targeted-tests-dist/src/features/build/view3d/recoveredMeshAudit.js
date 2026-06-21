import * as THREE from "three";
function summarizeBounds(box) {
    if (box.isEmpty()) {
        return null;
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    return {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
        size: { x: size.x, y: size.y, z: size.z },
        center: { x: center.x, y: center.y, z: center.z },
    };
}
function pickMaterial(mesh) {
    if (Array.isArray(mesh.material)) {
        return mesh.material[0] ?? null;
    }
    return mesh.material ?? null;
}
function getMaterialColorHex(material) {
    const color = material?.color;
    return color ? `#${color.getHexString()}` : null;
}
function isRedOrPurpleMaterial(material) {
    const color = material?.color;
    if (!color) {
        return false;
    }
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    const hueDeg = hsl.h * 360;
    const redHue = hueDeg <= 28 || hueDeg >= 332;
    const purpleHue = hueDeg >= 265 && hueDeg <= 332;
    return (redHue || purpleHue) && hsl.s >= 0.35 && hsl.l >= 0.16 && hsl.l <= 0.84;
}
function hasSuspiciousName(name) {
    return /temp|thermal|heat|surface|field|slab|roof|floor|room|wall/i.test(name);
}
export function collectRecoveredSceneMeshAudit(root, shellRoot) {
    const shellBox = shellRoot ? new THREE.Box3().setFromObject(shellRoot) : new THREE.Box3();
    const shellBounds = shellRoot ? summarizeBounds(shellBox) : null;
    const rows = [];
    root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
            return;
        }
        const bboxBox = new THREE.Box3().setFromObject(object);
        const bbox = summarizeBounds(bboxBox);
        const material = pickMaterial(object);
        const opacity = material ? material.opacity ?? 1 : null;
        const transparent = material ? material.transparent ?? false : null;
        const suspiciousColor = isRedOrPurpleMaterial(material);
        const suspiciousLarge = Boolean(bbox && (bbox.size.x > 1 || bbox.size.z > 1));
        const suspiciousName = hasSuspiciousName(object.name);
        const outsideShell = Boolean(bbox &&
            shellBounds &&
            !shellBox.isEmpty() &&
            !shellBox.intersectsBox(bboxBox) &&
            (Math.abs(bbox.center.x - shellBounds.center.x) > 0.01 || Math.abs(bbox.center.z - shellBounds.center.z) > 0.01));
        rows.push({
            name: object.name || "(unnamed)",
            uuid: object.uuid,
            parentName: object.parent?.name || null,
            userData: { ...(object.userData ?? {}) },
            materialType: material?.type ?? null,
            materialColorHex: getMaterialColorHex(material),
            materialOpacity: opacity,
            materialTransparent: transparent,
            geometryType: object.geometry?.type ?? null,
            bbox,
            visible: object.visible,
            renderOrder: object.renderOrder,
            category: typeof object.userData?.category === "string" ? object.userData.category : null,
            suspiciousColor,
            suspiciousLarge,
            suspiciousName,
            outsideShell,
        });
    });
    return {
        shellBounds,
        rows,
        suspiciousRows: rows.filter((row) => row.suspiciousColor && row.suspiciousLarge && (row.materialOpacity ?? 1) > 0.2),
        outsideShellRows: rows.filter((row) => row.outsideShell),
    };
}
