const selectedApp = process.env.NEXUS_APP === "pdv-demo" ? "pdv-demo" : "meu-engenheiro";

const appMap = {
  "meu-engenheiro": {
    appId: "com.nexuscore.srengenheiro",
    productName: "Sr. Engenheiro",
    artifactName: "Sr-Engenheiro-Setup-${version}.${ext}",
    rendererDir: "../meu-engenheiro/dist"
  },
  "pdv-demo": {
    appId: "com.nexuscore.pdv",
    productName: "PDV Nexus",
    artifactName: "PDV-Nexus-Setup-${version}.${ext}",
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
  electronVersion: "39.8.10",
  npmRebuild: false,
  artifactName: selected.artifactName,
  directories: {
    output: `dist-desktop/${selectedKey}`
  },
  files: [
    "main.cjs",
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
