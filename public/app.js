/* HiddenGems front end – plain JavaScript, no build step */
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// ---- Currency (approximate fixed rates per 1 USD; swap for a live API later) ----
const RATE={USD:1,INR:88,EUR:.92,GBP:.78,DKK:6.9,TRY:42,MXN:18.5,JPY:150,AUD:1.5,AED:3.67};
const SYM={USD:'$',INR:'₹',EUR:'€',GBP:'£',DKK:'kr ',TRY:'₺',MXN:'MX$',JPY:'¥',AUD:'A$',AED:'AED '};
const FUEL={USD:.95,INR:105,EUR:1.85,GBP:1.45,DKK:14,TRY:48,MXN:24,JPY:175,AUD:2,AED:2.7}; // petrol price per litre
const CC={India:'INR',Italy:'EUR',France:'EUR',Germany:'EUR',Spain:'EUR',Mexico:'MXN','Türkiye':'TRY',Turkey:'TRY','Faroe Islands':'DKK','United Kingdom':'GBP',UK:'GBP',Japan:'JPY',Australia:'AUD','United States':'USD',USA:'USD',UAE:'AED'};
const CATS=['Nature','Viewpoint','Historical','Adventure','Others'],TAGS=['Free','Family Friendly','Hiking','Scenic','Hidden','Dog-Friendly','Cash Only','Requires Hiking'];
const PIN={Nature:'#2e9e5b',Viewpoint:'#f39c12',Historical:'#8e44ad',Adventure:'#e0334c',Others:'#2b7fd6'};
const NAV=[['home','house','Home'],['explore','compass','Explore'],['map','map','Map'],['trips','suitcase-rolling','My Trips'],['favs','heart','Favorites'],['contribute','upload','Contribute'],['profile','user','Profile'],['settings','gear','Settings']];
const mny=(c,v)=>(SYM[c]||c+' ')+v.toLocaleString(c==='INR'?'en-IN':'en-US',{maximumFractionDigits:c==='JPY'||v>=100?0:2});
const total=g=>g.costs.reduce((a,c)=>a+c.a,0),lines=t=>t.split('\n').map(s=>s.trim()).filter(Boolean),uniq=a=>[...new Set(a.filter(Boolean))].sort();
const km=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 12742*Math.asin(Math.sqrt(h))};
const S={user:null,token:localStorage.getItem('tok'),gems:[],loading:true,q:'',tags:[],cat:'',co:'',st:'',di:'',verified:false,safe:false,near:null,radius:25,reg:false,ftags:[]};
let after=null;
const dd=g=>S.near?km(S.near.lat,S.near.lng,g.lat,g.lng):null;
const go=h=>{location.hash===h?render():location.hash=h};
const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2800)};
const api=async(p,o={})=>{const fd=o.body instanceof FormData,h={...(fd?{}:{'Content-Type':'application/json'}),...(S.token?{Authorization:'Bearer '+S.token}:{})};
  const r=await fetch('/api'+p,{...o,headers:h,body:o.body&&!fd?JSON.stringify(o.body):o.body}),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j};
