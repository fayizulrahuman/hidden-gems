# HiddenGems – Crowdsourced Hidden Gems Explorer

Stack: Node.js + Express (API, JWT auth, photo uploads, JSON-file database) and a plain HTML/CSS/JS front end with the Google Maps JavaScript API. No build step.

## Folder structure
hidden-gems/
  package.json     dependencies and scripts
  .env             your secrets (copy from .env.example)
  server.js        API: auth, gems CRUD, upvote/verify, favorites/trips, uploads
  seed.js          demo data (loaded into db.json on first start)
  db.json          created automatically (your database)
  uploads/         created automatically (user photos)
  public/
    index.html     page shell
    style.css      green theme
    app.js         all screens + Google Maps + currency + fuel calculator
    img/           put your photos here

## Setup (VS Code)
1. Install Node.js 18+ (nodejs.org). In VS Code: File > Open Folder > hidden-gems.
2. Terminal (Ctrl+`):  npm install
3. Copy .env.example to .env and set JWT_SECRET and GOOGLE_MAPS_KEY.
4. npm start   (or npm run dev to auto-restart)
5. Open http://localhost:3000 and sign in: demo@hiddengems.app / demo1234

## Google Maps API key
1. console.cloud.google.com > create a project.
2. Enable billing (free monthly credit; Maps will not load without it).
3. APIs & Services > Library > enable "Maps JavaScript API".
4. Credentials > Create credentials > API key.
5. Restrict it: Websites = http://localhost:3000/* (add your domain later); API = Maps JavaScript API.
6. Paste into .env as GOOGLE_MAPS_KEY, restart the server.
The code uses mapId 'DEMO_MAP_ID' (needed for advanced markers). Create your own Map ID in Google Maps Platform > Map Management for custom styling and replace it in public/app.js.

## Photos (to match the screenshot)
Put in public/img/: hero.jpg (wide mountain landscape ~1800x700), meenmutty.jpg, cave.jpg, varkala.jpg, ponmudi.jpg, agasthya.jpg, faroe.jpg
Free sources: unsplash.com, pexels.com (check licences). Missing files fall back to a green gradient.

## Demo data
Names and coordinates in seed.js are approximate. Replace with verified places. Delete db.json and restart to re-seed.

## Deploy
Push to GitHub, deploy on Render/Railway (web service, start: npm start, set the 3 env vars), add the live URL to your Google key referrers. On hosts with ephemeral disks, move db.json and uploads to MongoDB Atlas/Postgres and Cloudinary/S3.

## Next ideas
Reviews and ratings, live exchange rates, Places Autocomplete in the Add form, Malayalam/Hindi/Tamil UI, marker clustering, moderation.

## Install on a phone (PWA)
The app is installable. It needs HTTPS (localhost counts as secure on the same computer only).
- Android (Chrome): open the site > menu > Install app / Add to Home screen.
- iPhone (Safari): Share button > Add to Home Screen.
- Desktop Chrome/Edge: install icon at the right of the address bar.
To test on a phone, deploy to Render/Railway (free HTTPS), then add that domain to your Google Maps key's allowed websites.
After editing app files, bump CACHE = 'hiddengems-v2' in public/sw.js so users get the update.
