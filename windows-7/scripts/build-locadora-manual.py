from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "release" / "sistema-locadora" / "Manual-de-Instalacao-e-Uso-Sistema-Locadora.pdf"
SHOTS = ROOT / "release" / "sistema-locadora"

ORANGE = colors.HexColor("#FF6B00")
DARK = colors.HexColor("#351505")
INK = colors.HexColor("#241A16")
MUTED = colors.HexColor("#776B65")
PALE = colors.HexColor("#FFF3E8")
LINE = colors.HexColor("#E8D6C8")


def p(text, style):
    return Paragraph(text, style)


def step(number, title, body, styles):
    data = [[p(str(number), styles["step_number"]), p(f"<b>{title}</b><br/>{body}", styles["step_body"])]]
    table = Table(data, colWidths=[0.85 * cm, 15.45 * cm])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, 0), ORANGE),
        ("BOX", (0, 0), (0, 0), 0, ORANGE),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 4),
        ("BOTTOMPADDING", (0, 0), (0, 0), 4),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
        ("TOPPADDING", (1, 0), (1, 0), 2),
        ("BOTTOMPADDING", (1, 0), (1, 0), 9),
        ("LINEBELOW", (1, 0), (1, 0), 0.5, LINE),
    ]))
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.line(2 * cm, 1.45 * cm, A4[0] - 2 * cm, 1.45 * cm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(2 * cm, 0.95 * cm, "Sistema Locadora | Manual de instalação e uso")
    canvas.drawRightString(A4[0] - 2 * cm, 0.95 * cm, f"Página {doc.page}")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT), pagesize=A4, rightMargin=2 * cm, leftMargin=2 * cm,
        topMargin=1.8 * cm, bottomMargin=2.1 * cm,
        title="Manual de Instalação e Uso - Sistema Locadora",
        author="Software Factory",
    )
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="Helvetica-Bold", fontSize=30, leading=34, textColor=DARK, alignment=TA_LEFT, spaceAfter=8),
        "subtitle": ParagraphStyle("subtitle", parent=base["BodyText"], fontName="Helvetica", fontSize=12, leading=18, textColor=MUTED, spaceAfter=18),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=19, leading=24, textColor=DARK, spaceBefore=4, spaceAfter=12),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=18, textColor=DARK, spaceBefore=12, spaceAfter=7),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="Helvetica", fontSize=10.2, leading=15, textColor=INK, spaceAfter=7),
        "note": ParagraphStyle("note", parent=base["BodyText"], fontName="Helvetica", fontSize=9.5, leading=14, textColor=INK),
        "step_number": ParagraphStyle("step_number", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=11, leading=13, textColor=colors.white, alignment=TA_CENTER),
        "step_body": ParagraphStyle("step_body", parent=base["BodyText"], fontName="Helvetica", fontSize=10, leading=14, textColor=INK),
        "caption": ParagraphStyle("caption", parent=base["BodyText"], fontName="Helvetica-Oblique", fontSize=8.5, leading=11, textColor=MUTED, alignment=TA_CENTER, spaceAfter=9),
    }
    story = []
    story.append(Spacer(1, 1.4 * cm))
    story.append(p("SISTEMA LOCADORA", ParagraphStyle("eyebrow", parent=styles["body"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=ORANGE, spaceAfter=10)))
    story.append(p("Manual de instalação e uso", styles["title"]))
    story.append(p("Guia prático para controlar reservas, frota, clientes, recebimentos, contratos e backup da sua locadora.", styles["subtitle"]))
    cover = Table([[p("INSTALÁVEL WINDOWS", ParagraphStyle("cover_tag", parent=styles["body"], fontName="Helvetica-Bold", fontSize=10, textColor=colors.white, alignment=TA_CENTER))]], colWidths=[6.2 * cm])
    cover.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), ORANGE), ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    story += [cover, Spacer(1, 2.0 * cm)]
    overview = Table([
        [p("O que o sistema entrega", styles["h2"])],
        [p("Visão operacional por etapas, cadastro de clientes e veículos, controle financeiro, contratos para impressão e backup local dos dados.", styles["body"])],
    ], colWidths=[16.3 * cm])
    overview.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE), ("BOX", (0, 0), (-1, -1), 0.75, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    story += [overview, Spacer(1, 0.7 * cm)]
    story.append(p("Versão 0.1.5 | Agosto de 2026", ParagraphStyle("version", parent=styles["body"], textColor=MUTED, fontSize=9)))
    story.append(PageBreak())

    story.append(p("1. Instalação", styles["h1"]))
    story.append(p("O instalador foi preparado para computadores Windows. Você não precisa instalar banco de dados, servidor ou navegador adicional.", styles["body"]))
    story.append(step(1, "Localize o arquivo", "Abra <b>Sistema-Locadora-Setup-0.1.5.exe</b> na pasta entregue.", styles))
    story.append(step(2, "Inicie a instalação", "Dê duplo clique no instalador. Caso o Windows solicite confirmação, escolha <b>Mais informações</b> e depois <b>Executar assim mesmo</b>, se necessário.", styles))
    story.append(step(3, "Escolha a pasta", "O instalador permite definir o local da instalação. Mantenha o caminho sugerido caso não tenha uma política interna diferente.", styles))
    story.append(step(4, "Conclua e abra", "Finalize o assistente. Abra <b>Sistema Locadora</b> pelo atalho criado no Menu Iniciar ou na Área de Trabalho.", styles))
    story.append(p("Dados locais", styles["h2"]))
    story.append(p("Em uso desktop, os dados ficam armazenados localmente no computador. Use a tela Documentos e backup para exportar cópias de segurança periódicas, especialmente antes de trocar ou formatar a máquina.", styles["body"]))
    story.append(PageBreak())

    story.append(p("2. Painel de locações", styles["h1"]))
    story.append(p("A tela inicial organiza cada locação em Reserva, Retirada, Em uso e Devolução. Os indicadores superiores mostram receita prevista, resultado líquido, frota locada e valores em aberto.", styles["body"]))
    story.append(Image(str(SHOTS / "01-locacoes.png"), width=16.3 * cm, height=11.95 * cm))
    story.append(p("Visão geral das reservas e das etapas operacionais.", styles["caption"]))
    story.append(p("Criar uma locação", styles["h2"]))
    story.append(step(1, "Clique em Nova locação", "Informe veículo, cliente, datas de retirada e devolução, diárias, valor diário, atendente, prioridade e observações.", styles))
    story.append(step(2, "Acompanhe a etapa", "Abra o cartão da locação para mover a operação conforme ela avança: Reserva, Retirada, Em uso e Devolução.", styles))
    story.append(PageBreak())

    story.append(p("3. Cadastros e financeiro", styles["h1"]))
    story.append(p("Antes de registrar locações reais, mantenha os cadastros atualizados nas áreas Clientes e Frota. Informe ao menos nome, contato e documento do cliente; para veículos, modelo, placa, categoria e valor da diária.", styles["body"]))
    story.append(p("Financeiro", styles["h2"]))
    story.append(p("Em Financeiro, o sistema consolida receita prevista, valores já recebidos, despesas e resultado. Cada locação apresenta o saldo pendente; use Receber para registrar o pagamento integral. As despesas podem ser adicionadas na mesma tela.", styles["body"]))
    story.append(Image(str(SHOTS / "02-financeiro.png"), width=16.3 * cm, height=12.25 * cm))
    story.append(p("Controle de recebimentos, despesas e resultado da operação.", styles["caption"]))
    story.append(PageBreak())

    story.append(p("4. Detalhes, contrato e backup", styles["h1"]))
    story.append(p("Ao abrir uma locação, confira cliente, veículo, período, valor, itens de conferência e saldo. O botão Contrato mostra uma prévia pronta para impressão. Use o seletor de forma de pagamento antes de receber o saldo.", styles["body"]))
    story.append(Image(str(SHOTS / "03-detalhe-locacao.png"), width=16.3 * cm, height=11.95 * cm))
    story.append(p("Detalhe da locação com checklist, saldo e comandos operacionais.", styles["caption"]))
    story.append(p("Backup e restauração", styles["h2"]))
    story.append(step(1, "Exportar backup", "Abra Documentos e backup e selecione Exportar backup. Guarde o arquivo JSON em uma pasta segura, pendrive ou nuvem corporativa.", styles))
    story.append(step(2, "Restaurar backup", "Na mesma tela, escolha Restaurar backup e selecione o arquivo JSON previamente exportado. A restauração substitui os dados atuais pelo conteúdo do arquivo.", styles))
    story.append(p("Rotina recomendada", styles["h2"]))
    story.append(p("Faça um backup ao fim de cada dia de operação e antes de atualizações. Revise periodicamente os valores em aberto, a disponibilidade da frota e as despesas pendentes.", styles["body"]))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
