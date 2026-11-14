"""Screenshot the landing nav at several desktop widths.

Checks that the wordmark and the first nav link never touch, and reports the
gaps between the logo, the link group and the action buttons.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
OUTDIR = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else ".")
OUTDIR.mkdir(parents=True, exist_ok=True)

WIDTHS = [1280, 1366, 1440, 1600, 1920]

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="chrome", args=["--disable-gpu-vsync"])
    except Exception:
        browser = p.chromium.launch(args=["--disable-gpu-vsync"])

    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": 720})
        page.goto(BASE, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(600)

        nav = page.locator("nav").first
        nav.screenshot(path=str(OUTDIR / f"nav-{width}.png"))

        logo = page.locator("nav a[aria-label='Mhomho Media home']").first.bounding_box()
        first_link = page.locator("nav >> text=How it works").first.bounding_box()
        gap = None
        if logo and first_link:
            gap = round(first_link["x"] - (logo["x"] + logo["width"]), 1)
        mode = "links" if first_link else "hamburger"
        logo_right = round(logo["x"] + logo["width"], 1) if logo else None
        print(f"{width}: mode={mode} logo_right={logo_right} gap={gap}")
        page.close()

    browser.close()
