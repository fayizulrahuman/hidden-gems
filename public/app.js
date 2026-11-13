/* HiddenGems front end – plain JavaScript, no build step */
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RATE={USD:1,INR:88,EUR:.92,GBP:.78,DKK:6.9,TRY:42,MXN:18.5,JPY:150,AUD:1.5,AED:3.67};
const SYM={USD:'$',INR:'₹',EUR:'€',GBP:'£',DKK:'kr ',TRY:'₺',MXN:'MX$',JPY:'¥',AUD:'A$',AED:'AED '};
const FUEL={USD:.95,INR:105,EUR:1.85,GBP:1.45,DKK:14,TRY:48,MXN:24,JPY:175,AUD:2,AED:2.7};
const CC={India:'INR',Italy:'EUR',France:'EUR',Germany:'EUR',Spain:'EUR',Mexico:'MXN','Türkiye':'TRY',Turkey:'TRY','Faroe Islands':'DKK','United Kingdom':'GBP',UK:'GBP',Japan:'JPY',Australia:'AUD','United States':'USD',USA:'USD',UAE:'AED'};
const CATS=['Nature','Viewpoint','Historical','Adventure','Others'],TAGS=['Free','Family Friendly','Hiking','Scenic','Hidden','Dog-Friendly','Cash Only','Requires Hiking'];
const PIN={Nature:'#2e9e5b',Viewpoint:'#f39c12',Historical:'#8e44ad',Adventure:'#e0334c',Others:'#2b7fd6'};
const NAV=[['home','house','Home'],['explore','compass','Explore'],['map','map','Map'],['trips','suitcase-rolling','My Trips'],['favs','heart','Favorites'],['leaderboard','trophy','Leaderboard'],['contribute','upload','Contribute'],['profile','user','Profile'],['settings','gear','Settings']];
const mny=(c,v)=>(SYM[c]||c+' ')+v.toLocaleString(c==='INR'?'en-IN':'en-US',{maximumFractionDigits:c==='JPY'||v>=100?0:2});
const total=g=>g.costs.reduce((a,c)=>a+c.a,0),lines=t=>t.split('\n').map(s=>s.trim()).filter(Boolean),uniq=a=>[...new Set(a.filter(Boolean))].sort();
const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h))};

// --- FIREBASE INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyACaJSLguwiMKUlTROo3MA-uL5ORu6RZ5Y",
  authDomain: "login-d684e.firebaseapp.com",
  projectId: "login-d684e",
  storageBucket: "login-d684e.firebasestorage.app",
  messagingSenderId: "607768048141",
  appId: "1:607768048141:web:db212e656274836ac5db44"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// App State
const S={user:null,gems:[],notifications:[],leaderboard:[],loading:true,q:'',tags:[],cat:'',co:'',st:'',di:'',verified:false,safe:false,near:null,radius:25,reg:false,forgot:false,ftags:[]};
let after=null;
const dd=g=>S.near?km(S.near.lat,S.near.lng,g.lat,g.lng):null;
const go=h=>{location.hash===h?render():location.hash=h};
const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2800)};

// UPDATED: Better API error handling
const api=async(p,o={})=>{
  const fd=o.body instanceof FormData;
  const headers = {...(fd?{}:{'Content-Type':'application/json'})};
  if (auth.currentUser) {
    try { const token = await auth.currentUser.getIdToken(); headers['Authorization'] = 'Bearer ' + token; } catch (e) {}
  }
  const r=await fetch('/api'+p,{...o,headers,body:o.body&&!fd?JSON.stringify(o.body):o.body});
  
  const text = await r.text();
  let j = {};
  try { j = JSON.parse(text); } catch (e) { 
    console.error('Server returned non-JSON:', text.substring(0, 150)); 
  }
  
  if(!r.ok)throw new Error(j.error || `Request failed (Status: ${r.status})`);
  return j;
};

const FB=t=>{const c=[['#2fa37c','#0b4f3c'],['#6b8fb3','#27415c'],['#e0833a','#7a2e1b'],['#5aa88a','#1f4d3f']][[...(t||'x')].reduce((a,x)=>a+x.charCodeAt(0),0)%4];
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c[0]}'/><stop offset='1' stop-color='${c[1]}'/></linearGradient></defs><rect width='400' height='240' fill='url(#g)'/><path d='M0 200L110 110L190 170L270 80L400 190V240H0Z' fill='rgba(0,0,0,.25)'/></svg>`)};
const img=g=>`<img src="${esc(g.photo||FB(g.title))}" alt="${esc(g.title)}" onerror="this.onerror=null;this.src=FB(this.alt)">`;

const wCode = c => {
  if (c === 0) return { i: 'fa-sun', t: 'Clear' };
  if (c <= 3) return { i: 'fa-cloud-sun', t: 'Partly Cloudy' };
  if (c <= 48) return { i: 'fa-smog', t: 'Fog' };
  if (c <= 67) return { i: 'fa-cloud-rain', t: 'Rain' };
  if (c <= 77) return { i: 'fa-snowflake', t: 'Snow' };
  if (c <= 82) return { i: 'fa-cloud-showers-heavy', t: 'Showers' };
  return { i: 'fa-cloud-bolt', t: 'Storm' };
};

function list(){
  let r=S.gems.filter(g=>(!S.q||(g.title+g.place+g.state+g.country+g.district+g.tags.join(' ')).toLowerCase().includes(S.q.toLowerCase()))&&(!S.cat||g.cat===S.cat)&&(!S.co||g.country===S.co)&&(!S.st||g.state===S.st)&&(!S.di||g.district===S.di)&&S.tags.every(t=>g.tags.includes(t))&&(!S.verified||g.verifs.length>=3)&&(!S.safe||g.safety.lvl==='low'));
  if(S.near) r = r.filter(g=>dd(g)<=S.radius).sort((a,b)=>dd(a)-dd(b));
  else r.sort((a,b)=>b.ups.length-a.ups.length);
  return r;
}
const clearF=()=>{Object.assign(S,{q:'',tags:[],cat:'',co:'',st:'',di:'',verified:false,safe:false,near:null});render()};

async function locate(cb){
  if(!navigator.geolocation)return toast('Geolocation not supported');
  navigator.geolocation.getCurrentPosition(async p=>{
    S.near={lat:p.coords.latitude,lng:p.coords.longitude};
    cb?cb():render();
    try {
      const res = await api('/notifications/nearby', { method: 'POST', body: S.near });
      if (res.newNotifs > 0) { toast(`Found ${res.newNotifs} new gems nearby! Check notifications.`); await loadNotifs(); }
    } catch (e) {}
  },()=>toast('Location blocked. Allow access to use Near Me.'))
}
const togNear=()=>S.near?(S.near=null,render()):locate();

// --- NOTIFICATIONS ---
async function loadNotifs() { try { S.notifications = await api('/notifications'); paintNotifBadge(); } catch(e) {} }
function paintNotifBadge() { const badge = $('.notif-badge'); if (badge) badge.classList.toggle('show', S.notifications.some(n => !n.isRead)); }
async function toggleNotifPanel(e) {
  e.stopPropagation(); const panel = $('#notifPanel'); if (!panel) return;
  if (panel.classList.contains('open')) { panel.classList.remove('open'); } else {
    const list = $('#notifList'); if (list) list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--mu);font-size:13px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading...</div>';
    panel.classList.add('open'); await loadNotifs(); if (list) list.innerHTML = renderNotifList();
    if (S.notifications.some(n => !n.isRead)) { await api('/notifications/read', { method: 'POST' }); S.notifications.forEach(n => n.isRead = true); paintNotifBadge(); if (list) list.innerHTML = renderNotifList(); }
  }
}
function renderNotifList() {
  if (!S.notifications.length) return '<div style="padding:20px;text-align:center;color:var(--mu);font-size:13px;">No notifications yet.</div>';
  return S.notifications.map(n => {
    let icon = 'fa-circle-info', text = '', color = 'var(--ac)';
    if (n.type === 'upvote') { icon = 'fa-arrow-up'; text = `<b>${esc(n.actorName)}</b> upvoted your gem <b>${esc(n.gemTitle)}</b>.`; }
    if (n.type === 'verify') { icon = 'fa-check-circle'; text = `<b>${esc(n.actorName)}</b> verified that <b>${esc(n.gemTitle)}</b> is still open.`; }
    if (n.type === 'rate') { icon = 'fa-star'; text = `<b>${esc(n.actorName)}</b> rated your gem <b>${esc(n.gemTitle)}</b>.`; }
    if (n.type === 'favorite') { icon = 'fa-heart'; color = '#e0334c'; text = `<b>${esc(n.actorName)}</b> liked your gem <b>${esc(n.gemTitle)}</b>.`; }
    if (n.type === 'review') { icon = 'fa-comment'; color = '#2b7fd6'; text = `<b>${esc(n.actorName)}</b> left a review on <b>${esc(n.gemTitle)}</b>.`; }
    if (n.type === 'milestone_upvotes') { icon = 'fa-trophy'; color = '#f39c12'; text = `🎉 Congratulations! Your gem <b>${esc(n.gemTitle)}</b> just reached 10 upvotes!`; }
    if (n.type === 'milestone_verified') { icon = 'fa-shield-halved'; color = '#2e9e5b'; text = `✅ Your gem <b>${esc(n.gemTitle)}</b> is now marked as <b>Verified</b> by the community!`; }
    if (n.type === 'update') { icon = 'fa-pen'; color = '#2b7fd6'; text = `ℹ️ <b>${esc(n.gemTitle)}</b> (a gem in your favorites/trips) was recently updated.`; }
    if (n.type === 'nearby_alert') { icon = 'fa-location-dot'; color = '#8e44ad'; text = `📍 A new hidden gem <b>${esc(n.gemTitle)}</b> was recently added near your current location!`; }
    
    return `<a href="#/gem/${n.gemId}" class="notif-item ${n.isRead ? '' : 'unread'}" onclick="document.getElementById('notifPanel').classList.remove('open')">
      <i class="fa-solid ${icon}" style="color:${color}"></i>
      <div style="flex:1;"><div class="notif-text">${text}</div><div class="notif-time">${new Date(n.createdAt).toLocaleDateString()}</div></div>
    </a>`;
  }).join('');
}
document.addEventListener('click', (e) => {
  const panel = $('#notifPanel'); const btn = $('.notif-wrap');
  if (panel && panel.classList.contains('open') && !panel.contains(e.target) && !btn.contains(e.target)) panel.classList.remove('open');
});

