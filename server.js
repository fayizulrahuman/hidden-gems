require('dotenv').config();
const express = require('express'), path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const app = express();

// --- 1. CONNECT TO MONGODB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- 2. INITIALIZE FIREBASE ADMIN ---
if (getApps().length === 0) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
      }),
    });
  } catch (error) { console.error('❌ Firebase Admin Init Error:', error.message); }
}

// --- 3. SETUP CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'hiddengems', allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'avif'] }
});
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } });

// --- 4. DATABASE SCHEMAS ---
const UserSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  name: String, 
  email: String, 
  favs: [String], 
  trips: [String],
  lastLat: Number, 
  lastLng: Number  
});

const GemSchema = new mongoose.Schema({
  title: String, place: String, country: String, state: String, district: String,
  lat: Number, lng: Number, cat: String, desc: String, cur: String,
  costs: Array, tags: Array, steps: Array, safety: Object,
  photo: String, authorId: String, authorName: String,
  created: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  ups: { type: [String], default: [] }, verifs: { type: Array, default: [] },
  rating: { type: Number, default: 0 }, reviews: { type: Number, default: 0 },
  ratings: { type: Object, default: {} },
  textReviews: { type: Array, default: [] }
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  actorName: String, type: String, gemId: String, gemTitle: String,
  isRead: { type: Boolean, default: false }, createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Gem = mongoose.model('Gem', GemSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- 5. MIDDLEWARE & HELPERS ---
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/config.js', (q, r) => r.type('js').send('window.CFG={};'));

const pub = u => ({ id: u._id, name: u.name, email: u.email, favs: u.favs, trips: u.trips });
const formatGem = g => { const obj = g.toObject(); obj.id = obj._id; delete obj._id; delete obj.__v; return obj; };

const createNotif = async (userId, actorName, type, gemId, gemTitle) => {
  try { await Notification.create({ userId, actorName, type, gemId, gemTitle }); } catch (err) {}
};

const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c;
};

// --- 6. FIREBASE AUTH MIDDLEWARE ---
const firebaseAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing authorization header' });
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    let dbUser = await User.findOne({ firebaseUid: decoded.uid });
    if (!dbUser) {
      dbUser = await User.findOne({ email: decoded.email });
      if (dbUser) { dbUser.firebaseUid = decoded.uid; if (!dbUser.name) dbUser.name = decoded.name || decoded.email.split('@')[0]; await dbUser.save(); } 
      else { dbUser = await User.create({ firebaseUid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email.split('@')[0], favs: [], trips: [] }); }
    }
    req.dbUser = dbUser; next();
  } catch (err) { res.status(401).json({ error: 'Auth failed: ' + err.message }); }
};

// --- 7. USER ROUTES ---
app.get('/api/me', firebaseAuth, (req, res) => res.json({ user: pub(req.dbUser) }));
app.put('/api/me', firebaseAuth, async (req, res) => {
  if (req.body.name) req.dbUser.name = String(req.body.name).slice(0, 60);
  await req.dbUser.save(); res.json({ user: pub(req.dbUser) });
});
app.post('/api/me/:k(favs|trips)/:id', firebaseAuth, async (req, res) => {
  const k = req.params.k, id = req.params.id, i = req.dbUser[k].indexOf(id);
  if (i >= 0) req.dbUser[k].splice(i, 1); else { req.dbUser[k].push(id); if (k === 'favs') { const gem = await Gem.findById(id); if (gem && gem.authorId.toString() !== req.dbUser._id.toString()) createNotif(gem.authorId, req.dbUser.name, 'favorite', gem._id, gem.title); } }
  await req.dbUser.save(); res.json({ user: pub(req.dbUser) });
});

