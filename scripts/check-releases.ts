import { checkNewReleases } from "../src/lib/release-tracker";

async function main() {
  console.log(`[${new Date().toISOString()}] Starting Aubrey release tracking sync...`);
  try {
    const result = await checkNewReleases();
    console.log(`[${new Date().toISOString()}] Sync complete:`, result);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Release sync failed:`, error);
    process.exitCode = 1;
  }
}

if (require.main === module || !process.env.VITEST) {
  main();
}
