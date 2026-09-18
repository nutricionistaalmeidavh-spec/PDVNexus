process.env.NEXUS_APP = "pdv-demo";
const release = require("../../../pdv-release.json");
const base = require("./electron-builder.cjs");

module.exports = {
  ...base,
  extraMetadata: {
    ...(base.extraMetadata || {}),
    version: release.version,
    pdvUpdateManifestUrl: release.manifestUrl
  }
};
