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

My Reminders (sign up / log in):
- Each user signs up (email + password, or Google) and keeps a private list of due dates, e.g. car insurance renewal, NCT, motor tax, IRP, passport.
- The dashboard card shows overdue / due soon / upcoming counts and a countdown for each date.
- Dates can repeat monthly or yearly; "Renewed ✓" rolls the date forward.
- Profile: name, default reminder window (days before due), password reset, sign out.
- Uses Firebase Auth + Cloud Firestore from the browser, so the site stays static and GitHub Pages compatible.

Firebase setup (one time, free Spark plan):
1. Create a project at https://console.firebase.google.com and add a Web app.
2. Copy the web app config into firebase-config.js.
3. Authentication → Sign-in method: enable Email/Password (and Google if wanted).
4. Authentication → Settings → Authorized domains: add euro2rupee.net (localhost is there by default).
5. Firestore Database → Create database (production mode), then Rules → paste firestore.rules → Publish.

Data layout: users/{uid} holds the profile, users/{uid}/events/{eventId} holds each date. firestore.rules only lets a signed-in user read or write their own documents.
