import { spawn } from "node:child_process";

const child = (cmd, args) =>
  spawn(cmd, args, { stdio: "inherit", shell: true, cwd: process.cwd() });

child("node", ["scripts/watch-invite-bg.mjs"]);
child("npx", ["wrangler", "pages", "dev", ".", "--ip", "localhost", "--port", "8788"]);
