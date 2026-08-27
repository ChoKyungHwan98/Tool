from pathlib import Path

from PIL import IcnsImagePlugin, Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "build" / "icons"
SIZES = (16, 24, 32, 48, 64, 128, 256, 512, 1024)


def build_master() -> Image.Image:
    size = 1024
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((42, 42, 982, 982), radius=220, fill="#17202A")
    draw.rounded_rectangle((345, 205, 815, 820), radius=92, fill="#4D7471")
    draw.rounded_rectangle((205, 145, 705, 835), radius=104, fill="#F5F1E9")

    draw.rounded_rectangle((305, 275, 590, 333), radius=29, fill="#17202A")
    draw.rounded_rectangle((305, 420, 540, 478), radius=29, fill="#D85F43")
    draw.rounded_rectangle((305, 565, 590, 623), radius=29, fill="#4D7471")

    draw.line((720, 340, 842, 340, 842, 680), fill="#F5F1E9", width=34, joint="curve")
    draw.ellipse((692, 312, 748, 368), fill="#D85F43")
    draw.ellipse((814, 480, 870, 536), fill="#D85F43")
    draw.ellipse((814, 652, 870, 708), fill="#D85F43")
    return image


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    master = build_master()
    generated = {}
    for size in SIZES:
        resized = master.resize((size, size), Image.Resampling.LANCZOS)
        path = OUTPUT / f"{size}x{size}.png"
        resized.save(path, format="PNG", optimize=True)
        generated[size] = resized

    generated[256].save(
        OUTPUT / "icon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    master.save(OUTPUT / "icon.icns", format="ICNS")


if __name__ == "__main__":
    main()
