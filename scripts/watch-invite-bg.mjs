import { watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeInviteBgList } from "./list-invite-bg.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const dirs = [join(root, "invite-bg"), join(root, "invite-bg-mobile")];
let timer = 0;

async function refresh() {
  try {
    const listed = await writeInviteBgList();
    for (const [dir, files] of Object.entries(listed)) {
      console.log(`[${dir}] ${files.length} photos: ${files.join(", ") || "(none)"}`);
    }
  } catch (error) {
    console.warn("[invite-bg] could not refresh photo list", error);
  }
}

await refresh();
for (const dir of dirs) {
  try {
    watch(dir, () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 200);
    });
    console.log(`[invite-bg] watching ${dir}`);
  } catch {
    console.warn(`[invite-bg] not watching missing folder ${dir}`);
  }
}
