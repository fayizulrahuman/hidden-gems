const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const express = require('express'), path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express(), SECRET = process.env.JWT_SECRET || 'dev-secret';

// --- 1. CONNECT TO MONGODB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// --- 2. SETUP CLOUDINARY FOR IMAGES ---
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

// --- 3. DATABASE SCHEMAS ---
const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, unique: true }, hash: String,
  favs: [String], trips: [String]
});
const GemSchema = new mongoose.Schema({
  title: String, place: String, country: String, state: String, district: String,
  lat: Number, lng: Number, cat: String, desc: String, cur: String,
  costs: Array, tags: Array, steps: Array, safety: Object,
  photo: String, authorId: String, authorName: String,
  created: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  ups: { type: [String], default: [] }, verifs: { type: Array, default: [] },
  rating: { type: Number, default: 0 }, reviews: { type: Number, default: 0 },
  ratings: { type: Object, default: {} }
});

const User = mongoose.model('User', UserSchema);
const Gem = mongoose.model('Gem', GemSchema);

// --- 4. MIDDLEWARE ---
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/config.js', (q, r) => r.type('js').send('window.CFG={};'));

const sign = u => jwt.sign({ id: u._id }, SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u._id, name: u.name, email: u.email, favs: u.favs, trips: u.trips });
const auth = (req, res, next) => {
  try { req.uid = jwt.verify((req.headers.authorization || '').slice(7), SECRET).id; next(); }
  catch { res.status(401).json({ error: 'Please sign in' }); }
};

// Helper to format MongoDB documents to match frontend expectations
const formatGem = g => { const obj = g.toObject(); obj.id = obj._id; delete obj._id; delete obj.__v; return obj; };

// --- 5. AUTHENTICATION ROUTES ---
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email and a 6+ character password are required' });
    
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });
    
    const u = new User({ name: name || email.split('@')[0], email, hash: bcrypt.hashSync(password, 8), favs: [], trips: [] });
    await u.save();
    res.json({ token: sign(u), user: pub(u) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const u = await User.findOne({ email: req.body.email });
    if (!u || !bcrypt.compareSync(req.body.password || '', u.hash)) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: sign(u), user: pub(u) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/me', auth, async (req, res) => {
  const u = await User.findById(req.uid);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json({ user: pub(u) });
});

app.put('/api/me', auth, async (req, res) => {
  const u = await User.findById(req.uid);
  if (req.body.name) u.name = String(req.body.name).slice(0, 60);
  await u.save(); res.json({ user: pub(u) });
});

app.post('/api/me/:k(favs|trips)/:id', auth, async (req, res) => {
  const u = await User.findById(req.uid), k = req.params.k, id = req.params.id;
  const i = u[k].indexOf(id);
  if (i >= 0) u[k].splice(i, 1); else u[k].push(id);
  await u.save(); res.json({ user: pub(u) });
});

// --- 6. GEMS ROUTES ---
app.get('/api/gems', async (q, r) => {
  const gems = await Gem.find().sort({ _id: -1 });
  r.json(gems.map(formatGem));
});

app.get('/api/stats', async (q, r) => {
  const spots = await Gem.countDocuments();
  const users = await User.countDocuments();
  const gems = await Gem.find();
  const rated = gems.filter(g => g.rating > 0);
  r.json({
    spots, explorers: users, photos: gems.filter(g => g.photo).length,
    rating: rated.length ? Math.round(rated.reduce((a, g) => a + g.rating, 0) / rated.length * 10) / 10 : 0,
    ratings: rated.reduce((a, g) => a + g.reviews, 0)
  });
});

app.post('/api/gems', auth, upload.single('photo'), async (req, res) => {
  try {
    const u = await User.findById(req.uid);
    const b = req.body;
    const g = new Gem({
      ...b, lat: +b.lat, lng: +b.lng, authorId: u._id, authorName: u.name,
      costs: JSON.parse(b.costs || '[]'), tags: JSON.parse(b.tags || '[]'),
      steps: JSON.parse(b.steps || '[]'), safety: JSON.parse(b.safety || '{"lvl":"low","notes":[]}'),
      photo: req.file ? req.file.path : ''
    });
    await g.save(); res.json(formatGem(g));
  } catch (err) { res.status(400).json({ error: 'Invalid data' }); }
});

app.put('/api/gems/:id', auth, upload.single('photo'), async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (g.authorId !== req.uid) return res.status(403).json({ error: 'Only the author can edit this gem' });
  
  const b = req.body;
  Object.assign(g, {
    ...b, lat: +b.lat, lng: +b.lng,
    costs: JSON.parse(b.costs || '[]'), tags: JSON.parse(b.tags || '[]'),
    steps: JSON.parse(b.steps || '[]'), safety: JSON.parse(b.safety || '{"lvl":"low","notes":[]}')
  });
  if (req.file) g.photo = req.file.path;
  await g.save(); res.json(formatGem(g));
});

app.delete('/api/gems/:id', auth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (g.authorId !== req.uid) return res.status(403).json({ error: 'Only the author can delete this gem' });
  await g.deleteOne(); res.json({ ok: true });
});

// --- 7. VOTING & RATING ---
app.post('/api/gems/:id/rate', auth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const n = Math.round(+req.body.stars);
  if (!(n >= 1 && n <= 5)) return res.status(400).json({ error: 'Rating must be 1 to 5' });
  g.ratings = g.ratings || {}; g.ratings[req.uid] = n;
  const v = Object.values(g.ratings); g.reviews = v.length;
  g.rating = Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10;
  g.markModified('ratings'); await g.save(); res.json(formatGem(g));
});

app.post('/api/gems/:id/upvote', auth, async (req, res) => {
  const g = await Gem.findById(req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const i = g.ups.indexOf(req.uid);
  if (i >= 0) g.ups.splice(i, 1); else g.ups.push(req.uid);
  await g.save(); res.json(formatGem(g));
});

app.post('/api/gems/:id/verify', auth, async (req, res) => {
  const g = await Gem.findById(req.params.id), u = await User.findById(req.uid);
  if (!g) return res.status(404).json({ error: 'Not found' });
  const i = g.verifs.findIndex(v => v.u === u._id.toString());
  if (i >= 0) g.verifs.splice(i, 1); else g.verifs.push({ u: u._id, n: u.name, d: new Date().toISOString().slice(0, 10) });
  await g.save(); res.json(formatGem(g));
});

app.listen(process.env.PORT || 3000, () => console.log('HiddenGems running on port ' + (process.env.PORT || 3000)));