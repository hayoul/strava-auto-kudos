"""
Strava Auto Kudos
-----------------
Fetches your Strava following feed and gives kudos to every
activity that hasn't been kudoed yet.

Requires three environment variables (set as GitHub Secrets):
  STRAVA_CLIENT_ID      — from your Strava API application
  STRAVA_CLIENT_SECRET  — from your Strava API application
  STRAVA_REFRESH_TOKEN  — obtained once via OAuth (see README)
"""

import os
import sys
import time
import requests

# ── Config ────────────────────────────────────────────────────────────────────
DELAY_BETWEEN_KUDOS = 0.8   # seconds — keep ≥ 0.5 to respect rate limits
MAX_PAGES           = 5     # pages of feed to scan (50 activities per page)
PER_PAGE            = 50

STRAVA_TOKEN_URL    = "https://www.strava.com/oauth/token"
STRAVA_FEED_URL     = "https://www.strava.com/api/v3/activities/following"
STRAVA_KUDOS_URL    = "https://www.strava.com/api/v3/activities/{id}/kudos"

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_access_token(client_id: str, client_secret: str, refresh_token: str) -> str:
    """Exchange a refresh token for a short-lived access token."""
    resp = requests.post(STRAVA_TOKEN_URL, data={
        "client_id":     client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type":    "refresh_token",
    }, timeout=15)
    resp.raise_for_status()
    data = resp.json()
    print(f"✅ Authenticated as athlete #{data.get('athlete', {}).get('id', '?')}")
    return data["access_token"]


def fetch_feed(access_token: str) -> list[dict]:
    """Fetch recent activities from the following feed (paginated)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    activities = []

    for page in range(1, MAX_PAGES + 1):
        resp = requests.get(
            STRAVA_FEED_URL,
            headers=headers,
            params={"per_page": PER_PAGE, "page": page},
            timeout=15,
        )
        resp.raise_for_status()
        page_data = resp.json()

        if not page_data:
            break  # No more activities

        activities.extend(page_data)
        print(f"📄 Page {page}: {len(page_data)} activities fetched")

        if len(page_data) < PER_PAGE:
            break  # Last page

    return activities


def give_kudos(access_token: str, activity_id: int) -> bool:
    """Give kudos to a single activity. Returns True on success."""
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.post(
        STRAVA_KUDOS_URL.format(id=activity_id),
        headers=headers,
        timeout=15,
    )
    # 201 = kudos given, 400 = already kudoed or own activity
    return resp.status_code == 201


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load secrets from environment
    client_id     = os.environ.get("STRAVA_CLIENT_ID", "").strip()
    client_secret = os.environ.get("STRAVA_CLIENT_SECRET", "").strip()
    refresh_token = os.environ.get("STRAVA_REFRESH_TOKEN", "").strip()

    missing = [k for k, v in {
        "STRAVA_CLIENT_ID":     client_id,
        "STRAVA_CLIENT_SECRET": client_secret,
        "STRAVA_REFRESH_TOKEN": refresh_token,
    }.items() if not v]

    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        sys.exit(1)

    print("🚀 Starting Strava Auto Kudos...")

    # Authenticate
    access_token = get_access_token(client_id, client_secret, refresh_token)

    # Fetch feed
    activities = fetch_feed(access_token)
    print(f"\n📊 Total activities found: {len(activities)}")

    # Filter to un-kudoed activities that aren't your own
    to_kudo = [
        a for a in activities
        if not a.get("kudoed") and not a.get("athlete_count", 0) == 0
    ]
    print(f"👏 Activities to kudo: {len(to_kudo)}")

    if not to_kudo:
        print("✨ Nothing to kudo — you're all caught up!")
        return

    # Give kudos
    success = 0
    skipped = 0

    for activity in to_kudo:
        activity_id   = activity["id"]
        athlete_name  = activity.get("athlete", {}).get("firstname", "Someone")
        activity_name = activity.get("name", "activity")

        time.sleep(DELAY_BETWEEN_KUDOS)

        if give_kudos(access_token, activity_id):
            print(f"  ✅ Kudoed: {athlete_name} — \"{activity_name}\"")
            success += 1
        else:
            print(f"  ⏭️  Skipped: {athlete_name} — \"{activity_name}\" (own/already kudoed)")
            skipped += 1

    print(f"\n🏆 Done! Gave {success} kudos, skipped {skipped}.")


if __name__ == "__main__":
    main()
