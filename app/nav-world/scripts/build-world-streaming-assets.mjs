import { Accessor, NodeIO, Primitive } from "@gltf-transform/core";
import {
  EXTMeshoptCompression,
  KHRLightsPunctual,
  KHRMeshQuantization,
} from "@gltf-transform/extensions";
import {
  compactPrimitive,
  dedup,
  meshopt,
  prune,
  simplifyPrimitive,
  sparse,
  weld,
  weldPrimitive,
} from "@gltf-transform/functions";
import {
  MeshoptEncoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import { mkdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const GROUND_NODE_NAMES = new Set(["Icosphere", "Plane"]);
const SAKURA_NODE_NAME = "Cube.008";
const SAKURA_BLOSSOM_MATERIAL_NAME = "KyodaiSakuraHana";
const HIDDEN_TERRAIN_CUTOFF_Y = 0;

const outputDefinitions = [
  { fileName: "ground.glb", kind: "ground" },
  { fileName: "central-decor.glb", kind: "decor" },
  { fileName: "sakura-tree-low.glb", kind: "sakura-low" },
  { fileName: "sakura-tree-mid.glb", kind: "sakura-mid" },
  { fileName: "sakura-tree-high.glb", kind: "sakura-high" },
];

function createIO() {
  return new NodeIO()
    .registerExtensions([
      KHRLightsPunctual,
      KHRMeshQuantization,
      EXTMeshoptCompression,
    ])
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
    });
}

function listMeshNodeNames(document) {
  return document
    .getRoot()
    .listNodes()
    .filter((node) => Boolean(node.getMesh()))
    .map((node) => node.getName());
}

function retainNodes(document, retainedNames) {
  for (const node of document.getRoot().listNodes()) {
    if (!retainedNames.has(node.getName())) {
      node.dispose();
    }
  }
}

function getWorldY(position, matrix) {
  return (
    matrix[1] * position[0] +
    matrix[5] * position[1] +
    matrix[9] * position[2] +
    matrix[13]
  );
}

function trimHiddenGround(document) {
  let keptTriangleCount = 0;
  let removedTriangleCount = 0;

  for (const node of document.getRoot().listNodes()) {
    if (!GROUND_NODE_NAMES.has(node.getName()) || !node.getMesh()) {
      continue;
    }

    const worldMatrix = node.getWorldMatrix();

    for (const primitive of node.getMesh().listPrimitives()) {
      if (primitive.getMode() !== Primitive.Mode.TRIANGLES) {
        continue;
      }

      const positions = primitive.getAttribute("POSITION");

      if (!positions) {
        continue;
      }

      const sourceIndices = primitive.getIndices();
      const sourceIndexCount = sourceIndices?.getCount() ?? positions.getCount();
      const retainedIndices = [];
      const position = [0, 0, 0];

      for (let offset = 0; offset < sourceIndexCount; offset += 3) {
        const triangleIndices = [];
        let highestWorldY = Number.NEGATIVE_INFINITY;

        for (let corner = 0; corner < 3; corner += 1) {
          const vertexOffset = offset + corner;
          const vertexIndex =
            sourceIndices?.getScalar(vertexOffset) ?? vertexOffset;
          positions.getElement(vertexIndex, position);
          highestWorldY = Math.max(
            highestWorldY,
            getWorldY(position, worldMatrix),
          );
          triangleIndices.push(vertexIndex);
        }

        if (highestWorldY >= HIDDEN_TERRAIN_CUTOFF_Y) {
          retainedIndices.push(...triangleIndices);
          keptTriangleCount += 1;
        } else {
          removedTriangleCount += 1;
        }
      }

      let highestRetainedIndex = 0;

      for (const index of retainedIndices) {
        highestRetainedIndex = Math.max(highestRetainedIndex, index);
      }

      const IndexArray =
        highestRetainedIndex <= 65_535 ? Uint16Array : Uint32Array;
      primitive.setIndices(
        document
          .createAccessor()
          .setType(Accessor.Type.SCALAR)
          .setArray(new IndexArray(retainedIndices)),
      );
      compactPrimitive(primitive);
    }
  }

  return { keptTriangleCount, removedTriangleCount };
}

function collectVoxelCenters(positionArray, cellSize) {
  const voxels = new Map();

  for (let offset = 0; offset < positionArray.length; offset += 3) {
    const x = positionArray[offset];
    const y = positionArray[offset + 1];
    const z = positionArray[offset + 2];
    const key = [
      Math.round(x / cellSize),
      Math.round(y / cellSize),
      Math.round(z / cellSize),
    ].join(":");
    const voxel = voxels.get(key) ?? { count: 0, x: 0, y: 0, z: 0 };
    voxel.count += 1;
    voxel.x += x;
    voxel.y += y;
    voxel.z += z;
    voxels.set(key, voxel);
  }

  return [...voxels.entries()].map(([key, voxel]) => ({
    key,
    x: voxel.x / voxel.count,
    y: voxel.y / voxel.count,
    z: voxel.z / voxel.count,
  }));
}

