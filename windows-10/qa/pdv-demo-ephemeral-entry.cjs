const { app } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const demoUserData = fs.mkdtempSync(path.join(os.tmpdir(), "pdv-nexus-demo-"));
app.setPath("userData", demoUserData);
process.env.NEXUS_QA_DEMO_USER_DATA = demoUserData;

require("../apps/nexus-desktop/main.cjs");