async function tog(k,id){const u=S.user,old=[...u[k]];u[k]=u[k].includes(id)?u[k].filter(x=>x!==id):[...u[k],id];render();try{await api(`/me/${k}/${id}`,{method:'POST'})}catch(e){u[k]=old;render();toast(e.message)}}
async function vote(kind,id){const g=S.gems.find(x=>x.id===id),u=S.user,old=JSON.stringify([g.ups,g.verifs]);
  if(kind==='upvote')g.ups=g.ups.includes(u.id)?g.ups.filter(x=>x!==u.id):[...g.ups,u.id];else g.verifs=g.verifs.some(v=>v.u===u.id)?g.verifs.filter(v=>v.u!==u.id):[...g.verifs,{u:u.id,n:u.name,d:new Date().toISOString().slice(0,10)}];
  render();try{await api(`/gems/${id}/${kind}`,{method:'POST'})}catch(e){[g.ups,g.verifs]=JSON.parse(old);render();toast(e.message)}}
async function rate(id,n){const g=S.gems.find(x=>x.id===id),u=S.user,old=JSON.stringify([g.ratings,g.rating,g.reviews]);g.ratings={...(g.ratings||{}),[u.id]:n};const v=Object.values(g.ratings);g.reviews=v.length;g.rating=Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10;render();
  try{await api(`/gems/${id}/rate`,{method:'POST',body:{stars:n}});refresh()}catch(e){[g.ratings,g.rating,g.reviews]=JSON.parse(old);render();toast(e.message)}}
async function del(id){if(!confirm('Delete this gem?'))return;const old=S.gems;S.gems=S.gems.filter(g=>g.id!==id);go('#/explore');try{await api('/gems/'+id,{method:'DELETE'});toast('Gem deleted');refresh()}catch(e){S.gems=old;render();toast(e.message)}}

async function shareGem(id) {
  const g = S.gems.find(x => x.id === id);
  if (!g) return;
  
  // Try native share first (Only works on HTTPS or localhost)
  if (navigator.share) {
    try { 
      await navigator.share({ 
        title: g.title, 
        text: `Check out this hidden gem: ${g.title}`, 
        url: window.location.href 
      }); 
    } catch (e) { console.log('Share canceled'); }
  } else {
    // Bulletproof fallback for Desktop/HTTP IP testing
    const textarea = document.createElement('textarea');
    textarea.value = window.location.href;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast('Link copied!'); // <-- CLEANED UP MESSAGE
  }
}

async function submitReview(e, id) {
  e.preventDefault();
  const f = e.target, text = f.reviewText.value.trim(), b = f.querySelector('.btn');
  if (!text) return;
  b.disabled = true;
  try {
    const g = await api(`/gems/${id}/review`, { method: 'POST', body: { text } });
    S.gems = S.gems.map(x => x.id === id ? g : x);
    toast('Review posted!');
    render();
  } catch (err) { 
    toast(err.message);
    b.disabled = false; 
  }
}

// --- AUTH VIEWS ---
function authView(){
  if (S.forgot) {
    $('#app').innerHTML = `<form class="auth card" onsubmit="doForgot(event)">
      <div class="logo logo-d" style="color:#12503a"><img src="/img/my-icon.png" alt="Logo" style="height: 40px; margin-bottom: 5px;"><b>HiddenGems</b><small>— Recover Account —</small></div>
      <h2>Forgot Password</h2><p class="mu" style="margin-bottom:15px;">Enter your email to receive a reset link.</p>
      <label>Email</label><input name="email" type="email" required><button class="btn p wide">Send Reset Link</button>
      <div style="text-align:center;margin-top:10px"><button type="button" class="link" onclick="S.forgot=false;authView()">Back to Login</button></div>
    </form>`;
    return;
  }
  $('#app').innerHTML = `<form class="auth card" onsubmit="doAuth(event)">
    <div class="logo logo-d" style="color:#12503a"><img src="/img/my-icon.png" alt="Logo" style="height: 40px; margin-bottom: 5px;"><b>HiddenGems</b><small>— Explore More —</small></div>
    <h2>${S.reg?'Create account':'Welcome back'}</h2>
    ${S.reg?'<label>Name</label><input name="name">':''}
    <label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required minlength="6">
    <button class="btn p wide">${S.reg?'Sign up':'Sign in'}</button>
    <div style="text-align:center;margin-top:10px; display:flex; flex-direction:column; gap:8px;">
      <button type="button" class="link" onclick="S.reg=!S.reg;authView()">${S.reg?'Have an account? Sign in':'New here? Create an account'}</button>
      ${!S.reg ? '<button type="button" class="link" style="color:var(--mu); font-weight:500;" onclick="S.forgot=true;authView()">Forgot password?</button>' : ''}
    </div>
  </form>`;
}
async function doAuth(e){
  e.preventDefault(); const f=e.target,b=f.querySelector('.btn');b.disabled=true;
  try{
    if(S.reg){ const cred = await auth.createUserWithEmailAndPassword(f.email.value, f.password.value); if(f.name?.value) await cred.user.updateProfile({ displayName: f.name.value }); } else { await auth.signInWithEmailAndPassword(f.email.value, f.password.value); }
    toast(S.reg ? 'Account created!' : 'Welcome back!'); go('#/home');
  }catch(err){ toast(err.message.replace('Firebase: ', '')); b.disabled=false; }
}
async function doForgot(e) {
  e.preventDefault(); const f = e.target, b = f.querySelector('.btn'); b.disabled = true;
  try { await auth.sendPasswordResetEmail(f.email.value); toast('Password reset email sent! Check your inbox.'); S.forgot = false; authView(); } 
  catch (err) { toast(err.message.replace('Firebase: ', '')); b.disabled = false; }
}
const logout=async()=>{ try { await auth.signOut(); toast('Signed out'); go('#/home'); } catch (err) { toast('Error signing out'); } };

