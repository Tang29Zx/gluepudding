import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const projectRoot = resolve(navWorldDir, "../..");
const sourceDir = resolve(projectRoot, "resources/laboratory");
const outputDir = resolve(navWorldDir, "public/models/laboratory");
const shouldCheckOnly = process.argv.includes("--check");

const modelPaths = {
  dome: resolve(outputDir, "dome.glb"),
  glassFloor: resolve(outputDir, "glass_floor.glb"),
  teleporter: resolve(outputDir, "teleporter.glb"),
};

const sourceModelPaths = {
  dome: resolve(sourceDir, "sci-_fi__future_building_2_simple_dome.glb"),
  teleporter: resolve(sourceDir, "sci-fi_teleporter.glb"),
};

const floorSpec = {
  radius: 2.24,
  glassRadius: 2.08,
  glassTopY: 0.018,
  glassBottomY: -0.04,
  walkableTopY: 0.018,
  segments: 96,
  radialBeams: 12,
};

const materials = {
  glass: {
    name: "aerial_lab_blue_tinted_glass",
    alphaMode: "BLEND",
    doubleSided: true,
    pbrMetallicRoughness: {
      baseColorFactor: [0.43, 0.78, 1, 0.34],
      metallicFactor: 0,
      roughnessFactor: 0.06,
    },
  },
  metal: {
    name: "brushed_dark_titanium",
    pbrMetallicRoughness: {
      baseColorFactor: [0.11, 0.13, 0.15, 1],
      metallicFactor: 0.82,
      roughnessFactor: 0.32,
    },
  },
  glow: {
    name: "cyan_floor_edge_light",
    pbrMetallicRoughness: {
      baseColorFactor: [0.18, 0.84, 1, 1],
      metallicFactor: 0,
      roughnessFactor: 0.18,
    },
    emissiveFactor: [0.06, 0.52, 0.78],
  },
};

function padToFourBytes(buffer, padByte) {
  const paddingLength = (4 - (buffer.length % 4)) % 4;

  if (paddingLength === 0) {
    return buffer;
  }

  return Buffer.concat([buffer, Buffer.alloc(paddingLength, padByte)]);
}

function vec3Min(values) {
  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];

  for (let index = 0; index < values.length; index += 3) {
    min[0] = Math.min(min[0], values[index]);
    min[1] = Math.min(min[1], values[index + 1]);
    min[2] = Math.min(min[2], values[index + 2]);
  }

  return min;
}

function vec3Max(values) {
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let index = 0; index < values.length; index += 3) {
    max[0] = Math.max(max[0], values[index]);
    max[1] = Math.max(max[1], values[index + 1]);
    max[2] = Math.max(max[2], values[index + 2]);
  }

  return max;
}