const FB=t=>{const c=[['#2fa37c','#0b4f3c'],['#6b8fb3','#27415c'],['#e0833a','#7a2e1b'],['#5aa88a','#1f4d3f']][[...(t||'x')].reduce((a,x)=>a+x.charCodeAt(0),0)%4];
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c[0]}'/><stop offset='1' stop-color='${c[1]}'/></linearGradient></defs><rect width='400' height='240' fill='url(#g)'/><path d='M0 200L110 110L190 170L270 80L400 190V240H0Z' fill='rgba(0,0,0,.25)'/></svg>`)};
const img=g=>`<img src="${esc(g.photo||FB(g.title))}" alt="${esc(g.title)}" onerror="this.onerror=null;this.src=FB(this.alt)">`;
// ---- Filtering ----
function list(){
  let r=S.gems.filter(g=>(!S.q||(g.title+g.place+g.state+g.country+g.district+g.tags.join(' ')).toLowerCase().includes(S.q.toLowerCase()))&&(!S.cat||g.cat===S.cat)&&(!S.co||g.country===S.co)&&(!S.st||g.state===S.st)&&(!S.di||g.district===S.di)&&S.tags.every(t=>g.tags.includes(t))&&(!S.verified||g.verifs.length>=3)&&(!S.safe||g.safety.lvl==='low'));
  
  if(S.near) r = r.filter(g=>dd(g)<=S.radius).sort((a,b)=>dd(a)-dd(b));
  else r.sort((a,b)=>b.ups.length-a.ups.length);
  return r;
}
const clearF=()=>{Object.assign(S,{q:'',tags:[],cat:'',co:'',st:'',di:'',verified:false,safe:false,near:null});render()};
function locate(cb){if(!navigator.geolocation)return toast('Geolocation not supported');navigator.geolocation.getCurrentPosition(p=>{S.near={lat:p.coords.latitude,lng:p.coords.longitude};cb?cb():render()},()=>toast('Location blocked. Allow access to use Near Me.'))}
const togNear=()=>S.near?(S.near=null,render()):locate();
// ---- Optimistic actions ----
async function tog(k,id){const u=S.user,old=[...u[k]];u[k]=u[k].includes(id)?u[k].filter(x=>x!==id):[...u[k],id];render();try{await api(`/me/${k}/${id}`,{method:'POST'})}catch(e){u[k]=old;render();toast(e.message)}}
async function vote(kind,id){const g=S.gems.find(x=>x.id===id),u=S.user,old=JSON.stringify([g.ups,g.verifs]);
  if(kind==='upvote')g.ups=g.ups.includes(u.id)?g.ups.filter(x=>x!==u.id):[...g.ups,u.id];else g.verifs=g.verifs.some(v=>v.u===u.id)?g.verifs.filter(v=>v.u!==u.id):[...g.verifs,{u:u.id,n:u.name,d:new Date().toISOString().slice(0,10)}];
  render();try{await api(`/gems/${id}/${kind}`,{method:'POST'})}catch(e){[g.ups,g.verifs]=JSON.parse(old);render();toast(e.message)}}
async function rate(id,n){const g=S.gems.find(x=>x.id===id),u=S.user,old=JSON.stringify([g.ratings,g.rating,g.reviews]);g.ratings={...(g.ratings||{}),[u.id]:n};const v=Object.values(g.ratings);g.reviews=v.length;g.rating=Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10;render();
  try{await api(`/gems/${id}/rate`,{method:'POST',body:{stars:n}});refresh()}catch(e){[g.ratings,g.rating,g.reviews]=JSON.parse(old);render();toast(e.message)}}
async function del(id){if(!confirm('Delete this gem?'))return;const old=S.gems;S.gems=S.gems.filter(g=>g.id!==id);go('#/explore');try{await api('/gems/'+id,{method:'DELETE'});toast('Gem deleted');refresh()}catch(e){S.gems=old;render();toast(e.message)}}
// ---- Auth ----
function authView(){$('#app').innerHTML=`<form class="auth card" onsubmit="doAuth(event)"><div class="logo logo-d" style="color:#12503a"><img src="/img/my-icon.png" alt="Logo" style="height: 40px; margin-bottom: 5px;"><b>HiddenGems</b><small>— Explore More —</small></div><h2>${S.reg?'Create account':'Welcome back'}</h2>${S.reg?'<label>Name</label><input name="name">':''}<label>Email</label><input name="email" type="email" required value="${S.reg?'':'demo@hiddengems.app'}"><label>Password</label><input name="password" type="password" required minlength="6" value="${S.reg?'':'demo1234'}"><button class="btn p wide">${S.reg?'Sign up':'Sign in'}</button><div style="text-align:center;margin-top:10px"><button type="button" class="link" onclick="S.reg=!S.reg;authView()">${S.reg?'Have an account? Sign in':'New here? Create an account'}</button></div></form>`}
async function doAuth(e){e.preventDefault();const f=e.target,b=f.querySelector('.btn');b.disabled=true;try{const r=await api(S.reg?'/register':'/login',{method:'POST',body:{name:f.name?.value,email:f.email.value,password:f.password.value}});S.token=r.token;S.user=r.user;localStorage.setItem('tok',r.token);go('#/home');render()}catch(err){toast(err.message);b.disabled=false}}
const logout=()=>{localStorage.removeItem('tok');S.token=S.user=null;authView()};
// ---- Layout ----
function shell(r,body){const u=S.user;$('#app').innerHTML=`<div class="app"><aside class="side"><div class="logo"><img src="/img/my-icon.png" alt="Logo" style="height: 40px; margin-bottom: 5px;"><b>HiddenGems</b><small>— Explore More —</small></div>${NAV.map(n=>`<a class="nav ${r===n[0]?'on':''}" href="#/${n[0]}"><i class="fa-solid fa-${n[1]}"></i><span>${n[2]}</span></a>`).join('')}<a class="nav out" onclick="logout()"><i class="fa-solid fa-right-from-bracket"></i><span>Sign Out</span></a></aside><main class="${r==='map'?'nopad':''}"><div class="top"><button class="pill" onclick="togNear()"><i class="fa-solid fa-location-dot"></i> ${S.near?'Near me':'All locations'}</button><button class="pill" onclick="toast('No new notifications')"><i class="fa-solid fa-bell"></i></button><span class="av" onclick="go('#/profile')">${esc(u.name[0])}</span></div>${body}</main></div>`}
const skel=()=>'<div class="grid">'+'<div class="sk"></div>'.repeat(6)+'</div>';
const empty=(t,s,b)=>`<div class="card empty"><i class="fa-solid fa-compass" style="font-size:34px"></i><h2 style="margin-top:8px">${t}</h2>${s}<div style="margin-top:14px">${b||''}</div></div>`;
const card=g=>{const fav=S.user.favs.includes(g.id);return `<div class="gc" onclick="go('#/gem/${g.id}')"><div class="ph">${img(g)}<span class="bdg ${g.verifs.length>=3?'v':''}">${g.verifs.length>=3?'Verified ✓':esc(g.cat)}</span><button class="heart ${fav?'on':''}" onclick="event.stopPropagation();tog('favs','${g.id}')"><i class="fa-solid fa-heart"></i></button></div><div class="gb"><h3>${esc(g.title)}</h3><div class="row sp"><span class="mu"><i class="fa-solid fa-location-dot"></i> ${esc(g.district)}, ${esc(g.state)}</span><span class="mu"><i class="fa-solid fa-star" style="color:#f5a623"></i> ${g.rating||'New'}</span></div></div></div>`};
// ---- Views ----
// ---- Hero slideshow (slides move right to left, loops forever) ----
let hsI=0,hsPause=false;
const hsL=()=>S.gems.filter(g=>g.photo).sort((a,b)=>(b.rating||0)-(a.rating||0)||(b.reviews||0)-(a.reviews||0)||b.ups.length-a.ups.length).slice(0,5); // top-rated first
const hsHTML=()=>{const l=hsL();if(!l.length)return '';if(hsI>l.length)hsI=0;return `<div class="hs"><div class="hs-track" id="hsTrack" style="transform:translateX(-${hsI*100}%)">${[...l,l[0]].map(g=>`<div class="hs-s">${img(g)}<span class="hs-c"><i class="fa-solid fa-star" style="color:#f5a623"></i> ${g.rating||'New'} · ${esc(g.title)} · ${esc(g.district)}</span></div>`).join('')}</div></div>`};
const hsDots=()=>`<div class="hs-dots">${hsL().map((g,i)=>`<span class="hs-d ${i===hsI%hsL().length?'on':''}" onclick="hsGo(${i})"></span>`).join('')}</div>`;
function hsGo(i){const t=$('#hsTrack'),n=hsL().length;if(!t||!n)return;hsI=i;t.style.transition='transform .9s cubic-bezier(.65,0,.35,1)';t.style.transform=`translateX(-${i*100}%)`;
  document.querySelectorAll('.hs-d').forEach((d,k)=>d.classList.toggle('on',k===i%n));
  if(i>=n)setTimeout(()=>{const t2=$('#hsTrack');if(t2){t2.style.transition='none';t2.style.transform='translateX(0)';hsI=0}},950)}
setInterval(()=>{if(!$('#hsTrack')||document.hidden||hsPause||hsL().length<2)return;hsGo(hsI+1)},4000);
// ---- Live stats (numbers come from the server and update by themselves) ----
const shown={};
const stV=()=>{const r=S.gems.filter(g=>g.rating>0);return S.stats||{spots:S.gems.length,explorers:1,photos:S.gems.filter(g=>g.photo).length,rating:r.length?Math.round(r.reduce((a,g)=>a+g.rating,0)/r.length*10)/10:0,ratings:r.reduce((a,g)=>a+g.reviews,0)}};
const statsHTML=()=>{const s=stV();return `<div class="stats">${[['stSpots','leaf',s.spots,'Hidden Spots'],['stExp','users',s.explorers,'Explorers'],['stPh','image',s.photos,'Photos Shared'],['stRt','shield-halved',s.rating,'Community Rating']].map(c=>`<div class="card stat"><i class="fa-solid fa-${c[1]}"></i><div><b id="${c[0]}">${c[0]==='stRt'?(c[2]?c[2].toFixed(1)+'★':'–'):c[2]}</b><span class="mu">${c[3]}${c[0]==='stRt'&&s.ratings?` · ${s.ratings} rating${s.ratings>1?'s':''}`:''}</span></div></div>`).join('')}</div>`};
function paintStats(){const s=stV();[['stSpots',s.spots],['stExp',s.explorers],['stPh',s.photos],['stRt',s.rating]].forEach(([id,v])=>{const el=$('#'+id);if(!el)return;const from=shown[id]??v,t0=performance.now(),f=x=>id==='stRt'?(x?x.toFixed(1)+'★':'–'):Math.round(x);
  (function tick(t){const k=Math.min(1,(t-t0)/700);el.textContent=f(k<1?from+(v-from)*k:v);if(k<1)requestAnimationFrame(tick);else shown[id]=v})(t0)})}
const isHome=()=>['','home'].includes(location.hash.slice(2).split('/')[0]);
async function refresh(full){try{S.stats=await api('/stats');if(full){const g=await api('/gems'),ch=JSON.stringify(g)!==JSON.stringify(S.gems);S.gems=g;if(ch&&isHome()&&!document.activeElement.matches('input,textarea,select'))return render()}paintStats()}catch(e){}}
setInterval(()=>{if(S.user&&!document.hidden)refresh(true)},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.user)refresh(true)});
function home(){after=paintStats;const top=[...S.gems].sort((a,b)=>(b.rating||0)-(a.rating||0)||b.ups.length-a.ups.length).slice(0,4),rated=S.gems.filter(g=>g.rating),avg=rated.length?(rated.reduce((a,g)=>a+g.rating,0)/rated.length).toFixed(1):'–';
  const QF=[['near','location-dot','Near Me'],['Free','circle-dot','Free'],['safe','shield-halved','Safe'],['Dog-Friendly','paw','Dog-Friendly'],['Hiking','person-hiking','Hiking'],['Cash Only','money-bill','Cash Only']];
  return `<div class="hero" onmouseenter="hsPause=true" onmouseleave="hsPause=false">${hsHTML()}<div class="hero-in"><h1>Discover Hidden Gems Around You</h1><p>Real places. Real people. Unforgettable experiences.</p><form class="hq" onsubmit="event.preventDefault();S.q=this.q.value;go('#/explore')"><i class="fa-solid fa-magnifying-glass"></i><input name="q" placeholder="Search for hidden gems..."><button class="btn p">Explore →</button></form></div>${hsDots()}</div>
  ${statsHTML()}
  <div class="cols"><div><div class="row sp"><h2>Popular Hidden Gems</h2><button class="link" onclick="go('#/explore')">View All →</button></div>${top.length?`<div class="g4">${top.map(card).join('')}</div>`:empty('No hidden gems yet','Be the first to share a place.','<button class="btn p" onclick="go(\'#/contribute\')">Add a gem</button>')}</div>
  <div><div class="card" style="padding:18px"><h2>Plan Your Next Adventure</h2><p class="mu">Get personalised recommendations based on your interests.</p><button class="btn p" onclick="go('#/map')">Explore Map →</button></div>
  <div class="card" style="padding:18px;margin-top:14px"><div class="row sp"><h2>Quick Filters</h2><button class="link" onclick="clearF()">Clear All</button></div><div class="row">${QF.map(f=>`<button class="chip q" onclick="qf('${f[0]}')"><i class="fa-solid fa-${f[1]}"></i> ${f[2]}</button>`).join('')}</div></div></div></div>`}
