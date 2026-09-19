const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const requestedUserDataDir = String(process.env.NEXUS_USER_DATA_DIR || "").trim();
if (!requestedUserDataDir) {
  throw new Error("NEXUS_USER_DATA_DIR is required for the isolated ArtiSys QA Electron entrypoint.");
}

const isolatedUserDataDir = path.resolve(process.cwd(), requestedUserDataDir);
fs.mkdirSync(isolatedUserDataDir, { recursive: true });
app.setPath("userData", isolatedUserDataDir);

require("./main.cjs");