// --- 8. LEADERBOARD ROUTE ---
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({});
    const gems = await Gem.find({});
    const leaderboard = users.map(u => {
      const count = gems.filter(g => g.authorId && g.authorId.toString() === u._id.toString()).length;
      return { id: u._id, name: u.name || 'Anonymous Explorer', count };
    }).sort((a, b) => b.count - a.count).slice(0, 50);
    res.json(leaderboard);
  } catch (e) { 
    console.error("Leaderboard backend error:", e);
    res.status(500).json({ error: 'Failed to load leaderboard' }); 
  }
});

// --- 9. NOTIFICATION ROUTES ---
app.get('/api/notifications', firebaseAuth, async (req, res) => {
  const notifs = await Notification.find({ userId: req.dbUser._id.toString() }).sort({ createdAt: -1 }).limit(20);
  res.json(notifs);
});
app.post('/api/notifications/read', firebaseAuth, async (req, res) => {
  await Notification.updateMany({ userId: req.dbUser._id.toString(), isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
});
app.post('/api/notifications/nearby', firebaseAuth, async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'Missing coordinates' });
  req.dbUser.lastLat = lat; req.dbUser.lastLng = lng; await req.dbUser.save();
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentGems = await Gem.find({ created: { $gte: sevenDaysAgo.toISOString().slice(0, 10) }, authorId: { $ne: req.dbUser._id.toString() } });
  let newNotifs = 0;
  for (const gem of recentGems) {
    if (!gem.lat || !gem.lng) continue;
    const dist = getDistanceFromLatLonInKm(lat, lng, gem.lat, gem.lng);
    if (dist <= 20) {
      const existing = await Notification.findOne({ userId: req.dbUser._id.toString(), gemId: gem._id.toString(), type: 'nearby_alert' });
      if (!existing) { await Notification.create({ userId: req.dbUser._id.toString(), actorName: 'HiddenGems', type: 'nearby_alert', gemId: gem._id, gemTitle: gem.title }); newNotifs++; }
    }
  }
  res.json({ ok: true, newNotifs });
});

// --- 10. GEMS ROUTES ---
app.get('/api/gems', async (q, r) => {
  const gems = await Gem.find().sort({ _id: -1 });
  r.json(gems.map(formatGem));
});

app.get('/api/stats', async (q, r) => {
  const spots = await Gem.countDocuments(), users = await User.countDocuments(), gems = await Gem.find(), rated = gems.filter(g => g.rating > 0);
  r.json({ spots, explorers: users, photos: gems.filter(g => g.photo).length, rating: rated.length ? Math.round(rated.reduce((a, g) => a + g.rating, 0) / rated.length * 10) / 10 : 0, ratings: rated.reduce((a, g) => a + g.reviews, 0) });
});

app.post('/api/gems', firebaseAuth, upload.single('photo'), async (req, res) => {
  try {
    const b = req.body;
    const g = new Gem({
      ...b, lat: +b.lat, lng: +b.lng, authorId: req.dbUser._id, authorName: req.dbUser.name,
      costs: JSON.parse(b.costs || '[]'), tags: JSON.parse(b.tags || '[]'),
      steps: JSON.parse(b.steps || '[]'), safety: JSON.parse(b.safety || '{"lvl":"low","notes":[]}'),
      photo: req.file ? req.file.path : ''
    });
    await g.save(); 
    const activeUsers = await User.find({ lastLat: { $exists: true, $ne: null }, lastLng: { $exists: true, $ne: null } });
    activeUsers.forEach(u => {
      if (u._id.toString() === req.dbUser._id.toString()) return;
      if (getDistanceFromLatLonInKm(g.lat, g.lng, u.lastLat, u.lastLng) <= 20) createNotif(u._id.toString(), 'HiddenGems', 'nearby_alert', g._id, g.title);
    });
    res.json(formatGem(g));
  } catch (err) { res.status(400).json({ error: 'Invalid data' }); }
});

