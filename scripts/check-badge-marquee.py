"""Screenshot the badge marquee on the live site.

Used to check placement and that the strip actually drifts.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "marquee.png")
URL = "https://mhomho.work/"

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="chrome", args=["--disable-gpu-vsync"])
    except Exception:
        browser = p.chromium.launch(args=["--disable-gpu-vsync"])
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(1500)

    heading = page.locator("text=Every view is visible.").first
    heading.scroll_into_view_if_needed()
    page.wait_for_timeout(1200)

    wrap = page.locator(".badge-marquee-wrap").first
    if wrap.count() == 0:
        print("marquee not found")
    else:
        wrap.screenshot(path=str(OUT))
        print("wrote", OUT)

    # Prove it moves: sample the track transform twice.
    track = page.locator(".badge-marquee-track").first
    first = track.evaluate("el => getComputedStyle(el).transform")
    page.wait_for_timeout(1200)
    second = track.evaluate("el => getComputedStyle(el).transform")
    print("transform t0:", first)
    print("transform t1:", second)
    print("moving:", first != second)

    browser.close()