function subtract(left, right) {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    return [0, 1, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function createMeshBuilder() {
  return {
    positions: [],
    normals: [],
    indices: [],
  };
}

function appendQuad(builder, a, b, c, d) {
  const baseIndex = builder.positions.length / 3;
  const normal = normalize(cross(subtract(b, a), subtract(c, a)));

  for (const vertex of [a, b, c, d]) {
    builder.positions.push(...vertex);
    builder.normals.push(...normal);
  }

  builder.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
}

function appendDiscSlab(builder, radius, y0, y1, segments) {
  const topCenter = builder.positions.length / 3;
  builder.positions.push(0, y1, 0);
  builder.normals.push(0, 1, 0);

  const bottomCenter = builder.positions.length / 3;
  builder.positions.push(0, y0, 0);
  builder.normals.push(0, -1, 0);

  const topFlat = [];
  const bottomFlat = [];
  const topSide = [];
  const bottomSide = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const sideNormal = normalize([x, 0, z]);

    topFlat.push(builder.positions.length / 3);
    builder.positions.push(x, y1, z);
    builder.normals.push(0, 1, 0);

    bottomFlat.push(builder.positions.length / 3);
    builder.positions.push(x, y0, z);
    builder.normals.push(0, -1, 0);

    topSide.push(builder.positions.length / 3);
    builder.positions.push(x, y1, z);
    builder.normals.push(...sideNormal);

    bottomSide.push(builder.positions.length / 3);
    builder.positions.push(x, y0, z);
    builder.normals.push(...sideNormal);
  }

  for (let index = 0; index < segments; index += 1) {
    const nextIndex = (index + 1) % segments;

    builder.indices.push(topCenter, topFlat[index], topFlat[nextIndex]);
    builder.indices.push(bottomCenter, bottomFlat[nextIndex], bottomFlat[index]);
    builder.indices.push(
      bottomSide[index],
      bottomSide[nextIndex],
      topSide[nextIndex],
      bottomSide[index],
      topSide[nextIndex],
      topSide[index],
    );
  }
}

function appendAnnularSlab(builder, innerRadius, outerRadius, y0, y1, segments) {
  const rings = {
    topInner: [],
    topOuter: [],
    bottomInner: [],
    bottomOuter: [],
  };

  for (let index = 0; index < segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (const [key, radius, y, normal] of [
      ["topInner", innerRadius, y1, [0, 1, 0]],
      ["topOuter", outerRadius, y1, [0, 1, 0]],
      ["bottomInner", innerRadius, y0, [0, -1, 0]],
      ["bottomOuter", outerRadius, y0, [0, -1, 0]],
    ]) {
      rings[key].push(builder.positions.length / 3);
      builder.positions.push(cos * radius, y, sin * radius);
      builder.normals.push(...normal);
    }
  }

  for (let index = 0; index < segments; index += 1) {
    const nextIndex = (index + 1) % segments;
    const outerNormal = normalize([
      Math.cos((Math.PI * 2 * (index + 0.5)) / segments),
      0,
      Math.sin((Math.PI * 2 * (index + 0.5)) / segments),
    ]);
    const innerNormal = [-outerNormal[0], 0, -outerNormal[2]];

    appendQuadByIndices(builder, rings.topInner[index], rings.topOuter[index], rings.topOuter[nextIndex], rings.topInner[nextIndex]);
    appendQuadByIndices(builder, rings.bottomOuter[index], rings.bottomInner[index], rings.bottomInner[nextIndex], rings.bottomOuter[nextIndex]);
    appendDetachedQuad(builder, rings.bottomOuter[index], rings.bottomOuter[nextIndex], rings.topOuter[nextIndex], rings.topOuter[index], outerNormal);
    appendDetachedQuad(builder, rings.bottomInner[nextIndex], rings.bottomInner[index], rings.topInner[index], rings.topInner[nextIndex], innerNormal);
  }
}

function appendQuadByIndices(builder, a, b, c, d) {
  builder.indices.push(a, b, c, a, c, d);
}

function appendDetachedQuad(builder, aIndex, bIndex, cIndex, dIndex, normal) {
  const baseIndex = builder.positions.length / 3;

  for (const index of [aIndex, bIndex, cIndex, dIndex]) {
    const offset = index * 3;

    builder.positions.push(builder.positions[offset], builder.positions[offset + 1], builder.positions[offset + 2]);
    builder.normals.push(...normal);
  }

  builder.indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
}

function appendOrientedBox(builder, center, length, width, height, angle) {
  const [cx, cy, cz] = center;
  const forward = [Math.cos(angle), 0, Math.sin(angle)];
  const right = [-Math.sin(angle), 0, Math.cos(angle)];
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const halfHeight = height / 2;

  function point(lengthSign, widthSign, heightSign) {
    return [
      cx + forward[0] * halfLength * lengthSign + right[0] * halfWidth * widthSign,
      cy + halfHeight * heightSign,
      cz + forward[2] * halfLength * lengthSign + right[2] * halfWidth * widthSign,
    ];
  }

  const p000 = point(-1, -1, -1);
  const p001 = point(-1, -1, 1);
  const p010 = point(-1, 1, -1);
  const p011 = point(-1, 1, 1);
  const p100 = point(1, -1, -1);
  const p101 = point(1, -1, 1);
  const p110 = point(1, 1, -1);
  const p111 = point(1, 1, 1);

  appendQuad(builder, p011, p111, p101, p001);
  appendQuad(builder, p000, p100, p110, p010);
  appendQuad(builder, p101, p100, p000, p001);
  appendQuad(builder, p010, p110, p111, p011);
  appendQuad(builder, p110, p100, p101, p111);
  appendQuad(builder, p000, p010, p011, p001);
}

function createGlassFloorMeshes() {
  const glass = createMeshBuilder();
  appendDiscSlab(glass, floorSpec.glassRadius, floorSpec.glassBottomY, floorSpec.glassTopY, floorSpec.segments);

  const metal = createMeshBuilder();
  appendAnnularSlab(metal, 2.09, floorSpec.radius, -0.09, 0.035, floorSpec.segments);
  appendAnnularSlab(metal, 0.34, 0.48, -0.07, 0.01, floorSpec.segments);
  appendAnnularSlab(metal, 1.2, 1.24, -0.06, -0.005, floorSpec.segments);

  for (let index = 0; index < floorSpec.radialBeams; index += 1) {
    const angle = (Math.PI * 2 * index) / floorSpec.radialBeams;
    const beamLength = 1.58;
    const centerRadius = 1.25;

    appendOrientedBox(
      metal,
      [Math.cos(angle) * centerRadius, -0.048, Math.sin(angle) * centerRadius],
      beamLength,
      0.055,
      0.06,
      angle,
    );
  }

  const glow = createMeshBuilder();
  appendAnnularSlab(glow, 2.015, 2.045, 0.021, 0.026, floorSpec.segments);
  appendAnnularSlab(glow, 0.68, 0.705, 0.022, 0.027, floorSpec.segments);
  appendAnnularSlab(glow, 1.42, 1.445, 0.022, 0.027, floorSpec.segments);

  for (let index = 0; index < floorSpec.radialBeams; index += 1) {
    const angle = (Math.PI * 2 * index) / floorSpec.radialBeams;
    const stripLength = 1.52;
    const centerRadius = 1.31;

    appendOrientedBox(
      glow,
      [Math.cos(angle) * centerRadius, 0.028, Math.sin(angle) * centerRadius],
      stripLength,
      0.018,
      0.006,
      angle,
    );
  }

  return [
    {
      name: "TransparentGlassDeck",
      material: 0,
      mesh: glass,
    },
    {
      name: "TitaniumSupportFrame",
      material: 1,
      mesh: metal,
    },
    {
      name: "CyanGuideLights",
      material: 2,
      mesh: glow,
    },
  ];
}

function buildGlb({ extras, materials: documentMaterials, nodes, meshes, sceneNodes }) {
  const buffers = [];
  const bufferViews = [];
  const accessors = [];
  let byteOffset = 0;

  function addBufferView(buffer, target) {
    const alignedOffset = Math.ceil(byteOffset / 4) * 4;
    const paddingLength = alignedOffset - byteOffset;

    if (paddingLength > 0) {
      buffers.push(Buffer.alloc(paddingLength));
      byteOffset = alignedOffset;
    }

    const bufferView = {
      buffer: 0,
      byteOffset,
      byteLength: buffer.length,
      target,
    };

    buffers.push(buffer);
    bufferViews.push(bufferView);
    byteOffset += buffer.length;

    return bufferViews.length - 1;
  }

  function addFloatAccessor(values, type) {
    const typedValues = Float32Array.from(values);
    const buffer = Buffer.from(typedValues.buffer);
    const bufferViewIndex = addBufferView(buffer, 34962);
    const accessor = {
      bufferView: bufferViewIndex,
      componentType: 5126,
      count: values.length / 3,
      type,
    };

    if (type === "VEC3") {
      accessor.min = vec3Min(values);
      accessor.max = vec3Max(values);
    }

    accessors.push(accessor);

    return accessors.length - 1;
  }

  function addIndexAccessor(values) {
    const typedValues = Uint16Array.from(values);
    const buffer = Buffer.from(typedValues.buffer);
    const bufferViewIndex = addBufferView(buffer, 34963);

    accessors.push({
      bufferView: bufferViewIndex,
      componentType: 5123,
      count: values.length,
      type: "SCALAR",
      min: [Math.min(...values)],
      max: [Math.max(...values)],
    });

    return accessors.length - 1;
  }

  const gltfMeshes = meshes.map((meshDef) => {
    const positionAccessor = addFloatAccessor(meshDef.mesh.positions, "VEC3");
    const normalAccessor = addFloatAccessor(meshDef.mesh.normals, "VEC3");
    const indexAccessor = addIndexAccessor(meshDef.mesh.indices);

    return {
      name: meshDef.name,
      primitives: [
        {
          attributes: {
            POSITION: positionAccessor,
            NORMAL: normalAccessor,
          },
          indices: indexAccessor,
          material: meshDef.material,
        },
      ],
    };
  });

  const binaryChunk = padToFourBytes(Buffer.concat(buffers), 0);
  const gltf = {
    asset: {
      version: "2.0",
      generator: "gluepudding generate-laboratory-models.mjs",
    },
    extras,
    scene: 0,
    scenes: [
      {
        name: "Scene",
        nodes: sceneNodes,
      },
    ],
    nodes,
    meshes: gltfMeshes,
    materials: documentMaterials,
    buffers: [
      {
        byteLength: binaryChunk.length,
      },
    ],
    bufferViews,
    accessors,
  };

  const jsonChunk = padToFourBytes(Buffer.from(JSON.stringify(gltf)), 0x20);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + binaryChunk.length;
  const header = Buffer.alloc(12);

  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binaryChunk.length, 0);
  binaryHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonChunk, binaryHeader, binaryChunk]);
}

