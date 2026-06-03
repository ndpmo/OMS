# Google Apps Script Setup

This version replaces the Node server with a Google-hosted Apps Script web app.

## Files

- `Code.gs`: backend API, Apify call, Sheet writes
- `Index.html`: shareable web app UI

## Setup

1. Open your Google Sheet:

```text
https://docs.google.com/spreadsheets/d/1W6r0sQaQ96t1x2pF6ZodgVFqt6-odVWu-l1RWJXr7sw/edit
```

2. Go to `Extensions > Apps Script`.
3. Paste `Code.gs` into the default code file.
4. Add a new HTML file named `Index`.
5. Paste `Index.html` into that file.
6. Click `Run > setup` once and approve permissions.
7. Deploy with `Deploy > New deployment > Web app`.
8. Set access to whoever should use it.
9. Open the web app URL, save the Apify token, then submit post URLs.

## Sheet Tabs Created

The script creates these tabs automatically:

- `Hourly Results`: one row per manual metric check
- `Tracked Posts`: one row per tracked post

## Columns

`Hourly Results` includes:

- post metadata: note id, title, KOL, user id, Red ID, type, URL
- metrics: likes, comments, saves, shares, views
- hourly changes: `hourly_likes`, `hourly_comments`, `hourly_saves`, `hourly_shares`
- daily changes: `daily_likes`, `daily_comments`, `daily_saves`, `daily_shares`

## Notes

- The Apify token is stored in Apps Script Properties, not in the Sheet cells.
- Refresh only runs when the GitHub Pages frontend sends the refresh password.
- If an old hourly trigger exists, run `removeAutomaticRefreshTriggers` once in Apps Script to delete it.
- The first sample for a post has blank hourly and daily changes because there is no baseline yet.
