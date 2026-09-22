import { readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SETS = [
  { dir: "invite-bg", out: "invite-bg.json" },
  { dir: "invite-bg-mobile", out: "invite-bg-mobile.json" },
];

async function listImages(dir) {
  const names = (await readdir(dir).catch(() => [])).filter(
    (name) => IMAGE.test(name) && !name.startsWith("."),
  );
  names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  return names;
}

export async function writeInviteBgList() {
  const listed = {};
  for (const set of SETS) {
    const files = await listImages(join(root, "public", set.dir));
    await writeFile(join(root, "public", set.out), `${JSON.stringify({ files }, null, 2)}\n`);
    listed[set.dir] = files;
  }
  return listed;
}

if (fileURLToPath(import.meta.url).toLowerCase() === String(process.argv[1] || "").toLowerCase()) {
  const listed = await writeInviteBgList();
  for (const [dir, files] of Object.entries(listed)) {
    console.log(`Wrote ${files.length} photos to public/${dir}.json`);
  }
}
