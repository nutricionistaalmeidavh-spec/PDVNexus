from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT = OUT_DIR / "Manual-de-Uso-PDV-Nexus-0.1.3.pdf"
SCREENSHOTS = ROOT / "output" / "microsoft-store" / "screenshots"
MANUAL_ASSETS = ROOT / "output" / "pdf" / "manual-assets"

VERSION = "0.1.3"
INSTALLER = "PDV-Nexus-Setup-0.1.3-CORRIGIDO.exe"
SHA256 = "C45EA031F945C349A0FC36981188B2E08849A578C61C7B1F9DD1400883B37F9A"

NAVY = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748b")
BLUE = colors.HexColor("#0369a1")
CYAN = colors.HexColor("#0ea5e9")
RED = colors.HexColor("#ef4444")
GREEN = colors.HexColor("#16a34a")
LIGHT = colors.HexColor("#f8fafc")
LINE = colors.HexColor("#cbd5e1")

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=27,
        leading=31,
        textColor=NAVY,
        alignment=TA_CENTER,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=MUTED,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=21,
        textColor=BLUE,
        spaceBefore=4,
        spaceAfter=8,
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=5,
        keepWithNext=True,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.8,
        leading=14.2,
        textColor=SLATE,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.2,
        leading=11,
        textColor=MUTED,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Caption",
        parent=styles["BodyText"],
        fontName="Helvetica-Oblique",
        fontSize=8.1,
        leading=10.5,
        textColor=MUTED,
        alignment=TA_CENTER,
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="Key",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=NAVY,
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="Callout",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.2,
        leading=13,
        textColor=SLATE,
        alignment=TA_LEFT,
    )
)


def p(text: str, style: str = "Body") -> Paragraph:
    return Paragraph(text, styles[style])


def bullets(items):
    return ListFlowable(
        [ListItem(p(item), leftIndent=4) for item in items],
        bulletType="bullet",
        start="circle",
        leftIndent=16,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=BLUE,
        spaceAfter=7,
    )


def callout(title: str, text: str, kind: str = "info") -> Table:
    palette = {
        "info": (colors.HexColor("#eff6ff"), colors.HexColor("#93c5fd")),
        "warning": (colors.HexColor("#fff7ed"), colors.HexColor("#fb923c")),
        "success": (colors.HexColor("#f0fdf4"), colors.HexColor("#86efac")),
    }
    background, border = palette[kind]
    box = Table(
        [[p(f"<b>{title}</b><br/>{text}", "Callout")]],
        colWidths=[174 * mm],
    )
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("BOX", (0, 0), (-1, -1), 0.8, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 11),
                ("RIGHTPADDING", (0, 0), (-1, -1), 11),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return box


def figure(filename: str, caption: str):
    path = SCREENSHOTS / filename
    if not path.exists():
        raise FileNotFoundError(path)
    visual = Image(str(path), width=174 * mm, height=97.8 * mm, kind="proportional")
    visual.hAlign = "CENTER"
    return KeepTogether([visual, p(caption, "Caption")])


def manual_figure(filename: str, caption: str, max_height_mm: float = 142):
    path = MANUAL_ASSETS / filename
    if not path.exists():
        path = SCREENSHOTS / filename
    if not path.exists():
        raise FileNotFoundError(path)
    from PIL import Image as PilImage

    with PilImage.open(path) as source:
        image_width, image_height = source.size
    max_width = 174 * mm
    max_height = max_height_mm * mm
    scale = min(max_width / image_width, max_height / image_height)
    visual = Image(str(path), width=image_width * scale, height=image_height * scale)
    visual.hAlign = "CENTER"
    return KeepTogether([visual, Spacer(1, 4), p(caption, "Caption")])


class ManualDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if not isinstance(flowable, Paragraph):
            return
        if flowable.style.name == "H1":
            self.notify("TOCEntry", (0, flowable.getPlainText(), self.page))
        elif flowable.style.name == "H2":
            self.notify("TOCEntry", (1, flowable.getPlainText(), self.page))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#e2e8f0"))
    canvas.line(18 * mm, 15 * mm, 192 * mm, 15 * mm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, f"PDV Nexus {VERSION} - Manual de uso")
    canvas.drawRightString(192 * mm, 9 * mm, f"Página {doc.page}")
    canvas.restoreState()


doc = ManualDocTemplate(
    str(OUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=16 * mm,
    bottomMargin=21 * mm,
    title=f"Manual de Uso PDV Nexus {VERSION}",
    author="ArtiSys",
    subject="Instalação e operação do PDV Nexus",
)

story = [
    Spacer(1, 4 * mm),
    p("PDV Nexus", "CoverTitle"),
    p(f"Manual de instalação e operação - versão {VERSION}", "CoverSub"),
    figure(
        "01-caixa-rapido.png",
        "Tela principal do Caixa Rápido: produtos, pedido atual, totais e formas de pagamento.",
    ),
    callout(
        "Finalidade",
        "Este guia apresenta a instalação, abertura do caixa, registro de vendas, recebimentos, estoque, clientes, cancelamentos, relatórios, backup, balança e atalhos de teclado.",
        "info",
    ),
    Spacer(1, 5),
    p("Leitura rápida", "H2"),
    bullets(
        [
            "Use o sumário para localizar rapidamente cada módulo e demonstração.",
            "Para a primeira venda, procure Abrir o caixa e registrar uma venda.",
            "Para os botões grandes, procure Pagamentos e atalhos do caixa.",
            "O guia visual final mostra cada função usando telas reais do aplicativo.",
            "O PDV emite recibo não fiscal; emissão fiscal não está incluída nesta versão.",
        ]
    ),
    PageBreak(),
    p("Sumário", "H1"),
]

toc = TableOfContents()
toc.levelStyles = [
    ParagraphStyle(
        name="TOCLevel1",
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        leftIndent=0,
        firstLineIndent=0,
        textColor=NAVY,
        spaceBefore=5,
    ),
    ParagraphStyle(
        name="TOCLevel2",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        leftIndent=12,
        firstLineIndent=0,
        textColor=SLATE,
        spaceBefore=2,
    ),
]
story += [
    p("Use este sumário para localizar cada função, comando e demonstração visual."),
    Spacer(1, 6),
    toc,
    PageBreak(),
    p("1. Instalação segura", "H1"),
    p(
        f"Use o instalador <b>{INSTALLER}</b>. Dê dois cliques no arquivo, escolha a pasta de instalação e conclua o assistente. O programa cria atalhos no menu Iniciar e na área de trabalho."
    ),
    callout(
        "Verificação do arquivo",
        f"Nome: <b>{INSTALLER}</b><br/>SHA-256:<br/><font name='Courier' size='7.4'>{SHA256[:32]}<br/>{SHA256[32:]}</font>",
        "success",
    ),
    Spacer(1, 7),
    p("Se o Windows bloquear", "H2"),
    p(
        "Alguns computadores com Windows 11 podem impedir a execução de aplicativos novos e sem assinatura comercial. Se aparecer o aviso do <b>Controle Inteligente de Aplicativos</b>, não desative a proteção do computador. Solicite o link oficial da Microsoft Store ao fornecedor."
    ),
    callout(
        "Importante",
        "O bloqueio de segurança ocorre antes de o PDV iniciar. Não existe um botão seguro de exceção somente para este aplicativo. A versão publicada pela Microsoft Store será certificada e assinada pela Microsoft.",
        "warning",
    ),
    p("Primeira abertura", "H2"),
    bullets(
        [
            "Abra o atalho PDV Nexus.",
            "Confira o operador exibido e acesse Financeiro para abrir o caixa.",
            "Antes do uso definitivo, cadastre os produtos e configure os dados da loja.",
            "Faça um backup após concluir a configuração inicial.",
        ]
    ),
    PageBreak(),
    p("2. Conhecendo a interface", "H1"),
    figure(
        "01-caixa-rapido.png",
        "O menu lateral abre Caixa Rápido, Produtos, Clientes, Financeiro e Balança.",
    ),
    p("Áreas principais", "H2"),
    bullets(
        [
            "<b>Caixa Rápido:</b> inicia a venda, adiciona itens, recebe pagamentos e finaliza.",
            "<b>Produtos:</b> cadastro, preços, estoque mínimo e movimentações.",
            "<b>Clientes:</b> cadastro e vínculo do cliente à venda.",
            "<b>Financeiro:</b> abertura/fechamento, sangria, histórico e relatórios.",
            "<b>Balança:</b> leitor USB, porta serial, peso e etiquetas.",
        ]
    ),
    PageBreak(),
    p("3. Abrir o caixa e registrar uma venda", "H1"),
    p("Abrir o caixa", "H2"),
    bullets(
        [
            "Acesse <b>Financeiro</b>.",
            "Informe o valor inicial disponível na gaveta.",
            "Clique em <b>Abrir Caixa</b> e confirme o operador.",
        ]
    ),
    p("Registrar produtos", "H2"),
    bullets(
        [
            "No <b>Caixa Rápido</b>, pressione <b>F2</b> para iniciar uma nova venda.",
            "Pressione <b>F3</b> para levar o cursor ao campo de produto.",
            "Bipe o código de barras ou digite o código/nome exato e pressione <b>Enter</b>.",
            "Também é possível clicar em um cartão de produto e depois em <b>Adicionar</b>.",
            "Use <b>Delete</b> para retirar o último item lançado.",
        ]
    ),
    callout(
        "Exemplo",
        "F2 -> F3 -> digite 00015 -> Enter. O produto Queijo Muçarela será lançado no pedido se estiver cadastrado com esse código.",
        "info",
    ),
    p("Conferência antes de receber", "H2"),
    p(
        "Confira cliente, itens, quantidades, subtotal e desconto. Não finalize enquanto o valor pago estiver abaixo do total da venda."
    ),
    PageBreak(),
    p("4. Pagamentos e atalhos do caixa", "H1"),
    figure(
        "06-caixa-pagamentos-atalhos.png",
        "Painel de pagamento e comandos grandes: F2, F3, F6, F8 e Delete.",
    ),
    p("Comandos operacionais", "H2"),
]

shortcut_rows = [
    [p("Tecla", "Small"), p("Comando", "Small"), p("Demonstração", "Small")],
    [p("F2", "Key"), p("Nova venda"), p("Abre um pedido vazio para o cliente do balcão.")],
    [p("F3", "Key"), p("Produto"), p("Foca a busca para código, barras ou nome exato.")],
    [p("Enter", "Key"), p("Adicionar"), p("Inclui o produto digitado ou lido pelo leitor.")],
    [p("F6", "Key"), p("Pagamento"), p("Aplica rapidamente a forma A VISTA ao saldo da venda.")],
    [p("Delete", "Key"), p("Remover item"), p("Exclui o último item lançado no pedido atual.")],
    [p("F8", "Key"), p("Finalizar"), p("Conclui a venda quando pagamento e caixa estiverem válidos.")],
]
shortcut_table = Table(shortcut_rows, colWidths=[23 * mm, 42 * mm, 109 * mm], repeatRows=1)
shortcut_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.45, LINE),
            ("BACKGROUND", (0, 1), (-1, -1), LIGHT),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 1), (0, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
    )
)
story += [
    shortcut_table,
    Spacer(1, 7),
    p("Dinheiro", "H2"),
    p("Selecione <b>A VISTA</b>, informe o valor recebido e confira o troco antes de finalizar."),
    p("Cartão e PIX", "H2"),
    p(
        "Nesta versão, faça a cobrança na maquininha ou no QR Code externo da loja. Depois que o recebimento for confirmado no equipamento, selecione <b>Débito</b>, <b>Crédito</b> ou <b>PIX</b> no PDV e finalize com <b>F8</b>. O sistema apenas registra a forma recebida; não envia automaticamente a transação para a maquininha."
    ),
    PageBreak(),
    p("5. Produtos e controle de estoque", "H1"),
    figure(
        "02-produtos-estoque.png",
        "Movimentações de estoque e cadastro de produtos no mesmo módulo reutilizável.",
    ),
    p("Cadastrar produto", "H2"),
    bullets(
        [
            "Informe código único, código de barras, descrição e categoria.",
            "Defina unidade (UN ou KG), preço, estoque atual e estoque mínimo.",
            "Salve e confirme que o produto aparece no Caixa Rápido.",
        ]
    ),
    p("Movimentar estoque", "H2"),
    bullets(
        [
            "Selecione o produto e escolha entrada, saída ou ajuste.",
            "Informe quantidade e motivo; depois clique em <b>Registrar Movimento</b>.",
            "Vendas reduzem o estoque e cancelamentos devolvem os itens automaticamente.",
            "A faixa de estoque mínimo avisa quando é necessário repor produtos.",
        ]
    ),
    PageBreak(),
    p("6. Balança, leitor USB e etiquetas", "H1"),
    figure(
        "05-balanca-etiquetas.png",
        "Configuração da balança, perfil de código, leitor USB e comunicação serial.",
    ),
    p("Leitor USB", "H2"),
    p(
        "Leitores no modo teclado normalmente digitam o código e enviam Enter. Clique no campo, bipe a etiqueta e confira o produto interpretado."
    ),
    p("Balança serial", "H2"),
    bullets(
        [
            "Escolha a marca/perfil compatível e informe o comando serial quando necessário.",
            "Clique em <b>Listar portas</b>, selecione a porta COM e conecte.",
            "Use <b>Solicitar peso</b> e confira o frame recebido.",
            "Selecione o produto vendido por peso e clique em <b>Lançar peso no caixa</b>.",
        ]
    ),
    callout(
        "Sem equipamento físico",
        "A estrutura de integração está preparada, mas porta COM, comando serial, etiqueta e precisão devem ser conferidos no computador que possuir a balança e o leitor reais.",
        "warning",
    ),
    PageBreak(),
    p("7. Clientes, cancelamentos e financeiro", "H1"),
    p("Clientes", "H2"),
    p(
        "Cadastre os dados básicos em <b>Clientes</b>. No pedido atual, selecione o cliente desejado antes de finalizar a venda. Use Cliente Balcão quando não for necessário identificar o comprador."
    ),
    p("Cancelar uma venda", "H2"),
    bullets(
        [
            "Abra o histórico no módulo Financeiro.",
            "Localize a venda correta e escolha cancelar/estornar.",
            "Informe o motivo e solicite autorização do gerente quando necessário.",
            "Confira o registro do operador e a devolução dos itens ao estoque.",
        ]
    ),
    p("Fechamento de caixa", "H2"),
    bullets(
        [
            "Registre sangrias e suprimentos durante o turno.",
            "No fechamento, informe o valor contado e compare com o valor esperado.",
            "Revise divergências, pagamentos e vendas canceladas antes de confirmar.",
        ]
    ),
    p("Relatórios", "H2"),
    p(
        "Consulte vendas por período, formas de pagamento, produtos mais vendidos, estoque baixo e fluxo de caixa. Quando necessário, exporte os dados em CSV para análise em planilha."
    ),
    PageBreak(),
    p("8. Backup, recibo e solução de problemas", "H1"),
    p("Backup", "H2"),
    bullets(
        [
            "Ative o backup automático ao finalizar vendas.",
            "Use <b>Backup Agora</b> antes de atualizações ou restaurações.",
            "Guarde uma cópia fora do computador, por exemplo em uma pasta segura no Drive.",
            "Antes de restaurar, faça uma cópia do estado atual.",
        ]
    ),
    p("Recibo", "H2"),
    p(
        "O sistema prepara recibo não fiscal para impressoras térmicas de 58/80 mm. Margens, corte e comunicação devem ser testados com a impressora real. NFC-e, SAT e outros documentos fiscais não estão incluídos nesta versão."
    ),
    p("Diagnóstico rápido", "H2"),
]

