# backend/idcards/utils.py
from PIL import Image, ImageDraw, ImageFont, ImageOps
import io, os, math, json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, A3
from reportlab.lib.utils import ImageReader

MM_TO_PT = 72.0 / 25.4
IN_TO_PT = 72.0

# paper sizes in points
PAPER_SIZES = {
    "A4": (A4[0], A4[1]),
    "A3": (A3[0], A3[1]),
    "12x18": (12 * IN_TO_PT, 18 * IN_TO_PT),
    "13x19": (13 * IN_TO_PT, 19 * IN_TO_PT),
}

DEFAULT_FONT_DIRS = [
    "C:\\Windows\\Fonts\\",
    "/usr/share/fonts/truetype/",
    "/usr/share/fonts/",
]

def mm_to_pt(mm): return mm * MM_TO_PT

def find_font_path(font_name: str):
    if not font_name:
        return None
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

def _antialiased_polygon_mask(size, polygon_points):
    """
    Create an anti-aliased mask for a polygon by drawing into a larger temporary image and downscaling.
    size: (w,h)
    polygon_points: list of (x,y) float coords relative to size
    """
    scale = 4  # supersampling factor
    w, h = size
    tmp = Image.new("L", (w * scale, h * scale), 0)
    scaled = [(int(x * scale), int(y * scale)) for (x, y) in polygon_points]
    ImageDraw.Draw(tmp).polygon(scaled, fill=255)
    return tmp.resize((w, h), resample=Image.LANCZOS)

