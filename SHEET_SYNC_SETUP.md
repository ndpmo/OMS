# Google Sheet Live Sync

The website is already pointed at this workbook:

`https://docs.google.com/spreadsheets/d/1Hc-U6YnTrFxIfeG_wjwLpbYV-ghR0XGDSjuXGyMtSCg/edit`

It reads the `Master` tab and maps these columns into the dashboard:

- Brand
- Center
- AS Team
- TL Team
- Therapist
- Staff ID
- KPI Position
- HR Position
- Title mis matach
- Total Service time (Months)
- Last Join Date
- Current Sales Target
- Current month Sales
- Sales % April 26
- Sales % March 26
- Sales % Feb 26
- Sales % Jan 26
- Past 6 month Average sales
- Current Cat1/2
- Past 3 month Cat 1/2

## Apps Script Sync

The page is configured to use Apps Script for private-sheet access. Deploy `apps-script/Code.gs` as a Google Apps Script web app:

1. Open Apps Script from the Google Sheet.
2. Paste the contents of `apps-script/Code.gs`.
3. Deploy as a web app.
4. Set access to the required internal audience. For the simplest local test, use `Anyone with the link`.
5. Copy the web app URL.
6. In the website, click `Set Script URL` and paste the web app URL.

The site saves the web app URL in browser local storage. Refresh uses that URL afterward.
