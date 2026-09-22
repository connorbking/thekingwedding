import { watch } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeInviteBgList } from "./list-invite-bg.mjs";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "invite-bg");
let timer = 0;

async function refresh() {
  try {
    const files = await writeInviteBgList();
    console.log(`[invite-bg] ${files.length} photos: ${files.join(", ")}`);
  } catch (error) {
    console.warn("[invite-bg] could not refresh photo list", error);
  }
}

await refresh();
watch(dir, () => {
  clearTimeout(timer);
  timer = setTimeout(refresh, 200);
});
console.log(`[invite-bg] watching ${dir}`);