function shell(r,body){
  const u=S.user;
  const moreMobileNav = ['explore', 'trips', 'leaderboard', 'profile', 'settings'];
  const hasUnread = S.notifications.some(n => !n.isRead);

  $('#app').innerHTML = `
  <div class="app ${r==='map'?'is-map':''}">
    <aside class="side">
      <div class="logo"><img src="/img/my-icon.png" alt="Logo" style="height: 40px; margin-bottom: 5px;"><b>HiddenGems</b><small>— Explore More —</small></div>
      ${NAV.map(n=>`<a class="nav ${r===n[0]?'on':''}" href="#/${n[0]}"><i class="fa-solid fa-${n[1]}"></i><span>${n[2]}</span></a>`).join('')}
      <a class="nav out" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i><span>Sign Out</span></a>
    </aside>

    <main class="${r==='map'?'nopad':''}">
      <div class="top ${r==='home'?'mobile-absolute':''} ${r==='map'?'absolute-top':''}">
        <button class="pill" onclick="togNear()"><i class="fa-solid fa-location-dot"></i> ${S.near?'Near me':'All locations'}</button>
        <div class="notif-wrap">
          <button class="pill" onclick="toggleNotifPanel(event)"><i class="fa-solid fa-bell"></i></button>
          <div class="notif-badge ${hasUnread ? 'show' : ''}"></div>
          <div id="notifPanel" class="notif-panel">
            <div class="notif-head"><b>Notifications</b><button class="link" style="font-size:12px" onclick="document.getElementById('notifPanel').classList.remove('open')">Close</button></div>
            <div class="notif-list" id="notifList">${renderNotifList()}</div>
          </div>
        </div>
        <span class="av" onclick="go('#/profile')">${esc(u.name[0])}</span>
      </div>
      ${body}
    </main>

    <nav class="mobile-bottom-nav">
      <a class="m-nav ${r==='home'?'on':''}" href="#/home"><i class="fa-solid fa-house"></i><span>Home</span></a>
      <a class="m-nav ${r==='map'?'on':''}" href="#/map"><i class="fa-solid fa-map"></i><span>Map</span></a>
      <a class="nav-fab" href="#/contribute"><i class="fa-solid fa-plus"></i></a>
      <a class="m-nav ${r==='favs'?'on':''}" href="#/favs"><i class="fa-solid fa-bookmark"></i><span>Saved</span></a>
      <a class="m-nav ${moreMobileNav.includes(r)?'on':''}" onclick="toggleMoreMenu()"><i class="fa-solid fa-bars"></i><span>More</span></a>
    </nav>

    <div id="moreMenuOverlay" class="more-menu-overlay" onclick="toggleMoreMenu()">
      <div class="more-menu" onclick="event.stopPropagation()">
        <div class="more-handle"></div>
        ${NAV.filter(n => moreMobileNav.includes(n[0])).map(n => `
          <a class="more-item ${r===n[0]?'on':''}" href="#/${n[0]}" onclick="toggleMoreMenu()">
            <i class="fa-solid fa-${n[1]}"></i> <span>${n[2]}</span>
          </a>
        `).join('')}
        <a class="more-item" onclick="logout()" style="color:#e0334c"><i class="fa-solid fa-right-from-bracket"></i> <span>Sign Out</span></a>
      </div>
    </div>
  </div>`;
}
function toggleMoreMenu() { const menu = $('#moreMenuOverlay'); if (menu) menu.classList.toggle('open'); }

const skel=()=>'<div class="grid">'+'<div class="sk"></div>'.repeat(6)+'</div>';
const empty=(t,s,b)=>`<div class="empty-wrap"><div class="card empty"><i class="fa-solid fa-compass" style="font-size:34px"></i><h2 style="margin-top:8px">${t}</h2>${s}<div style="margin-top:14px">${b||''}</div></div></div>`;

const card=g=>{const fav=S.user.favs.includes(g.id);return `<div class="gc" onclick="go('#/gem/${g.id}')"><div class="ph">${img(g)}<span class="bdg ${g.verifs.length>=3?'v':''}">${g.verifs.length>=3?'Verified ✓':esc(g.cat)}</span><button class="heart ${fav?'on':''}" onclick="event.stopPropagation();tog('favs','${g.id}')"><i class="fa-solid fa-heart"></i></button></div><div class="gb"><h3>${esc(g.title)}</h3>
<div class="mu" style="display:flex; align-items:center; gap:4px; margin-bottom:4px;"><i class="fa-solid fa-location-dot"></i> <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(g.district)}</span></div>
<div class="mu" style="display:flex; align-items:center; gap:4px;"><i class="fa-solid fa-star" style="color:#f5a623"></i> ${g.rating||'New'}</div>
</div></div>`};

let hsI=0,hsPause=false;
const hsL=()=>S.gems.filter(g=>g.photo).sort((a,b)=>(b.rating||0)-(a.rating||0)||(b.reviews||0)-(a.reviews||0)||b.ups.length-a.ups.length).slice(0,5);
const hsHTML=()=>{const l=hsL();if(!l.length)return '';if(hsI>l.length)hsI=0;return `<div class="hs"><div class="hs-track" id="hsTrack" style="transform:translateX(-${hsI*100}%)">${[...l,l[0]].map(g=>`<div class="hs-s">${img(g)}</div>`).join('')}</div></div>`};
const hsDots=()=>`<div class="hs-dots">${hsL().map((g,i)=>`<span class="hs-d ${i===hsI%hsL().length?'on':''}" onclick="hsGo(${i})"></span>`).join('')}</div>`;
function hsGo(i){const t=$('#hsTrack'),n=hsL().length;if(!t||!n)return;hsI=i;t.style.transition='transform .9s cubic-bezier(.65,0,.35,1)';t.style.transform=`translateX(-${i*100}%)`;
  document.querySelectorAll('.hs-d').forEach((d,k)=>d.classList.toggle('on',k===i%n));
  if(i>=n)setTimeout(()=>{const t2=$('#hsTrack');if(t2){t2.style.transition='none';t2.style.transform='translateX(0)';hsI=0}},950)}
setInterval(()=>{if(!$('#hsTrack')||document.hidden||hsPause||hsL().length<2)return;hsGo(hsI+1)},4000);

