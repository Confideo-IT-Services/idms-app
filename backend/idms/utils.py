from PIL import Image, ImageDraw, ImageFont
import io, os, math
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader

DEFAULT_FONT_DIRS = [
    "/usr/share/fonts/truetype/",
    "/usr/share/fonts/",
    "C:\\Windows\\Fonts\\",
]

def find_font_path(font_name: str):
    for base in DEFAULT_FONT_DIRS:
        path = os.path.join(base, font_name)
        if os.path.exists(path):
            return path
    return None

def _open_font(font_name: str, size: int):
    font_path = find_font_path(font_name) if font_name else None
    try:
        if font_path:
            return ImageFont.truetype(font_path, size)
    except Exception:
        pass
    return ImageFont.load_default()

def _paste_photo(card: Image.Image, photo_path: str, cfg: dict):
    try:
        x, y = int(cfg["x"]), int(cfg["y"])
        w, h = int(cfg["width"]), int(cfg["height"])
    except Exception:
        return
    try:
        img = Image.open(photo_path).convert("RGBA")
    except Exception:
        return

    img_ratio, box_ratio = img.width / img.height, w / h
    if img_ratio > box_ratio:
        new_h = h
        new_w = int(h * img_ratio)
    else:
        new_w = w
        new_h = int(w / img_ratio)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    left = max(0, (new_w - w) // 2)
    top = max(0, (new_h - h) // 2)
    img = img.crop((left, top, left + w, top + h))

    card.paste(img, (x, y), img if img.mode == "RGBA" else None)

def render_card(student, template):
    """Render a single card image based on the template background + fields"""
    background = Image.open(template.background.path).convert("RGBA")
    card = background.copy().convert("RGBA")
    draw = ImageDraw.Draw(card)

    for field, cfg in (template.fields or {}).items():
        # normalize coordinates
        x, y = int(cfg.get("x", 0)), int(cfg.get("y", 0))
        w, h = int(cfg.get("width", 0)), int(cfg.get("height", 0))

        if cfg.get("isImage") or field == "photo":
            if getattr(student, "photo", None):
                _paste_photo(card, student.photo.path, {"x": x, "y": y, "width": w, "height": h})
            continue

        # Only render fields that exist in template
        val = getattr(student, field, None)
        if val is None:
            val = (student.meta or {}).get(field, "")
        text_val = str(val) if val else ""
        if not text_val:
            continue

        font_name = cfg.get("font", "arial.ttf")
        font_size = int(cfg.get("size", max(10, h // 2 if h else 14)))
        font = _open_font(font_name, font_size)
        color = cfg.get("color", "#000000")

        try:
            draw.text((x, y), text_val, fill=color, font=font)
        except Exception:
            draw.text((x, y), text_val, fill=color)

    return card.convert("RGB")

def generate_id_cards(students, template, card_w=300, card_h=200, cols=2, rows=4, margin=40, spacing=20):
    """
    Render ID cards in a grid layout on A4 PDF
    card_w, card_h = card size in points (72 dpi)
    cols, rows = number of cards per row/column
    margin = page margin in points
    spacing = gap between cards
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    x_start, y_start = margin, page_h - margin - card_h
    x, y = x_start, y_start
    count = 0

    for student in students:
        card_img = render_card(student, template)
        tmp = io.BytesIO()
        card_img.save(tmp, format="PNG")
        tmp.seek(0)
        img = ImageReader(tmp)

        c.drawImage(img, x, y, width=card_w, height=card_h)

        count += 1
        if count % cols == 0:
            # move to next row
            x = x_start
            y -= (card_h + spacing)
        else:
            # move right
            x += (card_w + spacing)

        if count % (cols * rows) == 0:
            # start new page
            c.showPage()
            x, y = x_start, page_h - margin - card_h

    if count % (cols * rows) != 0:
        c.showPage()

    c.save()
    buf.seek(0)
    return buf
