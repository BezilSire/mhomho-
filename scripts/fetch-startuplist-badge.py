"""Fetch the StartupList Africa badge with a real browser.

The badge host sits behind a Vercel bot challenge, so plain HTTP requests
get a 429. Chrome solves the challenge, so we let the browser fetch the
bytes and write them to disk for self-hosting.
"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

URL = "https://www.startuplist.africa/badges/listed-on-startuplist-africa-light.png"
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "badge.png")

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="chrome", args=["--disable-gpu-vsync"])
    except Exception:
        browser = p.chromium.launch(args=["--disable-gpu-vsync"])
    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1280, "height": 720},
    )
    page = context.new_page()
    response = page.goto(URL, wait_until="load", timeout=60000)
    print("status", response.status if response else None)
    if response and response.status == 200:
        body = response.body()
        OUT.write_bytes(body)
        print("wrote", OUT, len(body), "bytes")
    else:
        # Fall back to rendering the image in the page and screenshotting it.
        page.goto("https://www.startuplist.africa/startups/mhomho", wait_until="load", timeout=60000)
        page.wait_for_timeout(4000)
        badge = page.query_selector("img[src*='listed-on-startuplist']")
        if badge:
            box = badge.bounding_box()
            print("badge box", box)
            page.screenshot(path=str(OUT), clip=box)
            print("wrote screenshot", OUT)
        else:
            print("no badge found on the page")
            browser.close()
            sys.exit(1)
    browser.close()
