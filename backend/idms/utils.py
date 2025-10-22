# backend/idcards/utils.py
from PIL import Image, ImageDraw, ImageFont
import io, os, math
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, A3
from reportlab.lib.utils import ImageReader
from django.http import HttpResponse
import json
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




# def render_card_image(student, template):
#     """Render card image at template background's native pixel size using template.fields (image-pixel coords)."""
#     bg_path = template.background.path
#     background = Image.open(bg_path).convert("RGBA")
#     draw = ImageDraw.Draw(background)
#     fields = template.fields or {}

#     def _normalize_key_variants(key: str):
#         variants = [key, key.lower(), key.replace(" ", "_"), key.replace(" ", "_").lower()]
#         return list(dict.fromkeys(variants))  # unique, preserve order

#     def _get_meta_dict(s):
#         meta = None
        
#         if isinstance(s, dict):
#             # try common meta keys
#             meta = s.get("meta") or s.get("metadata") or s.get("Meta")
#         else:
#             meta = getattr(s, "meta", None)
#         if isinstance(meta, str):
#             try:
#                 meta_parsed = json.loads(meta)
#                 if isinstance(meta_parsed, dict):
#                     return meta_parsed
#             except Exception:
#                 return {}
#         if isinstance(meta, dict):
#             return meta
#         return {}

#     def _get_from_obj_or_dict(s, key):
#         """Try to resolve `key` from object attributes and dict keys, and return None if not found."""
#         # 1) direct attribute (for model instances)
#         if not isinstance(s, dict):
#             if hasattr(s, key):
#                 return getattr(s, key)
#             # try lowercase attr
#             lower = key.lower()
#             if hasattr(s, lower):
#                 return getattr(s, lower)
#             snake = key.replace(" ", "_").lower()
#             if hasattr(s, snake):
#                 return getattr(s, snake)

#         # 2) dict access
#         if isinstance(s, dict):
#             # try key variations
#             for k in _normalize_key_variants(key):
#                 if k in s:
#                     return s[k]

#         return None

#     def get_student_value(s, field_name):
#         # support nested lookup like "parent.fatherName"
#         if "." in field_name:
#             parts = field_name.split(".")
#             cur = s
#             for p in parts:
#                 cur = _get_from_obj_or_dict(cur, p)
#                 if cur is None:
#                     # if not found in top-level, try meta on the original student for nested full key
#                     break
#             if cur is not None:
#                 return cur

#         # try direct attribute/key
#         val = _get_from_obj_or_dict(s, field_name)
#         if val is not None:
#             return val

#         # try meta dict
#         #import ipdb; ipdb.set_trace()
#         meta = _get_meta_dict(s)
#         if meta:
#             for k in _normalize_key_variants(field_name):
#                 if k in meta:
#                     return meta[k]

#         # fallback: try other common names: remove non-alphanumeric and try
#         fallback_key = "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in field_name).lower()
#         if meta and fallback_key in meta:
#             return meta[fallback_key]

#         return None

#     # deterministic order
#     for field_name in fields.keys():
#         cfg = fields[field_name] or {}
#         x = int(round(cfg.get("x", 0))); y = int(round(cfg.get("y", 0)))
#         w = int(round(cfg.get("width", cfg.get("w", 0))))
#         h = int(round(cfg.get("height", cfg.get("h", 0))))

#         if cfg.get("isImage") or field_name.lower() == "photo":
#             photo_attr = get_student_value(student, "photo")
#             photo_path = None
#             if photo_attr is None:
#                 # also try 'photo_path' or 'photo_url'
#                 photo_attr = get_student_value(student, "photo_path") or get_student_value(student, "photo_url")

#             # handle different photo shapes: Django FileField, dict, plain string
#             try:
#                 if photo_attr is None:
#                     pass
#                 elif hasattr(photo_attr, "path"):
#                     photo_path = photo_attr.path
#                 elif isinstance(photo_attr, dict):
#                     # common nested shapes
#                     photo_path = photo_attr.get("path") or photo_attr.get("url") or photo_attr.get("file")
#                 elif isinstance(photo_attr, str):
#                     photo_path = photo_attr
#                 elif hasattr(photo_attr, "url"):
#                     # File-like with url
#                     photo_path = getattr(photo_attr, "url")
#             except Exception:
#                 photo_path = None

#             if photo_path:
#                 try:
#                     paste_photo_exact(background, photo_path, x, y, w, h)
#                 except Exception:
#                     # ignore photo paste errors (keeps other fields rendering)
#                     pass
#             continue

#         # fetch text (attribute then meta)
#         value = get_student_value(student, field_name)
#         # debug print left intentionally — remove or change to logging as needed
#         print(field_name, value)
#         if value is None:
#             continue
#         text = str(value)
#         font_name = cfg.get("font", "arial.ttf")
#         font_size = int(round(cfg.get("size", max(10, (h//2 if h else 14)))))
#         font = load_font(font_name, font_size)
#         color = cfg.get("color", "#000000")
#         try:
#             draw.text((x, y), text, fill=color, font=font)
#         except Exception:
#             draw.text((x, y), text, fill=color)

