process.env.NEXUS_APP = "pdv-demo";
const release = require("../../../pdv-release.json");
const base = require("./electron-builder.cjs");

const DEFAULT_PDV_TELEMETRY_ENDPOINT = "https://pdvnexus.nutricionistaalmeidavh.workers.dev";
const DEFAULT_PDV_LICENSE_ENDPOINT = "https://pdvnexus.nutricionistaalmeidavh.workers.dev";

module.exports = {
  ...base,
  extraMetadata: {
    ...(base.extraMetadata || {}),
    version: release.version,
    pdvUpdateChannel: "windows10-x64",
    pdvUpdateManifestUrl: release.manifestUrl,
    pdvReleaseGeneration: String(release.generation || "licensed-v2"),
    pdvLicenseRequired: true,
    pdvLicenseEndpoint: String(process.env.PDV_LICENSE_ENDPOINT || release.licenseEndpoint || DEFAULT_PDV_LICENSE_ENDPOINT).trim(),
    pdvTelemetryEndpoint: String(process.env.PDV_TELEMETRY_ENDPOINT || DEFAULT_PDV_TELEMETRY_ENDPOINT).trim()
  }
};
