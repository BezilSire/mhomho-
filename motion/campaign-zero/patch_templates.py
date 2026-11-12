"""Local patches to the claude-motion-styles templates and renderer.

1. render.py  — use the system Chrome that is already installed instead of
   downloading a bundled Chromium (this machine already has both).
2. motion-kinetic-type/template.html — add cx / cy / fs / mw parameters so the
   kinetic words can be placed in the lower band of the frame, clear of the
   speaker's face and of the burned-in captions in the source footage.
"""
from pathlib import Path

HERE = Path(__file__).parent

RENDER_OLD = "    br = p.chromium.launch(args=['--disable-gpu-vsync'])"
RENDER_NEW = """    try:
        br = p.chromium.launch(channel='chrome', args=['--disable-gpu-vsync'])
    except Exception:
        br = p.chromium.launch(args=['--disable-gpu-vsync'])"""

TEMPLATE_OLD = "const U = Math.min(W, H), CX = W / 2, CY = H / 2;"
TEMPLATE_NEW = """const U = Math.min(W, H);
const CXF = +(P.get('cx') || .5), CYF = +(P.get('cy') || .5);
const FS = +(P.get('fs') || 1), MW = +(P.get('mw') || .82);
const CX = W * CXF, CY = H * CYF;"""

KINETIC_EDITS = [
    ("const s = fitFont(w, 900, U * .34, W * .82);", "const s = fitFont(w, 900, U * .34 * FS, W * MW);"),
    ("const s = fitFont(w, 900, U * .3, W * .82); const lh = s * .95;", "const s = fitFont(w, 900, U * .3 * FS, W * MW); const lh = s * .95;"),
    ("if (SUB) { font(600, U * .03);", "if (SUB) { font(600, U * .03 * FS);"),
]


def patch_render() -> None:
    for style in ("motion-kinetic-type", "motion-particles"):
        path = HERE / style / "render.py"
        text = path.read_text(encoding="utf-8")
        if RENDER_OLD in text:
            path.write_text(text.replace(RENDER_OLD, RENDER_NEW), encoding="utf-8")
            print("patched", path)
        else:
            print("skip", path)


def patch_kinetic() -> None:
    path = HERE / "motion-kinetic-type" / "template.html"
    text = path.read_text(encoding="utf-8")
    if TEMPLATE_OLD not in text:
        print("skip template (already patched)")
        return
    text = text.replace(TEMPLATE_OLD, TEMPLATE_NEW)
    for old, new in KINETIC_EDITS:
        if old not in text:
            print("MISS:", old[:48])
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")
    print("patched", path)


if __name__ == "__main__":
    patch_render()
    patch_kinetic()
