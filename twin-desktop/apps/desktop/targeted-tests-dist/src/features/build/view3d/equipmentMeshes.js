import * as THREE from "three";
const METAL = Object.freeze({ roughness: 0.48, metalness: 0.2 });
const PAINT = Object.freeze({ roughness: 0.62, metalness: 0.12 });
const PLASTIC = Object.freeze({ roughness: 0.74, metalness: 0.04 });
const createMaterial = (color, profile, selected) => new THREE.MeshStandardMaterial({
    color: selected ? 0xf6c453 : color,
    roughness: profile.roughness,
    metalness: profile.metalness,
    emissive: selected ? 0xf59e0b : 0x000000,
    emissiveIntensity: selected ? 0.08 : 0.01,
});
const addBox = (group, size, position, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
};
const addCylinder = (group, radiusTop, radiusBottom, height, radialSegments, position, material, rotation) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material);
    if (rotation?.x !== undefined) {
        mesh.rotation.x = rotation.x;
    }
    if (rotation?.y !== undefined) {
        mesh.rotation.y = rotation.y;
    }
    if (rotation?.z !== undefined) {
        mesh.rotation.z = rotation.z;
    }
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
};
const addFeet = (group, xOffset, zOffset, material, y = 0.05) => {
    [-xOffset, xOffset].forEach((x) => {
        [-zOffset, zOffset].forEach((z) => {
            addBox(group, [0.06, 0.1, 0.06], [x, y, z], material);
        });
    });
};
const addFrontSlats = (group, count, width, y, z, material, height = 0.42) => {
    const span = width * 0.84;
    const step = count > 1 ? span / (count - 1) : 0;
    for (let index = 0; index < count; index += 1) {
        const x = -span / 2 + step * index;
        addBox(group, [0.02, height, 0.012], [x, y, z], material);
    }
};
export const getEquipmentBaseY = (type, levelHeight) => {
    if (type === "diffuser") {
        return Math.max(2.34, levelHeight - 0.12);
    }
    if (type === "boiler") {
        return 0.58;
    }
    if (type === "ahu") {
        return 0.4;
    }
    if (type === "pump") {
        return 0.24;
    }
    if (type === "heat_exchanger") {
        return 0.34;
    }
    if (type === "elevator") {
        return 0.26;
    }
    if (type === "expansion_tank") {
        return 0.38;
    }
    if (type === "dirt_separator") {
        return 0.22;
    }
    if (type === "radiator" || type === "fancoil") {
        return 0.18;
    }
    return 0.34;
};
const createRadiatorMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xf8fafc, PAINT, selected);
    const accent = createMaterial(0xd3dae4, METAL, selected);
    const bracket = createMaterial(0x94a3b8, METAL, selected);
    addBox(group, [0.94, 0.62, 0.08], [0, 0.38, -0.005], shell);
    addBox(group, [0.96, 0.03, 0.12], [0, 0.69, 0.01], accent);
    addBox(group, [0.96, 0.03, 0.1], [0, 0.08, 0.01], accent);
    addBox(group, [0.04, 0.62, 0.12], [-0.46, 0.38, 0.01], accent);
    addBox(group, [0.04, 0.62, 0.12], [0.46, 0.38, 0.01], accent);
    for (let section = 0; section < 8; section += 1) {
        const x = -0.36 + section * 0.103;
        addBox(group, [0.06, 0.56, 0.05], [x, 0.38, 0.065], shell);
        addBox(group, [0.02, 0.5, 0.07], [x, 0.38, 0.1], accent);
    }
    addBox(group, [0.16, 0.08, 0.03], [-0.26, 0.54, -0.055], bracket);
    addBox(group, [0.16, 0.08, 0.03], [0.26, 0.54, -0.055], bracket);
    addBox(group, [0.04, 0.18, 0.06], [-0.28, 0.11, 0.025], bracket);
    addBox(group, [0.04, 0.18, 0.06], [0.28, 0.11, 0.025], bracket);
    addCylinder(group, 0.022, 0.022, 0.18, 12, [-0.34, 0.12, 0.12], accent, { x: Math.PI / 2 });
    addCylinder(group, 0.022, 0.022, 0.18, 12, [0.34, 0.12, 0.12], accent, { x: Math.PI / 2 });
    return group;
};
const createBoilerMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xe2e8f0, PAINT, selected);
    const front = createMaterial(0xf8fafc, PAINT, selected);
    const accent = createMaterial(0x64748b, METAL, selected);
    const panel = createMaterial(0x1f2937, PLASTIC, selected);
    addBox(group, [0.68, 1.08, 0.46], [0, 0.58, 0], shell);
    addBox(group, [0.52, 0.66, 0.03], [0, 0.53, 0.248], front);
    addBox(group, [0.56, 0.14, 0.04], [0, 0.95, 0.24], accent);
    addBox(group, [0.24, 0.08, 0.02], [0.05, 0.95, 0.262], panel);
    addCylinder(group, 0.028, 0.028, 0.05, 14, [-0.21, 0.41, 0.258], accent, { z: Math.PI / 2 });
    addFeet(group, 0.22, 0.15, accent, 0.05);
    addCylinder(group, 0.04, 0.04, 0.22, 14, [-0.12, 1.14, -0.05], accent);
    addCylinder(group, 0.034, 0.034, 0.2, 14, [0.12, 1.13, -0.05], accent);
    addCylinder(group, 0.05, 0.05, 0.34, 14, [0.2, 1.19, -0.1], accent);
    addCylinder(group, 0.026, 0.026, 0.14, 12, [-0.18, 0.12, 0.24], accent, { x: Math.PI / 2 });
    addCylinder(group, 0.026, 0.026, 0.14, 12, [0.18, 0.12, 0.24], accent, { x: Math.PI / 2 });
    return group;
};
const createPumpMesh = (selected) => {
    const group = new THREE.Group();
    const body = createMaterial(0x7c5cff, PAINT, selected);
    const metal = createMaterial(0xcbd5e1, METAL, selected);
    const dark = createMaterial(0x475569, PLASTIC, selected);
    addBox(group, [0.34, 0.06, 0.22], [0, 0.05, 0], metal);
    addBox(group, [0.14, 0.08, 0.1], [0, 0.11, 0], dark);
    addCylinder(group, 0.095, 0.095, 0.34, 16, [0, 0.22, 0], body, { z: Math.PI / 2 });
    addCylinder(group, 0.056, 0.056, 0.12, 14, [-0.22, 0.22, 0], metal, { z: Math.PI / 2 });
    addCylinder(group, 0.056, 0.056, 0.12, 14, [0.22, 0.22, 0], metal, { z: Math.PI / 2 });
    addCylinder(group, 0.085, 0.085, 0.18, 16, [0, 0.34, 0], dark);
    addBox(group, [0.11, 0.1, 0.1], [0, 0.44, 0], dark);
    addCylinder(group, 0.02, 0.02, 0.1, 10, [0, 0.5, 0.068], metal, { x: Math.PI / 2 });
    return group;
};
const createAhuMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xdbe5ee, PAINT, selected);
    const accent = createMaterial(0x94a3b8, METAL, selected);
    const grille = createMaterial(0xf8fafc, METAL, selected);
    addBox(group, [1.26, 0.64, 0.68], [0, 0.4, 0], shell);
    addBox(group, [0.02, 0.58, 0.64], [-0.2, 0.4, 0], accent);
    addBox(group, [0.02, 0.58, 0.64], [0.22, 0.4, 0], accent);
    addBox(group, [1.28, 0.04, 0.7], [0, 0.72, 0], accent);
    addBox(group, [1.28, 0.05, 0.7], [0, 0.08, 0], accent);
    addFrontSlats(group, 7, 0.34, 0.4, 0.348, grille, 0.4);
    addBox(group, [0.32, 0.42, 0.018], [0, 0.4, 0.348], grille);
    addBox(group, [0.24, 0.4, 0.02], [0.44, 0.4, 0.348], grille);
    addBox(group, [0.09, 0.09, 0.03], [0.44, 0.58, 0.355], accent);
    addCylinder(group, 0.1, 0.1, 0.22, 16, [-0.74, 0.44, 0], accent, { z: Math.PI / 2 });
    addCylinder(group, 0.1, 0.1, 0.22, 16, [0.74, 0.44, 0], accent, { z: Math.PI / 2 });
    addFeet(group, 0.52, 0.22, accent, 0.05);
    return group;
};
const createDiffuserMesh = (selected, levelHeight) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xf8fafc, PAINT, selected);
    const accent = createMaterial(0xcbd5e1, METAL, selected);
    const y = Math.max(2.34, levelHeight - 0.12);
    addBox(group, [0.42, 0.022, 0.42], [0, y, 0], shell);
    addBox(group, [0.3, 0.014, 0.3], [0, y - 0.015, 0], accent);
    addBox(group, [0.22, 0.01, 0.02], [0, y - 0.008, 0], accent);
    addBox(group, [0.02, 0.01, 0.22], [0, y - 0.008, 0], accent);
    addBox(group, [0.14, 0.008, 0.14], [0, y - 0.02, 0], shell);
    addCylinder(group, 0.06, 0.06, 0.1, 12, [0, y - 0.065, 0], accent);
    return group;
};
const createFanCoilMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xf1f5f9, PAINT, selected);
    const accent = createMaterial(0xcbd5e1, METAL, selected);
    addBox(group, [0.88, 0.36, 0.24], [0, 0.24, 0], shell);
    addFrontSlats(group, 8, 0.72, 0.24, 0.126, accent, 0.2);
    addBox(group, [0.16, 0.05, 0.02], [0.24, 0.38, 0.13], accent);
    addFeet(group, 0.24, 0.07, accent, 0.035);
    return group;
};
/** Пластинчатый водоподогреватель (СП 41-101-95, п. 4.2). */
const createHeatExchangerMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xe2e8f0, PAINT, selected);
    const plate = createMaterial(0xf8fafc, PAINT, selected);
    const accent = createMaterial(0x64748b, METAL, selected);
    addBox(group, [0.92, 0.52, 0.4], [0, 0.34, 0], shell);
    addBox(group, [0.86, 0.46, 0.03], [0, 0.34, 0.21], accent);
    for (let index = 0; index < 9; index += 1) {
        const x = -0.36 + index * 0.09;
        addBox(group, [0.02, 0.42, 0.04], [x, 0.34, 0.24], plate);
    }
    addFeet(group, 0.36, 0.14, accent, 0.05);
    [[-0.38, 0.46, -0.12], [0.38, 0.46, -0.12], [-0.38, 0.22, -0.12], [0.38, 0.22, -0.12]].forEach(([x, y, z]) => {
        addCylinder(group, 0.034, 0.034, 0.14, 12, [x, y, z], accent, { x: Math.PI / 2 });
    });
    [[-0.38, 0.46, 0.12], [0.38, 0.46, 0.12], [-0.38, 0.22, 0.12], [0.38, 0.22, 0.12]].forEach(([x, y, z]) => {
        addCylinder(group, 0.034, 0.034, 0.14, 12, [x, y, z], accent, { x: Math.PI / 2 });
    });
    return group;
};
/** Водоструйный элеватор (СП 41-101-95, п. 4.4). */
const createElevatorMesh = (selected) => {
    const group = new THREE.Group();
    const body = createMaterial(0x0f766e, PAINT, selected);
    const metal = createMaterial(0x94a3b8, METAL, selected);
    const dark = createMaterial(0x334155, PLASTIC, selected);
    addCylinder(group, 0.11, 0.13, 0.62, 16, [0, 0.38, 0], body);
    addCylinder(group, 0.15, 0.11, 0.16, 16, [0, 0.72, 0], metal);
    addCylinder(group, 0.045, 0.02, 0.12, 12, [0, 0.8, 0], dark);
    addCylinder(group, 0.04, 0.04, 0.22, 12, [-0.2, 0.38, 0], metal, { z: Math.PI / 2 });
    addCylinder(group, 0.04, 0.04, 0.22, 12, [0.2, 0.38, 0], metal, { z: Math.PI / 2 });
    addBox(group, [0.28, 0.06, 0.18], [0, 0.05, 0], metal);
    return group;
};
/** Мембранный расширительный бак (СП 41-101-95, п. 4.5). */
const createExpansionTankMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0x6366f1, PAINT, selected);
    const accent = createMaterial(0xcbd5e1, METAL, selected);
    const support = createMaterial(0x475569, METAL, selected);
    addCylinder(group, 0.2, 0.2, 0.56, 20, [0, 0.38, 0], shell, { z: Math.PI / 2 });
    addBox(group, [0.08, 0.24, 0.12], [-0.22, 0.22, 0], support);
    addBox(group, [0.08, 0.24, 0.12], [0.22, 0.22, 0], support);
    addCylinder(group, 0.028, 0.028, 0.12, 12, [0, 0.52, 0], accent);
    addBox(group, [0.14, 0.04, 0.14], [0, 0.58, 0], accent);
    return group;
};
/** Магнитный грязевик (СП 41-101-95, п. 4.6). */
const createDirtSeparatorMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0x78716c, PAINT, selected);
    const accent = createMaterial(0xcbd5e1, METAL, selected);
    const cone = createMaterial(0x57534e, PAINT, selected);
    addCylinder(group, 0.14, 0.14, 0.52, 18, [0, 0.38, 0], shell);
    addCylinder(group, 0.16, 0.12, 0.1, 16, [0, 0.66, 0], accent);
    addCylinder(group, 0.08, 0.02, 0.14, 12, [0, 0.08, 0], cone);
    addCylinder(group, 0.038, 0.038, 0.18, 12, [-0.2, 0.38, 0], accent, { z: Math.PI / 2 });
    addCylinder(group, 0.038, 0.038, 0.18, 12, [0.2, 0.38, 0], accent, { z: Math.PI / 2 });
    addBox(group, [0.22, 0.06, 0.16], [0, 0.05, 0], accent);
    addCylinder(group, 0.02, 0.02, 0.08, 8, [0, 0.72, 0.1], accent);
    return group;
};
const createGenericEquipmentMesh = (selected) => {
    const group = new THREE.Group();
    const shell = createMaterial(0x64748b, PAINT, selected);
    const accent = createMaterial(0xcbd5e1, METAL, selected);
    addBox(group, [0.48, 0.4, 0.28], [0, 0.24, 0], shell);
    addBox(group, [0.28, 0.14, 0.02], [0, 0.28, 0.15], accent);
    addFeet(group, 0.14, 0.07, accent, 0.035);
    return group;
};
export const createEquipmentVisual = (item, options) => {
    if (options.simplified) {
        return createGenericEquipmentMesh(options.selected);
    }
    switch (item.type) {
        case "radiator":
            return createRadiatorMesh(options.selected);
        case "boiler":
            return createBoilerMesh(options.selected);
        case "pump":
            return createPumpMesh(options.selected);
        case "ahu":
            return createAhuMesh(options.selected);
        case "diffuser":
            return createDiffuserMesh(options.selected, options.levelHeight);
        case "fancoil":
            return createFanCoilMesh(options.selected);
        case "heat_exchanger":
            return createHeatExchangerMesh(options.selected);
        case "elevator":
            return createElevatorMesh(options.selected);
        case "expansion_tank":
            return createExpansionTankMesh(options.selected);
        case "dirt_separator":
            return createDirtSeparatorMesh(options.selected);
        case "sensor":
            return createGenericEquipmentMesh(options.selected);
        default:
            return createGenericEquipmentMesh(options.selected);
    }
};
export const createSensorVisual = (sensor, options) => {
    const group = new THREE.Group();
    const shell = createMaterial(0xe2e8f0, PLASTIC, options.selected);
    const accent = createMaterial(0x94a3b8, METAL, options.selected);
    const indicator = createMaterial(sensor.status === "alarm" ? 0xdc2626 : sensor.status === "warning" ? 0xf59e0b : 0x0ea5e9, PLASTIC, options.selected);
    addCylinder(group, 0.012, 0.012, 0.12, 8, [0, -0.08, 0], accent);
    addBox(group, [0.14, 0.06, 0.09], [0, 0, 0], shell);
    addBox(group, [0.09, 0.024, 0.018], [0, 0.008, 0.052], accent);
    addCylinder(group, 0.014, 0.014, 0.022, 10, [0.036, 0.008, 0.056], indicator, { x: Math.PI / 2 });
    return group;
};
export const getEquipmentWorldConnectionPoint = (item, networkKind, levelElevation, levelHeight, targetPoint) => {
    const targetX = targetPoint?.x ?? item.position.x;
    const targetY = targetPoint?.y ?? item.position.y;
    const sideX = targetX >= item.position.x ? 1 : -1;
    const sideZ = targetY >= item.position.y ? 1 : -1;
    if (networkKind === "duct") {
        if (item.type === "diffuser") {
            return new THREE.Vector3(item.position.x, levelElevation + Math.max(2.34, levelHeight - 0.12), item.position.y);
        }
        if (item.type === "ahu" || item.type === "fancoil") {
            return new THREE.Vector3(item.position.x + sideX * (item.type === "ahu" ? 0.66 : 0.44), levelElevation + (item.type === "ahu" ? 0.44 : 0.26), item.position.y);
        }
        return new THREE.Vector3(item.position.x, levelElevation + Math.max(1.8, levelHeight - 0.35), item.position.y);
    }
    switch (item.type) {
        case "radiator":
            return new THREE.Vector3(item.position.x + sideX * 0.34, levelElevation + 0.12, item.position.y + 0.11);
        case "boiler":
            return new THREE.Vector3(item.position.x + sideX * 0.2, levelElevation + 0.12, item.position.y + 0.22 * sideZ);
        case "pump":
            return new THREE.Vector3(item.position.x + sideX * 0.28, levelElevation + 0.22, item.position.y);
        case "heat_exchanger":
            return new THREE.Vector3(item.position.x + sideX * 0.42, levelElevation + 0.46, item.position.y + sideZ * 0.14);
        case "elevator":
            return new THREE.Vector3(item.position.x + sideX * 0.24, levelElevation + 0.38, item.position.y);
        case "expansion_tank":
            return new THREE.Vector3(item.position.x, levelElevation + 0.52, item.position.y + sideZ * 0.12);
        case "dirt_separator":
            return new THREE.Vector3(item.position.x + sideX * 0.22, levelElevation + 0.38, item.position.y);
        case "ahu":
            return new THREE.Vector3(item.position.x + sideX * 0.18, levelElevation + 0.24, item.position.y + sideZ * 0.22);
        case "fancoil":
            return new THREE.Vector3(item.position.x + sideX * 0.26, levelElevation + 0.15, item.position.y + 0.1);
        case "diffuser":
            return new THREE.Vector3(item.position.x, levelElevation + Math.max(2.28, levelHeight - 0.18), item.position.y);
        default:
            return new THREE.Vector3(item.position.x + sideX * 0.18, levelElevation + 0.16, item.position.y + sideZ * 0.1);
    }
};
export const getSensorWorldPosition = (sensor, levelElevation, levelHeight) => new THREE.Vector3(sensor.position.x, levelElevation + Math.max(1.58, levelHeight - 0.62), sensor.position.y);
