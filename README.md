# ⛰️ HiddenGems – Crowdsourced Hidden Gems Explorer

A full-stack web application to discover, share, and navigate to hidden spots, secret viewpoints, and local gems around the world. Built with a vanilla JavaScript frontend and a Node.js/Express backend.

## ✨ Features

*   **Interactive Maps:** Powered by MapLibre GL JS and OpenFreeMap (100% free, no API keys required).
*   **Real-time Driving Distances:** Automatically calculates road distances from your location to any hidden gem using the OSRM routing engine.
*   **Smart Fuel Calculator:** Estimates fuel costs and per-person trip costs based on your vehicle's mileage and current fuel prices.
*   **Search & Filter:** Find gems by country, state, district, categories, or tags (e.g., Free, Dog-Friendly, Requires Hiking).
*   **Image Uploads:** Photos are permanently stored in the cloud using Cloudinary.
*   **User Accounts:** Secure JWT authentication with password hashing.
*   **PWA Ready:** Can be installed on iOS and Android as a standalone app (Add to Home Screen).

## 🛠️ Tech Stack

*   **Frontend:** HTML, CSS, Vanilla JavaScript
*   **Backend:** Node.js, Express.js
*   **Database:** MongoDB (via Mongoose)
*   **Image Storage:** Cloudinary
*   **Maps & Routing:** MapLibre GL JS, OpenFreeMap, OSRM API

## 🚀 Local Setup Instructions

1. **Clone the repository:**
   git clone https://github.com/YOUR_USERNAME/hidden-gems.git
   cd hidden-gems

2. **Install dependencies:**
   npm install

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add the following keys:
   PORT=3000
   JWT_SECRET=your_super_secret_jwt_string
   
   # MongoDB (Create a free cluster at mongodb.com/atlas)
   MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/hiddengems?retryWrites=true&w=majority
   
   # Cloudinary (Create a free account at cloudinary.com)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

4. **Run the app locally:**
   npm start
   Open `http://localhost:3000` in your browser.

## ☁️ Deployment

This app is configured to be deployed easily on **Render** (Free Tier).
1. Push your code to GitHub.
2. Create a new **Web Service** on Render.
3. Set the Build Command to `npm install` and the Start Command to `npm start`.
4. Add all the variables from your `.env` file into Render's **Environment Variables** section.

*(Note: On Render's free tier, the app will "sleep" after 15 minutes of inactivity. The first visit after it sleeps may take 30-50 seconds to load).*

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).