const shown={};
const stV=()=>{const r=S.gems.filter(g=>g.rating>0);return S.stats||{spots:S.gems.length,explorers:1,photos:S.gems.filter(g=>g.photo).length,rating:r.length?Math.round(r.reduce((a,g)=>a+g.rating,0)/r.length*10)/10:0,ratings:r.reduce((a,g)=>a+g.reviews,0)}};
const statsHTML=()=>{const s=stV();return `<div class="stats">${[['stSpots','leaf',s.spots,'Hidden Spots'],['stExp','users',s.explorers,'Explorers'],['stPh','image',s.photos,'Photos'],['stRt','star',s.rating,'Rating']].map(c=>`<div class="card stat"><i class="fa-solid fa-${c[1]}"></i><div><b id="${c[0]}">${c[0]==='stRt'?(c[2]?c[2].toFixed(1):'–'):c[2]}</b><span class="mu">${c[3]}</span></div></div>`).join('')}</div>`};
function paintStats(){const s=stV();[['stSpots',s.spots],['stExp',s.explorers],['stPh',s.photos],['stRt',s.rating]].forEach(([id,v])=>{const el=$('#'+id);if(!el)return;const from=shown[id]??v,t0=performance.now(),f=x=>id==='stRt'?(x?x.toFixed(1):'–'):Math.round(x);
  (function tick(t){const k=Math.min(1,(t-t0)/700);el.textContent=f(k<1?from+(v-from)*k:v);if(k<1)requestAnimationFrame(tick);else shown[id]=v})(t0)})}
const isHome=()=>['','home'].includes(location.hash.slice(2).split('/')[0]);
async function refresh(full){try{S.stats=await api('/stats');if(full){const g=await api('/gems'),ch=JSON.stringify(g)!==JSON.stringify(S.gems);S.gems=g;if(ch&&isHome()&&!document.activeElement.matches('input,textarea,select'))return render()}paintStats()}catch(e){}}
setInterval(()=>{if(S.user&&!document.hidden){refresh(true);loadNotifs();}},10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.user){refresh(true);loadNotifs();}});