#     return background.convert("RGB")


def render_card_image(student, template):
    """Render card image at template background's native pixel size using template.fields (image-pixel coords)."""
    bg_path = template.background.path
    background = Image.open(bg_path).convert("RGBA")
    draw = ImageDraw.Draw(background)
    fields = template.fields or {}

    def _normalize_key_variants(key: str):
        variants = [key, key.lower(), key.replace(" ", "_"), key.replace(" ", "_").lower()]
        return list(dict.fromkeys(variants))  # unique, preserve order

    def _get_meta_dict(s):
        meta = None
        if isinstance(s, dict):
            meta = s.get("meta") or s.get("metadata") or s.get("Meta")
        else:
            meta = getattr(s, "meta", None)
        if isinstance(meta, str):
            try:
                meta_parsed = json.loads(meta)
                if isinstance(meta_parsed, dict):
                    return meta_parsed
            except Exception:
                return {}
        if isinstance(meta, dict):
            return meta
        return {}

    def _get_from_obj_or_dict(s, key):
        if not isinstance(s, dict):
            if hasattr(s, key):
                return getattr(s, key)
            lower = key.lower()
            if hasattr(s, lower):
                return getattr(s, lower)
            snake = key.replace(" ", "_").lower()
            if hasattr(s, snake):
                return getattr(s, snake)
        if isinstance(s, dict):
            for k in _normalize_key_variants(key):
                if k in s:
                    return s[k]
        return None

    def get_student_value(s, field_name):
        if "." in field_name:
            parts = field_name.split(".")
            cur = s
            for p in parts:
                cur = _get_from_obj_or_dict(cur, p)
                if cur is None:
                    break
            if cur is not None:
                return cur

        val = _get_from_obj_or_dict(s, field_name)
        if val is not None:
            return val

        meta = _get_meta_dict(s)
        if meta:
            for k in _normalize_key_variants(field_name):
                if k in meta:
                    return meta[k]

        fallback_key = "".join(ch if ch.isalnum() or ch == "_" else "_" for ch in field_name).lower()
        if meta and fallback_key in meta:
            return meta[fallback_key]

        return None

    # deterministic order
    for field_name in fields.keys():
        cfg = fields[field_name] or {}
        x = int(round(cfg.get("x", 0)))
        y = int(round(cfg.get("y", 0)))
        w = int(round(cfg.get("width", cfg.get("w", 0))))
        h = int(round(cfg.get("height", cfg.get("h", 0))))

        # --- handle photo fields ---
        if cfg.get("isImage") or field_name.lower() == "photo":
            photo_attr = get_student_value(student, "photo")
            photo_path = None
            if photo_attr is None:
                photo_attr = get_student_value(student, "photo_path") or get_student_value(student, "photo_url")

            try:
                if photo_attr is None:
                    pass
                elif hasattr(photo_attr, "path"):
                    photo_path = photo_attr.path
                elif isinstance(photo_attr, dict):
                    photo_path = photo_attr.get("path") or photo_attr.get("url") or photo_attr.get("file")
                elif isinstance(photo_attr, str):
                    photo_path = photo_attr
                elif hasattr(photo_attr, "url"):
                    photo_path = getattr(photo_attr, "url")
            except Exception:
                photo_path = None

            if photo_path:
                try:
                    paste_photo_exact(background, photo_path, x, y, w, h)
                except Exception:
                    pass
            continue

        # --- handle text fields ---
        value = get_student_value(student, field_name)
        print(field_name, value)
        if value is None:
            continue

        text = str(value)
        font_name = cfg.get("font", "arial.ttf")
        font_size = int(round(cfg.get("size", max(10, (h // 2 if h else 14)))))
        font = load_font(font_name, font_size)
        color = cfg.get("color", "#000000")

        # ---------- NEW: WORD WRAPPING ----------
        max_width = w if w > 0 else background.width
        lines = []
        words = text.split()
        current = ""
        for word in words:
            test_line = (current + " " + word).strip()
            tw, th = draw.textbbox((0, 0), test_line, font=font)[2:]
            if tw <= max_width:
                current = test_line
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)

        line_height = draw.textbbox((0, 0), "Ag", font=font)[3] - draw.textbbox((0, 0), "Ag", font=font)[1]
        total_text_height = len(lines) * line_height

        # vertical centering
        start_y = y
        if total_text_height < h:
            start_y = y + (h - total_text_height) // 2

        # draw each line centered horizontally
        for i, line in enumerate(lines):
            tw, _ = draw.textbbox((0, 0), line, font=font)[2:]
            line_x = x + max(0, (max_width - tw) // 2)
            draw.text((line_x, start_y + i * line_height), line, fill=color, font=font)
    # ---------------------------------------------

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
