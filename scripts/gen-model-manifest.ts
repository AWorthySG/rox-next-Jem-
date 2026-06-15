// Scans client/public/models/ for .glb/.gltf files and writes manifest.json,
// the list the client uses to decide which templates auto-load a model. Run via
// `npm run gen:manifest` (also invoked by `npm run build`), so dropping a
// correctly named model in is the only step needed to wire it up.
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../client/public/models/", import.meta.url));
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".glb") || f.endsWith(".gltf"))
  .sort();

writeFileSync(dir + "manifest.json", JSON.stringify(files, null, 2) + "\n");
console.log(`manifest.json: ${files.length} model(s)`, files);