// --- VIEWS ---
function home(){
  after=paintStats;
  const top=[...S.gems].sort((a,b)=>(b.rating||0)-(a.rating||0)||b.ups.length-a.ups.length).slice(0,4);
  const mockCats = [{i:'tree', n:'Nature'}, {i:'mountain', n:'Adventure'}, {i:'camera', n:'Scenic'}, {i:'paw', n:'Dog-Friendly'}, {i:'gift', n:'Free'}, {i:'wallet', n:'Budget'}, {i:'person-hiking', n:'Hiking'}, {i:'shield', n:'Safe'}];
  return `<div class="hero" onmouseenter="hsPause=true" onmouseleave="hsPause=false"><img src="/img/my-icon.png" class="mobile-hero-logo" alt="Logo">${hsHTML()}<div class="hero-in"><h1>Discover Hidden Gems Around You</h1><p>Explore. Plan. Experience.</p><div class="mobile-search-container"><form class="hq" onsubmit="event.preventDefault();S.q=this.q.value;go('#/explore')"><i class="fa-solid fa-magnifying-glass"></i><input name="q" placeholder="Search for hidden gems..."></form><button class="loc-btn" onclick="locate()"><i class="fa-solid fa-location-crosshairs"></i></button></div></div>${hsDots()}</div>
  ${statsHTML()}
  <div class="cols"><div><div class="row sp"><h2>Popular Hidden Gems</h2><button class="link" onclick="go('#/explore')">See All →</button></div>
      ${top.length?`<div class="g4 home-slider">${top.map(card).join('')}</div>`:empty('No hidden gems yet','Be the first to share a place.','<button class="btn p" onclick="go(\'#/contribute\')">Add a gem</button>')}
      <div class="card mobile-only-widget" style="margin-top:20px; position:relative; overflow:hidden; height:160px; background:url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80') center/cover;"><div style="position:absolute; inset:0; background:rgba(14,59,45,0.4); display:flex; align-items:center; justify-content:space-between; padding:20px;"><button class="btn" style="background:#fff; color:var(--dk); font-weight:700; border-radius:30px; padding:10px 20px; border:none; box-shadow:0 4px 10px rgba(0,0,0,0.2);" onclick="go('#/map')"><i class="fa-solid fa-map"></i> View Map →</button><button class="btn" style="width:40px;height:40px;border-radius:50%;padding:0;display:grid;place-items:center; background:#fff; border:none; box-shadow:0 4px 10px rgba(0,0,0,0.2);" onclick="locate()"><i class="fa-solid fa-location-crosshairs"></i></button></div></div>
      <div class="mobile-only-widget" style="margin-top:20px;"><div class="row sp"><h2>Explore Categories</h2><button class="link" onclick="go('#/explore')">See All →</button></div><div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-top:10px;">${mockCats.map(c=>`<div class="card" style="padding:12px 4px; text-align:center; border-radius:12px; border:none; background:#f7f9f5;" onclick="S.cat='${c.n==='Budget'?'Free':c.n}';go('#/explore')"><i class="fa-solid fa-${c.i}" style="color:var(--dk); font-size:20px; margin-bottom:6px;"></i><div style="font-size:10px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--tx);">${c.n}</div></div>`).join('')}</div></div>
      <div class="card mobile-only-widget" style="margin-top:20px; padding:20px; background:linear-gradient(135deg, var(--ac2), #d1ebd9); border:none; border-radius:20px; position:relative; overflow:hidden;"><h3 style="color:var(--dk); margin-bottom:5px;">Contribute to the Community</h3><p class="mu" style="font-size:12px; margin:0 0 15px 0;">Share a hidden gem, help fellow travelers!</p><button class="btn p" style="border-radius:20px;" onclick="go('#/contribute')">Share a Gem <i class="fa-solid fa-camera"></i></button><i class="fa-solid fa-images" style="position:absolute; right:-10px; bottom:-10px; font-size:80px; color:rgba(14,59,45,0.05); transform:rotate(-15deg);"></i></div>
    </div><div><div class="card" style="padding:18px"><h2>Plan Your Next Adventure</h2><p class="mu">Get personalised recommendations based on your interests.</p><button class="btn p" onclick="go('#/map')">Explore Map →</button></div><div class="card" style="padding:18px;margin-top:14px"><div class="row sp"><h2>Quick Filters</h2><button class="link" onclick="clearF()">Clear All</button></div><div class="row">${[['Free','circle-dot','Free'],['safe','shield-halved','Safe'],['Dog-Friendly','paw','Dog-Friendly'],['Hiking','person-hiking','Hiking']].map(f=>`<button class="chip q" onclick="qf('${f[0]}')"><i class="fa-solid fa-${f[1]}"></i> ${f[2]}</button>`).join('')}</div></div></div></div>`;
}
function qf(f){if(f==='near'){locate(()=>go('#/explore'));return}if(f==='safe')S.safe=!S.safe;else S.tags=S.tags.includes(f)?S.tags.filter(x=>x!==f):[...S.tags,f];go('#/explore')}
const locSel=()=>{const G=S.gems,o=(k,all,l)=>`<select onchange="S.${k}=this.value;${k==='co'?"S.st='';S.di='';":k==='st'?"S.di='';":''}render()"><option value="">${all}</option>${l.map(x=>`<option ${S[k]===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`;return o('co','All countries',uniq(G.map(g=>g.country)))+(S.co?o('st','All states',uniq(G.filter(g=>g.country===S.co).map(g=>g.state))):'')+(S.st?o('di','All districts',uniq(G.filter(g=>g.state===S.st).map(g=>g.district))):'')};
const grid=()=>{const r=list(),el=$('#grid');if(el)el.innerHTML=r.length?r.map(card).join(''):empty('No gems match','Try clearing filters or add the first one.','<button class="btn p" onclick="go(\'#/contribute\')">Add a gem</button>')};
function explore(){after=grid;return `<h1>Explore</h1><p class="mu">Search, filter by tag, or browse by country, state and district.</p><div class="bar"><input placeholder="Search places, tags..." value="${esc(S.q)}" oninput="S.q=this.value;grid()">${locSel()}<select onchange="S.cat=this.value;render()"><option value="">All categories</option>${CATS.map(c=>`<option ${S.cat===c?'selected':''}>${c}</option>`).join('')}</select><button class="btn ${S.near?'on':''}" onclick="togNear()"><i class="fa-solid fa-location-dot"></i> Near me${S.near?': on':''}</button>${S.near?`<select onchange="S.radius=+this.value;render()">${[5,10,25,50,100].map(r=>`<option value="${r}" ${S.radius===r?'selected':''}>${r} km</option>`).join('')}</select>`:''}<button class="link" onclick="clearF()">Clear All</button></div><div class="row" style="margin-bottom:14px"><button class="chip q ${S.safe?'on':''}" onclick="S.safe=!S.safe;render()">Safe</button><button class="chip q ${S.verified?'on':''}" onclick="S.verified=!S.verified;render()">Verified</button>${TAGS.map(t=>`<button class="chip q ${S.tags.includes(t)?'on':''}" onclick="S.tags=S.tags.includes('${t}')?S.tags.filter(x=>x!=='${t}'):[...S.tags,'${t}'];render()">${t}</button>`).join('')}</div><div class="grid" id="grid"></div>`}

let gmap = null;
async function searchMapLocation(query, inputEl) { if (!query) return; toast('Searching...'); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`); const data = await res.json(); if (data && data.length > 0) { const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon); if (gmap) { gmap.flyTo({ center: [lon, lat], zoom: 14 }); if (window.searchMarker) window.searchMarker.remove(); window.searchMarker = new maplibregl.Marker({ color: '#e0334c' }).setLngLat([lon, lat]).setPopup(new maplibregl.Popup().setText(data[0].display_name)).addTo(gmap); window.searchMarker.togglePopup(); } toast('Location found!'); if (inputEl) inputEl.value = ''; } else { toast('Location not found'); } } catch (e) { console.error(e); toast('Error searching map'); } }
async function drawMap(el, items) { if (gmap) { gmap.remove(); gmap = null; } if (!el) return; const center = S.near ? [S.near.lng, S.near.lat] : (items[0] ? [items[0].lng, items[0].lat] : [76.5, 10.5]); const validItems = items.filter(g => !isNaN(g.lat) && !isNaN(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180); gmap = new maplibregl.Map({ container: el, style: 'https://tiles.openfreemap.org/styles/liberty', center: center, zoom: S.near ? 11 : 7, attributionControl: false }); gmap.on('error', (e) => console.error('MapLibre Error:', e.error)); gmap.addControl(new maplibregl.NavigationControl(), 'bottom-right'); gmap.on('load', () => { gmap.resize(); const bounds = new maplibregl.LngLatBounds(); validItems.forEach(g => { const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`<div style="width:210px;cursor:pointer;font-family:Inter,sans-serif" onclick="go('#/gem/${g.id}')"><img src="${esc(g.photo || FB(g.title))}" onerror="this.onerror=null;this.src=FB('${esc(g.title).replace(/'/g,'')}')" style="width:100%;height:90px;object-fit:cover;border-radius:8px"><b style="display:block;margin-top:6px">${esc(g.title)}</b><span style="color:#6a7a71;font-size:12px">★ ${g.rating || 'New'} · ${esc(g.district)}</span></div>`); const markerEl = document.createElement('div'); markerEl.style.cssText = `width:18px;height:18px;border-radius:50%;background-color:${PIN[g.cat] || '#2e9e5b'};border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);cursor:pointer`; new maplibregl.Marker({ element: markerEl }).setLngLat([g.lng, g.lat]).setPopup(popup).addTo(gmap); bounds.extend([g.lng, g.lat]); }); if (S.near) { new maplibregl.Marker({ color: '#2563eb' }).setLngLat([S.near.lng, S.near.lat]).setPopup(new maplibregl.Popup().setText('You are here')).addTo(gmap); bounds.extend([S.near.lng, S.near.lat]); } if (validItems.length > 1 || (validItems.length === 1 && !S.near)) gmap.fitBounds(bounds, { padding: 60, maxZoom: 14 }); }); }
function mapView() { const r = list(); after = () => drawMap($('#gmap'), r); return `<div class="mapwrap"><div id="gmap"></div><div class="ovl card fpanel"><div class="row sp"><b>Filters</b><button class="link" onclick="clearF()">Clear All</button></div><label><input type="checkbox" ${S.verified?'checked':''} onchange="S.verified=this.checked"> Verified Only</label>${['Free','Dog-Friendly','Requires Hiking','Cash Only'].map(t=>`<label><input type="checkbox" ${S.tags.includes(t)?'checked':''} onchange="S.tags=this.checked?[...S.tags,'${t}']:S.tags.filter(x=>x!=='${t}')"> ${t}</label>`).join('')}<b style="display:block;margin-top:14px">Categories</b>${CATS.map(c=>`<label><input type="radio" name="cat" ${S.cat===c?'checked':''} onchange="S.cat='${c}'"> <i class="fa-solid fa-location-dot" style="color:${PIN[c]}"></i> ${c}</label>`).join('')}<button class="btn p wide" onclick="render()">Apply Filters</button></div><div class="ovl card msearch"><i class="fa-solid fa-magnifying-glass mu"></i><input id="mapSearchInput" placeholder="Search location..." onkeydown="if(event.key==='Enter'){searchMapLocation(this.value, this);}"><button class="btn p search-btn" onclick="searchMapLocation(document.getElementById('mapSearchInput').value, document.getElementById('mapSearchInput'))">Search</button></div><div class="mobile-map-controls"><div class="map-zoom"><button onclick="if(gmap) gmap.zoomIn()"><i class="fa-solid fa-plus"></i></button><div class="divider"></div><button onclick="if(gmap) gmap.zoomOut()"><i class="fa-solid fa-minus"></i></button></div><button class="map-btn loc-btn" onclick="locate()"><i class="fa-solid fa-location-crosshairs"></i></button><button class="map-btn layer-btn" onclick="if(gmap) gmap.setStyle(gmap.getStyle().name==='Liberty'?'https://tiles.openfreemap.org/styles/bright':'https://tiles.openfreemap.org/styles/liberty')"><i class="fa-solid fa-layer-group"></i></button></div></div>`}

function leaderboard(){
  after = async () => {
    try {
      S.leaderboard = await api('/leaderboard');
      const el = $('#lbList');
      if (el) {
        el.innerHTML = S.leaderboard.map((u, i) => {
          const initial = u.name ? u.name[0] : '?';
          return `
            <div class="card" style="padding:16px; display:flex; align-items:center; gap:16px; margin-bottom:10px;">
              <div style="font-size:20px; font-weight:800; color:${i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : i === 2 ? '#d35400' : 'var(--mu)'}; width:30px; text-align:center;">#${i + 1}</div>
              <span class="av" style="width:46px;height:46px;font-size:20px;">${esc(initial)}</span>
              <div style="flex:1;">
                <h3 style="margin:0; font-size:16px;">${esc(u.name || 'Anonymous Explorer')}</h3>
                <div class="mu" style="font-size:12px;">${u.count} hidden gems added</div>
              </div>
              ${i < 3 ? `<i class="fa-solid fa-medal" style="font-size:24px; color:${i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : '#d35400'};"></i>` : ''}
            </div>
          `;
        }).join('');
      }
    } catch(e) { 
      console.error("Leaderboard render error:", e);
      toast(e.message || 'Could not load leaderboard'); 
    }
  };
  return `<div style="padding:15px; max-width:800px; margin:0 auto;">
    <h1 style="text-align:center; margin-bottom:20px;"><i class="fa-solid fa-trophy" style="color:#f39c12;"></i> Top Explorers</h1>
    <p class="mu" style="text-align:center; margin-bottom:30px;">The most active members of the HiddenGems community.</p>
    <div id="lbList"><div class="sk" style="height:80px; margin-bottom:10px;"></div><div class="sk" style="height:80px; margin-bottom:10px;"></div><div class="sk" style="height:80px;"></div></div>
  </div>`;
}

