# GitHub Pages Frontend

This folder is a static website for GitHub Pages. It does not call Apify directly and does not write to Google Sheets directly.

Flow:

1. GitHub Pages hosts this static UI.
2. The UI calls the deployed Apps Script web app.
3. Apps Script calls Apify and writes rows into Google Sheets.
4. Apps Script hourly trigger keeps updating tracked posts.

## Setup

1. Deploy `apps-script/Code.gs` as an Apps Script web app.
2. Copy the web app URL.
3. Copy `config.example.js` to `config.js`.
4. Paste the web app URL:

```js
window.TRACKER_API_URL = 'https://script.google.com/macros/s/.../exec';
```

5. Publish the `github-site` folder with GitHub Pages.

## Important

If the Apps Script deployment is public, anyone with the GitHub Pages URL can submit post URLs for tracking. The Apify token is still hidden in Apps Script Properties, but usage can increase if the page is shared widely.
