import { readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "public", "invite-bg");
const out = join(root, "public", "invite-bg.json");

export async function writeInviteBgList() {
  const names = (await readdir(dir).catch(() => [])).filter(
    (name) => IMAGE.test(name) && !name.startsWith("."),
  );
  names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  await writeFile(out, `${JSON.stringify({ files: names }, null, 2)}\n`);
  return names;
}

if (fileURLToPath(import.meta.url).toLowerCase() === String(process.argv[1] || "").toLowerCase()) {
  const files = await writeInviteBgList();
  console.log(`Wrote ${files.length} invite backgrounds to public/invite-bg.json`);
}
