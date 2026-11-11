import { useMemo, useState } from "react";
import { buildRamuzaAtena2Load, RAMUZA_ATENA2_DEFAULT_PORT, type RamuzaAtena2File, type RamuzaAtena2Product } from "@nexus-core/module-balanca";
import { getDesktopRamuzaNetworkBridge } from "@nexus-core/desktop-runtime";
import { SectionCard } from "@nexus-core/ui";

export interface RamuzaAtenaToolsProps {
  products: readonly RamuzaAtena2Product[];
  host: string;
  onHostChange: (host: string) => void;
  onBarcodeModeChange: (mode: "DEFAULT_PRICE" | "RAMUZA_PRICE_6") => void;
}

const wrapStyle = { display: "grid", gap: 12 } as const;
const rowStyle = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } as const;
const buttonStyle = { padding: "10px 14px", cursor: "pointer", borderRadius: 8, border: "1px solid #9aa4b2", backgroundColor: "transparent", color: "inherit", font: "inherit" } as const;
const inputStyle = { minWidth: 180, maxWidth: 260, flex: 1, padding: 10, borderRadius: 8, border: "1px solid #9aa4b2", backgroundColor: "transparent", color: "inherit" } as const;

function saveTxtFile(file: RamuzaAtena2File) {
  // Byte array explicitamente CP1252. Blob de string mudaria a codificacao para UTF-8.
  const blob = new Blob([new Uint8Array(file.bytes)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function RamuzaAtenaTools({ products, host, onHostChange, onBarcodeModeChange }: RamuzaAtenaToolsProps) {
  const [includeUnits, setIncludeUnits] = useState(false);
  const [networkStatus, setNetworkStatus] = useState("");
  const [probing, setProbing] = useState(false);

  const result = useMemo(() => {
    try {
      return { load: buildRamuzaAtena2Load(products, { includeUnitProducts: includeUnits }), error: "" };
    } catch (error) {
      return { load: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [products, includeUnits]);

  const probe = async () => {
    const network = getDesktopRamuzaNetworkBridge();
    if (!network) { setNetworkStatus("O diagnóstico de rede está disponível no instalador desktop."); return; }
    setProbing(true);
    setNetworkStatus("Verificando conexão TCP local, sem transmitir produtos...");
    try {
      const response = await network.probe(host.trim(), RAMUZA_ATENA2_DEFAULT_PORT);
      setNetworkStatus(response.reachable
        ? `Conexão TCP acessível em ${response.host}:${response.port}. Confirme a carga no software Ramuza.`
        : `Sem conexão TCP em ${response.host}:${response.port}. Confira IP, rede, firewall e equipamento.`);
    } catch (error) {
      setNetworkStatus(error instanceof Error ? error.message : "Não foi possível verificar a conexão.");
    } finally {
      setProbing(false);
    }
  };

  return <SectionCard title="Ramuza Atena II" subtitle="Carga Filizola Windows-1252 e rede local">
    <div style={wrapStyle}>
      <p>Gere os arquivos a partir dos produtos do cadastro atual. O software gratuito Atena II importa os arquivos e transmite a carga à balança por Ethernet ou Wi-Fi.</p>
      <label style={rowStyle}>
        <input type="checkbox" checked={includeUnits} onChange={(event) => setIncludeUnits(event.target.checked)} />
        Incluir produtos vendidos por unidade (além dos vendidos por peso)
      </label>
      {result.load
        ? <div role="status">Prontos para exportação: <strong>{result.load.productCount} produtos</strong> em <strong>{result.load.sectorCount} setores</strong>.</div>
        : <p role="alert">{result.error}</p>}
      <div style={rowStyle}>
        <button type="button" style={buttonStyle} disabled={!result.load} onClick={() => result.load && saveTxtFile(result.load.productsFile)}>Baixar CADTXT.TXT</button>
        <button type="button" style={buttonStyle} disabled={!result.load} onClick={() => result.load && saveTxtFile(result.load.sectorsFile)}>Baixar SETORTXT.TXT</button>
      </div>
      <div style={wrapStyle}>
        <strong>Formato do código de barras Atena II</strong>
        <div style={rowStyle}>
          <button type="button" style={buttonStyle} onClick={() => onBarcodeModeChange("DEFAULT_PRICE")}>Tipo 03: 5 dígitos + preço</button>
          <button type="button" style={buttonStyle} onClick={() => onBarcodeModeChange("RAMUZA_PRICE_6")}>Tipo 06: 6 dígitos + preço</button>
        </div>
        <small>Selecione no Nexus o mesmo formato configurado na Atena II. O tipo 03 admite códigos de produto de até 5 dígitos; o tipo 06 admite 6 dígitos.</small>
      </div>
      <div style={wrapStyle}>
        <strong>Conexão Ethernet / Wi-Fi local</strong>
        <div style={rowStyle}>
          <input style={inputStyle} aria-label="IP local da balança Ramuza" value={host} onChange={(event) => onHostChange(event.target.value)} placeholder="Ex.: 192.168.0.150" inputMode="decimal" />
          <span>Porta {RAMUZA_ATENA2_DEFAULT_PORT}</span>
          <button type="button" style={buttonStyle} disabled={probing || !host.trim()} onClick={() => void probe()}>{probing ? "Verificando..." : "Testar rede"}</button>
        </div>
        {networkStatus ? <p role="status">{networkStatus}</p> : null}
        <small>O teste verifica somente se a porta TCP está acessível; não transmite comandos proprietários nem confirma que os PLUs foram gravados.</small>
      </div>
      <div style={wrapStyle}>
        <strong>Como enviar os produtos à balança</strong>
        <ol style={{ margin: 0, paddingLeft: 22 }}>
          <li>Baixe o CADTXT.TXT e abra o software oficial Ramuza Atena II no computador da loja.</li>
          <li>Em <strong>Importar/Exportar → Customizar arquivo</strong>, escolha <strong>FILIZOLA (Windows-1252)</strong>, selecione o arquivo e execute a importação para o software.</li>
          <li>Confira os produtos em <strong>Base de dados → PLU</strong> e selecione <strong>Ethernet → Download (para balança) → Executar</strong>.</li>
          <li>Confira o retorno de conclusão no software Ramuza e teste uma etiqueta real no caixa do Nexus.</li>
        </ol>
      </div>
      <small>Compatibilidade de arquivo validável sem hardware. Comunicação proprietária direta e gravação física exigem protocolo/documentação do fabricante e teste com uma Atena II real.</small>
    </div>
  </SectionCard>;
}