function detail(id){
  const g=S.gems.find(x=>x.id===id);if(!g)return empty('Gem not found','It may have been deleted.','<button class="btn p" onclick="go(\'#/explore\')">Back to Explore</button>');
  const u=S.user,mine=g.authorId===u.id,cur=g.cur||'USD',fav=u.favs.includes(g.id),trip=u.trips.includes(g.id),up=g.ups.includes(u.id),vf=g.verifs.some(v=>v.u===u.id);
  
  after=()=>{ 
    conv(); fuel(); autoFetchFuelDistance(g); 
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.lat}&longitude=${g.lng}&current_weather=true`)
      .then(r=>r.json()).then(d=>{
        if(d.current_weather){
          const w = wCode(d.current_weather.weathercode);
          const el = $('#weatherWidget');
          if(el) el.innerHTML = `<i class="fa-solid ${w.i}" style="font-size:24px; color:var(--dk);"></i><div><b style="font-size:16px;">${d.current_weather.temperature}°C</b><div class="mu" style="font-size:11px;">${w.t}</div></div>`;
        }
      }).catch(()=>{
        const el = $('#weatherWidget');
        if(el) el.innerHTML = '<div class="mu" style="text-align:center; width:100%; font-size:12px;">Weather unavailable.</div>';
      });
  };

  return `<a class="back" href="javascript:history.back()" style="margin:15px; display:inline-block;"><i class="fa-solid fa-arrow-left"></i> Back</a>
  <div class="d3"><div class="dph">${img(g)}</div>
  <div>
   <div class="row sp">
     <h1 style="margin:0;">${esc(g.title)} ${g.verifs.length>=3?'<span class="vb">Verified ✓</span>':''}</h1>
     <button class="btn" onclick="shareGem('${g.id}')" style="border-radius:50%; width:40px; height:40px; padding:0; flex-shrink:0;"><i class="fa-solid fa-share-nodes"></i></button>
   </div>
   <div class="mu"><i class="fa-solid fa-star" style="color:#f5a623"></i> <b>${g.rating||'New'}</b> (${g.reviews} ratings)</div><div class="stars">${[1,2,3,4,5].map(n=>`<i class="fa-${(g.ratings||{})[u.id]>=n?'solid':'regular'} fa-star" onclick="rate('${g.id}',${n})"></i>`).join('')} <span class="mu">${(g.ratings||{})[u.id]?'Your rating':'Tap to rate'}</span></div>
   <div class="mu" style="margin:6px 0"><i class="fa-solid fa-location-dot"></i> ${esc(g.district)}, ${esc(g.state)} <span id="real-road-dist"></span></div>
   <p>${esc(g.desc)}</p><div class="row">${g.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>
   <div class="row" style="margin-top:16px"><button class="btn ${fav?'on':''}" onclick="tog('favs','${g.id}')"><i class="fa-solid fa-heart"></i> ${fav?'Saved':'Save'}</button><button class="btn p" onclick="tog('trips','${g.id}')">${trip?'✓ In Trip':'Add to Trip'}</button><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}"><i class="fa-solid fa-route"></i> Directions</a></div>
   <div class="row" style="margin-top:10px"><button class="btn ${up?'on':''}" onclick="vote('upvote','${g.id}')">▲ ${g.ups.length}</button><button class="btn ${vf?'on':''}" onclick="vote('verify','${g.id}')">✓ Still open (${g.verifs.length})</button>${mine?`<button class="btn" onclick="go('#/contribute/${g.id}')">Edit</button><button class="btn d" onclick="del('${g.id}')">Delete</button>`:''}</div>
  </div>
  <div>
    <div class="card" style="padding:16px; margin-bottom:14px; display:flex; align-items:center; gap:16px;" id="weatherWidget">
      <div class="sk" style="width:40px; height:40px; border-radius:50%;"></div><div class="sk" style="width:60px; height:20px;"></div>
    </div>

    <div class="card" style="padding:16px"><h2>Cost Breakdown</h2>${g.costs.map(c=>`<div class="cost"><span>${esc(c.l)}</span><span>${mny(cur,c.a)}</span></div>`).join('')||'<div class="mu">No costs listed.</div>'}<div class="cost t"><span>Total</span><span>${mny(cur,total(g))}</span></div>
    <div class="row" style="margin-top:10px"><input id="cvA" type="number" min="0" step="any" value="${total(g)}" oninput="conv()" style="width:90px"><b>${cur}</b><span>→</span><select id="cvT" onchange="conv()" style="width:auto">${Object.keys(RATE).map(c=>`<option ${c==='USD'?'selected':''}>${c}</option>`).join('')}</select><b id="cvR"></b></div></div>
    <div class="card saf" style="padding:16px;margin-top:14px"><h2><i class="fa-solid fa-shield-halved" style="color:var(--ac)"></i> Safety Guide</h2><ul style="padding:0;margin:0">${g.safety.notes.map(n=>`<li><i class="fa-solid fa-circle-check"></i>${esc(n)}</li>`).join('')}</ul></div>
  </div></div>
  
  <div class="d3" style="margin-top:18px;">
    <div class="card" style="padding:16px"><h2>How to get there</h2><ol style="padding-left:16px;">${g.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>
    <div class="card" style="padding:16px" oninput="fuel()" onchange="fuel(event)"><h2>⛽ Fuel cost calculator</h2><div class="two"><div><label>Distance (km)</label><input id="fcD" type="number" min="0" placeholder="Fetching..."></div><div><label>Vehicle</label><select id="fcV"><option value="40">Bike</option><option value="15" selected>Car</option></select></div><div><label>Mileage (km/l)</label><input id="fcM" type="number" min="1" value="15"></div><div><label>Fuel price (${cur})</label><input id="fcP" type="number" min="0" step="any" value="${FUEL[cur]||1}"></div><div><label>People</label><input id="fcN" type="number" min="1" value="1"></div><div><label><input type="checkbox" id="fcR" checked style="width:auto"> Round trip</label></div></div><div id="fcO" class="chip" style="display:block;margin-top:12px;border-radius:10px;padding:10px;font-size:13px;"></div></div>
    
    <div class="card" style="padding:16px; margin-top:14px;">
      <h2>Reviews</h2>
      <form onsubmit="submitReview(event, '${g.id}')" style="margin-bottom:16px;">
        <input name="reviewText" placeholder="Write a review..." required style="margin-bottom:8px;">
        <button class="btn p" style="width:100%;">Post Review</button>
      </form>
      <div id="reviewList">
        ${(g.textReviews||[]).length ? g.textReviews.map(r=>`
          <div style="padding:10px 0; border-bottom:1px dashed var(--bd);">
            <div style="font-weight:600; font-size:13px;">${esc(r.n)} <span class="mu" style="font-weight:400; font-size:11px;">· ${r.d}</span></div>
            <div style="font-size:13px; margin-top:4px;">${esc(r.t)}</div>
          </div>
        `).join('') : '<div class="mu" style="text-align:center; padding:10px;">No reviews yet. Be the first!</div>'}
      </div>
    </div>
  </div>`
}
const cur_=()=>S.gems.find(x=>x.id===location.hash.split('/')[2]);
function conv(){const a=$('#cvA'),g=cur_();if(!a||!g)return;const t=$('#cvT').value;$('#cvR').textContent=mny(t,(+a.value||0)/RATE[g.cur||'USD']*RATE[t])}
function fuel(e){const d=$('#fcD'),g=cur_();if(!d||!g)return;if(e&&e.target.id==='fcV')$('#fcM').value=e.target.value;const c=g.cur||'USD',n=Math.max(1,+$('#fcN').value||1),L=(+d.value||0)*($('#fcR').checked?2:1)/Math.max(1,+$('#fcM').value||1),cost=L*(+$('#fcP').value||0);$('#fcO').innerHTML=`${L.toFixed(1)} L · <b>${mny(c,cost)}</b><br>Total + entry: <b>${mny(c,cost/n+total(g))}</b>/person`}
async function autoFetchFuelDistance(g) { const input = $('#fcD'), distLabel = $('#real-road-dist'); if (!input) return; const getOrigin = () => new Promise((resolve) => { if (S.near) return resolve(S.near); if (!navigator.geolocation) return resolve(null); navigator.geolocation.getCurrentPosition(p => { S.near = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(S.near); }, () => resolve(null), { timeout: 5000 }); }); const origin = await getOrigin(); if (!origin) { input.placeholder = "Location blocked."; return; } try { const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${g.lng},${g.lat}?overview=false`); const data = await res.json(); if (data.routes && data.routes.length > 0) { const km = Math.round(data.routes[0].distance / 1000); if ($('#fcD') === input) { input.value = km; input.placeholder = ""; fuel(); } if ($('#real-road-dist') === distLabel) { distLabel.textContent = `· ${km} km away`; } } } catch (e) { input.placeholder = "Error"; } }

