# backend/idcards/utils.py
from PIL import Image, ImageDraw, ImageFont
import io, os, math
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, A3
from reportlab.lib.utils import ImageReader
from django.http import HttpResponse

MM_TO_PT = 72.0 / 25.4
IN_TO_PT = 72.0

# paper sizes in points
PAPER_SIZES = {
    "A4": (A4[0], A4[1]),
    "A3": (A3[0], A3[1]),
    "12x18": (12 * IN_TO_PT, 18 * IN_TO_PT),
    "13x19": (13 * IN_TO_PT, 19 * IN_TO_PT),
    # add more custom presets as needed
}

DEFAULT_FONT_DIRS = [
    "C:\\Windows\\Fonts\\",
    "/usr/share/fonts/truetype/",
    "/usr/share/fonts/",
]

def mm_to_pt(mm): return mm * MM_TO_PT

def find_font_path(font_name: str):
    if not font_name: return None
    for base in DEFAULT_FONT_DIRS:
        path = os.path.join(base, font_name)
        if os.path.exists(path):
            return path
    return None

def load_font(font_name: str, size: int):
    path = find_font_path(font_name)
    try:
        if path:
            return ImageFont.truetype(path, size)
    except Exception:
        pass
    return ImageFont.load_default()

def paste_photo_exact(card: Image.Image, photo_path: str, x:int,y:int,w:int,h:int):
    try:
        img = Image.open(photo_path).convert("RGBA")
    except Exception:
        return
    img_w, img_h = img.size
    if w <= 0 or h <= 0: return
    img_ratio = img_w / img_h
    box_ratio = w / h
    if img_ratio > box_ratio:
        new_h = h; new_w = int(round(h * img_ratio))
    else:
        new_w = w; new_h = int(round(w / img_ratio))
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = max(0, (new_w - w)//2); top = max(0, (new_h - h)//2)
    img = img.crop((left, top, left + w, top + h))
    card.paste(img, (x,y), img if img.mode == "RGBA" else None)

def render_card_image(student, template):
    """Render card image at template background's native pixel size using template.fields (image-pixel coords)."""
    bg_path = template.background.path
    background = Image.open(bg_path).convert("RGBA")
    draw = ImageDraw.Draw(background)
    fields = template.fields or {}

    # deterministic order
    for field_name in fields.keys():
        cfg = fields[field_name] or {}
        x = int(round(cfg.get("x", 0))); y = int(round(cfg.get("y", 0)))
        w = int(round(cfg.get("width", cfg.get("w", 0))))
        h = int(round(cfg.get("height", cfg.get("h", 0))))

        if cfg.get("isImage") or field_name.lower() == "photo":
            photo_attr = getattr(student, "photo", None)
            if photo_attr:
                paste_photo_exact(background, photo_attr.path, x, y, w, h)
            continue

        # fetch text (attribute then meta)
        value = getattr(student, field_name, None)
        if value is None:
            meta = getattr(student, "meta", None) or {}
            value = meta.get(field_name)
            print(field_name, value)
        if value is None:
            continue
        text = str(value)
        font_name = cfg.get("font", "arial.ttf")
        font_size = int(round(cfg.get("size", max(10, (h//2 if h else 14)))))
        font = load_font(font_name, font_size)
        color = cfg.get("color", "#000000")
        try:
            draw.text((x, y), text, fill=color, font=font)
        except Exception:
            draw.text((x, y), text, fill=color)

    return background.convert("RGB")

def compute_grid(paper_w_pt, paper_h_pt, card_w_pt, card_h_pt, margin_pt=18, spacing_pt=8):
    """
    Exact floor-fitting grid calculator.
    Returns: cols, rows, per_page, x_start_pt, y_top_pt, used_w, used_h
    x_start_pt: left x of first card.
    y_top_pt: top y coordinate of the first row (ReportLab coords from bottom, we will compute Y when drawing).
    """
    inner_w = paper_w_pt - 2 * margin_pt
    inner_h = paper_h_pt - 2 * margin_pt
    if inner_w <= 0 or inner_h <= 0:
        return 0,0,0,margin_pt, paper_h_pt - margin_pt, 0, 0

    cols = int((inner_w + spacing_pt) // (card_w_pt + spacing_pt))
    rows = int((inner_h + spacing_pt) // (card_h_pt + spacing_pt))
    cols = max(1, cols); rows = max(1, rows)
    used_w = cols * card_w_pt + (cols - 1) * spacing_pt
    used_h = rows * card_h_pt + (rows - 1) * spacing_pt
    x_start = margin_pt + max(0, (inner_w - used_w)/2)
    # compute top Y (ReportLab origin bottom-left; top y for first row = page_h - margin - top_offset)
    top_offset = (inner_h - used_h)/2
    y_top = paper_h_pt - margin_pt - top_offset
    return cols, rows, cols*rows, x_start, y_top, used_w, used_h

def generate_id_cards(students, template, paper="A4", margin_mm=10, spacing_mm=3, max_pages=None):
    """
    Pack cards into the paper using exact grid computed above.
    template.card_size_mm expected.
    Returns BytesIO (PDF).
    """
    if isinstance(paper, str):
        paper = paper.upper()
        if paper not in PAPER_SIZES:
            paper_w_pt, paper_h_pt = PAPER_SIZES["A4"]
        else:
            paper_w_pt, paper_h_pt = PAPER_SIZES[paper]
    else:
        paper_w_pt, paper_h_pt = paper

    cs = getattr(template, "card_size_mm", None) or {"w":54,"h":86}
    card_w_pt = mm_to_pt(cs.get("w", 54))
    card_h_pt = mm_to_pt(cs.get("h", 86))
    margin_pt = mm_to_pt(margin_mm)
    spacing_pt = mm_to_pt(spacing_mm)

    cols, rows, per_page, x_start_pt, y_top_pt, used_w, used_h = compute_grid(
        paper_w_pt, paper_h_pt, card_w_pt, card_h_pt, margin_pt, spacing_pt
    )

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(paper_w_pt, paper_h_pt))

    count = 0
    page = 0
    for student in students:
        card_img = render_card_image(student, template)
        tmp = io.BytesIO()
        card_img.save(tmp, format="PNG")
        tmp.seek(0)
        img = ImageReader(tmp)

        idx = count % per_page
        col = idx % cols
        row = idx // cols

        x_pt = x_start_pt + col * (card_w_pt + spacing_pt)
        # compute y: top y minus rows offset minus card height
        y_pt = y_top_pt - row * (card_h_pt + spacing_pt) - card_h_pt

        c.drawImage(img, x_pt, y_pt, width=card_w_pt, height=card_h_pt)

        count += 1
        if count % per_page == 0:
            c.showPage()
            page += 1
            if max_pages and page >= max_pages:
                break

    if count % per_page != 0:
        c.showPage()

    c.save()
    buf.seek(0)
    return buf