function hashString(value) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function addBloomProxy(document, mesh, blossomPrimitive, cellSize) {
  const sourcePositions = blossomPrimitive.getAttribute("POSITION")?.getArray();

  if (!sourcePositions) {
    throw new Error("Sakura blossom primitive has no POSITION attribute.");
  }

  const centers = collectVoxelCenters(sourcePositions, cellSize);
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const palette = [
    [0.96, 0.75, 0.9, 1],
    [0.93, 0.62, 0.82, 1],
    [1, 0.84, 0.94, 1],
  ];
  const directions = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0.84, 0],
    [0, -0.84, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const faces = [
    [0, 2, 4],
    [4, 2, 1],
    [1, 2, 5],
    [5, 2, 0],
    [4, 3, 0],
    [1, 3, 4],
    [5, 3, 1],
    [0, 3, 5],
  ];
  const radius = cellSize * 0.64;

  for (const center of centers) {
    const baseIndex = positions.length / 3;
    const color = palette[hashString(center.key) % palette.length];

    for (const direction of directions) {
      const normalLength = Math.hypot(...direction);
      positions.push(
        center.x + direction[0] * radius,
        center.y + direction[1] * radius,
        center.z + direction[2] * radius,
      );
      normals.push(
        direction[0] / normalLength,
        direction[1] / normalLength,
        direction[2] / normalLength,
      );
      colors.push(...color);
    }

    for (const face of faces) {
      indices.push(
        baseIndex + face[0],
        baseIndex + face[1],
        baseIndex + face[2],
      );
    }
  }

  const IndexArray = positions.length / 3 <= 65_535 ? Uint16Array : Uint32Array;
  const material = document
    .createMaterial("SakuraBloomProxy")
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.86);
  const proxyPrimitive = document
    .createPrimitive()
    .setMode(Primitive.Mode.TRIANGLES)
    .setMaterial(material)
    .setAttribute(
      "POSITION",
      document
        .createAccessor()
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(positions)),
    )
    .setAttribute(
      "NORMAL",
      document
        .createAccessor()
        .setType(Accessor.Type.VEC3)
        .setArray(new Float32Array(normals)),
    )
    .setAttribute(
      "COLOR_0",
      document
        .createAccessor()
        .setType(Accessor.Type.VEC4)
        .setArray(new Float32Array(colors)),
    )
    .setIndices(
      document
        .createAccessor()
        .setType(Accessor.Type.SCALAR)
        .setArray(new IndexArray(indices)),
    );

  mesh.addPrimitive(proxyPrimitive);
  blossomPrimitive.dispose();

  return centers.length;
}

async function prepareSakuraLOD(document, kind) {
  const sakuraNode = document
    .getRoot()
    .listNodes()
    .find((node) => node.getName() === SAKURA_NODE_NAME);
  const mesh = sakuraNode?.getMesh();

  if (!mesh) {
    throw new Error(`Missing sakura node: ${SAKURA_NODE_NAME}`);
  }

  if (kind === "sakura-high") {
    return { bloomProxyCount: 0 };
  }

  const blossomPrimitive = mesh
    .listPrimitives()
    .find(
      (primitive) =>
        primitive.getMaterial()?.getName() === SAKURA_BLOSSOM_MATERIAL_NAME,
    );

  if (!blossomPrimitive) {
    throw new Error(
      `Missing sakura blossom material: ${SAKURA_BLOSSOM_MATERIAL_NAME}`,
    );
  }

  const isLow = kind === "sakura-low";
  const bloomProxyCount = addBloomProxy(
    document,
    mesh,
    blossomPrimitive,
    isLow ? 0.35 : 0.18,
  );

  await MeshoptSimplifier.ready;

  for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMaterial()?.getName() === "SakuraBloomProxy") {
      continue;
    }

    weldPrimitive(primitive);
    simplifyPrimitive(primitive, {
      error: isLow ? 0.012 : 0.004,
      lockBorder: false,
      ratio: isLow ? 0.38 : 0.68,
      simplifier: MeshoptSimplifier,
    });
  }

  return { bloomProxyCount };
}

async function optimizeAndWrite(document, outputPath) {
  await document.transform(
    dedup(),
    weld(),
    prune(),
    sparse(),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  await createIO().write(outputPath, document);
  return stat(outputPath);
}

async function buildOutput(inputPath, outputDirectory, definition) {
  const io = createIO();
  const document = await io.read(inputPath);
  const meshNodeNames = listMeshNodeNames(document);
  let stats = {};

  if (definition.kind === "ground") {
    retainNodes(document, GROUND_NODE_NAMES);
    stats = trimHiddenGround(document);
  } else if (definition.kind === "decor") {
    retainNodes(
      document,
      new Set(
        meshNodeNames.filter(
          (name) =>
            !GROUND_NODE_NAMES.has(name) && name !== SAKURA_NODE_NAME,
        ),
      ),
    );
  } else {
    retainNodes(document, new Set([SAKURA_NODE_NAME]));
    stats = await prepareSakuraLOD(document, definition.kind);
  }

  const outputPath = join(outputDirectory, definition.fileName);
  const outputStats = await optimizeAndWrite(document, outputPath);

  console.log(
    JSON.stringify({
      ...stats,
      bytes: outputStats.size,
      file: basename(outputPath),
    }),
  );
}

async function main() {
  const [inputArgument, outputArgument] = process.argv.slice(2);

  if (!inputArgument || !outputArgument) {
    throw new Error(
      "Usage: node scripts/build-world-streaming-assets.mjs <input.glb> <output-directory>",
    );
  }

  const inputPath = resolve(inputArgument);
  const outputDirectory = resolve(outputArgument);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

  for (const definition of outputDefinitions) {
    await buildOutput(inputPath, outputDirectory, definition);
  }
}

await main();
