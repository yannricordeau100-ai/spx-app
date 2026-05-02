#!/usr/bin/env python3
"""
IR debug — explore une page IR pour comprendre pourquoi le scraper v2
retournait 0 lien. Diagnostique :
  - Wait strategy (network idle vs domcontentloaded)
  - Sélecteurs disponibles
  - Patterns d'URL d'archive
  - Tous liens (pas que PDF) pour trouver les pages internes
  - Screenshot pour vérification visuelle
"""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

URLS_TO_DEBUG = {
    "ASML_main": "https://www.asml.com/en/investors/financial-results",
    "ASML_quarterly": "https://www.asml.com/en/investors/financial-results/quarterly-results",
}


async def debug_page(name: str, url: str):
    print(f"\n{'='*60}")
    print(f"=== {name} : {url}")
    print('='*60)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
            viewport={"width": 1280, "height": 1024},
            ignore_https_errors=True,
        )
        page = await context.new_page()

        # Strat 1 : networkidle (attend que tout soit chargé)
        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)
        except Exception as e:
            print(f"[WARN] networkidle failed: {e}, retry domcontentloaded")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)

        await asyncio.sleep(3)

        # Scroll plusieurs fois pour déclencher lazy load
        for i in range(5):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1)

        # 1. TOUS les liens (pas que PDF)
        all_links = await page.evaluate("""
            () => Array.from(document.querySelectorAll('a[href]'))
                .map(a => ({
                    text: (a.innerText || a.textContent || '').trim().slice(0, 80),
                    href: a.href
                }))
                .filter(a => a.href && !a.href.startsWith('javascript:'))
        """)

        # 2. Liens PDF
        pdf_links = [l for l in all_links if l["href"].lower().endswith(".pdf")]
        print(f"\n[STATS] Total links={len(all_links)}, PDF links={len(pdf_links)}")

        # 3. Liens internes /financial-results / /investors / earnings / quarterly
        kw_re = ["financial", "earnings", "quarterly", "results", "presentation",
                 "transcript", "annual", "press", "release", "report"]
        internal_relevant = [
            l for l in all_links
            if any(k in l["href"].lower() for k in kw_re)
            and "asml.com" in l["href"]
        ][:30]
        print(f"\n[INTERNAL RELEVANT LINKS] ({len(internal_relevant)})")
        for l in internal_relevant:
            print(f"  '{l['text'][:50]}' → {l['href']}")

        # 4. Buttons / dropdowns
        buttons = await page.evaluate("""
            () => Array.from(document.querySelectorAll('button, [role="button"], select, [role="combobox"]'))
                .map(b => ({
                    text: (b.innerText || b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 60),
                    type: b.tagName.toLowerCase(),
                    id: b.id, classes: b.className
                }))
                .filter(b => b.text)
        """)
        print(f"\n[INTERACTIVE ELEMENTS] ({len(buttons)})")
        for b in buttons[:15]:
            print(f"  [{b['type']}] '{b['text']}' #{b['id']} .{b['classes'][:40]}")

        # 5. Screenshot
        screenshot_path = Path(f"/tmp/ir-debug-{name}.png")
        await page.screenshot(path=str(screenshot_path), full_page=False)
        print(f"\n[SCREENSHOT] {screenshot_path}")

        # 6. Title + URL final
        title = await page.title()
        print(f"\n[META] title='{title}', url={page.url}")

        await context.close()
        await browser.close()


async def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "ASML_main"
    url = URLS_TO_DEBUG.get(target, target)
    await debug_page(target, url)


if __name__ == "__main__":
    asyncio.run(main())