function qf(f){if(f==='near'){locate(()=>go('#/explore'));return}if(f==='safe')S.safe=!S.safe;else S.tags=S.tags.includes(f)?S.tags.filter(x=>x!==f):[...S.tags,f];go('#/explore')}
const locSel=()=>{const G=S.gems,o=(k,all,l)=>`<select onchange="S.${k}=this.value;${k==='co'?"S.st='';S.di='';":k==='st'?"S.di='';":''}render()"><option value="">${all}</option>${l.map(x=>`<option ${S[k]===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`;
  return o('co','All countries',uniq(G.map(g=>g.country)))+(S.co?o('st','All states',uniq(G.filter(g=>g.country===S.co).map(g=>g.state))):'')+(S.st?o('di','All districts',uniq(G.filter(g=>g.state===S.st).map(g=>g.district))):'')};
const grid=()=>{const r=list(),el=$('#grid');if(el)el.innerHTML=r.length?r.map(card).join(''):empty('No gems match','Try clearing filters or add the first one.','<button class="btn p" onclick="go(\'#/contribute\')">Add a gem</button>')};
function explore(){after=grid;return `<h1>Explore</h1><p class="mu">Search, filter by tag, or browse by country, state and district.</p>
  <div class="bar"><input placeholder="Search places, tags..." value="${esc(S.q)}" oninput="S.q=this.value;grid()">${locSel()}<select onchange="S.cat=this.value;render()"><option value="">All categories</option>${CATS.map(c=>`<option ${S.cat===c?'selected':''}>${c}</option>`).join('')}</select><button class="btn ${S.near?'on':''}" onclick="togNear()"><i class="fa-solid fa-location-dot"></i> Near me${S.near?': on':''}</button>${S.near?`<select onchange="S.radius=+this.value;render()">${[5,10,25,50,100].map(r=>`<option value="${r}" ${S.radius===r?'selected':''}>${r} km</option>`).join('')}</select>`:''}<button class="link" onclick="clearF()">Clear All</button></div>
  <div class="row" style="margin-bottom:14px"><button class="chip q ${S.safe?'on':''}" onclick="S.safe=!S.safe;render()">Safe</button><button class="chip q ${S.verified?'on':''}" onclick="S.verified=!S.verified;render()">Verified</button>${TAGS.map(t=>`<button class="chip q ${S.tags.includes(t)?'on':''}" onclick="S.tags=S.tags.includes('${t}')?S.tags.filter(x=>x!=='${t}'):[...S.tags,'${t}'];render()">${t}</button>`).join('')}</div><div class="grid" id="grid"></div>`}

// ---- MapLibre GL JS ----
let gmap = null;

// Search location on Map using Nominatim
async function searchMapLocation(query) {
  if (!query || !gmap) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      gmap.flyTo({ center: [lon, lat], zoom: 13 });
      
      if (window.searchMarker) window.searchMarker.remove();
      window.searchMarker = new maplibregl.Marker({ color: '#e0334c' })
        .setLngLat([lon, lat])
        .setPopup(new maplibregl.Popup().setText(data[0].display_name))
        .addTo(gmap);
      window.searchMarker.togglePopup();
    } else {
      toast('Location not found');
    }
  } catch (e) {
    console.error('Geocoding failed:', e);
  }
}

async function drawMap(el, items) {
  if (gmap) { gmap.remove(); gmap = null; }
  if (!el) return;

  const center = S.near ? [S.near.lng, S.near.lat] : (items[0] ? [items[0].lng, items[0].lat] : [76.5, 10.5]);
  const validItems = items.filter(g => !isNaN(g.lat) && !isNaN(g.lng) && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180);

  gmap = new maplibregl.Map({
    container: el,
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: center,
    zoom: S.near ? 11 : 7
  });

  gmap.on('error', (e) => console.error('MapLibre Error:', e.error));

  gmap.addControl(new maplibregl.NavigationControl(), 'bottom-right');

  gmap.on('load', () => {
    gmap.resize(); 
    const bounds = new maplibregl.LngLatBounds();

    validItems.forEach(g => {
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div style="width:210px;cursor:pointer;font-family:Inter,sans-serif" onclick="go('#/gem/${g.id}')">
          <img src="${esc(g.photo || FB(g.title))}" onerror="this.onerror=null;this.src=FB('${esc(g.title).replace(/'/g,'')}')" style="width:100%;height:90px;object-fit:cover;border-radius:8px">
          <b style="display:block;margin-top:6px">${esc(g.title)}</b>
          <span style="color:#6a7a71;font-size:12px">★ ${g.rating || 'New'} · ${esc(g.district)}</span>
        </div>
      `);

      const markerEl = document.createElement('div');
      markerEl.style.width = '18px';
      markerEl.style.height = '18px';
      markerEl.style.borderRadius = '50%';
      markerEl.style.backgroundColor = PIN[g.cat] || '#2e9e5b';
      markerEl.style.border = '2px solid white';
      markerEl.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      markerEl.style.cursor = 'pointer';

      new maplibregl.Marker({ element: markerEl }).setLngLat([g.lng, g.lat]).setPopup(popup).addTo(gmap);
      bounds.extend([g.lng, g.lat]);
    });

    if (S.near) {
      new maplibregl.Marker({ color: '#2563eb' }).setLngLat([S.near.lng, S.near.lat]).setPopup(new maplibregl.Popup().setText('You are here')).addTo(gmap);
      bounds.extend([S.near.lng, S.near.lat]);
    }

    if (validItems.length > 1 || (validItems.length === 1 && !S.near)) {
      gmap.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }
  });
}

