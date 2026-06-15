// Copies the Draco glTF decoder (shipped with three) into client/public/draco/
// so DRACOLoader can fetch it at /draco/ in the browser. Run by `npm run build`;
// the folder is gitignored (it's a build artifact restored from node_modules).
import { cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = fileURLToPath(new URL("../node_modules/three/examples/jsm/libs/draco/gltf/", import.meta.url));
const dst = fileURLToPath(new URL("../client/public/draco/", import.meta.url));

mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log("copied Draco decoder ->", dst);
