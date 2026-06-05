"""
Strava Auto Kudos — Playwright edition
---------------------------------------
Strava removed the "following feed" from their public API.
This script uses a headless browser (Playwright) to log in and
give kudos exactly like a real user — no API key limitations.

GitHub Secrets required:
  STRAVA_EMAIL     — your Strava login email
  STRAVA_PASSWORD  — your Strava login password
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

# ── Config ────────────────────────────────────────────────────────────────────
SCROLL_PASSES      = 4      # how many times to scroll down the feed for more activities
DELAY_BETWEEN_KUDOS = 600   # ms between each kudo click (keep ≥ 400)
HEADLESS           = True   # set False locally to watch the browser

DASHBOARD_URL = "https://www.strava.com/dashboard"
LOGIN_URL     = "https://www.strava.com/login"

# ── Kudo button selectors (Strava uses several patterns) ──────────────────────
KUDO_SELECTORS = [
    # Not-yet-given kudos buttons only
    'button[data-testid="kudos_button"]:not([class*="active"])',
    'button.btn-kudo:not(.btn-kudos-active)',
    'button[title="Give kudos"]',
    '.js-add-kudo:not(.active)',
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def login(page, email: str, password: str) -> None:
    print("🔐 Logging in...")
    page.goto(LOGIN_URL, wait_until="networkidle")

    page.fill('#email', email)
    page.fill('#password', password)
    page.click('#login-button')

    # Wait for redirect to dashboard or home
    page.wait_for_url("**/dashboard**", timeout=15_000)
    print("✅ Logged in successfully")


def scroll_feed(page, passes: int) -> None:
    """Scroll down to load more feed activities."""
    for i in range(passes):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1200)
        print(f"  📜 Scroll pass {i + 1}/{passes}")


def collect_kudo_buttons(page) -> list:
    """Find all un-kudoed kudo buttons on the page."""
    buttons = []
    seen_ids = set()

    for selector in KUDO_SELECTORS:
        try:
            els = page.query_selector_all(selector)
            for el in els:
                box = el.bounding_box()
                if box:  # only visible elements
                    uid = f"{box['x']:.0f},{box['y']:.0f}"
                    if uid not in seen_ids:
                        seen_ids.add(uid)
                        buttons.append(el)
        except Exception:
            continue

    return buttons


def give_kudos(page) -> int:
    """Click all available kudo buttons. Returns count given."""
    buttons = collect_kudo_buttons(page)
    print(f"\n👏 Found {len(buttons)} un-kudoed activities")

    if not buttons:
        print("✨ Nothing to kudo — all caught up!")
        return 0

    success = 0
    for i, btn in enumerate(buttons, 1):
        try:
            btn.scroll_into_view_if_needed()
            page.wait_for_timeout(DELAY_BETWEEN_KUDOS)
            btn.click()
            success += 1
            print(f"  ✅ Kudoed activity {i}/{len(buttons)}")
        except Exception as e:
            print(f"  ⚠️  Skipped activity {i}: {e}")

    return success


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    email    = os.environ.get("STRAVA_EMAIL", "").strip()
    password = os.environ.get("STRAVA_PASSWORD", "").strip()

    if not email or not password:
        print("❌ Missing STRAVA_EMAIL or STRAVA_PASSWORD environment variables")
        sys.exit(1)

    print("🚀 Starting Strava Auto Kudos (Playwright)...")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=HEADLESS)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (X11; Linux x86_64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        try:
            login(page, email, password)

            # Navigate to dashboard and let feed load
            page.goto(DASHBOARD_URL, wait_until="networkidle")
            page.wait_for_timeout(2000)

            # Scroll to load more activities
            print(f"\n📡 Loading feed ({SCROLL_PASSES} scroll passes)...")
            scroll_feed(page, SCROLL_PASSES)

            # Give kudos
            total = give_kudos(page)
            print(f"\n🏆 Done! Gave kudos to {total} activities.")

        except PWTimeout as e:
            print(f"❌ Timeout: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error: {e}")
            sys.exit(1)
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
