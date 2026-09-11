import { useEffect } from "react";

const TECHNICAL_CARD_TITLES = new Set([
  "Leitor USB",
  "Leitura recebida",
  "Arquivos da balança"
]);

function textOf(element: Element | null) {
  return element?.textContent?.trim() ?? "";
}

function setTextIfChanged(element: Element | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function replaceHeading(article: Element, from: string, to: string) {
  const heading = article.querySelector("h2");
  if (textOf(heading) === from) setTextIfChanged(heading, to);
}

function markTechnical(element: Element | null) {
  if (element && !element.classList.contains("e55-technical")) element.classList.add("e55-technical");
}

function replaceTextNode(element: Element | null, from: string, to: string) {
  if (!element || !textOf(element).includes(from)) return;
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.includes(from)) {
      node.textContent = node.textContent.replace(from, to);
      return;
    }
  }
}

function cleanAdministration(article: Element) {
  replaceHeading(article, "Armazenamento e multi-caixa", "Dados, backup e multi-caixa");

  for (const button of Array.from(article.querySelectorAll("button"))) {
    if (textOf(button) === "Verificar SQLite") markTechnical(button);
  }

  for (const details of Array.from(article.querySelectorAll("details"))) markTechnical(details);

  for (const candidate of Array.from(article.querySelectorAll("div"))) {
    const text = textOf(candidate);
    if (!candidate.children.length && /SQLite ativo|Banco:|SQLite desktop/i.test(text)) {
      setTextIfChanged(candidate, "Dados salvos neste computador.");
    }
  }
}

function cleanScaleConfiguration(article: Element) {
  const title = textOf(article.querySelector("h2"));

  if (TECHNICAL_CARD_TITLES.has(title)) {
    markTechnical(article);
    return;
  }

  if (title === "Configuração da balança") {
    for (const label of Array.from(article.querySelectorAll("label"))) {
      const text = textOf(label);
      if (/Perfil de codigo|Comando serial/i.test(text)) markTechnical(label);
    }
    for (const candidate of Array.from(article.querySelectorAll("div"))) {
      if (textOf(candidate).includes("Exemplo de etiqueta")) markTechnical(candidate);
    }
  }

  if (/Balanca Serial|Balança Serial/i.test(title)) {
    replaceHeading(article, title, "Conexão da balança");
    setTextIfChanged(article.querySelector("h2 + p"), "Selecione a porta e conecte o equipamento.");

    for (const label of Array.from(article.querySelectorAll("label"))) {
      if (/baud rate|velocidade da porta/i.test(textOf(label))) markTechnical(label);
    }
    for (const candidate of Array.from(article.querySelectorAll("div"))) {
      if (/9600 é a velocidade|comunicação serial/i.test(textOf(candidate))) markTechnical(candidate);
    }
  }
}

function cleanPaymentConfiguration(article: Element) {
  const title = textOf(article.querySelector("h2"));
  if (title !== "TEF e maquininha" && title !== "Maquininha e pagamentos") return;

  replaceHeading(article, "TEF e maquininha", "Maquininha e pagamentos");
  setTextIfChanged(article.querySelector("h2 + p"), "Configuração opcional para recebimentos integrados.");

  for (const select of Array.from(article.querySelectorAll("select"))) {
    if (Array.from(select.querySelectorAll("option")).some((option) => textOf(option).includes("Ponte HTTP"))) {
      markTechnical(select.parentElement);
    }
  }

  for (const input of Array.from(article.querySelectorAll("input"))) {
    const placeholder = input.getAttribute("placeholder") ?? "";
    if (/URL da ponte TEF|Codigo lojista|Código lojista/i.test(placeholder)) markTechnical(input);
  }

  for (const label of Array.from(article.querySelectorAll("label"))) {
    replaceTextNode(label.querySelector("span") ?? label, "TEF habilitado", "Integração com maquininha habilitada");
  }

  for (const candidate of Array.from(article.querySelectorAll("div"))) {
    if (/ponte do provedor|NSU retornados|URL acima/i.test(textOf(candidate))) {
      setTextIfChanged(candidate, "Pagamentos externos continuam disponíveis normalmente. Ative a integração apenas quando utilizar uma maquininha compatível.");
    }
  }
}

function applyCustomerPresentation() {
  if (document.title !== "PDV Nexus") document.title = "PDV Nexus";
  const root = document.querySelector(".pdv-density-root");
  const advanced = new URLSearchParams(window.location.search).get("advanced") === "1";
  const advancedValue = advanced ? "true" : "false";
  if (root?.getAttribute("data-e55-advanced") !== advancedValue) root?.setAttribute("data-e55-advanced", advancedValue);

  const shell = document.querySelector('[data-shell="pdv-nexus"]');
  if (!shell) return;
  const view = shell.getAttribute("data-view");

  for (const article of Array.from(shell.querySelectorAll("article"))) {
    if (view === "administracao") cleanAdministration(article);
    if (view === "balanca") cleanScaleConfiguration(article);
    if (view === "configuracoes") cleanPaymentConfiguration(article);
  }
}

export function CustomerPresentationDecor() {
  useEffect(() => {
    applyCustomerPresentation();
    const observer = new MutationObserver(applyCustomerPresentation);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("hashchange", applyCustomerPresentation);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", applyCustomerPresentation);
    };
  }, []);

  return (
    <div className="e55-non-fiscal-badge" data-e55-non-fiscal="true" aria-label="Sistema não fiscal">
      <strong>PDV NÃO FISCAL</strong>
      <span>Comprovante sem valor fiscal</span>
    </div>
  );
}
