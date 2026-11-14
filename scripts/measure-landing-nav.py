"""Measure the landing nav group widths so the desktop breakpoint can be set
where the link row still has comfortable separation from the wordmark.
"""
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="chrome", args=["--disable-gpu-vsync"])
    except Exception:
        browser = p.chromium.launch(args=["--disable-gpu-vsync"])
    page = browser.new_page(viewport={"width": 1920, "height": 720})
    page.goto(BASE, wait_until="networkidle", timeout=60000)
    page.wait_for_selector("nav", timeout=30000)
    page.wait_for_timeout(800)
    data = page.evaluate(
        """() => {
      const nav = document.querySelector('nav');
      const row = nav.querySelector('div');
      const kids = [...row.children].map(el => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: el.className.slice(0, 40), w: Math.round(r.width), x: Math.round(r.x) };
      });
      const links = nav.querySelector('div:nth-child(2)');
      return {
        rowWidth: Math.round(row.getBoundingClientRect().width),
        kids,
        linkScrollWidth: links ? links.scrollWidth : null,
      };
    }"""
    )
    print(data)
    browser.close()