troubleshooting_rows = [
    [p("Situação", "Small"), p("O que verificar", "Small")],
    [p("Venda não inicia"), p("Abra o caixa no Financeiro e pressione F2 novamente.")],
    [p("Produto não entra"), p("Confirme código/nome exato, cadastro ativo e estoque disponível.")],
    [p("Venda não finaliza"), p("Confira itens, total pago, forma de pagamento e operador.")],
    [p("Cartão/PIX"), p("Confirme primeiro na maquininha ou QR Code externo; depois registre no PDV.")],
    [p("Balança sem resposta"), p("Revise porta COM, baud rate, perfil, comando serial e cabo.")],
    [p("Windows bloqueou"), p("Não desative a proteção. Solicite o link oficial da Microsoft Store.")],
]
troubleshooting_table = Table(troubleshooting_rows, colWidths=[48 * mm, 126 * mm], repeatRows=1)
troubleshooting_table.setStyle(
    TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.45, LINE),
            ("BACKGROUND", (0, 1), (-1, -1), LIGHT),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7),
            ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]
    )
)
story += [
    troubleshooting_table,
    Spacer(1, 9),
    callout(
        "Ao solicitar suporte",
        "Envie a tela onde ocorreu o problema, o que estava tentando fazer, horário aproximado e versão do PDV. Não envie senhas, dados de cartão nem backups com informações sensíveis por canais públicos.",
        "info",
    ),
    Spacer(1, 8),
    p("Resumo do fluxo de venda", "H2"),
    p(
        "Abrir caixa -> F2 Nova venda -> F3 Produto -> código + Enter -> escolher pagamento -> confirmar recebimento externo quando aplicável -> F8 Finalizar -> emitir recibo -> realizar backup."
    ),
]

