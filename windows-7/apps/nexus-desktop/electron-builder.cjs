const selectedApp = process.env.NEXUS_APP === "pdv-demo" ? "pdv-demo" : "meu-engenheiro";

const appMap = {
  "meu-engenheiro": {
    appId: "com.nexuscore.srengenheiro",
    productName: "Sr. Engenheiro",
    artifactName: "Sr-Engenheiro-Setup-${version}.${ext}",
    rendererDir: "../meu-engenheiro/dist"
  },
  "pdv-demo": {
    appId: "br.com.artisys.pdvnexus.nova",
    productName: "PDV Nexus Nova Edição",
    artifactName: "PDV-Nexus-Nova-Edicao-Setup-${version}.${ext}",
    rendererDir: "../pdv-demo/dist"
  },
  "oficina-demo": {
    appId: "com.softwarefactory.oficina",
    productName: "Sistema Oficina",
    artifactName: "Sistema-Oficina-Setup-${version}.${ext}",
    rendererDir: "../oficina-demo/dist"
  },
  "aluguel-veiculo-demo": {
    appId: "com.softwarefactory.locadora",
    productName: "Sistema Locadora",
    artifactName: "Sistema-Locadora-Setup-${version}.${ext}",
    rendererDir: "../aluguel-veiculo-demo/dist"
  }
};

const selectedKey = ["pdv-demo", "oficina-demo", "aluguel-veiculo-demo"].includes(process.env.NEXUS_APP)
  ? process.env.NEXUS_APP
  : selectedApp;
const selected = appMap[selectedKey];

module.exports = {
  appId: selected.appId,
  productName: selected.productName,
  electronVersion: "22.3.27",
  npmRebuild: false,
  artifactName: selected.artifactName,
  directories: {
    output: `dist-desktop/${selectedKey}`
  },
  files: [
    "bootstrap.cjs",
    "main.cjs",
    "ramuzaNetwork.cjs",
    "pdv-lifecycle.cjs",
    "pdv-telemetry.cjs",
    "preload.cjs",
    "package.json",
    {
      from: selected.rendererDir,
      to: `${selectedKey}/dist`,
      filter: ["**/*"]
    }
  ],
  win: {
    target: ["nsis"],
    signAndEditExecutable: false
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    perMachine: true,
    allowElevation: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "PDV Nexus"
  }
};