def paste_photo_exact(card: Image.Image, photo_path: str, x:int, y:int, w:int, h:int, shape: str | None = None):
    """
    Paste photo into `card` at (x,y) with target size (w,h).
    If `shape` provided, apply a mask (circle, hexagon, rounded rect, etc).
    Coordinates x,y,w,h are in card pixel coordinates.
    """
    try:
        img = Image.open(photo_path).convert("RGBA")
    except Exception:
        return

    if w <= 0 or h <= 0:
        return

    # Resize to cover (like CSS cover): fill the box, center-cropped
    img_w, img_h = img.size
    img_ratio = img_w / img_h
    box_ratio = float(w) / float(h)
    if img_ratio > box_ratio:
        # image wider -> match height
        new_h = h
        new_w = int(round(h * img_ratio))
    else:
        # image taller or equal -> match width
        new_w = w
        new_h = int(round(w / img_ratio))

    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = max(0, (new_w - w)//2)
    top = max(0, (new_h - h)//2)
    cropped = img.crop((left, top, left + w, top + h))

    # dest layer
    layer = Image.new("RGBA", (w, h), (0,0,0,0))
    layer.paste(cropped, (0,0), cropped)

    # create mask
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    s = (shape or "square")
    s = str(s).lower()

    if s in ("square", "rectangle"):
        draw.rectangle([0,0,w,h], fill=255)
    elif s == "rounded" or s == "round" or s == "rounded_rect":
        r = int(min(w, h) * 0.12)
        # PIL's rounded_rectangle may not exist on very old versions; fallback handled
        try:
            draw.rounded_rectangle([0,0,w,h], radius=r, fill=255)
        except Exception:
            draw.rectangle([0,0,w,h], fill=255)
    elif s in ("circle", "sphere"):
        draw.ellipse([0,0,w,h], fill=255)
    elif s == "hexagon":
        # Hexagon with points scaled to box, slightly inset to avoid clipping of corners
        inset = min(w,h) * 0.02
        cx = w/2.0
        cy = h/2.0
        r = min(w,h)/2.0 - inset
        pts = []
        for i in range(6):
            ang = math.radians(-90 + i * 60)
            px = cx + r * math.cos(ang)
            py = cy + r * math.sin(ang)
            pts.append((px, py))
        # Use supersampled polygon mask for smoother edges
        mask = _antialiased_polygon_mask((w,h), pts)
    else:
        # default full rect
        draw.rectangle([0,0,w,h], fill=255)

    # Paste with mask (use alpha composite if paste with mask fails)
    try:
        card.paste(layer, (x, y), mask)
    except Exception:
        tmp = Image.new("RGBA", card.size)
        tmp.paste(layer, (x, y))
        card.alpha_composite(tmp)

# ---------- render_card_image with helpers ----------
def render_card_image(student, template):
    """Render card image at template background's native pixel size using template.fields (image-pixel coords)."""
    bg_path = template.background.path
    background = Image.open(bg_path).convert("RGBA")
    draw = ImageDraw.Draw(background)
    fields = template.fields or {}

    # helper functions
    def _normalize_key_variants(key: str):
        variants = [key, key.lower(), key.replace(" ", "_"), key.replace(" ", "_").lower()]
        seen = set()
        out = []
        for v in variants:
            if v not in seen:
                seen.add(v)
                out.append(v)
        return out

    def _get_meta_dict(s):
        meta = None
        if isinstance(s, dict):
            meta = s.get("meta") or s.get("metadata") or s.get("Meta")
        else:
            meta = getattr(s, "meta", None)
        if isinstance(meta, str):
            try:
                parsed = json.loads(meta)
                if isinstance(parsed, dict):
                    return parsed
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
        # nested lookup support
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

    # debug: print template fields to server logs to verify 'shape' and 'align'
    try:
        print("TEMPLATE FIELDS:", json.dumps(fields, indent=2))
    except Exception:
        print("TEMPLATE FIELDS (raw):", fields)

    # iterate in deterministic order
    for field_name in list(fields.keys()):
        cfg = fields[field_name] or {}
        x = int(round(cfg.get("x", 0)))
        y = int(round(cfg.get("y", 0)))
        w = int(round(cfg.get("width", cfg.get("w", 0))))
        h = int(round(cfg.get("height", cfg.get("h", 0))))

        # image/photo
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
                    shape = cfg.get("shape")
                    paste_photo_exact(background, photo_path, x, y, w, h, shape=shape)
                except Exception:
                    pass
            continue

                # ---------- TEXT FIELDS (auto font shrink to fit box, no wrap) ----------
        value = get_student_value(student, field_name)
        if value is None:
            continue

        text = str(value).strip()
        font_name = cfg.get("font", "arial.ttf")
        base_font_size = int(round(cfg.get("size", max(10, (h // 2 if h else 14)))))
        color = cfg.get("color", "#000000")
        align = (cfg.get("align") or "left").lower()

        max_width = max(1, int(w or background.width))
        max_height = max(1, int(h or background.height))

        # Start from base size, shrink proportionally until it fits
        font_size = base_font_size
        font = load_font(font_name, font_size)

        # Measure text width and height and adjust font size
        while font_size > 6:
            try:
                bbox = draw.textbbox((0, 0), text, font=font)
                text_w = bbox[2] - bbox[0]
                text_h = bbox[3] - bbox[1]
            except Exception:
                text_w, text_h = draw.textsize(text, font=font)

            if text_w <= max_width and text_h <= max_height:
                break
            font_size -= 1
            font = load_font(font_name, font_size)

        # Final bounding box check
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
        except Exception:
            text_w, text_h = draw.textsize(text, font=font)

        # Center vertically within box
        start_y = y + max(0, (h - text_h) // 2)

        # Align horizontally
        if align == "center":
            text_x = x + max(0, (w - text_w) // 2)
        elif align == "right":
            text_x = x + max(0, (w - text_w))
        else:
            text_x = x

        # Draw single-line, auto-shrunk text
        draw.text((text_x, start_y), text, fill=color, font=font)
    return background.convert("RGB")

# ---------- grid + PDF functions (unchanged logic) ----------
def compute_grid(paper_w_pt, paper_h_pt, card_w_pt, card_h_pt, margin_pt=18, spacing_pt=8):
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
    top_offset = (inner_h - used_h)/2
    y_top = paper_h_pt - margin_pt - top_offset
    return cols, rows, cols*rows, x_start, y_top, used_w, used_h

def generate_id_cards(students, template, paper="A4", margin_mm=10, spacing_mm=3, max_pages=None):
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
