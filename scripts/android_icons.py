"""Genera los iconos de Android (clásicos, redondos y adaptativos) desde el logo.
Uso: python3 scripts/android_icons.py android/app/src/main/res"""
import sys, os
from PIL import Image, ImageDraw

res = sys.argv[1]
src = Image.open("branding/icon-1024.png").convert("RGB")
bg = src.getpixel((8, 8))  # verde de fondo del logo

legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
fore = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

for d, size in legacy.items():
    out = os.path.join(res, f"mipmap-{d}")
    os.makedirs(out, exist_ok=True)
    img = src.resize((size, size), Image.LANCZOS)
    img.save(os.path.join(out, "ic_launcher.png"))
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    round_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_img.paste(img, (0, 0), mask)
    round_img.save(os.path.join(out, "ic_launcher_round.png"))

# Adaptativo: el logo ocupa ~66% del lienzo para que ninguna máscara lo recorte
for d, size in fore.items():
    out = os.path.join(res, f"mipmap-{d}")
    os.makedirs(out, exist_ok=True)
    canvas = Image.new("RGBA", (size, size), bg + (255,))
    inner = int(size * 0.66)
    logo = src.resize((inner, inner), Image.LANCZOS).convert("RGBA")
    off = (size - inner) // 2
    canvas.paste(logo, (off, off))
    canvas.save(os.path.join(out, "ic_launcher_foreground.png"))

vals = os.path.join(res, "values")
os.makedirs(vals, exist_ok=True)
with open(os.path.join(vals, "ic_launcher_background.xml"), "w") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
            f'    <color name="ic_launcher_background">#{bg[0]:02X}{bg[1]:02X}{bg[2]:02X}</color>\n</resources>\n')
print("iconos generados con fondo", bg)

# Icono adaptativo (Android 8+): fondo verde + logo
any_dir = os.path.join(res, "mipmap-anydpi-v26")
os.makedirs(any_dir, exist_ok=True)
xml = ('<?xml version="1.0" encoding="utf-8"?>\n'
       '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
       '    <background android:drawable="@color/ic_launcher_background"/>\n'
       '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
       '</adaptive-icon>\n')
for n in ("ic_launcher.xml", "ic_launcher_round.xml"):
    with open(os.path.join(any_dir, n), "w") as f:
        f.write(xml)