function createGlassFloorGlb() {
  const meshes = createGlassFloorMeshes();

  return buildGlb({
    extras: {
      kind: "laboratory_glass_floor",
      radiusMeters: floorSpec.radius,
      glassRadiusMeters: floorSpec.glassRadius,
      walkableTopY: floorSpec.walkableTopY,
      intendedUse: "aerial_laboratory_floor_under_simple_dome",
      matchingReference: "resources/laboratory/sci-_fi__future_building_2_simple_dome.glb",
    },
    materials: [materials.glass, materials.metal, materials.glow],
    meshes,
    nodes: [
      {
        name: "LaboratoryGlassFloorRoot",
        children: [1, 2, 3],
      },
      {
        name: "TransparentGlassDeck",
        mesh: 0,
      },
      {
        name: "TitaniumSupportFrame",
        mesh: 1,
      },
      {
        name: "CyanGuideLights",
        mesh: 2,
      },
    ],
    sceneNodes: [0],
  });
}

function parseGlb(filePath) {
  const buffer = readFileSync(filePath);

  if (buffer.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`Invalid GLB magic in ${filePath}`);
  }

  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error(`Invalid GLB version in ${filePath}`);
  }

  const totalLength = buffer.readUInt32LE(8);

  if (totalLength !== buffer.length) {
    throw new Error(`Invalid GLB length in ${filePath}`);
  }

  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);

  if (jsonType !== 0x4e4f534a) {
    throw new Error(`Missing JSON chunk in ${filePath}`);
  }

  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonLength;
  const json = JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString("utf8").trim());
  const binLength = buffer.readUInt32LE(jsonEnd);
  const binType = buffer.readUInt32LE(jsonEnd + 4);

  if (binType !== 0x004e4942) {
    throw new Error(`Missing BIN chunk in ${filePath}`);
  }

  if (jsonEnd + 8 + binLength !== buffer.length) {
    throw new Error(`Invalid BIN chunk length in ${filePath}`);
  }

  return json;
}

