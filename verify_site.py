import os
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH",
    r"c:\Users\Mommy Jayce\Desktop\Boxing Center\Portet\scrapers\.playwright-browsers")
from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
shots = os.path.dirname(os.path.abspath(__file__))
errs = []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("pageerror", lambda e: errs.append("PAGEERR: " + str(e)))
    pg.on("console", lambda m: errs.append("CONSOLE: " + m.text) if m.type == "error" else None)

    pg.goto(BASE + "/", wait_until="load", timeout=45000)
    pg.wait_for_timeout(5000)  # let the crest form
    h1 = pg.eval_on_selector("h1.display", "e => e.innerText")
    canvases = pg.eval_on_selector_all("canvas", "e => e.length")
    pg.screenshot(path=os.path.join(shots, "shot_home_arena.png"))

    pg.click('.theme-switch button[data-th="heritage"]'); pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(shots, "shot_home_heritage.png"))
    pg.click('.theme-switch button[data-th="raw"]'); pg.wait_for_timeout(900)
    pg.screenshot(path=os.path.join(shots, "shot_home_raw.png"))
    pg.click('.theme-switch button[data-th="arena"]'); pg.wait_for_timeout(700)

    # scroll to media section
    pg.eval_on_selector("#media", "e => e.scrollIntoView()")
    pg.wait_for_timeout(2500)
    shots_n = pg.eval_on_selector_all("#gallery .shot", "e => e.length")
    clips_n = pg.eval_on_selector_all("#clips .clip", "e => e.length")
    pg.screenshot(path=os.path.join(shots, "shot_media.png"), full_page=False)

    b.close()

print("h1        :", repr(h1))
print("canvases  :", canvases)
print("shots     :", shots_n, "| clips:", clips_n)
print(f"errors ({len(errs)}):")
for e in errs[:12]:
    print("  -", e[:150])
