import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const navWorldDir = resolve(scriptDir, "..");
const outputDir = resolve(navWorldDir, "public/models/gomoku");
const shouldCheckOnly = process.argv.includes("--check");

const modelPaths = {
  board: resolve(outputDir, "gomoku_board.glb"),
  blackStone: resolve(outputDir, "black_stone.glb"),
  whiteStone: resolve(outputDir, "white_stone.glb"),
};

const boardSpec = {
  intersections: 25,
  cellSpacing: 0.12,
  topY: 0.08,
  gridY: 0.087,
  boardBottomHalfSize: 1.6266666667,
  boardHalfSize: 1.5733333333,
  gridHalfSize: 1.44,
};

const materials = {
  wood: {
    name: "warm_wood_board",
    pbrMetallicRoughness: {
      baseColorFactor: [0.72, 0.47, 0.22, 1],
      metallicFactor: 0,
      roughnessFactor: 0.56,
    },
  },
  darkWood: {
    name: "engraved_dark_grid",
    pbrMetallicRoughness: {
      baseColorFactor: [0.11, 0.06, 0.025, 1],
      metallicFactor: 0,
      roughnessFactor: 0.62,
    },
  },
  blackStone: {
    name: "polished_black_stone",
    pbrMetallicRoughness: {
      baseColorFactor: [0.005, 0.005, 0.007, 1],
      metallicFactor: 0,
      roughnessFactor: 0.28,
    },
  },
  whiteStone: {
    name: "ivory_white_stone",
    pbrMetallicRoughness: {
      baseColorFactor: [0.92, 0.88, 0.78, 1],
      metallicFactor: 0,
      roughnessFactor: 0.34,
    },
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

  builder.indices.push(
    baseIndex,
    baseIndex + 1,
    baseIndex + 2,
    baseIndex,
    baseIndex + 2,
    baseIndex + 3,
  );
}

function appendBox(builder, center, size) {
  const [cx, cy, cz] = center;
  const [sx, sy, sz] = size;
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const z0 = cz - sz / 2;
  const z1 = cz + sz / 2;

  appendQuad(builder, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
  appendQuad(builder, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
  appendQuad(builder, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
  appendQuad(builder, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
  appendQuad(builder, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
  appendQuad(builder, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
}

function appendBeveledSlab(builder, halfBottom, halfTop, y0, y1) {
  appendQuad(builder, [-halfTop, y1, halfTop], [halfTop, y1, halfTop], [halfTop, y1, -halfTop], [-halfTop, y1, -halfTop]);
  appendQuad(builder, [-halfBottom, y0, -halfBottom], [halfBottom, y0, -halfBottom], [halfBottom, y0, halfBottom], [-halfBottom, y0, halfBottom]);
  appendQuad(builder, [halfBottom, y0, halfBottom], [halfBottom, y0, -halfBottom], [halfTop, y1, -halfTop], [halfTop, y1, halfTop]);
  appendQuad(builder, [-halfBottom, y0, -halfBottom], [-halfBottom, y0, halfBottom], [-halfTop, y1, halfTop], [-halfTop, y1, -halfTop]);
  appendQuad(builder, [-halfBottom, y0, halfBottom], [halfBottom, y0, halfBottom], [halfTop, y1, halfTop], [-halfTop, y1, halfTop]);
  appendQuad(builder, [halfBottom, y0, -halfBottom], [-halfBottom, y0, -halfBottom], [-halfTop, y1, -halfTop], [halfTop, y1, -halfTop]);
}

function appendCylinder(builder, center, radius, height, segments) {
  const [cx, cy, cz] = center;
  const y0 = cy - height / 2;
  const y1 = cy + height / 2;
  const topCenter = builder.positions.length / 3;

  builder.positions.push(cx, y1, cz);
  builder.normals.push(0, 1, 0);

  const bottomCenter = builder.positions.length / 3;
  builder.positions.push(cx, y0, cz);
  builder.normals.push(0, -1, 0);

  const topRing = [];
  const bottomRing = [];

  for (let index = 0; index < segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    const sideNormal = normalize([x - cx, 0, z - cz]);

    topRing.push(builder.positions.length / 3);
    builder.positions.push(x, y1, z);
    builder.normals.push(0, 1, 0);

    bottomRing.push(builder.positions.length / 3);
    builder.positions.push(x, y0, z);
    builder.normals.push(0, -1, 0);

    topRing.push(builder.positions.length / 3);
    builder.positions.push(x, y1, z);
    builder.normals.push(...sideNormal);

    bottomRing.push(builder.positions.length / 3);
    builder.positions.push(x, y0, z);
    builder.normals.push(...sideNormal);
  }

  for (let index = 0; index < segments; index += 1) {
    const nextIndex = (index + 1) % segments;
    const topFlat = topRing[index * 2];
    const bottomFlat = bottomRing[index * 2];
    const topSide = topRing[index * 2 + 1];
    const bottomSide = bottomRing[index * 2 + 1];
    const nextTopFlat = topRing[nextIndex * 2];
    const nextBottomFlat = bottomRing[nextIndex * 2];
    const nextTopSide = topRing[nextIndex * 2 + 1];
    const nextBottomSide = bottomRing[nextIndex * 2 + 1];

    builder.indices.push(topCenter, nextTopFlat, topFlat);
    builder.indices.push(bottomCenter, bottomFlat, nextBottomFlat);
    builder.indices.push(bottomSide, nextBottomSide, nextTopSide, bottomSide, nextTopSide, topSide);
  }
}

function appendStone(builder, profile, segments) {
  const firstRingY = profile[0].y;
  const lastRingY = profile.at(-1).y;
  const vertexCount = profile.length * segments + 2;
  const smoothNormals = Array.from({ length: vertexCount }, () => [0, 0, 0]);
  const ringIndices = [];

  for (const ring of profile) {
    const currentRing = [];

    for (let index = 0; index < segments; index += 1) {
      const angle = (Math.PI * 2 * index) / segments;
      const vertexIndex = builder.positions.length / 3;
      const x = Math.cos(angle) * ring.radius;
      const z = Math.sin(angle) * ring.radius;

      builder.positions.push(x, ring.y, z);
      builder.normals.push(0, 1, 0);
      currentRing.push(vertexIndex);
    }

    ringIndices.push(currentRing);
  }

  const bottomCenterIndex = builder.positions.length / 3;
  builder.positions.push(0, firstRingY, 0);
  builder.normals.push(0, -1, 0);

  const topCenterIndex = builder.positions.length / 3;
  builder.positions.push(0, lastRingY + 0.002, 0);
  builder.normals.push(0, 1, 0);

  const localBase = builder.positions.length / 3 - vertexCount;
  const localFaces = [];

  for (let ringIndex = 0; ringIndex < ringIndices.length - 1; ringIndex += 1) {
    const currentRing = ringIndices[ringIndex];
    const nextRing = ringIndices[ringIndex + 1];

    for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
      const nextSegmentIndex = (segmentIndex + 1) % segments;
      const a = currentRing[segmentIndex];
      const b = nextRing[segmentIndex];
      const c = nextRing[nextSegmentIndex];
      const d = currentRing[nextSegmentIndex];

      builder.indices.push(a, b, c, a, c, d);
      localFaces.push([a, b, c], [a, c, d]);
    }
  }

  const bottomRing = ringIndices[0];
  const topRing = ringIndices.at(-1);

  for (let segmentIndex = 0; segmentIndex < segments; segmentIndex += 1) {
    const nextSegmentIndex = (segmentIndex + 1) % segments;
    const bottomA = bottomRing[segmentIndex];
    const bottomB = bottomRing[nextSegmentIndex];
    const topA = topRing[segmentIndex];
    const topB = topRing[nextSegmentIndex];

    builder.indices.push(bottomCenterIndex, bottomA, bottomB);
    builder.indices.push(topCenterIndex, topB, topA);
    localFaces.push([bottomCenterIndex, bottomA, bottomB], [topCenterIndex, topB, topA]);
  }

  for (const face of localFaces) {
    const [a, b, c] = face;
    const aPosition = readPosition(builder.positions, a);
    const bPosition = readPosition(builder.positions, b);
    const cPosition = readPosition(builder.positions, c);
    const normal = normalize(cross(subtract(bPosition, aPosition), subtract(cPosition, aPosition)));

    for (const vertexIndex of face) {
      const localIndex = vertexIndex - localBase;

      smoothNormals[localIndex][0] += normal[0];
      smoothNormals[localIndex][1] += normal[1];
      smoothNormals[localIndex][2] += normal[2];
    }
  }

  for (let localIndex = 0; localIndex < smoothNormals.length; localIndex += 1) {
    const normal = normalize(smoothNormals[localIndex]);
    const normalOffset = (localBase + localIndex) * 3;

    builder.normals[normalOffset] = normal[0];
    builder.normals[normalOffset + 1] = normal[1];
    builder.normals[normalOffset + 2] = normal[2];
  }
}

function readPosition(positions, vertexIndex) {
  const offset = vertexIndex * 3;

  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function createBoardMeshes() {
  const slab = createMeshBuilder();
  appendBeveledSlab(
    slab,
    boardSpec.boardBottomHalfSize,
    boardSpec.boardHalfSize,
    0,
    boardSpec.topY,
  );

  const grid = createMeshBuilder();
  const lineWidth = 0.008;
  const lineHeight = 0.008;
  const gridLength = boardSpec.gridHalfSize * 2;

  for (let index = 0; index < boardSpec.intersections; index += 1) {
    const offset = (index - (boardSpec.intersections - 1) / 2) * boardSpec.cellSpacing;
    appendBox(grid, [offset, boardSpec.gridY, 0], [lineWidth, lineHeight, gridLength + lineWidth]);
    appendBox(grid, [0, boardSpec.gridY, offset], [gridLength + lineWidth, lineHeight, lineWidth]);
  }

  const rim = createMeshBuilder();
  const rimY = boardSpec.topY + 0.018;
  const rimHeight = 0.035;
  const rimWidth = 0.047;
  const rimLength = boardSpec.boardHalfSize * 2;

  appendBox(rim, [0, rimY, boardSpec.boardHalfSize - rimWidth / 2], [rimLength, rimHeight, rimWidth]);
  appendBox(rim, [0, rimY, -boardSpec.boardHalfSize + rimWidth / 2], [rimLength, rimHeight, rimWidth]);
  appendBox(rim, [boardSpec.boardHalfSize - rimWidth / 2, rimY, 0], [rimWidth, rimHeight, rimLength]);
  appendBox(rim, [-boardSpec.boardHalfSize + rimWidth / 2, rimY, 0], [rimWidth, rimHeight, rimLength]);

  const starPoints = createMeshBuilder();
  const starIndices = [4, 12, 20];

  for (const row of starIndices) {
    for (const col of starIndices) {
      const x = (col - (boardSpec.intersections - 1) / 2) * boardSpec.cellSpacing;
      const z = (row - (boardSpec.intersections - 1) / 2) * boardSpec.cellSpacing;

      appendCylinder(starPoints, [x, boardSpec.gridY + 0.006, z], 0.021, 0.012, 24);
    }
  }

  return [
    {
      name: "BoardSlab",
      material: 0,
      mesh: slab,
    },
    {
      name: "GridLines",
      material: 1,
      mesh: grid,
    },
    {
      name: "BoardRim",
      material: 1,
      mesh: rim,
    },
    {
      name: "StarPoints",
      material: 1,
      mesh: starPoints,
    },
  ];
}

function createStoneMesh() {
  const stone = createMeshBuilder();

  appendStone(
    stone,
    [
      { y: 0, radius: 0.052 },
      { y: 0.004, radius: 0.068 },
      { y: 0.015, radius: 0.08 },
      { y: 0.03, radius: 0.078 },
      { y: 0.044, radius: 0.052 },
      { y: 0.052, radius: 0.018 },
    ],
    48,
  );

  return stone;
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
      generator: "gluepudding generate-gomoku-models.mjs",
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

function createBoardGlb() {
  const meshes = createBoardMeshes();

  return buildGlb({
    extras: {
      kind: "gomoku_board",
      intersections: boardSpec.intersections,
      cellSpacingMeters: boardSpec.cellSpacing,
      gridOrigin: [-boardSpec.gridHalfSize, boardSpec.gridY, -boardSpec.gridHalfSize],
      boardTopY: boardSpec.topY,
      intendedUse: "floor_spawned_world_gomoku",
    },
    materials: [materials.wood, materials.darkWood],
    meshes,
    nodes: [
      {
        name: "GomokuBoardRoot",
        children: [1, 2, 3, 4],
      },
      {
        name: "BoardSlab",
        mesh: 0,
      },
      {
        name: "GridLines",
        mesh: 1,
      },
      {
        name: "BoardRim",
        mesh: 2,
      },
      {
        name: "StarPoints",
        mesh: 3,
      },
    ],
    sceneNodes: [0],
  });
}

function createStoneGlb(kind, material) {
  return buildGlb({
    extras: {
      kind,
      bottomCenterOrigin: true,
      diameterMeters: 0.16,
      heightMeters: 0.054,
      intendedUse: "world_gomoku_piece",
    },
    materials: [material],
    meshes: [
      {
        name: kind === "black_stone" ? "BlackStone" : "WhiteStone",
        material: 0,
        mesh: createStoneMesh(),
      },
    ],
    nodes: [
      {
        name: kind === "black_stone" ? "BlackStoneRoot" : "WhiteStoneRoot",
        mesh: 0,
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
  const expectedKinds = {
    [modelPaths.board]: "gomoku_board",
    [modelPaths.blackStone]: "black_stone",
    [modelPaths.whiteStone]: "white_stone",
  };

  for (const [filePath, expectedKind] of Object.entries(expectedKinds)) {
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

      if (gltf.extras?.kind !== expectedKind) {
        errors.push(`${filePath} has unexpected kind: ${gltf.extras?.kind ?? "missing"}`);
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

  return errors;
}

if (shouldCheckOnly) {
  const errors = validateGeneratedModels();

  if (errors.length > 0) {
    console.error("Gomoku model check failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Gomoku model check passed.");
  process.exit(0);
}

mkdirSync(dirname(modelPaths.board), { recursive: true });

writeFileSync(modelPaths.board, createBoardGlb());
writeFileSync(modelPaths.blackStone, createStoneGlb("black_stone", materials.blackStone));
writeFileSync(modelPaths.whiteStone, createStoneGlb("white_stone", materials.whiteStone));

for (const filePath of Object.values(modelPaths)) {
  const { size } = statSync(filePath);
  console.log(`Generated ${filePath} (${(size / 1024).toFixed(1)} KB).`);
}
