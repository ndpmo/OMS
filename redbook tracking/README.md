# Redbook Tracking

Small standalone website for tracking Xiaohongshu / Little Redbook post metrics with Apify.

## What It Does

- Accepts one or many Xiaohongshu post URLs, `xhslink.com` short links, or note IDs.
- Fetches title, KOL name, likes, comments, saves, shares, and post metadata.
- Appends one row per manual refresh.
- Calculates hourly change from the previous row.
- Calculates daily change from the closest row at least 24 hours earlier.
- Stores a local CSV at `data/redbook-hourly-results.csv`.
- Optionally syncs each row to Google Sheets.
- Requires the frontend refresh password before a paid refresh can run.

Current Apify actor:

```text
sian.agency/xiaohongshu-rednote-scraper
```

This actor is configured in `apps-script/Code.gs`. It is more reliable for note detail data, so keep refresh password-protected to control Apify cost.

## Run Locally

```bash
cd "redbook tracking"
APIFY_TOKEN="your_apify_token" npm start
```

Then open:

```text
http://localhost:3000
```

## Google Sheets Setup

1. Create a Google Sheet.
2. Add a tab named `Hourly Results`.
3. Create a Google Cloud service account and JSON key.
4. Share the Sheet with the service account `client_email` as Editor.
5. Start the app with these environment variables:

```bash
APIFY_TOKEN="your_apify_token" \
GOOGLE_SHEET_ID="your_sheet_id" \
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
npm start
```

The app will create the header row automatically if the tab is empty.

For your current tracker Sheet, use:

```text
GOOGLE_SHEET_ID=1W6r0sQaQ96t1x2pF6ZodgVFqt6-odVWu-l1RWJXr7sw
```

## Share With Colleagues

For people on the same Wi-Fi:

```text
http://YOUR_LOCAL_IP:3000
```

For remote colleagues, deploy it to a small Node host such as Render, Railway, Fly.io, or a private server. Add the same environment variables in the host settings.

Keep the Apify token and Google service account JSON as server environment variables only. Do not put them in browser code.

## Folder Layout

```text
redbook tracking/
  index.html      Redirects to the GitHub Pages dashboard
  apps-script/   Google Apps Script backend and Sheet writer
  github-site/   Static GitHub Pages frontend
  public/        Local Node fallback frontend
  server.mjs     Local Node fallback backend
```

For GitHub Pages, open:

```text
redbook tracking/index.html
```

or directly:

```text
redbook tracking/github-site/index.html
```
