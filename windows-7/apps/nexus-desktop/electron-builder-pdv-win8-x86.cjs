const base = require("./electron-builder-pdv.cjs");

module.exports = {
  ...base,
  artifactName: "PDV-Nexus-Windows-8-32bit-Setup-${version}.${ext}",
  directories: { ...base.directories, output: "dist-desktop/pdv-demo-windows-8-x86" },
  win: {
    ...base.win,
    target: [{ target: "nsis", arch: ["ia32"] }]
  }
};
