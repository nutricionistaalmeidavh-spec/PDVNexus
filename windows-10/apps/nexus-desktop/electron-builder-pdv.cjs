process.env.NEXUS_APP = "pdv-demo";
const release = require("../../../pdv-release.json");
const base = require("./electron-builder.cjs");

const DEFAULT_PDV_TELEMETRY_ENDPOINT = "https://pdv-nexus-telemetry.nutricionistaalmeidavh.workers.dev";

module.exports = {
  ...base,
  extraMetadata: {
    ...(base.extraMetadata || {}),
    version: release.version,
    pdvUpdateChannel: "windows10-x64",
    pdvUpdateManifestUrl: release.manifestUrl,
    pdvTelemetryEndpoint: String(process.env.PDV_TELEMETRY_ENDPOINT || DEFAULT_PDV_TELEMETRY_ENDPOINT).trim()
  }
};
