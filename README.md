# ⛰️ HiddenGems – Crowdsourced Hidden Gems Explorer

**Live Demo:** [https://hidden-gems-4twl.onrender.com](https://hidden-gems-4twl.onrender.com)

A full-stack, PWA-ready web application to discover, share, and navigate to hidden spots, secret viewpoints, and local gems around the world. Built with a vanilla JavaScript frontend, a Node.js/Express backend, MongoDB, and secured by Firebase Authentication.

## ✨ Features

### 🗺️ Discovery & Navigation
*   **Interactive Maps:** Powered by MapLibre GL JS and OpenFreeMap (100% free, no API keys required).
*   **Proximity Radar Alerts:** Get notified when another user adds a hidden gem within 20km of your current location.
*   **Real-time Driving Distances:** Automatically calculates road distances from your location to any hidden gem using the OSRM routing engine.
*   **Smart Fuel Calculator:** Estimates fuel costs and per-person trip costs based on your vehicle's mileage and current fuel prices.

### 🌤️ Trip Planning
*   **Live Weather Integration:** Automatically fetches current weather conditions for any gem using the Open-Meteo API.
*   **Search & Filter:** Find gems by country, state, district, categories, or tags (e.g., Free, Dog-Friendly, Requires Hiking).
*   **Itinerary Builder:** Save gems to your "Trips" or "Favorites" list for easy access later.

### 👥 Community & Gamification
*   **Social Interactions:** Upvote, Verify (mark as still open), and leave detailed text Reviews on gems.
*   **Smart Notifications:** A built-in notification bell alerts users to upvotes, new reviews, verifications, and system updates (like gems in their favorites being edited).
*   **Top Explorers Leaderboard:** A gamified dashboard ranking users by the number of hidden gems they have contributed.
*   **Milestone Achievements:** Users receive special notifications when their gems reach 10 upvotes or become community-verified.
*   **Native Share API:** Share hidden gems directly to WhatsApp, Instagram, and other apps (works on HTTPS environments).
*   **Image Uploads:** High-quality photos are permanently stored in the cloud using Cloudinary.

### 📱 Progressive Web App (PWA)
*   **Installable:** Can be added to the home screen on iOS and Android as a standalone app.
*   **Offline Caching:** Service workers cache the app shell so the UI loads instantly.

## 🛠️ Tech Stack

*   **Frontend:** HTML, CSS, Vanilla JavaScript, FontAwesome, MapLibre GL JS
*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB (via Mongoose)
*   **Authentication:** Firebase Auth (Client & Admin SDKs)
*   **Image Storage:** Cloudinary
*   **External APIs:** OpenFreeMap, OSRM, Open-Meteo
