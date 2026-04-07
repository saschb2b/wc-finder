#!/usr/bin/env python3
"""
Generate app icons for WC Finder
"""
from PIL import Image, ImageDraw, ImageFont
import os

# Colors
PRIMARY_COLOR = (0, 102, 204)  # #0066cc - matches the app's blue
WHITE = (255, 255, 255)
TRANSPARENT = (0, 0, 0, 0)

def create_rounded_rect(draw, xy, radius, fill):
    """Draw a rounded rectangle"""
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)

def create_icon(size=1024):
    """Create the main app icon"""
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    # Background - rounded square with primary color
    padding = size // 16
    corner_radius = size // 8
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill=PRIMARY_COLOR
    )

    # WC text
    font_size = size // 2
    try:
        # Try to use a system font
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "WC"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20

    draw.text((x, y), text, font=font, fill=WHITE)

    return img

def create_adaptive_icon(size=1024):
    """Create Android adaptive icon foreground (transparent bg, icon centered)"""
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    # For adaptive icons, the content should be within the safe zone (66% of the icon)
    # We'll draw just the WC text without background
    font_size = int(size * 0.5)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "WC"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20

    draw.text((x, y), text, font=font, fill=WHITE)

    return img

def create_splash_icon(size=1024):
    """Create splash screen icon (white icon on transparent)"""
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    font_size = size // 2
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "WC"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - size // 20

    draw.text((x, y), text, font=font, fill=WHITE)

    return img

def create_favicon(size=48):
    """Create favicon"""
    img = Image.new('RGBA', (size, size), TRANSPARENT)
    draw = ImageDraw.Draw(img)

    # Small rounded square
    padding = 2
    draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=6,
        fill=PRIMARY_COLOR
    )

    # WC text - smaller
    font_size = 24
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        font = ImageFont.load_default()

    text = "WC"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    x = (size - text_width) // 2
    y = (size - text_height) // 2 - 1

    draw.text((x, y), text, font=font, fill=WHITE)

    return img

def main():
    assets_dir = "assets"
    os.makedirs(assets_dir, exist_ok=True)

    print("Generating icons...")

    # Main app icon
    icon = create_icon(1024)
    icon.save(os.path.join(assets_dir, "icon.png"), "PNG")
    print("✓ icon.png (1024x1024)")

    # Android adaptive icon (foreground only, transparent background)
    adaptive = create_adaptive_icon(1024)
    adaptive.save(os.path.join(assets_dir, "adaptive-icon.png"), "PNG")
    print("✓ adaptive-icon.png (1024x1024, transparent)")

    # Splash icon (white on transparent)
    splash = create_splash_icon(1024)
    splash.save(os.path.join(assets_dir, "splash-icon.png"), "PNG")
    print("✓ splash-icon.png (1024x1024)")

    # Favicon
    favicon = create_favicon(48)
    favicon.save(os.path.join(assets_dir, "favicon.png"), "PNG")
    print("✓ favicon.png (48x48)")

    print("\nAll icons generated successfully!")

if __name__ == "__main__":
    main()
