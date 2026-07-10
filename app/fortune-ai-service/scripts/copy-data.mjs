import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const serviceDirectory = resolve(scriptDirectory, "..");
const sourceDirectory = resolve(
  serviceDirectory,
  "../nav-world/src/modules/divination/data",
);
const destinationDirectory = resolve(serviceDirectory, "dist/data");

await mkdir(destinationDirectory, { recursive: true });

for (const fileName of ["tarot_cards.json", "iching_64.json"]) {
  await cp(
    resolve(sourceDirectory, fileName),
    resolve(destinationDirectory, fileName),
  );
}
