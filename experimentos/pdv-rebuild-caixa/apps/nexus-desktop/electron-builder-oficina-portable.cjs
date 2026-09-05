process.env.NEXUS_APP = "oficina-demo";
const base = require("./electron-builder.cjs");

module.exports = {
  ...base,
  artifactName: "Sistema-Oficina-Portable-${version}.${ext}",
  directories: { ...base.directories, output: "dist-desktop/oficina-demo-portable-final" },
  win: { ...base.win, target: ["portable"], signAndEditExecutable: false }
};