function form(id){
  const g=S.gems.find(x=>x.id===id)||{}; S.ftags=[...(g.tags||[])]; after=()=>pickMap();
  return `<a class="back" href="javascript:history.back()"><i class="fa-solid fa-arrow-left"></i> Back</a><form onsubmit="saveGem(event,'${g.id||''}')" style="padding:15px; max-width:800px; margin:0 auto;"><div class="row sp" style="margin-bottom:20px;"><div><h1>${g.id?'Edit Gem':'Add New Gem'}</h1><div class="mu">Share a hidden gem with the community</div></div><button class="btn p" id="sv" type="submit">${g.id?'Save':'Publish'}</button></div>
  <div class="two"><div><label class="drop" id="dz"><i class="fa-solid fa-cloud-arrow-up" style="font-size:30px"></i><br><b>Upload Photos</b><input type="file" name="photo" accept="image/*" hidden onchange="prev(this)">${g.photo?`<img id="pv" src="${esc(g.photo)}" onerror="this.remove()">`:''}</label>
   <label>Spot Name *</label><input name="title" required placeholder="Spot name..." value="${esc(g.title)}"><label>Location *</label><input name="place" required placeholder="Location..." value="${esc(g.place)}">
   <div class="two"><div><label>Country *</label><input name="country" required placeholder="India" value="${esc(g.country)}"></div><div><label>State *</label><input name="state" required placeholder="Kerala" value="${esc(g.state)}"></div></div><label>District *</label><input name="district" required placeholder="Kollam" value="${esc(g.district)}">
   <label>Category</label><select name="cat">${CATS.map(c=>`<option ${g.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
  <div><label>Tags</label><div class="row" id="ft">${TAGS.map(t=>`<button type="button" class="chip q ${S.ftags.includes(t)?'on':''}" onclick="ftag(this,'${t}')">${t}</button>`).join('')}</div>
   <label>Description *</label><textarea name="desc" rows="3" required>${esc(g.desc)}</textarea>
   <label>Pin the spot (Search or use GPS)</label><div class="map-controls"><input type="text" id="formMapSearch" placeholder="Type location here..."><button type="button" class="btn" style="background:var(--dk); color:#fff; padding:0 12px;" onclick="searchFormLocation(document.getElementById('formMapSearch').value)"><i class="fa-solid fa-search"></i></button><button type="button" class="btn" style="padding:0 12px;" onclick="locateForForm()"><i class="fa-solid fa-location-crosshairs"></i></button></div>
   <div id="pm" style="height:200px;border-radius:12px;background:#e3ede6; margin-bottom:8px;"></div>
   <div class="two"><input name="lat" type="number" step="any" required placeholder="Lat" value="${g.lat??''}"><input name="lng" type="number" step="any" required placeholder="Lng" value="${g.lng??''}"></div>
   <label>Costs (Label: amount)</label><textarea name="costs" rows="2" placeholder="Entry Fee: 50">${esc((g.costs||[]).map(c=>c.l+': '+c.a).join('\n'))}</textarea>
   <div class="two"><div><label>Safety level</label><select name="lvl">${['low','moderate','high'].map(l=>`<option ${g.safety?.lvl===l?'selected':''}>${l}</option>`).join('')}</select></div></div><label>Safety notes</label><textarea name="sn" rows="2">${esc((g.safety?.notes||[]).join('\n'))}</textarea>
   <label>Steps</label><textarea name="steps" rows="3" placeholder="Add steps if necessary">${esc((g.steps||[]).join('\n'))}</textarea></div></div></form>`
}
const prev=i=>{const f=i.files[0];if(!f)return;let p=$('#pv');if(!p){p=document.createElement('img');p.id='pv';$('#dz').appendChild(p)}p.src=URL.createObjectURL(f)};
const ftag=(b,t)=>{S.ftags=S.ftags.includes(t)?S.ftags.filter(x=>x!==t):[...S.ftags,t];b.classList.toggle('on')};
let formMapMarker = null;
async function pickMap() { const el = $('#pm'); if (!el) return; if (window.pmMap) { window.pmMap.remove(); window.pmMap = null; } const f = el.closest('form'), la = +f.lat.value, ln = +f.lng.value, has = f.lat.value && f.lng.value && !isNaN(la) && !isNaN(ln); window.pmMap = new maplibregl.Map({container: el,style: 'https://tiles.openfreemap.org/styles/liberty',center: has ? [ln, la] : (S.near ? [S.near.lng, S.near.lat] : [76.5, 10.5]),zoom: has ? 11 : 6}); window.pmMap.addControl(new maplibregl.NavigationControl(), 'top-right'); window.pmMap.on('load', () => window.pmMap.resize()); if (has) { formMapMarker = new maplibregl.Marker({ draggable: true }).setLngLat([ln, la]).addTo(window.pmMap); formMapMarker.on('dragend', () => { const p = formMapMarker.getLngLat(); f.lat.value = p.lat.toFixed(5); f.lng.value = p.lng.toFixed(5); }); } window.pmMap.on('click', (e) => { const p = e.lngLat; f.lat.value = p.lat.toFixed(5); f.lng.value = p.lng.toFixed(5); if (formMapMarker) { formMapMarker.setLngLat(p); } else { formMapMarker = new maplibregl.Marker({ draggable: true }).setLngLat(p).addTo(window.pmMap); formMapMarker.on('dragend', () => { const p2 = formMapMarker.getLngLat(); f.lat.value = p2.lat.toFixed(5); f.lng.value = p2.lng.toFixed(5); }); } }); }
async function searchFormLocation(query) { if (!query || !window.pmMap) return; toast('Searching...'); try { const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`); const data = await res.json(); if (data && data.length > 0) { const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon); window.pmMap.flyTo({ center: [lon, lat], zoom: 14 }); const f = $('#pm').closest('form'); f.lat.value = lat.toFixed(5); f.lng.value = lon.toFixed(5); if (formMapMarker) { formMapMarker.setLngLat([lon, lat]); } else { formMapMarker = new maplibregl.Marker({ draggable: true }).setLngLat([lon, lat]).addTo(window.pmMap); } toast('Location found!'); } else { toast('Location not found'); } } catch (e) { toast('Search error'); } }
function locateForForm() { const f = $('#pm') ? $('#pm').closest('form') : null; if (!f) return; if (!navigator.geolocation) return toast('Geolocation not supported'); toast('Getting location...'); navigator.geolocation.getCurrentPosition(p => { const lat = p.coords.latitude, lng = p.coords.longitude; f.lat.value = lat.toFixed(5); f.lng.value = lng.toFixed(5); if (window.pmMap) { window.pmMap.flyTo({ center: [lng, lat], zoom: 15 }); if (formMapMarker) { formMapMarker.setLngLat([lng, lat]); } else { formMapMarker = new maplibregl.Marker({ draggable: true }).setLngLat([lng, lat]).addTo(window.pmMap); } } toast('Location pinned!'); }, () => toast('Location blocked. Check browser settings.')); }
async function saveGem(e,id){e.preventDefault();const f=e.target,fd=new FormData(),b=$('#sv');['title','place','country','state','district','lat','lng','cat','desc'].forEach(k=>fd.append(k,f[k].value)); fd.append('cur',CC[f.country.value.trim()]||'USD');fd.append('tags',JSON.stringify(S.ftags));fd.append('steps',JSON.stringify(lines(f.steps.value)));fd.append('safety',JSON.stringify({lvl:f.lvl.value,notes:lines(f.sn.value)})); fd.append('costs',JSON.stringify(lines(f.costs.value).map(l=>{const p=l.split(':');return{l:p[0].trim(),a:parseFloat(p[1])||0}})));if(f.photo.files[0])fd.append('photo',f.photo.files[0]); b.disabled=true;try{const g=await api(id?'/gems/'+id:'/gems',{method:id?'PUT':'POST',body:fd});S.gems=id?S.gems.map(x=>x.id===id?g:x):[g,...S.gems];toast(id?'Gem updated':'Gem published!');refresh();go('#/gem/'+g.id)}catch(err){toast(err.message);b.disabled=false}}

