import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outfile = resolve(process.env.MAINTENANCE_OUTFILE || ".maintenance/reconcile-activity.cjs");

await mkdir(dirname(outfile), { recursive: true });
await build({
  entryPoints: ["scripts/reconcile-activity.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  outfile,
});
