# 👏 Strava Auto Kudos — GitHub Actions

Automatically give kudos to every activity in your Strava following feed, daily, with zero human interaction.

---

## How It Works

A GitHub Actions workflow runs on a cron schedule. It:
1. Exchanges your Strava refresh token for a fresh access token
2. Fetches up to 250 recent activities from your following feed
3. Gives kudos to every un-kudoed activity (skips your own)

---

## Setup

### Step 1 — Create a Strava API App

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Fill in any name/website (e.g. `Auto Kudos` / `http://localhost`)
3. Set **Authorization Callback Domain** to `localhost`
4. Note your **Client ID** and **Client Secret**

### Step 2 — Get Your Refresh Token (one-time)

Open this URL in your browser (replace `YOUR_CLIENT_ID`):

```
https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost&approval_prompt=force&scope=activity:read,activity:write
```

1. Approve the app — you'll be redirected to `localhost` (it will error, that's fine)
2. Copy the `code=` value from the URL
3. Run this in your terminal (replace the placeholders):

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=YOUR_CODE \
  -d grant_type=authorization_code
```

4. Copy the `refresh_token` from the JSON response

### Step 3 — Add GitHub Secrets

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add:

| Secret name            | Value                        |
|------------------------|------------------------------|
| `STRAVA_CLIENT_ID`     | Your Strava app Client ID    |
| `STRAVA_CLIENT_SECRET` | Your Strava app Client Secret|
| `STRAVA_REFRESH_TOKEN` | The refresh token from Step 2|

### Step 4 — Add the Files to Your Repo

```
your-repo/
├── .github/
│   └── workflows/
│       └── auto-kudos.yml
└── auto_kudos.py
```

Commit and push — GitHub Actions handles the rest.

---

## Customisation

| Option | Location | Default |
|---|---|---|
| Run schedule | `auto-kudos.yml` → `cron:` | `0 8 * * *` (8am UTC daily) |
| Delay between kudos | `auto_kudos.py` → `DELAY_BETWEEN_KUDOS` | `0.8s` |
| Pages of feed to scan | `auto_kudos.py` → `MAX_PAGES` | `5` (250 activities) |

---

## Triggering Manually

Go to your repo → **Actions → Strava Auto Kudos → Run workflow**.

---

## Notes

- The refresh token does **not** expire as long as the app is authorised
- Strava's API rate limit is 100 requests/15 min, 1000/day — well within range
- The script skips activities you've already kudoed and your own activities
