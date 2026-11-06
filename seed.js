require('dotenv').config();
const express = require('express'), fs = require('fs'), path = require('path');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), multer = require('multer');
const app = express(), DB = path.join(__dirname, 'db.json'), SECRET = process.env.JWT_SECRET || 'dev-secret';
fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify(require('./seed'), null, 2));
const load = () => JSON.parse(fs.readFileSync(DB)), save = d => fs.writeFileSync(DB, JSON.stringify(d, null, 2));
const upload = multer({
  storage: multer.diskStorage({ destination: 'uploads', filename: (q, f, cb) => cb(null, Date.now() + path.extname(f.originalname)) }),
  limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (q, f, cb) => cb(null, /^image\//.test(f.mimetype))
});
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/config.js', (q, r) => r.type('js').send('window.CFG=' + JSON.stringify({ mapsKey: process.env.GOOGLE_MAPS_KEY || '' })));

const sign = u => jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' });
const pub = u => ({ id: u.id, name: u.name, email: u.email, favs: u.favs, trips: u.trips });
const auth = (req, res, next) => { try { req.uid = jwt.verify((req.headers.authorization || '').slice(7), SECRET).id; next(); } catch { res.status(401).json({ error: 'Please sign in' }); } };

app.post('/api/register', (req, res) => {
  const d = load(), { name, email, password } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email and a 6+ character password are required' });
  if (d.users.some(u => u.email === email)) return res.status(400).json({ error: 'Email already registered' });
  const u = { id: 'u' + Date.now(), name: name || email.split('@')[0], email, hash: bcrypt.hashSync(password, 8), favs: [], trips: [] };
  d.users.push(u); save(d); res.json({ token: sign(u), user: pub(u) });
});
app.post('/api/login', (req, res) => {
  const u = load().users.find(x => x.email === req.body.email);
  if (!u || !bcrypt.compareSync(req.body.password || '', u.hash)) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign(u), user: pub(u) });
});
app.get('/api/me', auth, (req, res) => res.json({ user: pub(load().users.find(u => u.id === req.uid)) }));
app.put('/api/me', auth, (req, res) => {
  const d = load(), u = d.users.find(x => x.id === req.uid);
  if (req.body.name) u.name = String(req.body.name).slice(0, 60);
  save(d); res.json({ user: pub(u) });
});
app.post('/api/me/:k(favs|trips)/:id', auth, (req, res) => {
  const d = load(), u = d.users.find(x => x.id === req.uid), a = u[req.params.k], i = a.indexOf(req.params.id);
  i >= 0 ? a.splice(i, 1) : a.push(req.params.id); save(d); res.json({ user: pub(u) });
});

const build = (b, f, old = {}) => {
  const j = (k, dflt) => { try { return JSON.parse(b[k]); } catch { return dflt; } };
  return { ...old, title: b.title, place: b.place, country: b.country, state: b.state, district: b.district,
    lat: +b.lat, lng: +b.lng, cat: b.cat, desc: b.desc, cur: b.cur || 'USD',
    costs: j('costs', []), tags: j('tags', []), steps: j('steps', []), safety: j('safety', { lvl: 'low', notes: [] }),
    photo: f ? '/uploads/' + f.filename : old.photo || '' };
};
const valid = b => b.title && b.place && !isNaN(+b.lat) && !isNaN(+b.lng) && b.lat !== '' && b.lng !== '';
app.get('/api/gems', (q, r) => r.json(load().gems));
app.post('/api/gems', auth, upload.single('photo'), (req, res) => {
  if (!valid(req.body)) return res.status(400).json({ error: 'Title, place and coordinates are required' });
  const d = load(), me = d.users.find(u => u.id === req.uid);
  const g = { id: 'g' + Date.now(), ups: [], verifs: [], rating: 0, reviews: 0, ratings: {}, authorId: me.id, authorName: me.name, created: new Date().toISOString().slice(0, 10), ...build(req.body, req.file) };
  d.gems.unshift(g); save(d); res.json(g);
});
app.put('/api/gems/:id', auth, upload.single('photo'), (req, res) => {
  const d = load(), i = d.gems.findIndex(g => g.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Not found' });
  if (d.gems[i].authorId !== req.uid) return res.status(403).json({ error: 'Only the author can edit this gem' });
  if (!valid(req.body)) return res.status(400).json({ error: 'Title, place and coordinates are required' });
  d.gems[i] = build(req.body, req.file, d.gems[i]); save(d); res.json(d.gems[i]);
});
app.delete('/api/gems/:id', auth, (req, res) => {
  const d = load(), g = d.gems.find(x => x.id === req.params.id);
  if (!g) return res.status(404).json({ error: 'Not found' });
  if (g.authorId !== req.uid) return res.status(403).json({ error: 'Only the author can delete this gem' });
  d.gems = d.gems.filter(x => x.id !== g.id); save(d); res.json({ ok: true });
});
const recalc = g => { const v = Object.values(g.ratings || {}); g.reviews = v.length; g.rating = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : 0; };
app.post('/api/gems/:id/rate', auth, (req, res) => {
  const d = load(), g = d.gems.find(x => x.id === req.params.id); if (!g) return res.status(404).json({ error: 'Not found' });
  const n = Math.round(+req.body.stars); if (!(n >= 1 && n <= 5)) return res.status(400).json({ error: 'Rating must be 1 to 5' });
  g.ratings = g.ratings || {}; g.ratings[req.uid] = n; recalc(g); save(d); res.json(g);
});
app.post('/api/gems/:id/upvote', auth, (req, res) => {
  const d = load(), g = d.gems.find(x => x.id === req.params.id); if (!g) return res.status(404).json({ error: 'Not found' });
  g.ups = g.ups.includes(req.uid) ? g.ups.filter(x => x !== req.uid) : [...g.ups, req.uid]; save(d); res.json(g);
});
app.post('/api/gems/:id/verify', auth, (req, res) => {
  const d = load(), g = d.gems.find(x => x.id === req.params.id), u = d.users.find(x => x.id === req.uid); if (!g) return res.status(404).json({ error: 'Not found' });
  g.verifs = g.verifs.some(v => v.u === u.id) ? g.verifs.filter(v => v.u !== u.id) : [...g.verifs, { u: u.id, n: u.name, d: new Date().toISOString().slice(0, 10) }];
  save(d); res.json(g);
});
app.listen(process.env.PORT || 3000, () => console.log('HiddenGems running on http://localhost:' + (process.env.PORT || 3000)));