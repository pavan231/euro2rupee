# Euro2Rupee Live Dashboard

This version makes the currency converter live.

Currency:
- Uses Frankfurter's public exchange-rate API.
- Refreshes every 15 minutes.
- Supports EUR/INR and reverse conversion.
- Shows the latest rate timestamp.
- No API key is embedded.

Sports:
- Loads sports.json so the page remains static/GitHub Pages compatible.
- Can be replaced by the GitHub Actions RSS updater from the previous version.

Events:
- Uses native scrolling links to the Eventbrite Dublin Telugu search because Eventbrite blocks iframe embedding.

Upload all four files to the repository root:
index.html, style.css, script.js, sports.json
