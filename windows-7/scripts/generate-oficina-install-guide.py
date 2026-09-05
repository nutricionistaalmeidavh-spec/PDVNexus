from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "guia-instalacao-sistema-oficina.pdf"


def paragraph(text, style):
    return Paragraph(text, style)


def header(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#123B4A"))
    canvas.rect(0, A4[1] - 1.45 * cm, A4[0], 1.45 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10)
    canvas.drawString(1.7 * cm, A4[1] - 0.9 * cm, "SISTEMA OFICINA")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(A4[0] - 1.7 * cm, A4[1] - 0.9 * cm, f"Guia de instalação | Página {doc.page}")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=26, leading=31, textColor=colors.HexColor("#123B4A"), spaceAfter=10)
    subtitle = ParagraphStyle("Subtitle", parent=styles["BodyText"], fontSize=12, leading=18, textColor=colors.HexColor("#4C6470"), spaceAfter=22)
    heading = ParagraphStyle("Heading", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=20, textColor=colors.HexColor("#123B4A"), spaceBefore=12, spaceAfter=8)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10.2, leading=15, textColor=colors.HexColor("#24333A"), spaceAfter=7)
    note = ParagraphStyle("Note", parent=body, backColor=colors.HexColor("#E9F4F3"), borderColor=colors.HexColor("#65A9A0"), borderWidth=0.7, borderPadding=10, spaceBefore=7, spaceAfter=13)

    story = [Spacer(1, 1.2 * cm), paragraph("Guia de instalação", title), paragraph("Sistema Oficina para Windows", subtitle)]
    story.append(paragraph("Antes de começar", heading))
    story.append(paragraph("Use um computador com Windows 10 ou 11, conexão com a internet apenas para baixar o instalador e uma conta de usuário com permissão para instalar programas. O sistema funciona localmente após a instalação.", body))
    story.append(paragraph("<b>Importante:</b> instale o programa em um computador que seja usado pela oficina. Os dados ficam gravados localmente nesse computador, e as cópias automáticas são armazenadas junto aos dados do aplicativo.", note))

    story.append(paragraph("1. Instalar", heading))
    install_rows = [
        ["1", "Baixe o arquivo Sistema-Oficina-Setup.exe no Drive e aguarde o fim do download."],
        ["2", "Abra o arquivo baixado. Caso o Windows peça confirmação, escolha Mais informações e depois Executar assim mesmo, somente se o arquivo foi baixado da pasta oficial."],
        ["3", "Na tela do instalador, escolha a pasta de instalação, aceite os termos exibidos e conclua."],
        ["4", "Abra Sistema Oficina pelo atalho criado na área de trabalho ou no menu Iniciar."],
    ]
    table = Table([[paragraph(a, body), paragraph(b, body)] for a, b in install_rows], colWidths=[1.0 * cm, 15.5 * cm], repeatRows=0)
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5B544")), ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E1E3")), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E1E3")), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story.append(table)

    story.append(paragraph("2. Primeiro acesso", heading))
    story.append(paragraph("Na primeira tela, selecione o usuário e informe a senha. A instalação inicial usa a senha <b>1234</b> para os usuários de demonstração. Antes de usar no dia a dia, cadastre os usuários reais e defina senhas próprias.", body))
    story.append(paragraph("Perfis: Administrador gerencia configurações, financeiro, estoque, documentos e usuários. Atendente opera clientes, veículos e ordens. Técnico trabalha nas ordens de serviço, sem acesso a pagamentos, backup ou configurações.", body))

    story.append(paragraph("3. Configurar a oficina", heading))
    story.append(paragraph("Entre como Administrador, abra Configurações e preencha nome, CPF/CNPJ, telefone e endereço. Esses dados aparecem nos documentos de ordem de serviço. Defina também quantas cópias automáticas devem ser mantidas; o padrão é 14.", body))

    story.append(PageBreak())
    story.append(Spacer(1, 0.2 * cm))
    story.append(paragraph("4. Uso diário", heading))
    daily_rows = [
        ["Clientes e veículos", "Cadastre primeiro o cliente e depois o veículo vinculado a ele."],
        ["Ordens de serviço", "Crie uma OS, registre o serviço, associe o técnico e mova pelas etapas: Entrada, Diagnóstico, Em execução e Finalização."],
        ["Estoque", "Adicione peças à OS. Ao finalizar a ordem, o sistema desconta as peças do estoque e sinaliza itens abaixo do mínimo."],
        ["Financeiro", "Registre os pagamentos da OS e acompanhe os valores recebidos e em aberto."],
        ["Documentos", "Abra a OS para visualizar e imprimir o documento para o cliente."],
    ]
    table = Table([[paragraph(a, body), paragraph(b, body)] for a, b in daily_rows], colWidths=[4.0 * cm, 12.5 * cm])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#E9F4F3")), ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E1E3")), ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D9E1E3")), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story.append(table)

    story.append(paragraph("5. Backup e recuperação", heading))
    story.append(paragraph("No aplicativo desktop, uma cópia automática é criada no primeiro uso de cada dia e as cópias mais antigas são removidas conforme a retenção configurada. Em Documentos, use Exportar backup para guardar uma cópia fora do computador, por exemplo em pendrive ou nuvem.", body))
    story.append(paragraph("Para recuperar dados: entre como Administrador, abra Documentos, escolha Restaurar backup e selecione um arquivo JSON que foi exportado anteriormente. A restauração substitui os dados atuais; exporte uma cópia antes de restaurar quando houver qualquer dúvida.", note))

    story.append(paragraph("6. Atualizações e suporte", heading))
    story.append(paragraph("Antes de instalar uma atualização, exporte um backup manual. Instale a nova versão sobre a anterior apenas quando orientado pelo fornecedor. Não desinstale o programa para atualizar sem ter uma cópia externa dos dados.", body))
    story.append(paragraph("Checklist final: dados da oficina preenchidos, usuários cadastrados, uma OS de teste criada, uma peça baixada do estoque, um pagamento registrado e um backup exportado.", body))

    SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=1.7 * cm, leftMargin=1.7 * cm, topMargin=1.8 * cm, bottomMargin=1.5 * cm, title="Guia de instalação - Sistema Oficina").build(story, onFirstPage=header, onLaterPages=header)


if __name__ == "__main__":
    build()
