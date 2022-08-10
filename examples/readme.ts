import { unlink, writeFile } from "fs/promises";
import { addCleanupListener, exitAfterCleanup } from "../src";

void (async function () {
  const path = ".lockfile";
  try {
    await writeFile(path, String(process.pid), { flag: "wx" });
  } catch (err) {
    if ((err as { code?: string }).code === "EEXIST") {
      console.log(`${path} already exists`);
    } else {
      console.log(`Error writing ${path}`, err);
    }
    // Can't use process.exit with async cleanup
    await exitAfterCleanup(1);
  }
  console.log(`Created ${path}`);

  addCleanupListener(async () => {
    await unlink(path);
    console.log(`Deleted ${path}`);
  });

  // Do stuff...

  console.log("Stuff done");
})();
