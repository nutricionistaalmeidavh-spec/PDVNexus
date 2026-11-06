const base = require("./electron-builder-pdv.cjs");

module.exports = {
  ...base,
  extraMetadata: {
    ...(base.extraMetadata || {}),
    author: "ArtiSys",
    description: "Sistema PDV para vendas, estoque, clientes e controle de caixa."
  },
  artifactName: "PDV-Nexus-Nova-Edicao-Store-${version}-${arch}.${ext}",
  directories: { ...base.directories, output: "dist-desktop/pdv-demo-store" },
  win: { ...base.win, target: ["appx"], icon: "build/pdv-nexus.ico" },
  appx: {
    identityName: "ArtiSys.PDVNova",
    publisher: "CN=921F5CDE-55B8-4F74-93DA-A30F70F068F6",
    publisherDisplayName: "ArtiSys",
    applicationId: "PDVNexusNova",
    displayName: "PDV Nexus Nova Edição",
    languages: ["pt-BR"],
    backgroundColor: "#0f172a",
    showNameOnTiles: true,
    minVersion: "10.0.17763.0",
    maxVersionTested: "10.0.26100.0"
  }
};