function mapView() {
  const r = list();
  after = () => drawMap($('#gmap'), r);
  return `<div class="mapwrap"><div id="gmap"></div>
  <div class="ovl card fpanel"><div class="row sp"><b>Filters</b><button class="link" onclick="clearF()">Clear All</button></div>
   <label><input type="checkbox" ${S.verified?'checked':''} onchange="S.verified=this.checked"> Verified Only</label>
   ${['Free','Dog-Friendly','Requires Hiking','Cash Only'].map(t=>`<label><input type="checkbox" ${S.tags.includes(t)?'checked':''} onchange="S.tags=this.checked?[...S.tags,'${t}']:S.tags.filter(x=>x!=='${t}')"> ${t}</label>`).join('')}
   <b style="display:block;margin-top:14px">Categories</b>${CATS.map(c=>`<label><input type="radio" name="cat" ${S.cat===c?'checked':''} onchange="S.cat='${c}'"> <i class="fa-solid fa-location-dot" style="color:${PIN[c]}"></i> ${c}</label>`).join('')}
   <button class="btn p wide" onclick="render()">Apply Filters</button></div>
  <div class="ovl card msearch"><i class="fa-solid fa-magnifying-glass mu"></i><input placeholder="Search map..." onkeydown="if(event.key==='Enter'){searchMapLocation(this.value); this.blur();}"><select onchange="S.radius=+this.value;S.near||locate();render()">${[5,10,25,50,100].map(x=>`<option value="${x}" ${S.radius===x?'selected':''}>${x} km</option>`).join('')}</select><span class="av" onclick="go('#/profile')">${esc(S.user.name[0])}</span></div>
  <button class="ovl zb" style="left:14px;bottom:24px" onclick="gmap&&gmap.setStyle(gmap.getStyle().name==='Liberty'?'https://tiles.openfreemap.org/styles/bright':'https://tiles.openfreemap.org/styles/liberty')" title="Layers"><i class="fa-solid fa-layer-group"></i></button>
  <button class="ovl zb" style="right:14px;bottom:110px" onclick="locate()" title="My location"><i class="fa-solid fa-location-crosshairs"></i></button></div>`
}

