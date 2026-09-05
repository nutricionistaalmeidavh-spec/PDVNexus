const base = require("./electron-builder-pdv.cjs");

module.exports = {
  ...base,
  artifactName: "PDV-Nexus-Portable-${version}.${ext}",
  directories: { ...base.directories, output: "dist-desktop/pdv-demo-portable" },
  win: { ...base.win, target: ["portable"] }
};