visual_guides = [
    (
        "Caixa Rápido: venda e busca de produtos",
        "demo-caixa-rapido.png",
        "Tela operacional usada durante a venda. A área central reúne pesquisa, categorias e produtos; o painel do pedido mostra cliente, totais, pagamentos e comandos grandes.",
        [
            "Pressione F2 para criar a venda e F3 para focar a pesquisa.",
            "Digite ou bipe o código e pressione Enter; também é possível clicar no produto.",
            "Confira subtotal, desconto, valor pago, falta e troco no painel do pedido.",
        ],
    ),
    (
        "Atalhos e formas de pagamento",
        "06-caixa-pagamentos-atalhos.png",
        "Demonstração dos botões grandes e das formas A VISTA, PIX, DÉBITO, CRÉDITO e A PRAZO.",
        [
            "F6 aplica rapidamente o pagamento A VISTA ao saldo restante.",
            "Delete remove o último item; F8 finaliza depois da conferência.",
            "Para cartão ou PIX, cobre fora do sistema e somente depois confirme o recebimento no PDV.",
        ],
    ),
    (
        "Estoque: entradas, ajustes e inventário",
        "demo-estoque.png",
        "O bloco Estoque registra entrada, saída/ajuste e inventário, guarda motivo, exibe antes/depois e avisa quando um item fica abaixo do mínimo.",
        [
            "Escolha o produto e o tipo de movimento.",
            "Informe quantidade ou quantidade contada e descreva o motivo.",
            "Clique em Registrar Movimento e confira a linha criada no histórico.",
        ],
    ),
    (
        "Produtos: cadastrar, buscar, editar e excluir",
        "demo-produtos.png",
        "Cadastro de produtos por unidade ou peso, com código, barras, categoria, preço, estoque inicial e mínimo.",
        [
            "Preencha os campos e clique em Cadastrar Produto.",
            "Use a busca para localizar por código, barras, descrição ou categoria.",
            "Lançar envia o item ao caixa; Editar altera o cadastro; Excluir remove o produto após confirmação.",
        ],
    ),
    (
        "Clientes e limite para venda a prazo",
        "demo-clientes.png",
        "Cadastro de cliente, documento, cidade e limite de crédito, incluindo o valor já utilizado em compras a prazo.",
        [
            "Cadastre nome, CPF/CNPJ, cidade e limite.",
            "Use Editar para atualizar os dados e Excluir somente quando o cadastro não for mais necessário.",
            "Selecione o cliente no pedido antes de usar A PRAZO.",
        ],
    ),
    (
        "Operador, autorização, cancelamento e estorno",
        "demo-operador-e-autorizacao.png",
        "A mesma tela registra quem executou ações sensíveis e permite estornar uma venda, devolver estoque e reverter crédito a prazo.",
        [
            "Selecione a venda, informe a senha do gerente e escreva um motivo claro.",
            "Clique em Cancelar/Estornar Venda e confira o histórico de auditoria.",
            "Nunca estorne apenas para corrigir forma de pagamento sem conferir o impacto no estoque e no caixa.",
        ],
    ),
    (
        "Conferência de caixa e comprovante",
        "demo-conferencia-de-caixa.png",
        "A conferência compara dinheiro, PIX e cartões contados com os valores esperados. Ao lado ficam o recibo não fiscal e os comandos de impressão/reimpressão.",
        [
            "Informe os valores contados e clique em Fechar com Conferência.",
            "Escolha 58 mm ou 80 mm e, se desejar, ative a impressão automática.",
            "Use Gerar Último e Imprimir/Reimprimir para uma venda já concluída.",
        ],
    ),
    (
        "Relatórios, dashboard e estoque baixo",
        "demo-relatorios-e-dashboard.png",
        "Resumo dos últimos 30 dias com quantidade de vendas, total, ticket médio, divergência, formas de pagamento, produtos mais vendidos e alertas de estoque.",
        [
            "Use os totais para acompanhar a operação, não como documento fiscal.",
            "Analise as formas de pagamento e os produtos vendidos antes de repor o estoque.",
            "Corrija alertas de estoque baixo pelo módulo Produtos.",
        ],
    ),
    (
        "Abrir/fechar caixa, sangria, backup, SQLite e multi-caixa",
        "demo-caixa-e-financeiro.png",
        "Controles de caixa e manutenção dos dados locais: abertura, fechamento, sangria, exportação/restauração, migração SQLite e sincronização entre terminais.",
        [
            "Informe o caixa inicial e clique em Abrir Caixa antes da primeira venda.",
            "Para sangria, informe valor e observação e clique em Registrar Sangria.",
            "Exporte backup antes de restaurar ou migrar; multi-caixa exige configuração de servidor, rede e token.",
        ],
    ),
    (
        "Resumo local e formas de pagamento",
        "demo-resumo-local-das-vendas-finalizadas.png",
        "Os cartões resumem caixa inicial, vendas, cancelamentos e sangrias. O cadastro ao lado controla nome, tipo, taxa, situação ativa e participação no fluxo.",
        [
            "Cadastre taxas de crédito e débito conforme a operadora da loja.",
            "Desative uma forma que não deve aparecer no caixa, sem apagar o histórico antigo.",
            "A PRAZO pode ficar fora do fluxo imediato porque ainda não houve entrada de dinheiro.",
        ],
    ),
    (
        "Usuários, permissões e captura manual de cartão/PIX",
        "demo-usuarios-e-permissoes.png",
        "Usuários podem ser Caixa, Gerente ou Admin. A captura manual registra cartão/PIX confirmados fora do PDV, sem enviar comandos à maquininha.",
        [
            "Cadastre código, nome, perfil e senha/PIN; desative usuários que saíram da operação.",
            "Gerente ou Admin autoriza cancelamentos e outras ações sensíveis.",
            "A captura manual só deve ser marcada como recebida após a confirmação na maquininha ou no QR Code externo.",
        ],
    ),
    (
        "Histórico completo e exportação CSV",
        "demo-historico-completo-de-vendas.png",
        "Consulta de vendas finalizadas e canceladas com filtros por texto, status, cliente e forma de pagamento.",
        [
            "Aplique os filtros para localizar a venda correta.",
            "Confira número, data, cliente, status e total.",
            "Clique em Exportar CSV para abrir os dados em uma planilha.",
        ],
    ),
    (
        "Dados da loja, login e segurança",
        "demo-dados-da-loja.png",
        "Os dados da loja aparecem nos recibos. O login identifica o operador e mantém autorização separada para ações de gerente/admin.",
        [
            "Preencha nome, documento, telefone e endereço da empresa.",
            "Selecione o operador, informe o PIN e clique em Entrar.",
            "Não compartilhe PIN de gerente entre todos os caixas.",
        ],
    ),
    (
        "Backup automático e configuração de TEF",
        "demo-dados-da-loja.png",
        "O backup pode ocorrer ao finalizar cada venda. A área TEF existe para integração futura; no primeiro lançamento, cartão e PIX permanecem em captura manual.",
        [
            "Mantenha Backup ao finalizar venda ativado e defina a retenção desejada.",
            "Use Backup Agora antes de atualizações e Listar backups do desktop para conferir os arquivos.",
            "Deixe a ponte TEF desabilitada enquanto não houver provedor homologado e maquininha testada.",
        ],
    ),
    (
        "Atalhos de operação",
        "demo-atalhos-e-polimento.png",
        "Resumo visual dos comandos usados pelo operador durante a venda.",
        [
            "F2: nova venda; F3: produto; F6: pagamento A VISTA; Delete: remover último item; F8: finalizar.",
            "Enter confirma a pesquisa ou leitura do produto.",
            "Se uma tecla não responder, use o botão equivalente na tela e confira se o foco está no PDV.",
        ],
    ),
    (
        "Configuração de balança e leitor USB",
        "demo-setup-da-balanca.png",
        "Configuração de marca, perfil de etiqueta, comando serial e leitura por scanner USB no modo teclado.",
        [
            "Escolha a marca e o perfil correto de preço/peso embutido.",
            "No leitor USB, bipe a etiqueta ou digite o código e pressione Enter/Bipar.",
            "Valide com etiquetas reais antes de usar em produção.",
        ],
    ),
    (
        "Balança serial e frame recebido",
        "demo-balanca-serial.png",
        "Conexão à porta COM, taxa de comunicação, solicitação de peso e leitura do frame bruto retornado pelo equipamento.",
        [
            "Clique em Listar portas, escolha a COM e confirme o baud rate indicado pelo fabricante.",
            "Conecte, solicite o peso e confira o frame recebido.",
            "Selecione o produto de peso e clique em Lançar peso no caixa.",
        ],
    ),
    (
        "Arquivos de carga da balança",
        "demo-arquivos-da-balanca.png",
        "Geração dos arquivos de produtos para modelos compatíveis Toledo e Urano.",
        [
            "Revise códigos, descrições, preços e tipo de item antes de exportar.",
            "Transfira o arquivo conforme o software e o manual do fabricante da balança.",
            "Como não houve teste físico, confirme o formato no equipamento do cliente antes do uso definitivo.",
        ],
    ),
]

story += [PageBreak(), p("9. Guia visual de todas as funções", "H1")]
story += [
    callout(
        "Como usar esta seção",
        "Cada página abaixo mostra a tela real do PDV e demonstra os comandos de uma função. Os dados exibidos são exemplos locais de treinamento.",
        "info",
    ),
    PageBreak(),
]

for index, (title, filename, description, steps) in enumerate(visual_guides, start=1):
    story += [
        p(f"9.{index} {title}", "H2"),
        p(description),
        Spacer(1, 4),
        manual_figure(filename, f"Demonstração: {title}."),
        Spacer(1, 6),
        p("Comandos e sequência recomendada", "H2"),
        bullets(steps),
    ]
    if index != len(visual_guides):
        story.append(PageBreak())

doc.multiBuild(story, onFirstPage=footer, onLaterPages=footer)
print(OUT)