app.put('/api/gems/:id', firebaseAuth, upload.single('photo'), async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (g.authorId.toString() !== req.dbUser._id.toString()) return res.status(403).json({ error: 'Only the author can edit this gem' });
  const b = req.body;
  Object.assign(g, { ...b, lat: +b.lat, lng: +b.lng, costs: JSON.parse(b.costs || '[]'), tags: JSON.parse(b.tags || '[]'), steps: JSON.parse(b.steps || '[]'), safety: JSON.parse(b.safety || '{"lvl":"low","notes":[]}') });
  if (req.file) g.photo = req.file.path;
  await g.save(); 
  const usersToNotify = await User.find({ $or: [ { favs: g._id.toString() }, { trips: g._id.toString() } ] });
  usersToNotify.forEach(u => { if (u._id.toString() !== req.dbUser._id.toString()) createNotif(u._id.toString(), 'HiddenGems', 'update', g._id, g.title); });
  res.json(formatGem(g));
});

app.delete('/api/gems/:id', firebaseAuth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (g.authorId.toString() !== req.dbUser._id.toString()) return res.status(403).json({ error: 'Only the author can delete this gem' });
  await g.deleteOne(); res.json({ ok: true });
});

// --- 11. VOTING, RATING & REVIEWS ---
app.post('/api/gems/:id/rate', firebaseAuth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const n = Math.round(+req.body.stars);
  if (!(n >= 1 && n <= 5)) return res.status(400).json({ error: 'Rating must be 1 to 5' });
  g.ratings = g.ratings || {}; g.ratings[req.dbUser._id] = n;
  const v = Object.values(g.ratings); g.reviews = v.length;
  g.rating = Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10;
  g.markModified('ratings'); await g.save(); 
  if (g.authorId.toString() !== req.dbUser._id.toString()) createNotif(g.authorId, req.dbUser.name, 'rate', g._id, g.title);
  res.json(formatGem(g));
});

app.post('/api/gems/:id/review', firebaseAuth, async (req, res) => {
  try {
    const g = await Gem.findById(req.params.id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    
    const text = String(req.body.text).trim();
    if (!text) return res.status(400).json({ error: 'Review text required' });

    g.textReviews = g.textReviews || [];
    g.textReviews.unshift({ u: req.dbUser._id.toString(), n: req.dbUser.name, t: text, d: new Date().toISOString().slice(0, 10) });
    
    g.markModified('textReviews'); 
    await g.save();

    if (g.authorId.toString() !== req.dbUser._id.toString()) {
      createNotif(g.authorId, req.dbUser.name, 'review', g._id, g.title);
    }
    res.json(formatGem(g));
  } catch (err) {
    console.error("Review Error:", err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

app.post('/api/gems/:id/upvote', firebaseAuth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const uid = req.dbUser._id.toString(), i = g.ups.indexOf(uid);
  if (i >= 0) { g.ups.splice(i, 1); } else { g.ups.push(uid); if (g.authorId.toString() !== uid) { createNotif(g.authorId, req.dbUser.name, 'upvote', g._id, g.title); if (g.ups.length === 10) createNotif(g.authorId, 'HiddenGems', 'milestone_upvotes', g._id, g.title); } }
  await g.save(); res.json(formatGem(g));
});

app.post('/api/gems/:id/verify', firebaseAuth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const uid = req.dbUser._id.toString(), i = g.verifs.findIndex(v => v.u === uid);
  if (i >= 0) { g.verifs.splice(i, 1); } else { g.verifs.push({ u: uid, n: req.dbUser.name, d: new Date().toISOString().slice(0, 10) }); if (g.authorId.toString() !== uid) { createNotif(g.authorId, req.dbUser.name, 'verify', g._id, g.title); if (g.verifs.length === 3) createNotif(g.authorId, 'HiddenGems', 'milestone_verified', g._id, g.title); } }
  await g.save(); res.json(formatGem(g));
});

app.listen(process.env.PORT || 3000, () => console.log('HiddenGems running on port ' + (process.env.PORT || 3000)));