from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "apps" / "nexus-desktop" / "build" / "appx"
ICON_PATH = ROOT / "apps" / "nexus-desktop" / "build" / "pdv-nexus.ico"
ASSET_DIR.mkdir(parents=True, exist_ok=True)

FONT_BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/segoeui.ttf")

def font(path, size):
    return ImageFont.truetype(str(path), max(8, size))

def gradient(size):
    width, height = size
    image = Image.new("RGBA", size, (15, 23, 42, 255))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            ratio = (x + y) / max(1, width + height - 2)
            pixels[x, y] = (
                int(15 + 0 * ratio),
                int(23 + 142 * ratio),
                int(42 + 188 * ratio),
                255,
            )
    return image

def draw_square(size, short=False):
    image = gradient((size, size))
    draw = ImageDraw.Draw(image)
    margin = max(2, size // 12)
    draw.rounded_rectangle((margin, margin, size-margin, size-margin), radius=max(4, size//6), outline=(255,255,255,90), width=max(1,size//40))
    label = "N" if short else "PDV"
    text_font = font(FONT_BOLD, int(size * (0.52 if short else 0.34)))
    box = draw.textbbox((0, 0), label, font=text_font)
    x = (size - (box[2]-box[0])) / 2
    y = (size - (box[3]-box[1])) / 2 - box[1]
    draw.text((x, y), label, font=text_font, fill=(255,255,255,255))
    if not short and size >= 100:
        subtitle = "NEXUS"
        sub_font = font(FONT_REGULAR, int(size * 0.10))
        sub_box = draw.textbbox((0,0), subtitle, font=sub_font)
        draw.text(((size-(sub_box[2]-sub_box[0]))/2, size*0.72), subtitle, font=sub_font, fill=(186,230,253,255))
    return image

def draw_wide():
    image = gradient((310, 150))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((10,10,140,140), radius=24, outline=(255,255,255,90), width=3)
    draw.text((33, 45), "PDV", font=font(FONT_BOLD, 43), fill=(255,255,255,255))
    draw.text((158, 45), "PDV Nexus", font=font(FONT_BOLD, 26), fill=(255,255,255,255))
    draw.text((158, 82), "Caixa, estoque e vendas", font=font(FONT_REGULAR, 14), fill=(186,230,253,255))
    return image

draw_square(50, short=True).save(ASSET_DIR / "StoreLogo.png")
draw_square(150).save(ASSET_DIR / "Square150x150Logo.png")
draw_square(44, short=True).save(ASSET_DIR / "Square44x44Logo.png")
draw_wide().save(ASSET_DIR / "Wide310x150Logo.png")

icon = draw_square(256)
icon.save(ICON_PATH, format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
print(ASSET_DIR)
print(ICON_PATH)