function validateGeneratedModels() {
  const errors = [];

  for (const filePath of Object.values(modelPaths)) {
    if (!existsSync(filePath)) {
      errors.push(`Missing ${filePath}`);
      continue;
    }

    try {
      const gltf = parseGlb(filePath);
      const { size } = statSync(filePath);

      if (gltf.asset?.version !== "2.0") {
        errors.push(`${filePath} is not glTF 2.0`);
      }

      if (!Array.isArray(gltf.meshes) || gltf.meshes.length === 0) {
        errors.push(`${filePath} has no meshes`);
      }

      if (!Array.isArray(gltf.materials) || gltf.materials.length === 0) {
        errors.push(`${filePath} has no materials`);
      }

      if (size <= 1024) {
        errors.push(`${filePath} is unexpectedly small`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  try {
    const gltf = parseGlb(modelPaths.glassFloor);

    if (gltf.extras?.kind !== "laboratory_glass_floor") {
      errors.push(`${modelPaths.glassFloor} has unexpected kind: ${gltf.extras?.kind ?? "missing"}`);
    }

    if (gltf.meshes?.length !== 3) {
      errors.push(`${modelPaths.glassFloor} should contain 3 meshes`);
    }

    if (gltf.materials?.length !== 3) {
      errors.push(`${modelPaths.glassFloor} should contain 3 materials`);
    }

    if (gltf.materials?.[0]?.alphaMode !== "BLEND") {
      errors.push(`${modelPaths.glassFloor} glass material is not transparent`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return errors;
}

if (shouldCheckOnly) {
  const errors = validateGeneratedModels();

  if (errors.length > 0) {
    console.error("Laboratory model check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Laboratory model check passed.");
  process.exit(0);
}

mkdirSync(dirname(modelPaths.glassFloor), { recursive: true });

for (const [kind, sourcePath] of Object.entries(sourceModelPaths)) {
  if (!existsSync(sourcePath)) {
    console.error(`Missing source laboratory asset: ${sourcePath}`);
    process.exit(1);
  }

  copyFileSync(sourcePath, modelPaths[kind]);
}

writeFileSync(modelPaths.glassFloor, createGlassFloorGlb());

for (const filePath of Object.values(modelPaths)) {
  const { size } = statSync(filePath);
  console.log(`Prepared ${filePath} (${(size / 1024).toFixed(1)} KB).`);
}