const mine=ids=>ids.map(i=>S.gems.find(g=>g.id===i)).filter(Boolean);
const trips=()=>{const r=mine(S.user.trips);return `<div style="padding:15px;"><div class="row sp" style="margin-bottom:20px;"><div><h1>My Trips</h1></div><button class="btn p" onclick="go('#/explore')">Plan</button></div>`+(r.length?`<div class="grid">${r.map(card).join('')}</div>`:empty('No trips yet','Tap Add to Trip.','<button class="btn p" onclick="go(\'#/explore\')">Explore</button>'))+`</div>`};
const favs=()=>{const r=mine(S.user.favs);return `<div style="padding:15px;"><h1>Saved Gems</h1>`+(r.length?`<div class="grid">${r.map(card).join('')}</div>`:empty('Nothing saved','Tap the heart on any gem.','<button class="btn p" onclick="go(\'#/explore\')">Explore</button>'))+`</div>`};
function profile(){const u=S.user,own=S.gems.filter(g=>g.authorId===u.id),ups=own.reduce((a,g)=>a+g.ups.length,0),A=[['Top Explorer','10 trips',u.trips.length,10,'medal'],['Helper','50 upvotes',ups,50,'hands-holding-heart'],['Nature','25 spots',own.filter(g=>g.cat==='Nature').length,25,'leaf']]; return `<div style="padding:15px;"><div class="row sp"><div><h1>Dashboard</h1></div><button class="btn p" onclick="go('#/explore')">+ Plan</button></div><div class="cols" style="margin-top:12px"><div><div class="card" style="padding:18px;display:flex;gap:16px;align-items:center;margin-bottom:14px"><span class="av" style="width:64px;height:64px;font-size:26px">${esc(u.name[0])}</span><div><h2 style="margin:0">${esc(u.name)}</h2><div class="mu">${own.length} contributions</div></div></div><div class="stat2"><div class="card"><i class="fa-solid fa-suitcase-rolling"></i><b>${u.trips.length}</b><span class="mu">Trips</span></div><div class="card"><i class="fa-solid fa-camera"></i><b>${own.filter(g=>g.photo).length}</b><span class="mu">Photos</span></div><div class="card"><i class="fa-solid fa-star"></i><b>${ups}</b><span class="mu">Upvotes</span></div></div><h2 style="margin-top:20px">My Activity</h2>${own.length?`<div class="grid">${own.slice(0,4).map(card).join('')}</div>`:empty('No contributions','Share a hidden gem.','<button class="btn p" onclick="go(\'#/contribute\')">Contribute</button>')}</div><div class="card" style="padding:18px"><h2>Achievements</h2>${A.map(a=>`<div style="margin:14px 0"><div class="row"><i class="fa-solid fa-${a[4]}" style="color:var(--ac)"></i><b>${a[0]}</b></div><div class="mu">${Math.min(a[2],a[3])}/${a[3]}</div><div style="height:6px;background:var(--bd);border-radius:9px;margin-top:6px"><div style="height:6px;width:${Math.min(100,a[2]/a[3]*100)}%;background:var(--ac);border-radius:9px"></div></div></div>`).join('')}</div></div></div>`}
const settings=()=>`<div style="padding:15px;"><h1>Settings</h1><form class="card" style="padding:18px;max-width:460px" onsubmit="saveName(event)"><label>Display name</label><input name="name" value="${esc(S.user.name)}" required><label>Email</label><input value="${esc(S.user.email)}" disabled><div class="row" style="margin-top:16px"><button class="btn p">Save</button><button type="button" class="btn d" onclick="logout()">Sign out</button></div></form></div>`;
async function saveName(e){e.preventDefault();const old=S.user.name,n=e.target.name.value;S.user.name=n;render();try{await api('/me',{method:'PUT',body:{name:n}});toast('Saved')}catch(err){S.user.name=old;render();toast(err.message)}}

function render(){
  if (S.loading) { $('#app').innerHTML = '<div class="boot"><div class="sk" style="width:300px;height:400px;margin:10vh auto;"></div></div>'; return; }
  if(!S.user) return authView();
  const [r='home',a]=location.hash.slice(2).split('/');
  const V={home,explore,map:mapView,trips,favs,leaderboard,contribute:()=>form(a),profile,settings,gem:()=>detail(a)};
  after=null;
  const body=(V[r]||home)();
  shell(V[r]?r:'home',body);
  if(after)after();
}
addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});

// --- BOOT LOGIC VIA FIREBASE AUTH STATE ---
auth.onAuthStateChanged(async (user) => {
  S.loading = true; render();
  if (user) {
    try {
      const res = await api('/me');
      S.user = res.user;
      S.gems = await api('/gems');
      S.stats = await api('/stats');
      await loadNotifs();
    } catch (err) {
      toast(err.message || 'Could not connect to server');
      await auth.signOut();
    }
  } else {
    S.user = null; S.gems = []; S.stats = null; S.notifications = [];
  }
  S.loading = false; render();
});