// ---- Gem detail ----
function detail(id){const g=S.gems.find(x=>x.id===id);if(!g)return empty('Gem not found','It may have been deleted.','<button class="btn p" onclick="go(\'#/explore\')">Back to Explore</button>');
  const u=S.user,mine=g.authorId===u.id,cur=g.cur||'USD',fav=u.favs.includes(g.id),trip=u.trips.includes(g.id),up=g.ups.includes(u.id),vf=g.verifs.some(v=>v.u===u.id);
  
  after=()=>{ conv(); fuel(); autoFetchFuelDistance(g); };
  
  return `<a class="back" href="javascript:history.back()"><i class="fa-solid fa-arrow-left"></i> Back</a>
  <div class="d3"><div class="dph">${img(g)}</div>
  <div><h1>${esc(g.title)} ${g.verifs.length>=3?'<span class="vb">Verified ✓</span>':''}</h1>
   <div class="mu"><i class="fa-solid fa-star" style="color:#f5a623"></i> <b>${g.rating||'New'}</b> (${g.reviews} ratings)</div><div class="stars">${[1,2,3,4,5].map(n=>`<i class="fa-${(g.ratings||{})[u.id]>=n?'solid':'regular'} fa-star" onclick="rate('${g.id}',${n})"></i>`).join('')} <span class="mu">${(g.ratings||{})[u.id]?'Your rating':'Tap a star to rate'}</span></div>
   
   <div class="mu" style="margin:6px 0"><i class="fa-solid fa-location-dot"></i> ${esc(g.district)}, ${esc(g.state)}, ${esc(g.country)} <span id="real-road-dist"></span></div>
   
   <p>${esc(g.desc)}</p><div class="row">${g.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>
   <div class="row" style="margin-top:16px"><button class="btn ${fav?'on':''}" onclick="tog('favs','${g.id}')"><i class="fa-solid fa-heart"></i> ${fav?'Saved':'Save'}</button><button class="btn p" onclick="tog('trips','${g.id}')">${trip?'✓ In Trip':'Add to Trip'}</button><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${g.lat},${g.lng}"><i class="fa-solid fa-route"></i> Directions</a></div>
   <div class="row" style="margin-top:10px"><button class="btn ${up?'on':''}" onclick="vote('upvote','${g.id}')">▲ ${g.ups.length}</button><button class="btn ${vf?'on':''}" onclick="vote('verify','${g.id}')">✓ Still open (${g.verifs.length})</button>${mine?`<button class="btn" onclick="go('#/contribute/${g.id}')">Edit</button><button class="btn d" onclick="del('${g.id}')">Delete</button>`:''}</div></div>
  <div><div class="card" style="padding:16px"><h2>Cost Breakdown</h2>${g.costs.map(c=>`<div class="cost"><span>${esc(c.l)}</span><span>${mny(cur,c.a)}</span></div>`).join('')||'<div class="mu">No costs listed.</div>'}<div class="cost t"><span>Total</span><span>${mny(cur,total(g))}</span></div>
    <div class="row" style="margin-top:10px"><input id="cvA" type="number" min="0" step="any" value="${total(g)}" oninput="conv()" style="width:90px"><b>${cur}</b><span>→</span><select id="cvT" onchange="conv()" style="width:auto">${Object.keys(RATE).map(c=>`<option ${c==='USD'?'selected':''}>${c}</option>`).join('')}</select><b id="cvR"></b></div><div class="mu" style="font-size:11px;margin-top:4px">Approximate rates, for planning only.</div></div>
   <div class="card saf" style="padding:16px;margin-top:14px"><h2><i class="fa-solid fa-shield-halved" style="color:var(--ac)"></i> Safety Guide · ${esc(g.safety.lvl)} risk</h2><ul style="padding:0;margin:0">${g.safety.notes.map(n=>`<li><i class="fa-solid fa-circle-check"></i>${esc(n)}</li>`).join('')}</ul></div></div></div>
  <div class="d3" style="margin-top:18px;grid-template-columns:1fr 1fr"><div class="card" style="padding:16px"><h2>How to get there</h2><ol>${g.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></div>
  <div class="card" style="padding:6px 16px 16px" oninput="fuel()" onchange="fuel(event)"><h2 style="margin-top:12px">⛽ Fuel cost calculator</h2><div class="two"><div><label>Distance (km, one way)</label><input id="fcD" type="number" min="0" placeholder="Fetching..."></div><div><label>Vehicle</label><select id="fcV"><option value="40">Bike (40 km/l)</option><option value="15" selected>Car (15 km/l)</option><option value="10">SUV (10 km/l)</option></select></div><div><label>Mileage (km per litre)</label><input id="fcM" type="number" min="1" value="15"></div><div><label>Fuel price per litre (${cur})</label><input id="fcP" type="number" min="0" step="any" value="${FUEL[cur]||1}"></div><div><label>People sharing</label><input id="fcN" type="number" min="1" value="1"></div><div><label><input type="checkbox" id="fcR" checked style="width:auto"> Round trip</label></div></div><div id="fcO" class="chip" style="display:block;margin-top:12px;border-radius:10px;padding:10px;font-size:13px;line-height:1.6"></div></div></div>`}
