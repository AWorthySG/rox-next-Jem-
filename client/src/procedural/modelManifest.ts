// Which monster models actually exist, fetched once. A template auto-loads
// models/<templateId>.glb when that file is present — so dropping a correctly
// named .glb into public/models/ is the entire wiring (no code edit). The
// manifest avoids 333 speculative 404s for templates with no model yet.
//
// public/models/manifest.json is regenerated from the present .glb files by
// `npm run gen:manifest` (also run as part of `npm run build`).

let manifest: Promise<Set<string>> | null = null;

function load(): Promise<Set<string>> {
  if (!manifest) {
    manifest = fetch("models/manifest.json")
      .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
      .then((arr) => new Set(arr))
      .catch(() => new Set<string>());
  }
  return manifest;
}

// Resolve the model file for a template: an explicit override wins, otherwise
// the <templateId>.glb convention if the manifest lists it; else null (= keep
// the procedural mesh).
export async function resolveModelFile(templateId: string, explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const set = await load();
  const file = `${templateId}.glb`;
  return set.has(file) ? file : null;
}
