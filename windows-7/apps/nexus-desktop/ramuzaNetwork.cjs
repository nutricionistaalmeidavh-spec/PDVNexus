const net = require("node:net");

/** Verifica apenas a abertura do socket da Atena II, sem enviar bytes de comandos. */
function probeRamuzaAtena2Lan(address, portInput = 33581, connectionFactory = net.createConnection) {
  const host = typeof address === "string" ? address.trim() : "";
  const parts = host.split(".").map(Number);
  const isLocal = net.isIP(host) === 4 && parts.length === 4 && (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254) ||
    parts[0] === 127
  );
  if (!isLocal) return Promise.reject(new Error("Informe um endereco IPv4 privado da rede local (ex.: 192.168.0.150)."));
  const port = Number(portInput);
  if (port !== 33581) return Promise.reject(new Error("A porta permitida para o teste Atena II e 33581."));

  return new Promise((resolve) => {
    let done = false;
    let socket;
    const complete = (reachable) => {
      if (done) return;
      done = true;
      if (socket) socket.destroy();
      resolve({ host, port, reachable });
    };
    try {
      socket = connectionFactory({ host, port });
      socket.setTimeout(1600);
      socket.once("connect", () => complete(true));
      socket.once("timeout", () => complete(false));
      socket.once("error", () => complete(false));
    } catch {
      complete(false);
    }
  });
}

module.exports = { probeRamuzaAtena2Lan };
