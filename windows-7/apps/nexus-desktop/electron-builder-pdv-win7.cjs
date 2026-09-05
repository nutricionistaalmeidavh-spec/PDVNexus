const base = require("./electron-builder-pdv.cjs");

module.exports = {
  ...base,
  artifactName: "PDV-Nexus-Windows-7-Setup-${version}.${ext}",
  directories: { ...base.directories, output: "dist-desktop/pdv-demo-windows-7" },
  win: {
    ...base.win,
    target: [{ target: "nsis", arch: ["x64"] }]
  }
};
