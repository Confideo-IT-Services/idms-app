# backend/idcards/utils.py
from PIL import Image, ImageDraw, ImageFont
import io, os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader

DEFAULT_FONT_DIRS = [
    "/usr/share/fonts/truetype/",
    "/usr/share/fonts/",
    "C:\\Windows\\Fonts\\",
]

def find_font_path(font_name: str):
    # Try common paths, fallback to PIL default font if not found
    for base in DEFAULT_FONT_DIRS:
        path = os.path.join(base, font_name)
        if os.path.exists(path):
            return path
    # not found: return None
    return None

def _open_font(font_name: str, size: int):
    font_path = find_font_path(font_name) if font_name else None
    try:
        if font_path:
            return ImageFont.truetype(font_path, size)
    except Exception:
        pass
    # fallback to default PIL font
    return ImageFont.load_default()

def _paste_photo_onto_card(card: Image.Image, photo_path: str, cfg: dict):
    """
    Paste the photo at cfg x,y,width,height — keep aspect ratio and center.
    """
    try:
        # ensure ints
        x = int(round(cfg.get("x", 0)))
        y = int(round(cfg.get("y", 0)))
        w = int(round(cfg.get("width", cfg.get("w", 100))))
        h = int(round(cfg.get("height", cfg.get("h", 100))))
        if w <= 0 or h <= 0:
            return
    except Exception:
        return

    try:
        img = Image.open(photo_path).convert("RGBA")
    except Exception:
        return

    # Resize the photo to fit box while keeping aspect ratio, then center-crop/pad
    img_ratio = img.width / img.height
    box_ratio = w / h

    if img_ratio > box_ratio:
        # image is wider — fit height
        new_h = h
        new_w = int(round(h * img_ratio))
    else:
        new_w = w
        new_h = int(round(w / img_ratio))

    img = img.resize((new_w, new_h), Image.LANCZOS)

    # center crop
    left = max(0, (new_w - w) // 2)
    top = max(0, (new_h - h) // 2)
    img = img.crop((left, top, left + w, top + h))

    # paste with alpha if any
    card.paste(img, (x, y), img if img.mode == "RGBA" else None)

def generate_id_cards(students, template, font_dir=None):
    """
    students: queryset or list of Student model instances
    template: IdCardTemplate instance with .background.path and .fields (dict)
    returns: io.BytesIO buffer containing PDF
    """
    if font_dir:
        DEFAULT_FONT_DIRS.insert(0, font_dir)

    # Load background image
    bg_path = template.background.path
    background = Image.open(bg_path).convert("RGBA")

    # PDF canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4  # points

    for s in students:
        card = background.copy().convert("RGBA")
        draw = ImageDraw.Draw(card)

        for field, cfg in (template.fields or {}).items():
            # normalize cfg numeric fields to ints
            try:
                cfg_x = int(round(cfg.get("x", 0)))
                cfg_y = int(round(cfg.get("y", 0)))
                cfg_w = int(round(cfg.get("width", cfg.get("w", 0))))
                cfg_h = int(round(cfg.get("height", cfg.get("h", 0))))
            except Exception:
                cfg_x = int(cfg.get("x", 0)) if cfg.get("x") else 0
                cfg_y = int(cfg.get("y", 0)) if cfg.get("y") else 0
                cfg_w = int(cfg.get("width", 0)) if cfg.get("width") else 0
                cfg_h = int(cfg.get("height", 0)) if cfg.get("height") else 0

            if field == "photo" or cfg.get("isImage"):
                # paste photo
                if getattr(s, "photo", None):
                    _paste_photo_onto_card(card, s.photo.path, {"x": cfg_x, "y": cfg_y, "width": cfg_w, "height": cfg_h})
                continue

            # text value: prefer attribute then meta
            text_val = getattr(s, field, None)
            if text_val is None:
                text_val = (s.meta or {}).get(field, "")
            text_val = "" if text_val is None else str(text_val)

            if not text_val:
                continue

            # font handling
            font_name = cfg.get("font", "arial.ttf")
            font_size = int(round(cfg.get("size", max(10, cfg_h // 2 if cfg_h else 14))))
            font = _open_font(font_name, font_size)

            # color
            color = cfg.get("color", "#000000")
            try:
                draw.text((cfg_x, cfg_y), text_val, fill=color, font=font)
            except Exception:
                # fallback using default font
                draw.text((cfg_x, cfg_y), text_val, fill=color)

        # write card image into PDF page
        tmp = io.BytesIO()
        card_rgb = card.convert("RGB")  # reportlab handles RGB/JPEG/PNG via ImageReader
        card_rgb.save(tmp, format="PNG")
        tmp.seek(0)
        img = ImageReader(tmp)

        # optionally compute scale to place card on the PDF page; here we center at full width if small
        img_w, img_h = card_rgb.size  # in pixels
        # convert pixels to points (ReportLab expects points). PIL image size is pixels.
        # For simplicity, draw image at original pixel sizes in points (1px ~ 1pt) — adjust as needed.
        # Place at center:
        x_pos = (page_w - img_w) / 2
        y_pos = (page_h - img_h) / 2
        try:
            c.drawImage(img, x_pos, y_pos, width=img_w, height=img_h)
        except Exception:
            # fallback: draw image at some default size
            c.drawImage(img, 50, 500, width=300, height=200)

        c.showPage()

    c.save()
    buf.seek(0)
    return buf
