const { app } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const userData = process.env.NEXUS_QA_USER_DATA_DIR;
if (!userData || !path.isAbsolute(userData) || !fs.existsSync(userData)) {
  throw new Error("Ambiente de teste exige NEXUS_QA_USER_DATA_DIR isolado");
}
app.setPath("userData", userData);
require("../apps/nexus-desktop/main.cjs");