const cur_=()=>S.gems.find(x=>x.id===location.hash.split('/')[2]);
function conv(){const a=$('#cvA'),g=cur_();if(!a||!g)return;const t=$('#cvT').value;$('#cvR').textContent=mny(t,(+a.value||0)/RATE[g.cur||'USD']*RATE[t])}
function fuel(e){const d=$('#fcD'),g=cur_();if(!d||!g)return;if(e&&e.target.id==='fcV')$('#fcM').value=e.target.value;const c=g.cur||'USD',n=Math.max(1,+$('#fcN').value||1),L=(+d.value||0)*($('#fcR').checked?2:1)/Math.max(1,+$('#fcM').value||1),cost=L*(+$('#fcP').value||0);
  $('#fcO').innerHTML=`${L.toFixed(1)} L of fuel · <b>${mny(c,cost)}</b>${n>1?` (${mny(c,cost/n)} each for ${n})`:''}<br>Trip total with entry costs: <b>${mny(c,cost/n+total(g))}</b> per person`}

// ---- Auto-fetch driving distance for fuel calc AND location header ----
async function autoFetchFuelDistance(g) {
  const input = $('#fcD');
  const distLabel = $('#real-road-dist');
  if (!input) return;

  const getOrigin = () => new Promise((resolve) => {
    if (S.near) return resolve(S.near);
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => {
        S.near = { lat: p.coords.latitude, lng: p.coords.longitude };
        resolve(S.near);
      },
      () => resolve(null),
      { timeout: 5000 }
    );
  });

  const origin = await getOrigin();
  
  if (!origin) {
    input.placeholder = "Location blocked. Enter manually.";
    return;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${g.lng},${g.lat}?overview=false`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.routes && data.routes.length > 0) {
      const km = Math.round(data.routes[0].distance / 1000);
      
      if ($('#fcD') === input) {
        input.value = km;
        input.placeholder = "";
        fuel(); 
      }
      
      if ($('#real-road-dist') === distLabel) {
        distLabel.textContent = `· ${km} km away`;
      }
    }
  } catch (e) {
    console.error('OSRM Routing failed:', e);
    input.placeholder = "Could not fetch distance";
  }
}

// ---- Add / edit form ----
function form(id){const g=S.gems.find(x=>x.id===id)||{};S.ftags=[...(g.tags||[])];after=()=>pickMap();
  return `<a class="back" href="javascript:history.back()"><i class="fa-solid fa-arrow-left"></i> Back</a><form onsubmit="saveGem(event,'${g.id||''}')"><div class="row sp"><div><h1>${g.id?'Edit Gem':'Add New Gem'}</h1><div class="mu">Share a hidden gem with the community</div></div><button class="btn p" id="sv">${g.id?'Save changes':'Publish Gem'} →</button></div>
  <div class="two" style="margin-top:14px"><div><label class="drop" id="dz"><i class="fa-solid fa-cloud-arrow-up" style="font-size:30px"></i><br><b>Upload Photos</b><div class="mu">PNG, JPG up to 10MB</div><input type="file" name="photo" accept="image/*" hidden onchange="prev(this)">${g.photo?`<img id="pv" src="${esc(g.photo)}" onerror="this.remove()">`:''}</label>
   <label>Spot Name *</label><input name="title" required placeholder="Enter spot name..." value="${esc(g.title)}"><label>Location *</label><input name="place" required placeholder="Enter location..." value="${esc(g.place)}">
   <div class="two"><div><label>Country *</label><input name="country" required placeholder="India" value="${esc(g.country)}"></div><div><label>State *</label><input name="state" required placeholder="Kerala" value="${esc(g.state)}"></div></div><label>District *</label><input name="district" required placeholder="Kollam" value="${esc(g.district)}">
   <label>Category</label><select name="cat">${CATS.map(c=>`<option ${g.cat===c?'selected':''}>${c}</option>`).join('')}</select></div>
  <div><label>Tags</label><div class="row" id="ft">${TAGS.map(t=>`<button type="button" class="chip q ${S.ftags.includes(t)?'on':''}" onclick="ftag(this,'${t}')">${t}</button>`).join('')}</div>
   <label>Description *</label><textarea name="desc" rows="3" required placeholder="Tell us about this place...">${esc(g.desc)}</textarea>
   <label>Pin the spot (click the map or type coordinates)</label><div id="pm" style="height:200px;border-radius:12px;background:#e3ede6"></div><div class="two" style="margin-top:8px"><input name="lat" type="number" step="any" required placeholder="Latitude" value="${g.lat??''}"><input name="lng" type="number" step="any" required placeholder="Longitude" value="${g.lng??''}"></div>
   <label>Costs, one per line as Label: amount (in the country's local currency)</label><textarea name="costs" rows="3" placeholder="Entry Fee: 50">${esc((g.costs||[]).map(c=>c.l+': '+c.a).join('\n'))}</textarea>
   <div class="two"><div><label>Safety level</label><select name="lvl">${['low','moderate','high'].map(l=>`<option ${g.safety?.lvl===l?'selected':''}>${l}</option>`).join('')}</select></div></div><label>Safety notes (one per line)</label><textarea name="sn" rows="2">${esc((g.safety?.notes||[]).join('\n'))}</textarea>
   <label>Step-by-step directions (one per line) *</label><textarea name="steps" rows="3" required>${esc((g.steps||[]).join('\n'))}</textarea></div></div></form>`}
const prev=i=>{const f=i.files[0];if(!f)return;let p=$('#pv');if(!p){p=document.createElement('img');p.id='pv';$('#dz').appendChild(p)}p.src=URL.createObjectURL(f)};
const ftag=(b,t)=>{S.ftags=S.ftags.includes(t)?S.ftags.filter(x=>x!==t):[...S.ftags,t];b.classList.toggle('on')};

async function pickMap() {
  const el = $('#pm'); if (!el) return;
  if (window.pmMap) { window.pmMap.remove(); window.pmMap = null; }
  const f = el.closest('form'), la = +f.lat.value, ln = +f.lng.value;
  const has = f.lat.value && f.lng.value && !isNaN(la) && !isNaN(ln);
  window.pmMap = new maplibregl.Map({container: el,style: 'https://tiles.openfreemap.org/styles/liberty',center: has ? [ln, la] : (S.near ? [S.near.lng, S.near.lat] : [76.5, 10.5]),zoom: has ? 11 : 6});
  window.pmMap.addControl(new maplibregl.NavigationControl(), 'top-right');
  window.pmMap.on('error', (e) => console.error('Pin Map Error:', e.error));
  window.pmMap.on('load', () => window.pmMap.resize());
  let mk = null;
  if (has) {
    mk = new maplibregl.Marker({ draggable: true }).setLngLat([ln, la]).addTo(window.pmMap);
    mk.on('dragend', () => { const p = mk.getLngLat(); f.lat.value = p.lat.toFixed(5); f.lng.value = p.lng.toFixed(5); });
  }
  window.pmMap.on('click', (e) => {
    const p = e.lngLat; f.lat.value = p.lat.toFixed(5); f.lng.value = p.lng.toFixed(5);
    if (mk) { mk.setLngLat(p); } else {
      mk = new maplibregl.Marker({ draggable: true }).setLngLat(p).addTo(window.pmMap);
      mk.on('dragend', () => { const p2 = mk.getLngLat(); f.lat.value = p2.lat.toFixed(5); f.lng.value = p2.lng.toFixed(5); });
    }
  });
}

async function saveGem(e,id){e.preventDefault();const f=e.target,fd=new FormData(),b=$('#sv');['title','place','country','state','district','lat','lng','cat','desc'].forEach(k=>fd.append(k,f[k].value));
  fd.append('cur',CC[f.country.value.trim()]||'USD');fd.append('tags',JSON.stringify(S.ftags));fd.append('steps',JSON.stringify(lines(f.steps.value)));fd.append('safety',JSON.stringify({lvl:f.lvl.value,notes:lines(f.sn.value)}));
  fd.append('costs',JSON.stringify(lines(f.costs.value).map(l=>{const p=l.split(':');return{l:p[0].trim(),a:parseFloat(p[1])||0}})));if(f.photo.files[0])fd.append('photo',f.photo.files[0]);
  b.disabled=true;try{const g=await api(id?'/gems/'+id:'/gems',{method:id?'PUT':'POST',body:fd});S.gems=id?S.gems.map(x=>x.id===id?g:x):[g,...S.gems];toast(id?'Gem updated':'Gem published!');refresh();go('#/gem/'+g.id)}catch(err){toast(err.message);b.disabled=false}}
// ---- Trips, favourites, profile, settings ----
const mine=ids=>ids.map(i=>S.gems.find(g=>g.id===i)).filter(Boolean);
const trips=()=>{const r=mine(S.user.trips);return `<div class="row sp"><div><h1>My Trips</h1><p class="mu">Gems you plan to visit.</p></div><button class="btn p" onclick="go('#/explore')">Plan a Trip</button></div>`+(r.length?`<div class="grid">${r.map(card).join('')}</div>`:empty('No trips yet','Open a gem and tap Add to Trip.','<button class="btn p" onclick="go(\'#/explore\')">Explore</button>'))};
const favs=()=>{const r=mine(S.user.favs);return `<h1>Favorites</h1><p class="mu">Spots you saved for later.</p>`+(r.length?`<div class="grid">${r.map(card).join('')}</div>`:empty('Nothing saved yet','Tap the heart on any gem.','<button class="btn p" onclick="go(\'#/explore\')">Explore</button>'))};
function profile(){const u=S.user,own=S.gems.filter(g=>g.authorId===u.id),ups=own.reduce((a,g)=>a+g.ups.length,0),A=[['Top Explorer','Reach 10 trips',u.trips.length,10,'medal'],['Community Helper','Get 50 upvotes',ups,50,'hands-holding-heart'],['Nature Lover','Add 25 nature spots',own.filter(g=>g.cat==='Nature').length,25,'leaf']];
  return `<div class="row sp"><div><h1>My Dashboard</h1><p class="mu">Track your adventures and contributions</p></div><button class="btn p" onclick="go('#/explore')">+ Plan a Trip</button></div><div class="cols" style="margin-top:12px"><div><div class="card" style="padding:18px;display:flex;gap:16px;align-items:center;margin-bottom:14px"><span class="av" style="width:64px;height:64px;font-size:26px">${esc(u.name[0])}</span><div><h2 style="margin:0">${esc(u.name)}</h2><div class="mu">@${esc(u.email.split('@')[0])} · Explorer · ${own.length} contributions</div></div></div>
  <div class="stat2"><div class="card"><i class="fa-solid fa-suitcase-rolling"></i><b>${u.trips.length}</b><span class="mu">Trips Planned</span></div><div class="card"><i class="fa-solid fa-camera"></i><b>${own.filter(g=>g.photo).length}</b><span class="mu">Photos Shared</span></div><div class="card"><i class="fa-solid fa-star"></i><b>${ups}</b><span class="mu">Upvotes</span></div></div>
  <h2 style="margin-top:20px">My Recent Activity</h2>${own.length?`<div class="g4">${own.slice(0,4).map(card).join('')}</div>`:empty('No contributions yet','Share your first hidden gem.','<button class="btn p" onclick="go(\'#/contribute\')">Contribute</button>')}</div>
  <div class="card" style="padding:18px"><h2>Achievements</h2>${A.map(a=>`<div style="margin:14px 0"><div class="row"><i class="fa-solid fa-${a[4]}" style="color:var(--ac)"></i><b>${a[0]}</b></div><div class="mu">${a[1]} (${Math.min(a[2],a[3])}/${a[3]})</div><div style="height:6px;background:var(--bd);border-radius:9px;margin-top:6px"><div style="height:6px;width:${Math.min(100,a[2]/a[3]*100)}%;background:var(--ac);border-radius:9px"></div></div></div>`).join('')}</div></div>`}
const settings=()=>`<h1>Settings</h1><p class="mu">Manage your account.</p><form class="card" style="padding:18px;max-width:460px" onsubmit="saveName(event)"><label>Display name</label><input name="name" value="${esc(S.user.name)}" required><label>Email</label><input value="${esc(S.user.email)}" disabled><div class="row" style="margin-top:16px"><button class="btn p">Save</button><button type="button" class="btn d" onclick="logout()">Sign out</button></div></form>`;
async function saveName(e){e.preventDefault();const old=S.user.name,n=e.target.name.value;S.user.name=n;render();try{await api('/me',{method:'PUT',body:{name:n}});toast('Saved')}catch(err){S.user.name=old;render();toast(err.message)}}
// ---- Router ----
function render(){if(!S.user)return authView();const [r='home',a]=location.hash.slice(2).split('/'),V={home,explore,map:mapView,trips,favs,contribute:()=>form(a),profile,settings,gem:()=>detail(a)};after=null;
  const body=S.loading?skel():(V[r]||home)();shell(V[r]?r:'home',body);if(after&&!S.loading)after()}
addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});
(async()=>{try{S.gems=await api('/gems')}catch(e){toast('Could not load gems')}try{S.stats=await api('/stats')}catch(e){}S.loading=false;if(S.token)try{S.user=(await api('/me')).user}catch{localStorage.removeItem('tok');S.token=null}render()})();