/* Kalaksha demo: customer shop + admin panel. All data lives in this browser's localStorage. */
const { useState, useEffect, useMemo, useRef } = React;
const html = htm.bind(React.createElement);
const { seed, STATES, dayKey } = window.KALAKSHA;
const KEY = 'kalaksha-demo-v1';

/* ---------- storage ---------- */
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 4) return s; } catch (e) {}
  return seed();
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); }
  catch (e) { console.warn('Could not save demo data (storage full?)', e); }
}

/* ---------- helpers ---------- */
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const inrShort = (v) => v >= 1e7 ? '₹' + (v / 1e7).toFixed(2) + ' Cr' : v >= 1e5 ? '₹' + (v / 1e5).toFixed(1) + 'L' : v >= 1e3 ? '₹' + Math.round(v / 1e3) + 'k' : '₹' + Math.round(v);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const fmtDT = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const stockOf = (p) => p.variants.reduce((s, v) => s + v.stock, 0);
const uniq = (a) => [...new Set(a)];
const rid = () => Math.random().toString(36).slice(2, 10);
const STATUS = { New: 'info', Packed: 'warn', Shipped: 'brand', Delivered: 'ok', Replacement: 'bad', Returned: 'neutral' };
const FLOW = ['New', 'Packed', 'Shipped', 'Delivered'];
const CHANNELS = ['Website', 'WhatsApp', 'Phone call', 'Instagram', 'In person'];
const chanOf = (o) => o.source || 'Website';
const chanPill = (c) => (c === 'WhatsApp' ? 'ok' : c === 'Website' ? 'neutral' : 'info');
const gatewayRate = (s) => (s.gatewayPct / 100) * (1 + s.gstOnFee / 100);
const usesGateway = (o) => o.payment.method !== 'UPI direct' && o.payment.method !== 'COD';
const feeOf = (o, s) => (usesGateway(o) && o.payment.status === 'Paid' ? Math.round(o.total * gatewayRate(s) * 100) / 100 : 0);
function gatewayShare(orders) {
  const tot = orders.reduce((x, o) => x + o.total, 0) || 1;
  return orders.filter(usesGateway).reduce((x, o) => x + o.total, 0) / tot;
}
const STEP_LABEL = { New: 'Order placed', Packed: 'Packed', Shipped: 'Shipped', Delivered: 'Delivered' };

function ratingMap(reviews) {
  const m = {};
  reviews.filter((r) => r.status === 'Published').forEach((r) => {
    m[r.pid] = m[r.pid] || { sum: 0, n: 0 };
    m[r.pid].sum += r.rating; m[r.pid].n++;
  });
  Object.values(m).forEach((x) => (x.avg = x.sum / x.n));
  return m;
}

function calc(db, lines, state, code, cust) {
  const s = db.settings;
  const qty = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.p.price * l.qty, 0);
  const parcels = qty ? Math.ceil(qty / s.perParcel) : 0;
  const rate = state === 'Maharashtra' ? s.rateMH : s.rateROI;
  let shipping = parcels * rate;
  if (s.freeShipAbove > 0 && subtotal >= s.freeShipAbove) shipping = 0;
  let discount = 0, couponMsg = '';
  if (code) {
    const r = couponCheck(db, db.coupons.find((c) => c.code === code.toUpperCase()), lines, cust || {});
    if (r.msg) couponMsg = r.msg; else discount = r.freeShip ? shipping : r.discount;
  }
  return { qty, subtotal, parcels, rate, shipping, discount, couponMsg, total: subtotal + shipping - discount };
}

function cartLines(db) {
  return db.cart.map((l) => {
    const p = db.products.find((x) => x.id === l.pid);
    const v = p && p.variants.find((x) => x.id === l.vid);
    return p && v ? { ...l, p, v } : null;
  }).filter(Boolean);
}

function readImage(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, 640 / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      im.onerror = rej; im.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}

/* ---------- icons ---------- */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm10 17-5.2-5.2',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  bag: 'M6 7h12l1 13H5L6 7zm3 0a3 3 0 0 1 6 0',
  box: 'M3 7l9-4 9 4-9 4-9-4zm0 0v10l9 4 9-4V7M12 11v10',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 6l-6 6 6 6',
  dash: 'M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-3H4zm10-13h6V4h-6z',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  tag: 'M3 12V4h8l10 10-8 8L3 12zm5-4h.01',
  layers: 'm12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10a7 7 0 0 1 14 0M17 3a4 4 0 0 1 0 8m5 10a7 7 0 0 0-4-6.3',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  chat: 'M4 5h16v11H8l-4 4z',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3m0 14v3M4.9 4.9 7 7m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
  hand: 'M7 11V6a1.5 1.5 0 0 1 3 0v5m0-6a1.5 1.5 0 0 1 3 0v6m0-5a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L4 13a1.5 1.5 0 0 1 2.6-1.5L7 12',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  store: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  check: 'm5 12 5 5 9-10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  upload: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v4h16v-4',
  alert: 'M12 3 2 20h20L12 3zm0 7v4m0 3h.01',
  home: 'M3 11l9-7 9 7M5 10v10h14V10',
};
function Icon({ n, fill }) {
  return html`<svg viewBox="0 0 24 24" fill=${fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d=${PATHS[n]} /></svg>`;
}

function Stars({ v, n }) {
  const r = Math.round(v || 0);
  return html`<span class="stars" aria-label=${(v || 0).toFixed(1) + ' out of 5'}>
    ${[1, 2, 3, 4, 5].map((i) => html`<span key=${i} style=${{ color: i <= r ? 'var(--haldi)' : 'var(--line)' }}>★</span>`)}
    ${n != null && html`<small>${v ? v.toFixed(1) : 'New'}${n ? ` (${n})` : ''}</small>`}
  </span>`;
}

function ThemeBtn() {
  const toggle = () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('kalaksha-theme', root.dataset.theme); } catch (e) {}
  };
  return html`<button class="icon-btn" title="Switch light / dark" onClick=${toggle}><${Icon} n="moon" /></button>`;
}
document.documentElement.removeAttribute('data-theme');

function useEsc(fn) {
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && fn();
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  }, [fn]);
}

function ConfirmBtn({ label, confirm, onConfirm, cls }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return html`<button class=${'btn sm ' + (cls || '')} style=${armed ? { background: 'var(--bad)', color: '#fff', borderColor: 'var(--bad)' } : null}
    onClick=${(e) => { e.stopPropagation(); armed ? onConfirm() : setArmed(true); }}>${armed ? confirm : label}</button>`;
}

/* ================================================================ APP */
function App() {
  const [db, setDb] = useState(load);
  const [route, setRoute] = useState(() => (location.hash === '#admin' ? 'admin' : 'shop'));
  const [toast, setToast] = useState('');
  const skipSave = useRef(false);

  useEffect(() => { if (skipSave.current) { skipSave.current = false; return; } save(db); }, [db]);
  useEffect(() => {
    const f = () => { setRoute(location.hash === '#admin' ? 'admin' : 'shop'); scrollTo(0, 0); };
    addEventListener('hashchange', f); return () => removeEventListener('hashchange', f);
  }, []);
  // Keep the shop and admin in sync when they are open in two browser tabs.
  useEffect(() => {
    const f = (e) => { if (e.key === KEY && e.newValue) { try { skipSave.current = true; setDb(JSON.parse(e.newValue)); } catch (err) {} } };
    addEventListener('storage', f); return () => removeEventListener('storage', f);
  }, []);

  const notify = (msg) => { setToast(msg); clearTimeout(window.__toast); window.__toast = setTimeout(() => setToast(''), 2400); };
  const update = (fn) => setDb((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const go = (r) => { location.hash = r === 'admin' ? 'admin' : 'shop'; };
  const reset = () => { setDb(seed()); notify('Demo data reset to the catalogue'); };
  const ctx = { db, update, notify, go, reset };

  return html`
    ${route === 'admin' ? html`<${Admin} ...${ctx} />` : html`<${Shop} ...${ctx} />`}
    ${toast && html`<div class="toast" role="status">${toast}</div>`}
  `;
}

/* ================================================================ SHOP (home page built from admin settings) */
const catName = (db, id) => ((db.categories || []).find((c) => c.id === id) || { name: 'Uncategorised' }).name;
function imageLibrary(db) {
  return uniq([
    ...db.products.flatMap((p) => [...p.images, ...p.variants.map((v) => v.img)]),
    ...(db.home ? db.home.banners.map((b) => b.img) : []),
    ...(db.categories || []).map((c) => c.img),
  ].filter(Boolean));
}

function Shop({ db, update, notify, go }) {
  const [view, setView] = useState('home'); // home | checkout | success | orders | wishlist
  const [q, setQ] = useState('');
  const [coll, setColl] = useState('All');
  const [cat, setCat] = useState('All');
  const [flag, setFlag] = useState('All'); // All | new | best | featured
  const [sort, setSort] = useState('popular');
  const [openPid, setOpenPid] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const gridRef = useRef(null);

  const ratings = useMemo(() => ratingMap(db.reviews), [db.reviews]);
  const lines = cartLines(db);
  const cartQty = lines.reduce((a, l) => a + l.qty, 0);
  const low = db.settings.lowStock;
  const cats = (db.categories || []).filter((c) => c.active);
  const visible = db.products.filter((p) => p.active);
  const collections = uniq(visible.map((p) => p.collection));

  useEffect(() => { document.body.classList.toggle('has-cart', cartQty > 0 && view === 'home'); }, [cartQty, view]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = visible.filter((p) =>
      (coll === 'All' || p.collection === coll) && (cat === 'All' || p.category === cat) &&
      (flag === 'All' || (flag === 'new' && p.isNew) || (flag === 'best' && p.bestseller) || (flag === 'featured' && p.featured)) &&
      (!t || (p.name + ' ' + p.mr + ' ' + p.collection + ' ' + catName(db, p.category) + ' ' + p.variants.map((v) => v.name).join(' ')).toLowerCase().includes(t)));
    const r = (p) => (ratings[p.id] ? ratings[p.id].avg : 0);
    const by = { popular: (a, b) => b.sold - a.sold, new: (a, b) => (b.isNew - a.isNew) || (b.sold - a.sold), low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, rated: (a, b) => r(b) - r(a) }[sort];
    return [...l].sort(by);
  }, [db.products, db.categories, q, coll, cat, flag, sort, ratings]);

  const addToCart = (pid, vid, qty = 1, silent) => {
    const p = db.products.find((x) => x.id === pid); const v = p.variants.find((x) => x.id === vid);
    const inCart = (db.cart.find((l) => l.pid === pid && l.vid === vid) || { qty: 0 }).qty;
    if (inCart + qty > v.stock) { notify(v.stock - inCart > 0 ? `Only ${v.stock - inCart} more available` : 'No more stock for this colour'); return false; }
    update((d) => { const l = d.cart.find((l) => l.pid === pid && l.vid === vid); if (l) l.qty += qty; else d.cart.push({ pid, vid, qty }); });
    if (!silent) notify(`Added ${p.name}${p.variants.length > 1 ? ' (' + v.name + ')' : ''} to cart`);
    return true;
  };
  const toggleWish = (pid) => {
    const on = db.wishlist.includes(pid);
    update((d) => { d.wishlist = on ? d.wishlist.filter((x) => x !== pid) : [...d.wishlist, pid]; });
    notify(on ? 'Removed from wishlist' : 'Saved to wishlist');
  };
  const toGrid = () => { setView('home'); setTimeout(() => gridRef.current && gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40); };
  const browse = ({ c = 'All', co = 'All', f = 'All' } = {}) => { setCat(c); setColl(co); setFlag(f); setQ(''); toGrid(); };
  const goHome = () => { setView('home'); setCat('All'); setColl('All'); setFlag('All'); setQ(''); scrollTo({ top: 0, behavior: 'smooth' }); };
  const follow = (link) => {
    if (!link) return;
    if (link.kind === 'category') browse({ c: link.value });
    else if (link.kind === 'collection') browse({ co: link.value });
    else if (link.kind === 'product') setOpenPid(link.value);
    else if (link.kind === 'new') browse({ f: 'new' });
    else if (link.kind === 'best') browse({ f: 'best' });
    else browse();
  };
  const filtered = !!q.trim() || cat !== 'All' || coll !== 'All' || flag !== 'All';
  const cardProps = (p) => ({
    key: p.id, p, rating: ratings[p.id] || { avg: 0, n: 0 }, low, wished: db.wishlist.includes(p.id),
    onOpen: () => setOpenPid(p.id), onWish: () => toggleWish(p.id), onAdd: addToCart,
  });
  const gridTitle = q.trim() ? `Results for “${q.trim()}”` : flag === 'new' ? 'New arrivals' : flag === 'best' ? 'Bestsellers' : flag === 'featured' ? 'Featured torans'
    : cat !== 'All' ? catName(db, cat) + (coll !== 'All' ? ' · ' + coll : '') : coll !== 'All' ? coll + ' collection' : 'All torans';

  const grid = (title) => html`<div class="wrap" key="grid">
    <div ref=${gridRef} class="section-head" style=${{ scrollMarginTop: '120px' }}>
      <h2>${filtered ? gridTitle : title}</h2><span class="muted">${list.length} product${list.length === 1 ? '' : 's'}</span></div>
    <div class="filters">
      <button class=${'chip' + (cat === 'All' ? ' on' : '')} onClick=${() => setCat('All')}>All categories</button>
      ${cats.map((c) => html`<button key=${c.id} class=${'chip' + (cat === c.id ? ' on' : '')} onClick=${() => setCat(c.id)}>${c.name}</button>`)}
      ${coll !== 'All' && html`<button class="chip on" onClick=${() => setColl('All')}>${coll} ✕</button>`}
      ${flag !== 'All' && html`<button class="chip on" onClick=${() => setFlag('All')}>${{ new: 'New arrivals', best: 'Bestsellers', featured: 'Featured' }[flag]} ✕</button>`}
      <span class="grow"></span>
      <label class="row" style=${{ gap: '6px', fontSize: '14px' }}><span class="muted">Sort</span>
        <select id="sort" class="select" style=${{ width: 'auto', padding: '7px 10px' }} value=${sort} onChange=${(e) => setSort(e.target.value)}>
          <option value="popular">Most popular</option><option value="new">New arrivals</option><option value="rated">Top rated</option>
          <option value="low">Price: low to high</option><option value="high">Price: high to low</option>
        </select></label>
    </div>
    ${list.length ? html`<div class="grid">${list.map((p) => html`<${Card} ...${cardProps(p)} />`)}</div>`
      : html`<div class="empty"><${Icon} n="search" /><p>No torans match. Try another category or clear the filters.</p><button class="btn" onClick=${goHome}>Clear filters</button></div>`}
  </div>`;

  const row = (s, items, f) => items.length ? html`<div class="wrap" key=${s.id}>
    <div class="section-head"><h2>${s.title}</h2><button class="btn sm" onClick=${() => browse({ f })}>View all</button></div>
    <div class="grid">${items.slice(0, 4).map((p) => html`<${Card} ...${cardProps(p)} />`)}</div></div>` : null;

  const section = (s) => {
    if (s.kind === 'categories') return cats.length ? html`<div class="wrap" key=${s.id}>
      <div class="section-head"><h2>${s.title}</h2></div>
      <div class="cats">${cats.map((c) => html`<button key=${c.id} class="cat" onClick=${() => browse({ c: c.id })}>
        <span class="cat-img"><img src=${c.img} alt="" /></span><b>${c.name}</b><span class="muted">${c.mr ? c.mr + ' · ' : ''}${visible.filter((p) => p.category === c.id).length} products</span></button>`)}</div></div>` : null;
    if (s.kind === 'collections') return html`<div class="wrap" key=${s.id}>
      <div class="section-head"><h2>${s.title}</h2></div>
      <div class="collections">${collections.map((c) => { const ps = visible.filter((p) => p.collection === c); return html`
        <button key=${c} class="coll" onClick=${() => browse({ co: c })}>
          <img src=${(ps.find((p) => p.featured) || ps[0]).images[0]} alt="" />
          <span class="cap"><b>${c} collection</b><span>${ps.length} product${ps.length === 1 ? '' : 's'}</span></span></button>`; })}</div></div>`;
    if (s.kind === 'featured') return row(s, visible.filter((p) => p.featured), 'featured');
    if (s.kind === 'new') return row(s, visible.filter((p) => p.isNew), 'new');
    if (s.kind === 'bestsellers') return row(s, visible.filter((p) => p.bestseller).sort((a, b) => b.sold - a.sold), 'best');
    if (s.kind === 'values') return html`<div class="wrap" key=${s.id}><${Values} db=${db} /></div>`;
    if (s.kind === 'all') return grid(s.title);
    return null;
  };
  const sections = db.home.sections.filter((s) => s.active);
  if (!sections.find((s) => s.kind === 'all')) sections.push({ id: 'all-fallback', kind: 'all', title: 'All torans', active: true });

  return html`
    <${ShopHeader} db=${db} q=${q} setQ=${(v) => { setQ(v); if (view !== 'home') setView('home'); }} cartQty=${cartQty}
      onCart=${() => setCartOpen(true)} onHome=${goHome} onOrders=${() => { setView('orders'); scrollTo(0, 0); }}
      onWish=${() => { setView('wishlist'); scrollTo(0, 0); }} go=${go}
      cats=${cats} collections=${collections} cat=${cat} coll=${coll} flag=${flag} browse=${browse} />
    <main class="page-pad">
      ${view === 'home' && (filtered ? grid('All torans') : html`
        <${BannerCarousel} banners=${db.home.banners.filter((b) => b.active)} onGo=${follow} />
        ${sections.map(section)}`)}
      ${view === 'wishlist' && html`
        <div class="wrap">
          <div class="section-head"><h2>Wishlist</h2><button class="btn sm" onClick=${goHome}>Continue shopping</button></div>
          ${db.wishlist.length ? html`<div class="grid">${db.products.filter((p) => p.active && db.wishlist.includes(p.id)).map((p) => html`<${Card} ...${cardProps(p)} />`)}</div>`
            : html`<div class="empty"><${Icon} n="heart" /><p>Tap the heart on any toran to save it here.</p></div>`}
        </div>`}
      ${view === 'orders' && html`<${MyOrders} db=${db} onShop=${goHome} />`}
      ${view === 'checkout' && html`<${Checkout} db=${db} update=${update} notify=${notify} onBack=${() => { setView('home'); setCartOpen(true); }}
        onPlaced=${(id) => { setLastOrder(id); setView('success'); scrollTo(0, 0); }} />`}
      ${view === 'success' && html`<${Success} db=${db} id=${lastOrder} onShop=${goHome} onTrack=${() => setView('orders')} />`}
    </main>
    <${Footer} db=${db} />

    ${view === 'home' && cartQty > 0 && html`<div class="mobile-cart"><button class="btn primary block" onClick=${() => setCartOpen(true)}>
      View cart · ${cartQty} item${cartQty > 1 ? 's' : ''} · ${inr(lines.reduce((a, l) => a + l.p.price * l.qty, 0))}</button></div>`}

    ${openPid && db.products.find((p) => p.id === openPid) && html`<${ProductModal} key=${openPid} db=${db} pid=${openPid} update=${update} notify=${notify}
      wished=${db.wishlist.includes(openPid)} onWish=${() => toggleWish(openPid)} onClose=${() => setOpenPid(null)}
      onAdd=${(vid, qty) => addToCart(openPid, vid, qty)}
      onBuy=${(vid, qty) => { if (addToCart(openPid, vid, qty, true)) { setOpenPid(null); setView('checkout'); scrollTo(0, 0); } }} />`}
    ${cartOpen && html`<${CartDrawer} db=${db} lines=${lines} update=${update} onClose=${() => setCartOpen(false)}
      onCheckout=${() => { setCartOpen(false); setView('checkout'); scrollTo(0, 0); }} />`}
  `;
}

function ShopHeader({ db, q, setQ, cartQty, onCart, onHome, onOrders, onWish, go, cats, collections, cat, coll, flag, browse }) {
  const all = cat === 'All' && coll === 'All' && flag === 'All';
  return html`
    <div class="announce">${db.settings.announcement}</div>
    <div class="demo-ribbon">Demo store · Products, photos and prices are from the Kalaksha catalogue · Orders, reviews and stock are sample data saved in this browser</div>
    <header class="shop-header">
      <div class="wrap bar">
        <button class="logo" onClick=${onHome} aria-label="Kalaksha home"><span class="mr">कलाक्षा</span><span class="en"><b>KALAKSHA</b><span>Tradition by Style</span></span></button>
        <div class="search"><${Icon} n="search" /><input id="shop-search" type="search" placeholder="Search Swami, Ganapati, car toran…" value=${q} onChange=${(e) => setQ(e.target.value)} /></div>
        <div class="row" style=${{ marginLeft: 'auto', gap: '2px' }}>
          <button class="icon-btn" title="Wishlist" onClick=${onWish}><${Icon} n="heart" />${db.wishlist.length > 0 && html`<span class="count">${db.wishlist.length}</span>`}</button>
          <button class="icon-btn" title="My orders" onClick=${onOrders}><${Icon} n="box" /></button>
          <button class="icon-btn" title="Cart" onClick=${onCart}><${Icon} n="bag" />${cartQty > 0 && html`<span class="count">${cartQty}</span>`}</button>
          <button class="btn sm dark" style=${{ marginLeft: '6px' }} onClick=${() => go('admin')}>Admin</button>
        </div>
      </div>
      <nav class="catnav" aria-label="Categories"><div class="wrap">
        <button class=${all ? 'on' : ''} onClick=${() => browse()}>All torans</button>
        ${cats.map((c) => html`<button key=${c.id} class=${cat === c.id && coll === 'All' ? 'on' : ''} onClick=${() => browse({ c: c.id })}>${c.name}</button>`)}
        <span class="sep" aria-hidden="true"></span>
        ${collections.map((c) => html`<button key=${c} class=${coll === c && cat === 'All' ? 'on' : ''} onClick=${() => browse({ co: c })}>${c}</button>`)}
        <span class="sep" aria-hidden="true"></span>
        <button class=${flag === 'new' ? 'on' : ''} onClick=${() => browse({ f: 'new' })} style=${{ color: 'var(--kumkum)' }}>New arrivals</button>
      </div></nav>
    </header>`;
}

function BannerCarousel({ banners, onGo }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = banners.length;
  useEffect(() => { if (n < 2 || paused) return; const t = setInterval(() => setI((x) => (x + 1) % n), 5000); return () => clearInterval(t); }, [n, paused]);
  if (!n) return null;
  const b = banners[i % n];
  return html`<section class="wrap" style=${{ paddingBlock: '20px 4px' }}>
    <div class="banner" style=${{ background: b.bg || '#F5F5F5' }} onMouseEnter=${() => setPaused(true)} onMouseLeave=${() => setPaused(false)} key=${b.id}>
      <div class="banner-text">
        ${b.tag && html`<span class="eyebrow">${b.tag}</span>`}
        <h1>${b.title}</h1>
        ${b.subtitle && html`<p>${b.subtitle}</p>`}
        ${b.cta && html`<div><button class="btn primary" onClick=${() => onGo(b.link)}>${b.cta}</button></div>`}
      </div>
      <button class="banner-img" onClick=${() => onGo(b.link)} aria-label=${b.cta || b.title}><img src=${b.img} alt="" style=${{ objectPosition: b.pos || '50% 30%' }} /></button>
      ${n > 1 && html`
        <button class="banner-arrow l" aria-label="Previous banner" onClick=${() => setI((i - 1 + n) % n)}><${Icon} n="back" /></button>
        <button class="banner-arrow r" aria-label="Next banner" onClick=${() => setI((i + 1) % n)}><span style=${{ display: 'inline-flex', transform: 'rotate(180deg)' }}><${Icon} n="back" /></span></button>
        <div class="dots">${banners.map((x, k) => html`<button key=${x.id} class=${k === i % n ? 'on' : ''} aria-label=${'Banner ' + (k + 1)} onClick=${() => setI(k)}></button>`)}</div>`}
    </div>
  </section>`;
}

/* ================================================================ ADMIN: storefront + categories */
function ImagePicker({ db, value, onChange, notify, id }) {
  const lib = uniq([value, ...imageLibrary(db)].filter(Boolean));
  const upload = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { onChange(await readImage(f)); notify('Photo added'); } catch (err) { notify('Could not read that image. Try a JPG or PNG.'); }
  };
  return html`<div class="stack" style=${{ gap: '8px' }}>
    <div class="imgpick">${lib.map((src) => html`<button type="button" key=${src.slice(-48)} class=${src === value ? 'on' : ''} onClick=${() => onChange(src)}><img src=${src} alt="" /></button>`)}</div>
    <label class="upload" htmlFor=${id}><${Icon} n="upload" /> Upload a photo<input id=${id} type="file" accept="image/*" hidden onChange=${upload} /></label>
  </div>`;
}

const LINK_KINDS = [['all', 'All products'], ['category', 'A category'], ['collection', 'A collection'], ['product', 'A product'], ['new', 'New arrivals'], ['best', 'Bestsellers']];
function linkLabel(db, l) {
  if (!l) return '—';
  if (l.kind === 'category') return 'Category: ' + catName(db, l.value);
  if (l.kind === 'collection') return 'Collection: ' + l.value;
  if (l.kind === 'product') return 'Product: ' + ((db.products.find((p) => p.id === l.value) || {}).name || 'deleted');
  return (LINK_KINDS.find((k) => k[0] === l.kind) || ['', 'All products'])[1];
}
const SECTION_KINDS = { categories: 'Category tiles', collections: 'Collection tiles', featured: 'Products marked Featured', new: 'Products marked New', bestsellers: 'Products marked Bestseller', all: 'All products with filters', values: 'Handmade / delivery highlights' };

function Storefront({ db, update, notify, go }) {
  const [edit, setEdit] = useState(null);
  const move = (key, i, dir) => update((d) => { const a = d.home[key]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; });
  return html`<div class="stack" style=${{ gap: '16px', maxWidth: '980px' }}>
    <div class="callout"><${Icon} n="alert" /> Changes here show on the store home page straight away. Open the store in another tab to watch.</div>
    <div class="box">
      <h3>Home page banners <button class="btn sm primary" onClick=${() => setEdit('new')}><${Icon} n="plus" /> Add banner</button></h3>
      <div class="stack" style=${{ gap: '8px' }}>${db.home.banners.map((b, i) => html`<div key=${b.id} class="row wrapflex" style=${{ border: '1px solid var(--line)', borderRadius: '10px', padding: '8px', opacity: b.active ? 1 : 0.55 }}>
        <div style=${{ width: '120px', height: '64px', borderRadius: '6px', overflow: 'hidden', background: b.bg, flex: 'none' }}><img src=${b.img} alt="" style=${{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos }} /></div>
        <div class="grow"><b>${b.title}</b><div class="muted" style=${{ fontSize: '13px' }}>${b.tag ? b.tag + ' · ' : ''}Button “${b.cta || '—'}” → ${linkLabel(db, b.link)}</div></div>
        <button class="btn sm ghost" aria-label="Move up" disabled=${i === 0} onClick=${() => move('banners', i, -1)}>↑</button>
        <button class="btn sm ghost" aria-label="Move down" disabled=${i === db.home.banners.length - 1} onClick=${() => move('banners', i, 1)}>↓</button>
        <button class=${'switch' + (b.active ? ' on' : '')} aria-label="Show banner" onClick=${() => update((d) => { const x = d.home.banners.find((y) => y.id === b.id); x.active = !x.active; })}></button>
        <button class="btn sm" onClick=${() => setEdit(b.id)}><${Icon} n="edit" /> Edit</button>
      </div>`)}</div>
    </div>
    <div class="box">
      <h3>Home page sections <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>Top to bottom, below the banners</span></h3>
      <div class="stack" style=${{ gap: '8px' }}>${db.home.sections.map((s, i) => html`<div key=${s.id} class="row wrapflex" style=${{ border: '1px solid var(--line)', borderRadius: '10px', padding: '8px 10px', opacity: s.active ? 1 : 0.55 }}>
        <span class="num muted" style=${{ width: '18px' }}>${i + 1}</span>
        <input id=${'sec-' + s.id} class="input grow" style=${{ maxWidth: '280px' }} value=${s.title} aria-label="Section title" onChange=${(e) => update((d) => { d.home.sections.find((y) => y.id === s.id).title = e.target.value; })} />
        <span class="muted grow" style=${{ fontSize: '13px' }}>${SECTION_KINDS[s.kind]}</span>
        <button class="btn sm ghost" aria-label="Move up" disabled=${i === 0} onClick=${() => move('sections', i, -1)}>↑</button>
        <button class="btn sm ghost" aria-label="Move down" disabled=${i === db.home.sections.length - 1} onClick=${() => move('sections', i, 1)}>↓</button>
        <button class=${'switch' + (s.active ? ' on' : '')} aria-label="Show section" onClick=${() => update((d) => { const x = d.home.sections.find((y) => y.id === s.id); x.active = !x.active; })}></button>
      </div>`)}</div>
      <p class="muted" style=${{ fontSize: '13px', marginBottom: 0 }}>Which products appear in Featured, New arrivals and Bestsellers is set per product under Products → Edit.</p>
    </div>
    <div class="box stack"><h3 style=${{ margin: 0 }}>Announcement bar</h3>
      <input id="sf-ann" class="input" value=${db.settings.announcement} onChange=${(e) => update((d) => { d.settings.announcement = e.target.value; })} /></div>
    <div><button class="btn" onClick=${() => go('shop')}><${Icon} n="store" /> View store home page</button></div>
    ${edit && html`<${BannerEditor} db=${db} update=${update} notify=${notify} id=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function BannerEditor({ db, update, notify, id, onClose }) {
  useEsc(onClose);
  const isNew = id === 'new';
  const [b, setB] = useState(() => isNew
    ? { id: 'b' + rid(), tag: 'New', title: '', subtitle: '', cta: 'Shop now', link: { kind: 'all' }, img: imageLibrary(db)[0], bg: '#F5F0EC', pos: '50% 30%', active: true }
    : structuredClone(db.home.banners.find((x) => x.id === id)));
  const set = (k, v) => setB({ ...b, [k]: v });
  const setLink = (kind) => {
    const value = kind === 'category' ? (db.categories[0] || {}).id : kind === 'collection' ? db.products[0].collection : kind === 'product' ? db.products[0].id : undefined;
    set('link', { kind, value });
  };
  const save = () => {
    if (!b.title.trim()) { notify('Add a banner title'); return; }
    update((d) => { const i = d.home.banners.findIndex((x) => x.id === b.id); if (i >= 0) d.home.banners[i] = b; else d.home.banners.push(b); });
    notify(isNew ? 'Banner added to the home page' : 'Banner saved'); onClose();
  };
  const del = () => { update((d) => { d.home.banners = d.home.banners.filter((x) => x.id !== b.id); }); notify('Banner deleted'); onClose(); };
  const txt = (k, label, ph) => html`<label class="f" htmlFor=${'be-' + k}>${label}<input id=${'be-' + k} class="input" placeholder=${ph || ''} value=${b[k]} onChange=${(e) => set(k, e.target.value)} /></label>`;
  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Edit banner">
    <div class="head"><h3>${isNew ? 'Add banner' : 'Edit banner'}</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '14px' }}>
      <div class="banner mini" style=${{ background: b.bg }}>
        <div class="banner-text">${b.tag && html`<span class="eyebrow">${b.tag}</span>`}<h1>${b.title || 'Banner title'}</h1>${b.subtitle && html`<p>${b.subtitle}</p>`}${b.cta && html`<div><span class="btn primary sm">${b.cta}</span></div>`}</div>
        <div class="banner-img"><img src=${b.img} alt="" style=${{ objectPosition: b.pos }} /></div>
      </div>
      <span class="muted" style=${{ fontSize: '12px', marginTop: '-8px' }}>Preview</span>
      <div class="grid2">${txt('tag', 'Small label', 'e.g. New arrival, Diwali offer')}${txt('cta', 'Button text', 'e.g. Shop now')}</div>
      ${txt('title', 'Title', 'e.g. Ganapati torans for Diwali')}
      <label class="f" htmlFor="be-sub">Text under the title<textarea id="be-sub" class="input" rows="2" value=${b.subtitle} onChange=${(e) => set('subtitle', e.target.value)}></textarea></label>
      <div class="grid2">
        <label class="f" htmlFor="be-link">Button opens<select id="be-link" class="select" value=${b.link.kind} onChange=${(e) => setLink(e.target.value)}>${LINK_KINDS.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>
        ${b.link.kind === 'category' && html`<label class="f" htmlFor="be-lv">Category<select id="be-lv" class="select" value=${b.link.value} onChange=${(e) => set('link', { ...b.link, value: e.target.value })}>${db.categories.map((c) => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select></label>`}
        ${b.link.kind === 'collection' && html`<label class="f" htmlFor="be-lv">Collection<select id="be-lv" class="select" value=${b.link.value} onChange=${(e) => set('link', { ...b.link, value: e.target.value })}>${uniq(db.products.map((p) => p.collection)).map((c) => html`<option key=${c}>${c}</option>`)}</select></label>`}
        ${b.link.kind === 'product' && html`<label class="f" htmlFor="be-lv">Product<select id="be-lv" class="select" value=${b.link.value} onChange=${(e) => set('link', { ...b.link, value: e.target.value })}>${db.products.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}</select></label>`}
      </div>
      <div class="grid2">
        <label class="f" htmlFor="be-bg">Background colour<div class="row"><input id="be-bg" type="color" value=${b.bg} onChange=${(e) => set('bg', e.target.value)} style=${{ width: '44px', height: '38px', border: 0, padding: 0, background: 'none' }} />
          ${['#F5F0EC', '#FFF4D6', '#E7F2EC', '#FBE9E7', '#E8EEF8', '#F5F5F5'].map((c) => html`<button key=${c} type="button" aria-label=${'Colour ' + c} onClick=${() => set('bg', c)} style=${{ width: '26px', height: '26px', borderRadius: '50%', border: b.bg === c ? '2px solid var(--ink)' : '1px solid var(--line)', background: c }}></button>`)}</div></label>
        <label class="f" htmlFor="be-pos">Photo focus<select id="be-pos" class="select" value=${b.pos} onChange=${(e) => set('pos', e.target.value)}><option value="50% 15%">Top</option><option value="50% 30%">Upper middle</option><option value="50% 50%">Centre</option><option value="50% 85%">Bottom</option></select></label>
      </div>
      <div class="stack" style=${{ gap: '6px' }}><span class="opt-label">Banner photo</span><${ImagePicker} db=${db} value=${b.img} onChange=${(v) => set('img', v)} notify=${notify} id="be-upload" /></div>
      <label class="row" style=${{ gap: '8px', cursor: 'pointer' }}><button type="button" class=${'switch' + (b.active ? ' on' : '')} onClick=${() => set('active', !b.active)} aria-label="Show on home page"></button>Show on home page</label>
    </div>
    <div class="foot"><div class="row">${!isNew && html`<${ConfirmBtn} label="Delete" confirm="Click again to delete" onConfirm=${del} />`}<span class="grow"></span>
      <button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${save}>${isNew ? 'Add banner' : 'Save banner'}</button></div></div>
  </aside>`;
}

function Categories({ db, update, notify }) {
  const [edit, setEdit] = useState(null);
  const count = (id) => db.products.filter((p) => p.category === id).length;
  return html`<div class="stack" style=${{ gap: '14px' }}>
    <div class="toolbar" style=${{ margin: 0 }}><span class="muted">Categories appear in the store menu, the “Shop by category” section and the filters.</span><span class="grow"></span>
      <button class="btn primary" onClick=${() => setEdit('new')}><${Icon} n="plus" /> Add category</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Category</th><th>Marathi name</th><th class="r">Products</th><th>Visible</th><th></th></tr></thead>
      <tbody>${db.categories.map((c) => html`<tr key=${c.id} class="click" onClick=${() => setEdit(c.id)}>
        <td><img class="thumb" src=${c.img} alt="" /></td><td><b>${c.name}</b></td><td>${c.mr || html`<span class="muted">—</span>`}</td>
        <td class="r num">${count(c.id)}</td>
        <td onClick=${(e) => e.stopPropagation()}><button class=${'switch' + (c.active ? ' on' : '')} aria-label="Visible" onClick=${() => update((d) => { const x = d.categories.find((y) => y.id === c.id); x.active = !x.active; })}></button></td>
        <td><button class="btn sm ghost"><${Icon} n="edit" /></button></td></tr>`)}</tbody></table></div>
    ${edit && html`<${CategoryEditor} db=${db} update=${update} notify=${notify} id=${edit} count=${edit === 'new' ? 0 : count(edit)} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function CategoryEditor({ db, update, notify, id, count, onClose }) {
  useEsc(onClose);
  const isNew = id === 'new';
  const [c, setC] = useState(() => isNew ? { id: '', name: '', mr: '', img: imageLibrary(db)[0], active: true } : structuredClone(db.categories.find((x) => x.id === id)));
  const [assign, setAssign] = useState(() => db.products.filter((p) => p.category === id).map((p) => p.id));
  const save = () => {
    const name = c.name.trim();
    if (!name) { notify('Add a category name'); return; }
    const cid = isNew ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cat-' + rid() : c.id;
    if (isNew && db.categories.find((x) => x.id === cid)) { notify('A category with this name already exists'); return; }
    update((d) => {
      const nc = { ...c, id: cid, name };
      const i = d.categories.findIndex((x) => x.id === cid); if (i >= 0) d.categories[i] = nc; else d.categories.push(nc);
      d.products.forEach((p) => { if (assign.includes(p.id)) p.category = cid; else if (p.category === cid) p.category = ''; });
    });
    notify(isNew ? `${name} added` : `${name} saved`); onClose();
  };
  const del = () => { update((d) => { d.categories = d.categories.filter((x) => x.id !== c.id); d.products.forEach((p) => { if (p.category === c.id) p.category = ''; }); }); notify(`${c.name} deleted`); onClose(); };
  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Edit category">
    <div class="head"><h3>${isNew ? 'Add category' : 'Edit category'}</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '14px' }}>
      <div class="grid2">
        <label class="f" htmlFor="ce-name">Category name<input id="ce-name" class="input" placeholder="e.g. Wall Hangings" value=${c.name} onChange=${(e) => setC({ ...c, name: e.target.value })} /></label>
        <label class="f" htmlFor="ce-mr">Marathi name (optional)<input id="ce-mr" class="input" placeholder="e.g. भिंतीवरील सजावट" value=${c.mr} onChange=${(e) => setC({ ...c, mr: e.target.value })} /></label>
      </div>
      <div class="stack" style=${{ gap: '6px' }}><span class="opt-label">Category photo</span><${ImagePicker} db=${db} value=${c.img} onChange=${(v) => setC({ ...c, img: v })} notify=${notify} id="ce-upload" /></div>
      <div class="stack" style=${{ gap: '6px' }}><span class="opt-label">Products in this category</span>
        ${db.products.map((p) => html`<label key=${p.id} class="row" style=${{ gap: '10px', fontSize: '14px', cursor: 'pointer' }}>
          <input type="checkbox" checked=${assign.includes(p.id)} onChange=${() => setAssign(assign.includes(p.id) ? assign.filter((x) => x !== p.id) : [...assign, p.id])} />
          <img class="thumb" src=${p.images[0]} alt="" style=${{ width: '36px', height: '36px' }} />${p.name}
          ${p.category && p.category !== c.id && html`<span class="muted" style=${{ fontSize: '12px' }}>now in ${catName(db, p.category)}</span>`}</label>`)}
      </div>
      <label class="row" style=${{ gap: '8px', cursor: 'pointer' }}><button type="button" class=${'switch' + (c.active ? ' on' : '')} onClick=${() => setC({ ...c, active: !c.active })} aria-label="Visible"></button>Show in store</label>
    </div>
    <div class="foot"><div class="row">${!isNew && html`<${ConfirmBtn} label="Delete" confirm=${count ? `Delete and unassign ${count} products` : 'Click again to delete'} onConfirm=${del} />`}<span class="grow"></span>
      <button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${save}>${isNew ? 'Add category' : 'Save category'}</button></div></div>
  </aside>`;
}

/* ================================================================ COUPONS */
const CP_DEFAULT = { desc: '', type: 'pct', value: 10, maxDiscount: 0, minOrder: 0, minQty: 0, starts: '', ends: '', limit: 0, perCustomer: 0, firstOrder: false, eligible: [], products: [], collections: [], showAtCheckout: true, active: true, uses: 0 };
function couponCheck(db, raw, lines, cust) {
  if (!raw) return { msg: 'This code is not valid.' };
  const c = { ...CP_DEFAULT, ...raw };
  const today = dayKey(new Date());
  if (!c.active) return { msg: 'This code is not active.' };
  if (c.starts && c.starts > today) return { msg: `${c.code} starts on ${fmtDate(c.starts)}.` };
  if (c.ends && c.ends < today) return { msg: `${c.code} has expired.` };
  if (c.limit && c.uses >= c.limit) return { msg: `${c.code} has been fully used.` };
  const email = (cust.email || '').trim().toLowerCase(), phone = (cust.phone || '').replace(/\D/g, '').slice(-10);
  if (c.eligible.length) {
    if (!email && !phone) return { msg: `Enter your email or mobile number above to use ${c.code}.` };
    if (!c.eligible.some((e) => e === email || e === phone)) return { msg: `${c.code} is not available for this email or mobile number.` };
  }
  const mine = db.orders.filter((o) => (email && (o.customer.email || '').toLowerCase() === email) || (phone && o.customer.phone === phone));
  if (c.firstOrder) {
    if (!email && !phone) return { msg: `Enter your email or mobile number above to use ${c.code}.` };
    if (mine.length) return { msg: `${c.code} is only for your first order.` };
  }
  if (c.perCustomer && mine.filter((o) => o.coupon === c.code).length >= c.perCustomer) return { msg: `You have already used ${c.code}.` };
  const elig = lines.filter((l) => (!c.products.length || c.products.includes(l.pid)) && (!c.collections.length || c.collections.includes(l.p.collection)));
  if (!elig.length) return { msg: `${c.code} does not apply to the torans in your cart.` };
  const sub = elig.reduce((a, l) => a + l.p.price * l.qty, 0), qty = elig.reduce((a, l) => a + l.qty, 0);
  if (sub < c.minOrder) return { msg: `Add ${inr(c.minOrder - sub)} more to use ${c.code}.` };
  if (qty < c.minQty) return { msg: `Add ${c.minQty - qty} more toran${c.minQty - qty > 1 ? 's' : ''} to use ${c.code}.` };
  let discount = c.type === 'pct' ? Math.round((sub * c.value) / 100) : c.type === 'flat' ? Math.min(c.value, sub) : 0;
  if (c.type === 'pct' && c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  return { discount, freeShip: c.type === 'freeship' };
}
function couponOff(c) { return c.type === 'pct' ? `${c.value}% off${c.maxDiscount ? ` (up to ${inr(c.maxDiscount)})` : ''}` : c.type === 'flat' ? `${inr(c.value)} off` : 'Free delivery'; }
function couponRules(db, raw) {
  const c = { ...CP_DEFAULT, ...raw }; const r = [];
  if (c.eligible.length) r.push(['brand', `${c.eligible.length} chosen customer${c.eligible.length > 1 ? 's' : ''}`]);
  if (c.firstOrder) r.push(['info', 'First order only']);
  if (c.collections.length) r.push(['neutral', c.collections.join(', ')]);
  if (c.products.length) r.push(['neutral', c.products.length + ' product' + (c.products.length > 1 ? 's' : '')]);
  if (c.minOrder) r.push(['neutral', 'Min ' + inr(c.minOrder)]);
  if (c.minQty) r.push(['neutral', `Min ${c.minQty} torans`]);
  if (c.perCustomer) r.push(['neutral', `${c.perCustomer}× per customer`]);
  const today = dayKey(new Date());
  if (c.ends) r.push([c.ends < today ? 'bad' : 'warn', c.ends < today ? 'Expired' : 'Ends ' + fmtDate(c.ends)]);
  if (c.starts && c.starts > today) r.push(['info', 'Starts ' + fmtDate(c.starts)]);
  if (!c.showAtCheckout) r.push(['neutral', 'Hidden code']);
  return r;
}

function Coupons({ db, update, notify }) {
  const [edit, setEdit] = useState(null);
  return html`<div class="stack" style=${{ gap: '14px' }}>
    <div class="toolbar" style=${{ margin: 0 }}><span class="muted">Limit codes to chosen customers, first orders, collections, dates or usage counts.</span><span class="grow"></span>
      <button class="btn primary" onClick=${() => setEdit('new')}><${Icon} n="plus" /> Create coupon</button></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Discount</th><th>Rules</th><th class="r">Used</th><th>Active</th><th></th></tr></thead>
      <tbody>${db.coupons.map((raw) => { const c = { ...CP_DEFAULT, ...raw }; return html`<tr key=${c.code} class="click" onClick=${() => setEdit(c.code)}>
        <td><b class="mono">${c.code}</b>${c.desc && html`<div class="muted" style=${{ fontSize: '12px' }}>${c.desc}</div>`}</td>
        <td style=${{ whiteSpace: 'nowrap' }}>${couponOff(c)}</td>
        <td><div class="row wrapflex" style=${{ gap: '4px' }}>${couponRules(db, c).map(([k, t], i) => html`<span key=${i} class=${'pill nodot ' + k}>${t}</span>`)}${!couponRules(db, c).length && html`<span class="muted">Everyone</span>`}</div></td>
        <td class="r num">${c.uses}${c.limit ? ' / ' + c.limit : ''}</td>
        <td onClick=${(e) => e.stopPropagation()}><button class=${'switch' + (c.active ? ' on' : '')} aria-label="Active" onClick=${() => update((d) => { const x = d.coupons.find((y) => y.code === c.code); x.active = !x.active; })}></button></td>
        <td><button class="btn sm ghost"><${Icon} n="edit" /></button></td></tr>`; })}</tbody></table></div>
    ${edit && html`<${CouponEditor} db=${db} update=${update} notify=${notify} code=${edit} onClose=${() => setEdit(null)} />`}
  </div>`;
}

function CouponEditor({ db, update, notify, code, onClose }) {
  useEsc(onClose);
  const isNew = code === 'new';
  const [c, setC] = useState(() => isNew ? { ...CP_DEFAULT, code: '' } : { ...CP_DEFAULT, ...structuredClone(db.coupons.find((x) => x.code === code)) });
  const [who, setWho] = useState(() => (c.eligible.length ? 'list' : c.firstOrder ? 'first' : 'all'));
  const [scope, setScope] = useState(() => (c.products.length ? 'products' : c.collections.length ? 'collections' : 'all'));
  const [listText, setListText] = useState(c.eligible.join('\n'));
  const [cq, setCq] = useState('');
  const set = (k, v) => setC({ ...c, [k]: v });
  const eligible = uniq(listText.split(/[\n,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean).map((s) => (/@/.test(s) ? s : s.replace(/\D/g, '').slice(-10))).filter(Boolean));
  const bad = eligible.filter((e) => !(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || /^[6-9]\d{9}$/.test(e)));
  const customers = useMemo(() => {
    const m = {};
    db.orders.forEach((o) => { const k = o.customer.phone; if (!m[k]) m[k] = { name: o.customer.name, email: (o.customer.email || '').toLowerCase(), phone: k, orders: 0, spent: 0 }; m[k].orders++; m[k].spent += o.total; });
    return Object.values(m).sort((a, b) => b.spent - a.spent);
  }, [db.orders]);
  const addCust = (cu) => { const key = cu.email || cu.phone; if (!eligible.includes(key)) setListText((listText.trim() ? listText.trim() + '\n' : '') + key); };
  const toggleIn = (k, v) => set(k, c[k].includes(v) ? c[k].filter((x) => x !== v) : [...c[k], v]);
  const gen = () => set('code', ['KAL', 'TORAN', 'BAPPA', 'SHUBH'][Math.floor(Math.random() * 4)] + Math.random().toString(36).slice(2, 6).toUpperCase());

  const save = () => {
    const cd = c.code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cd) { notify('Enter a coupon code'); return; }
    if ((isNew || cd !== code) && db.coupons.find((x) => x.code === cd)) { notify(`${cd} already exists`); return; }
    if (c.type !== 'freeship' && !(+c.value > 0)) { notify('Enter the discount value'); return; }
    if (c.type === 'pct' && +c.value > 100) { notify('A percentage discount cannot be more than 100'); return; }
    if (who === 'list' && !eligible.length) { notify('Add at least one email or mobile number'); return; }
    if (who === 'list' && bad.length) { notify(`Fix ${bad.length} invalid entr${bad.length > 1 ? 'ies' : 'y'}: ${bad[0]}`); return; }
    if (c.starts && c.ends && c.ends < c.starts) { notify('The end date is before the start date'); return; }
    const nc = { ...c, code: cd, value: +c.value || 0, maxDiscount: +c.maxDiscount || 0, minOrder: +c.minOrder || 0, minQty: +c.minQty || 0, limit: +c.limit || 0, perCustomer: +c.perCustomer || 0,
      eligible: who === 'list' ? eligible : [], firstOrder: who === 'first', products: scope === 'products' ? c.products : [], collections: scope === 'collections' ? c.collections : [] };
    update((d) => { const i = d.coupons.findIndex((x) => x.code === code); if (i >= 0) d.coupons[i] = nc; else d.coupons.unshift(nc); });
    notify(isNew ? `${cd} created` : `${cd} saved`); onClose();
  };
  const del = () => { update((d) => { d.coupons = d.coupons.filter((x) => x.code !== code); }); notify(`${code} deleted`); onClose(); };
  const num = (k, label, ph) => html`<label class="f" htmlFor=${'cp-' + k}>${label}<input id=${'cp-' + k} class="input" type="number" min="0" placeholder=${ph || ''} value=${c[k] || ''} onChange=${(e) => set(k, e.target.value)} /></label>`;
  const radio = (val, cur, setter, label, sub) => html`<button type="button" class=${'paymethod' + (cur === val ? ' on' : '')} onClick=${() => setter(val)}><span class="dot"></span><span class="grow"><b>${label}</b>${sub && html`<br /><span class="muted" style=${{ fontSize: '13px' }}>${sub}</span>`}</span></button>`;
  const shown = customers.filter((cu) => !cq.trim() || (cu.name + cu.email + cu.phone).toLowerCase().includes(cq.trim().toLowerCase())).slice(0, 8);

  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Edit coupon">
    <div class="head"><h3>${isNew ? 'Create coupon' : 'Edit ' + code}</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '16px' }}>
      <div class="grid2">
        <label class="f" htmlFor="cp-code">Coupon code<div class="row"><input id="cp-code" class="input mono" placeholder="DIWALI20" value=${c.code} onChange=${(e) => set('code', e.target.value.toUpperCase())} /><button type="button" class="btn sm" onClick=${gen}>Generate</button></div></label>
        <label class="f" htmlFor="cp-desc">Shown to customers<input id="cp-desc" class="input" placeholder="e.g. 20% off for our regular customers" value=${c.desc} onChange=${(e) => set('desc', e.target.value)} /></label>
      </div>

      <div class="box stack"><h3 style=${{ margin: 0 }}>Discount</h3>
        <div class="row wrapflex">${[['pct', '% off'], ['flat', '₹ off'], ['freeship', 'Free delivery']].map(([k, l]) => html`<button key=${k} type="button" class=${'chip' + (c.type === k ? ' on' : '')} onClick=${() => set('type', k)}>${l}</button>`)}</div>
        ${c.type !== 'freeship' && html`<div class="grid2">${num('value', c.type === 'pct' ? 'Percentage off' : 'Amount off (₹)')}${c.type === 'pct' && num('maxDiscount', 'Maximum discount (₹, optional)', 'No limit')}</div>`}
        <div class="grid2">${num('minOrder', 'Minimum order value (₹)', 'None')}${num('minQty', 'Minimum number of torans', 'None')}</div>
      </div>

      <div class="box stack"><h3 style=${{ margin: 0 }}>Who can use it</h3>
        ${radio('all', who, setWho, 'Everyone', 'Anyone who has the code')}
        ${radio('first', who, setWho, 'First-time customers only', 'Checked against past orders by email and mobile')}
        ${radio('list', who, (v) => { setWho(v); set('showAtCheckout', false); }, 'Only chosen customers', 'Enter emails or mobile numbers. Others see “not available for this account”.')}
        ${who === 'list' && html`<div class="stack" style=${{ gap: '8px' }}>
          <textarea id="cp-list" class="input" rows="4" placeholder=${'One per line, or separated by commas\nsneha@example.com\n9822045671'} value=${listText} onChange=${(e) => setListText(e.target.value)}></textarea>
          <span style=${{ fontSize: '13px', color: bad.length ? 'var(--bad)' : 'var(--ink-2)' }}>${eligible.length} customer${eligible.length === 1 ? '' : 's'}${bad.length ? ` · ${bad.length} invalid: ${bad.slice(0, 3).join(', ')}` : ''}</span>
          <div class="box" style=${{ padding: '10px' }}>
            <input id="cp-cust" class="input" placeholder="Add from your customers: search name, email or mobile" value=${cq} onChange=${(e) => setCq(e.target.value)} />
            <div class="stack" style=${{ gap: '2px', marginTop: '8px' }}>${shown.map((cu) => { const on = eligible.includes(cu.email || cu.phone); return html`<div key=${cu.phone} class="row between" style=${{ fontSize: '13px', padding: '4px 0' }}>
              <span><b>${cu.name}</b> <span class="muted">${cu.email || cu.phone} · ${cu.orders} order${cu.orders > 1 ? 's' : ''} · ${inr(cu.spent)}</span></span>
              <button type="button" class="btn sm" disabled=${on} onClick=${() => addCust(cu)}>${on ? 'Added' : 'Add'}</button></div>`; })}</div>
            <button type="button" class="btn sm" style=${{ marginTop: '6px' }} onClick=${() => { const add = customers.slice(0, 10).map((cu) => cu.email || cu.phone).filter((k) => !eligible.includes(k)); setListText([...eligible, ...add].join('\n')); }}>Add top 10 customers by spend</button>
          </div>
        </div>`}
      </div>

      <div class="box stack"><h3 style=${{ margin: 0 }}>Applies to</h3>
        <div class="row wrapflex">${[['all', 'All products'], ['collections', 'Collections'], ['products', 'Specific products']].map(([k, l]) => html`<button key=${k} type="button" class=${'chip' + (scope === k ? ' on' : '')} onClick=${() => setScope(k)}>${l}</button>`)}</div>
        ${scope === 'collections' && html`<div class="row wrapflex">${uniq(db.products.map((p) => p.collection)).map((co) => html`<label key=${co} class="row" style=${{ gap: '6px' }}><input type="checkbox" checked=${c.collections.includes(co)} onChange=${() => toggleIn('collections', co)} />${co}</label>`)}</div>`}
        ${scope === 'products' && html`<div class="stack" style=${{ gap: '6px' }}>${db.products.map((p) => html`<label key=${p.id} class="row" style=${{ gap: '8px', fontSize: '14px' }}><input type="checkbox" checked=${c.products.includes(p.id)} onChange=${() => toggleIn('products', p.id)} />${p.name} <span class="muted">${inr(p.price)}</span></label>`)}</div>`}
      </div>

      <div class="box stack"><h3 style=${{ margin: 0 }}>Limits and dates</h3>
        <div class="grid2">${num('limit', 'Total uses allowed', 'Unlimited')}${num('perCustomer', 'Uses per customer', 'Unlimited')}</div>
        <div class="grid2">
          <label class="f" htmlFor="cp-start">Starts on<input id="cp-start" class="input" type="date" value=${c.starts} onChange=${(e) => set('starts', e.target.value)} /></label>
          <label class="f" htmlFor="cp-end">Ends on<input id="cp-end" class="input" type="date" value=${c.ends} onChange=${(e) => set('ends', e.target.value)} /></label>
        </div>
        <label class="row" style=${{ gap: '8px', cursor: 'pointer' }}><button type="button" class=${'switch' + (c.showAtCheckout ? ' on' : '')} onClick=${() => set('showAtCheckout', !c.showAtCheckout)} aria-label="Show at checkout"></button>Show this offer at checkout <span class="muted" style=${{ fontSize: '13px' }}>(turn off for private codes)</span></label>
        <label class="row" style=${{ gap: '8px', cursor: 'pointer' }}><button type="button" class=${'switch' + (c.active ? ' on' : '')} onClick=${() => set('active', !c.active)} aria-label="Active"></button>Active</label>
      </div>
    </div>
    <div class="foot"><div class="row wrapflex">${!isNew && html`<${ConfirmBtn} label="Delete" confirm="Click again to delete" onConfirm=${del} />`}
      ${who === 'list' && eligible.length > 0 && html`<button class="btn" onClick=${() => notify(`Code ${c.code || '(new)'} sent to ${eligible.length} customers by email and WhatsApp (demo)`)}>Send code to ${eligible.length}</button>`}
      <span class="grow"></span><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${save}>${isNew ? 'Create coupon' : 'Save coupon'}</button></div></div>
  </aside>`;
}

function Card({ p, rating, low, wished, onOpen, onWish, onAdd }) {
  const stock = stockOf(p);
  const v0 = p.variants.find((v) => v.stock > 0);
  const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  return html`<article class="card">
    <div class="media">
      <button onClick=${onOpen} aria-label=${'View ' + p.name} style=${{ border: 0, padding: 0, width: '100%', height: '100%', background: 'none', display: 'block' }}>
        <img src=${p.images[0]} alt=${p.name} loading="lazy" style=${stock === 0 ? { filter: 'grayscale(.8)', opacity: 0.7 } : null} />
        ${p.images[1] && stock > 0 && html`<img class="alt" src=${p.images[1]} alt="" loading="lazy" />`}
      </button>
      <div class="badges">
        ${p.isNew && html`<span class="badge new">NEW</span>`}
        ${p.bestseller && html`<span class="badge best">BESTSELLER</span>`}
        ${off > 0 && html`<span class="badge sale">${off}% OFF</span>`}
        ${stock === 0 ? html`<span class="badge low">OUT OF STOCK</span>` : stock <= low ? html`<span class="badge low">ONLY ${stock} LEFT</span>` : null}
      </div>
      <button class=${'heart' + (wished ? ' on' : '')} onClick=${onWish} aria-label=${wished ? 'Remove from wishlist' : 'Save to wishlist'}><${Icon} n="heart" fill=${wished} /></button>
    </div>
    <div class="body">
      <button class="title" onClick=${onOpen}>${p.name}</button>
      <span class="mr">${p.mr} · ${p.size}</span>
      <${Stars} v=${rating.avg} n=${rating.n} />
      <div class="price"><b class="num">${inr(p.price)}</b>${off > 0 && html`<s>${inr(p.mrp)}</s><span class="off">${off}% off</span>`}</div>
      ${p.variants.length > 1 && html`<div class="swatches">${p.variants.map((v) => html`<span key=${v.id} class="sw" style=${{ background: v.swatch, opacity: v.stock ? 1 : 0.3 }} title=${v.name}></span>`)}</div>`}
      <div class="add">${p.variants.length > 1
        ? html`<button class="btn block sm" onClick=${onOpen} disabled=${!v0}>${v0 ? 'Choose colour' : 'Out of stock'}</button>`
        : html`<button class="btn block sm primary" disabled=${!v0} onClick=${() => onAdd(p.id, v0.id)}>${v0 ? 'Add to cart' : 'Out of stock'}</button>`}</div>
    </div>
  </article>`;
}

function Values({ db }) {
  return html`<div class="values">
    <div class="value"><${Icon} n="hand" /><div><b>Handmade</b><span>Stitched by hand · हस्तनिर्मित</span></div></div>
    <div class="value"><${Icon} n="drop" /><div><b>Washable</b><span>Wash and reuse every festival</span></div></div>
    <div class="value"><${Icon} n="truck" /><div><b>Delivery across India</b><span>${inr(db.settings.rateMH)} Maharashtra · ${inr(db.settings.rateROI)} rest of India</span></div></div>
    <div class="value"><${Icon} n="shield" /><div><b>Replacement for defects</b><span>Secure online payment</span></div></div>
  </div>`;
}

function Footer({ db }) {
  const s = db.settings;
  return html`<footer class="footer"><div class="wrap cols">
    <div class="stack" style=${{ gap: '6px' }}>
      <div class="logo"><span class="mr">कलाक्षा</span><span class="en"><b>KALAKSHA</b><span>Tradition by Style</span></span></div>
      <span>Handcrafted torans for your home, devghar and car. Thank you for supporting handmade.</span>
    </div>
    <div class="stack" style=${{ gap: '4px' }}><b style=${{ color: 'var(--ink)' }}>Delivery</b>
      <span>Maharashtra ${inr(s.rateMH)} · Rest of India ${inr(s.rateROI)}</span>
      <span>Up to ${s.perParcel} torans ship in one parcel, depending on package size and courier.</span></div>
    <div class="stack" style=${{ gap: '4px' }}><b style=${{ color: 'var(--ink)' }}>Payment policy</b>
      <span>${s.cod ? 'Cash on Delivery available.' : 'Cash on Delivery is not available.'}</span>
      <span>Refunds are not available. Replacement only for product defects.</span></div>
  </div></footer>`;
}

function ProductModal({ db, pid, update, notify, wished, onWish, onClose, onAdd, onBuy }) {
  const p = db.products.find((x) => x.id === pid);
  const [vid, setVid] = useState(() => (p.variants.find((v) => v.stock > 0) || p.variants[0]).id);
  const v = p.variants.find((x) => x.id === vid) || p.variants[0];
  const imgs = uniq([...p.variants.map((x) => x.img), ...p.images].filter(Boolean));
  const [img, setImg] = useState(v.img || p.images[0]);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState('Maharashtra');
  const [form, setForm] = useState({ rating: 0, name: '', text: '' });
  const [writing, setWriting] = useState(false);
  useEsc(onClose);
  useEffect(() => { if (v.img) setImg(v.img); setQty(1); }, [vid]);

  const s = db.settings;
  const revs = db.reviews.filter((r) => r.pid === pid && r.status === 'Published').sort((a, b) => b.date.localeCompare(a.date));
  const avg = revs.length ? revs.reduce((a, r) => a + r.rating, 0) / revs.length : 0;
  const dist = [5, 4, 3, 2, 1].map((k) => [k, revs.filter((r) => r.rating === k).length]);
  const ship = Math.ceil(qty / s.perParcel) * (state === 'Maharashtra' ? s.rateMH : s.rateROI);
  const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;

  const submitReview = (e) => {
    e.preventDefault();
    if (!form.rating || !form.name.trim() || !form.text.trim()) { notify('Add a star rating, your name and a short review'); return; }
    update((d) => { d.reviews.push({ id: 'r' + rid(), pid, name: form.name.trim(), city: '', rating: form.rating, text: form.text.trim(), date: new Date().toISOString(), status: 'Published', sample: false }); });
    setForm({ rating: 0, name: '', text: '' }); setWriting(false); notify('Thanks! Your review is live');
  };

  return html`<div class="scrim" onClick=${onClose}></div>
  <div class="modal" role="dialog" aria-modal="true" aria-label=${p.name}>
    <button class="icon-btn close" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button>
    <div class="pdp">
      <div class="gallery">
        <div class="main"><img src=${img} alt=${p.name + ' ' + v.name} /></div>
        ${imgs.length > 1 && html`<div class="thumbs">${imgs.map((src) => html`<button key=${src} class=${src === img ? 'on' : ''} onClick=${() => setImg(src)}><img src=${src} alt="" /></button>`)}</div>`}
      </div>
      <div class="stack" style=${{ gap: '14px', alignContent: 'start' }}>
        <div class="row wrapflex" style=${{ gap: '6px' }}>
          <span class="pill neutral nodot">${p.collection} collection</span>
          ${p.isNew && html`<span class="pill ok nodot">New</span>`}
          ${p.bestseller && html`<span class="pill warn nodot">Bestseller</span>`}
        </div>
        <div><h2>${p.name}</h2><div class="mr">${p.mr}</div></div>
        <${Stars} v=${avg} n=${revs.length} />
        <div class="price"><b class="num" style=${{ fontSize: '28px' }}>${inr(p.price)}</b>${off > 0 && html`<s>${inr(p.mrp)}</s><span class="off">${off}% off</span>`}<span class="muted" style=${{ fontSize: '13px' }}>per toran</span></div>
        <p class="ink2" style=${{ margin: 0 }}>${p.desc}</p>
        ${p.variants.length > 1 && html`<div class="stack" style=${{ gap: '8px' }}>
          <span class="opt-label">Colour: ${v.name}</span>
          <div class="row wrapflex">${p.variants.map((x) => html`<button key=${x.id} class=${'variant' + (x.id === vid ? ' on' : '')} disabled=${!x.stock} onClick=${() => setVid(x.id)}>
            <span class="sw" style=${{ background: x.swatch }}></span>${x.name}</button>`)}</div></div>`}
        <div class="row wrapflex" style=${{ gap: '14px' }}>
          <div class="stack" style=${{ gap: '6px' }}><span class="opt-label">Quantity</span>
            <div class="stepper"><button onClick=${() => setQty(Math.max(1, qty - 1))} aria-label="Less">−</button><span class="num">${qty}</span><button onClick=${() => setQty(Math.min(v.stock, qty + 1))} aria-label="More">+</button></div></div>
          <div class="stack" style=${{ gap: '6px' }}><span class="opt-label">Size</span><b>${p.size} <span class="muted" style=${{ fontWeight: 400 }}>(${p.sizeNote})</span></b></div>
        </div>
        <div style=${{ fontSize: '13px', fontWeight: 600, color: v.stock === 0 ? 'var(--bad)' : v.stock <= s.lowStock ? 'var(--warn)' : 'var(--ok)' }}>
          ${v.stock === 0 ? 'Out of stock' : v.stock <= s.lowStock ? `Hurry, only ${v.stock} left` : 'In stock, ready to ship'}</div>
        <div class="row wrapflex">
          <button class="btn primary grow" disabled=${!v.stock} onClick=${() => onAdd(vid, qty)}><${Icon} n="bag" /> Add to cart</button>
          <button class="btn dark grow" disabled=${!v.stock} onClick=${() => onBuy(vid, qty)}>Buy now</button>
          <button class=${'icon-btn'} style=${{ border: '1px solid var(--line)', color: wished ? 'var(--kumkum)' : 'inherit' }} onClick=${onWish} aria-label="Wishlist"><${Icon} n="heart" fill=${wished} /></button>
        </div>
        <div class="feat">
          <div><b>Handmade</b>हस्तनिर्मित, made with love</div>
          <div><b>Washable</b>Wash and reuse it every year</div>
          <div><b>${p.size}</b>${p.sizeNote}</div>
          <div><b>For festivals</b>Home décor and gifting</div>
        </div>
        <div class="note">
          <div class="row wrapflex" style=${{ gap: '8px' }}><${Icon} n="truck" /><b>Delivery to</b>
            <select id="pdp-state" class="select" style=${{ width: 'auto', padding: '4px 8px' }} value=${state} onChange=${(e) => setState(e.target.value)}>
              ${STATES.map((x) => html`<option key=${x}>${x}</option>`)}</select>
            <b class="num">${inr(ship)}</b></div>
          <div style=${{ marginTop: '6px' }}>Up to ${s.perParcel} torans ship in one parcel. ${s.cod ? 'Cash on Delivery available.' : 'No Cash on Delivery.'} Replacement for product defects only.</div>
        </div>
      </div>
    </div>
    <div class="reviews">
      <div class="section-head" style=${{ marginTop: '6px' }}><h2 style=${{ fontSize: '24px' }}>Customer reviews</h2>
        <button class="btn sm" onClick=${() => setWriting(!writing)}>${writing ? 'Cancel' : 'Write a review'}</button></div>
      ${writing && html`<form class="panel stack" style=${{ marginBottom: '14px' }} onSubmit=${submitReview}>
        <div class="star-input" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((i) => html`<button type="button" key=${i} class=${i <= form.rating ? 'on' : ''} onClick=${() => setForm({ ...form, rating: i })} aria-label=${i + ' stars'}>★</button>`)}</div>
        <input id="rev-name" class="input" placeholder="Your name" value=${form.name} onChange=${(e) => setForm({ ...form, name: e.target.value })} />
        <textarea id="rev-text" class="input" rows="3" placeholder="How does the toran look at your home?" value=${form.text} onChange=${(e) => setForm({ ...form, text: e.target.value })}></textarea>
        <button class="btn primary" type="submit">Post review</button>
      </form>`}
      ${revs.length ? html`
        <div class="rev-summary">
          <div><div class="big num">${avg.toFixed(1)}</div><${Stars} v=${avg} /><div class="muted" style=${{ fontSize: '13px' }}>${revs.length} reviews</div></div>
          <div class="dist">${dist.map(([k, c]) => html`<div class="r" key=${k}><span>${k}★</span><div class="track"><div class="fill" style=${{ width: (revs.length ? (c / revs.length) * 100 : 0) + '%' }}></div></div><span class="muted num">${c}</span></div>`)}</div>
        </div>
        ${revs.map((r) => html`<div class="review" key=${r.id}>
          <div class="row between"><div class="row" style=${{ gap: '8px' }}><b>${r.name}</b>${r.city && html`<span class="muted">${r.city}</span>`}${r.sample && html`<span class="pill neutral nodot">Sample</span>`}</div><span class="muted" style=${{ fontSize: '13px' }}>${fmtDate(r.date)}</span></div>
          <${Stars} v=${r.rating} /><p style=${{ margin: '4px 0 0' }}>${r.text}</p></div>`)}`
        : html`<p class="muted">No reviews yet. Be the first to review this toran.</p>`}
    </div>
  </div>`;
}

function CartDrawer({ db, lines, update, onClose, onCheckout }) {
  useEsc(onClose);
  const t = calc(db, lines, 'Maharashtra', '');
  const tRoi = calc(db, lines, 'Other', '');
  const setQty = (l, q) => update((d) => {
    const x = d.cart.find((c) => c.pid === l.pid && c.vid === l.vid);
    if (q <= 0) d.cart = d.cart.filter((c) => c !== x); else x.qty = Math.min(q, l.v.stock);
  });
  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Cart">
    <div class="head"><h3>Your cart</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content">
      ${lines.length === 0 ? html`<div class="empty"><${Icon} n="bag" /><p>Your cart is empty.</p><button class="btn primary" onClick=${onClose}>Browse torans</button></div>`
        : lines.map((l) => html`<div class="line" key=${l.pid + l.vid}>
          <img src=${l.v.img || l.p.images[0]} alt="" />
          <div class="stack" style=${{ gap: '4px' }}>
            <b style=${{ lineHeight: 1.25 }}>${l.p.name}</b>
            <span class="muted" style=${{ fontSize: '13px' }}>${l.v.name} · ${l.p.size}</span>
            <div class="stepper" style=${{ width: 'fit-content' }}><button onClick=${() => setQty(l, l.qty - 1)} aria-label="Less">−</button><span class="num">${l.qty}</span><button onClick=${() => setQty(l, l.qty + 1)} aria-label="More">+</button></div>
          </div>
          <div class="stack" style=${{ gap: '4px', justifyItems: 'end' }}><b class="num">${inr(l.p.price * l.qty)}</b>
            <button class="btn ghost sm" onClick=${() => setQty(l, 0)}>Remove</button></div>
        </div>`)}
      ${lines.length > 0 && html`<div class="note" style=${{ marginTop: '14px' }}>
        ${t.qty} toran${t.qty > 1 ? 's' : ''} ship in ${t.parcels} parcel${t.parcels > 1 ? 's' : ''} (up to ${db.settings.perParcel} per parcel).</div>`}
    </div>
    ${lines.length > 0 && html`<div class="foot">
      <div class="sum">
        <div class="r"><span>Subtotal</span><b class="num">${inr(t.subtotal)}</b></div>
        <div class="r"><span>Delivery</span><span class="num">${t.shipping === 0 ? 'Free' : `${inr(t.shipping)} Maharashtra · ${inr(tRoi.shipping)} other states`}</span></div>
      </div>
      <button class="btn primary block" onClick=${onCheckout}>Checkout · ${inr(t.subtotal)}</button>
      <span class="muted" style=${{ fontSize: '12px', textAlign: 'center' }}>Coupons and delivery are applied at checkout</span>
    </div>`}
  </aside>`;
}

function Checkout({ db, update, notify, onBack, onPlaced }) {
  const lines = cartLines(db);
  const [f, setF] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('kalaksha-address')); if (s) return s; } catch (e) {}
    return { name: '', phone: '', email: '', address: '', city: '', pin: '', state: 'Maharashtra' };
  });
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState('');
  const [method, setMethod] = useState('UPI');
  const [errors, setErrors] = useState({});
  const [pay, setPay] = useState(null); // null | 'confirm' | 'processing'
  const t = calc(db, lines, f.state, applied, f);
  const today = dayKey(new Date());
  const offers = db.coupons.map((x) => ({ ...CP_DEFAULT, ...x })).filter((c) => c.active && c.showAtCheckout && (!c.eligible.length || c.eligible.includes((f.email || '').trim().toLowerCase()) || c.eligible.includes(f.phone.replace(/\D/g, '').slice(-10))) && (!c.ends || c.ends >= today) && (!c.starts || c.starts <= today) && (!c.limit || c.uses < c.limit));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!lines.length && !pay) return html`<div class="wrap"><div class="empty"><${Icon} n="bag" /><p>Your cart is empty.</p><button class="btn primary" onClick=${onBack}>Back to shop</button></div></div>`;

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(f.phone.replace(/\D/g, ''))) e.phone = 'Enter a 10-digit mobile number';
    if (f.address.trim().length < 6) e.address = 'Enter your house, street and area';
    if (!f.city.trim()) e.city = 'Enter your city';
    if (!/^\d{6}$/.test(f.pin)) e.pin = 'Enter a 6-digit PIN code';
    setErrors(e); return !Object.keys(e).length;
  };
  const start = () => { if (validate()) setPay('confirm'); else notify('Check the highlighted fields'); };

  const place = () => {
    setPay('processing');
    setTimeout(() => {
      const id = 'KLK-' + db.nextOrder;
      update((d) => {
        const ls = cartLines(d); const tt = calc(d, ls, f.state, applied, f);
        d.orders.unshift({
          id, date: new Date().toISOString(),
          items: ls.map((l) => ({ pid: l.pid, vid: l.vid, name: l.p.name, variant: l.v.name, img: l.v.img || l.p.images[0], price: l.p.price, qty: l.qty })),
          qty: tt.qty, subtotal: tt.subtotal, shipping: tt.shipping, discount: tt.discount, total: tt.total, coupon: tt.discount ? applied : '',
          customer: { ...f, phone: f.phone.replace(/\D/g, '') },
          payment: { method, ref: method === 'COD' ? 'COD' : 'pay_' + rid().toUpperCase(), status: method === 'COD' ? 'Pending' : 'Paid' }, source: 'Website',
          status: 'New', awb: '', mine: true,
        });
        ls.forEach((l) => { const p = d.products.find((x) => x.id === l.pid); const v = p.variants.find((x) => x.id === l.vid); v.stock = Math.max(0, v.stock - l.qty); p.sold += l.qty; });
        const today = dayKey(new Date());
        let h = d.hist.find((x) => x.date === today);
        if (!h) { h = { date: today, orders: 0, revenue: 0 }; d.hist.push(h); if (d.hist.length > 30) d.hist.shift(); }
        h.orders++; h.revenue += tt.total;
        if (tt.discount) { const c = d.coupons.find((c) => c.code === applied); if (c) c.uses++; }
        d.cart = []; d.myOrders.unshift(id); d.nextOrder++;
      });
      try { localStorage.setItem('kalaksha-address', JSON.stringify(f)); } catch (e) {}
      setPay(null); onPlaced(id);
    }, 1400);
  };

  const field = (k, label, props = {}) => html`<label class="f" htmlFor=${'co-' + k}>${label}
    <input id=${'co-' + k} class="input" value=${f[k]} onChange=${set(k)} style=${errors[k] ? { borderColor: 'var(--bad)' } : null} ...${props} />
    ${errors[k] && html`<span style=${{ color: 'var(--bad)', fontWeight: 500 }}>${errors[k]}</span>`}</label>`;

  const methods = [['UPI', 'UPI', 'Google Pay, PhonePe, Paytm or any UPI app'], ['Card', 'Debit / credit card', 'Visa, Mastercard, RuPay'], ['Netbanking', 'Netbanking', 'All major Indian banks']];
  if (db.settings.cod) methods.push(['COD', 'Cash on Delivery', 'Pay when the parcel arrives']);

  return html`<div class="wrap checkout">
    <div class="stack" style=${{ gap: '16px' }}>
      <button class="btn ghost sm" style=${{ width: 'fit-content' }} onClick=${onBack}><${Icon} n="back" /> Back to cart</button>
      <div class="panel"><h3>Delivery address</h3>
        <div class="stack">
          <div class="grid2">${field('name', 'Full name', { autoComplete: 'name' })}${field('phone', 'Mobile number', { inputMode: 'numeric', autoComplete: 'tel', placeholder: '10-digit number' })}</div>
          ${field('email', 'Email (optional)', { type: 'email', autoComplete: 'email' })}
          ${field('address', 'House no., street, area', { autoComplete: 'street-address' })}
          <div class="grid2">${field('city', 'City')}${field('pin', 'PIN code', { inputMode: 'numeric', maxLength: 6 })}</div>
          <label class="f" htmlFor="co-state">State
            <select id="co-state" class="select" value=${f.state} onChange=${set('state')}>${STATES.map((s) => html`<option key=${s}>${s}</option>`)}</select></label>
        </div>
      </div>
      <div class="panel"><h3>Payment</h3>
        <div class="stack" style=${{ gap: '8px' }}>${methods.map(([k, l, sub]) => html`<button key=${k} class=${'paymethod' + (method === k ? ' on' : '')} onClick=${() => setMethod(k)}>
          <span class="dot"></span><span class="grow"><b>${l}</b><br /><span class="muted" style=${{ fontSize: '13px' }}>${sub}</span></span></button>`)}</div>
        <p class="muted" style=${{ fontSize: '12px', marginBottom: 0 }}>Demo checkout. In the live store this opens a secure payment gateway such as Razorpay or Cashfree.</p>
      </div>
    </div>
    <div class="panel stack" style=${{ position: 'sticky', top: '110px' }}>
      <h3>Order summary</h3>
      ${lines.map((l) => html`<div class="row" key=${l.pid + l.vid} style=${{ alignItems: 'flex-start' }}>
        <img src=${l.v.img || l.p.images[0]} alt="" style=${{ width: '52px', height: '52px', borderRadius: '8px', objectFit: 'cover' }} />
        <div class="grow"><b style=${{ fontSize: '14px' }}>${l.p.name}</b><div class="muted" style=${{ fontSize: '13px' }}>${l.v.name} · Qty ${l.qty}</div></div>
        <b class="num">${inr(l.p.price * l.qty)}</b></div>`)}
      <form class="row" onSubmit=${(e) => { e.preventDefault(); setApplied(code.trim().toUpperCase()); }}>
        <input id="co-coupon" class="input" placeholder="Enter coupon code" value=${code} onChange=${(e) => setCode(e.target.value)} />
        <button class="btn" type="submit">Apply</button></form>
      ${offers.length > 0 && html`<div class="stack" style=${{ gap: '6px' }}><span class="opt-label">Available offers</span>${offers.map((c) => html`<button key=${c.code} class="offer" onClick=${() => { setCode(c.code); setApplied(c.code); }}>
        <span class="grow" style=${{ textAlign: 'left' }}><b class="mono">${c.code}</b><br /><span class="muted" style=${{ fontSize: '13px' }}>${c.desc || couponOff(c)}</span></span><span class="apply">${applied === c.code ? 'Applied' : 'Apply'}</span></button>`)}</div>`}
      ${applied && (t.couponMsg ? html`<span style=${{ color: 'var(--bad)', fontSize: '13px' }}>${t.couponMsg}</span>` : html`<span style=${{ color: 'var(--ok)', fontSize: '13px', fontWeight: 600 }}>${applied} applied. You save ${inr(t.discount)}.</span>`)}
      <div class="sum">
        <div class="r"><span>Subtotal (${t.qty} item${t.qty > 1 ? 's' : ''})</span><span class="num">${inr(t.subtotal)}</span></div>
        <div class="r"><span>Delivery · ${f.state === 'Maharashtra' ? 'Maharashtra' : 'Rest of India'} · ${t.parcels} parcel${t.parcels > 1 ? 's' : ''}</span><span class="num">${t.shipping ? inr(t.shipping) : 'Free'}</span></div>
        ${t.discount > 0 && html`<div class="r" style=${{ color: 'var(--ok)' }}><span>Discount</span><span class="num">−${inr(t.discount)}</span></div>`}
        <div class="r total"><span>Total</span><span class="num">${inr(t.total)}</span></div>
      </div>
      <button class="btn primary block" onClick=${start}>${method === 'COD' ? 'Place order' : 'Pay ' + inr(t.total)}</button>
      <span class="muted" style=${{ fontSize: '12px', textAlign: 'center' }}>Refunds are not available. Replacement only for product defects.</span>
    </div>

    ${pay && html`<div class="scrim"></div><div class="modal small" role="dialog" aria-modal="true" aria-label="Payment">
      <div style=${{ padding: '22px' }} class="stack">
        ${pay === 'confirm' ? html`
          <div class="row between"><b>Kalaksha · Secure payment</b><span class="pill neutral nodot">Demo gateway</span></div>
          <div style=${{ fontSize: '32px', fontWeight: 700 }} class="num">${inr(t.total)}</div>
          <div class="muted">Paying by ${method === 'COD' ? 'Cash on Delivery' : method} · Order for ${f.name}</div>
          ${method === 'UPI' && html`<input id="pay-upi" class="input" placeholder="yourname@upi" defaultValue=${f.name ? f.name.split(' ')[0].toLowerCase() + '@okaxis' : ''} />`}
          ${method === 'Card' && html`<div class="grid2"><input id="pay-card" class="input" placeholder="Card number" defaultValue="4111 1111 1111 1111" /><input id="pay-exp" class="input" placeholder="MM/YY" defaultValue="12/29" /></div>`}
          <button class="btn primary block" onClick=${place}>${method === 'COD' ? 'Confirm order' : 'Pay now'}</button>
          <button class="btn ghost block" onClick=${() => setPay(null)}>Cancel</button>
          <span class="muted" style=${{ fontSize: '12px' }}>No real money moves in this demo.</span>`
        : html`<div class="empty" style=${{ padding: '24px 0' }}><div class="spinner" style=${{ width: '36px', height: '36px', margin: '0 auto 12px', border: '3px solid var(--line)', borderTopColor: 'var(--kumkum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div><b>Confirming payment…</b></div>`}
      </div></div>`}
  </div>`;
}

function Timeline({ status }) {
  const idx = status === 'Replacement' ? 3 : status === 'Returned' ? 2 : FLOW.indexOf(status);
  return html`<div class="timeline">${FLOW.map((s, i) => html`<div key=${s} class=${'t' + (i <= idx ? ' done' : '')}>
    <span class="d">${i <= idx ? '✓' : ''}</span><div><b>${STEP_LABEL[s]}</b>${i === idx && status !== 'Replacement' && html`<div class="muted" style=${{ fontSize: '13px' }}>Current status</div>`}</div></div>`)}
    ${status === 'Replacement' && html`<div class="t"><span class="d" style=${{ borderColor: 'var(--bad)' }}>!</span><div><b>Replacement in progress</b></div></div>`}${status === 'Returned' && html`<div class="t"><span class="d" style=${{ borderColor: 'var(--bad)' }}>!</span><div><b>Returned to Kalaksha</b></div></div>`}</div>`;
}

function Success({ db, id, onShop, onTrack }) {
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  return html`<div class="wrap" style=${{ maxWidth: '640px', paddingBlock: '36px' }}>
    <div class="panel stack" style=${{ gap: '14px', textAlign: 'center', justifyItems: 'center' }}>
      <div style=${{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--ok-soft)', color: 'var(--ok)', display: 'grid', placeItems: 'center' }}><${Icon} n="check" /></div>
      <h2 style=${{ fontWeight: 700, fontSize: '28px' }}>Thank you, ${o.customer.name.split(' ')[0]}!</h2>
      <p class="ink2" style=${{ margin: 0 }}>Order <b class="mono">${o.id}</b> is confirmed. We have sent the details to ${o.customer.phone} on WhatsApp (demo).</p>
      <div class="sum" style=${{ width: '100%', textAlign: 'left' }}>
        ${o.items.map((i) => html`<div class="r" key=${i.pid + i.vid}><span>${i.name} · ${i.variant} × ${i.qty}</span><span class="num">${inr(i.price * i.qty)}</span></div>`)}
        <div class="r"><span>Delivery</span><span class="num">${inr(o.shipping)}</span></div>
        ${o.discount > 0 && html`<div class="r"><span>Discount (${o.coupon})</span><span class="num">−${inr(o.discount)}</span></div>`}
        <div class="r total"><span>Paid via ${o.payment.method}</span><span class="num">${inr(o.total)}</span></div>
      </div>
      <div class="row wrapflex" style=${{ justifyContent: 'center' }}><button class="btn primary" onClick=${onTrack}>Track order</button><button class="btn" onClick=${onShop}>Continue shopping</button></div>
      <span class="muted" style=${{ fontSize: '13px' }}>Tip: open the Admin panel to see this order arrive.</span>
    </div></div>`;
}

function MyOrders({ db, onShop }) {
  const [q, setQ] = useState('');
  const mine = db.orders.filter((o) => o.mine);
  const found = q.trim() ? db.orders.find((o) => o.id.toLowerCase() === q.trim().toLowerCase()) : null;
  const shown = found ? [found] : mine;
  return html`<div class="wrap" style=${{ maxWidth: '820px' }}>
    <div class="section-head"><h2>My orders</h2>
      <form class="row" onSubmit=${(e) => e.preventDefault()}><input id="track-id" class="input" placeholder="Track by order ID, e.g. KLK-24510" value=${q} onChange=${(e) => setQ(e.target.value)} style=${{ minWidth: 0 }} /></form></div>
    ${q.trim() && !found && html`<p class="muted">No order found with ID ${q}.</p>`}
    ${shown.length === 0 ? html`<div class="empty"><${Icon} n="box" /><p>You have not placed any orders yet.</p><button class="btn primary" onClick=${onShop}>Shop torans</button></div>`
      : html`<div class="stack" style=${{ gap: '14px', paddingBottom: '20px' }}>${shown.map((o) => html`<div class="panel" key=${o.id}>
        <div class="row between wrapflex"><div><b class="mono">${o.id}</b> <span class="muted">· ${fmtDT(o.date)}</span></div><span class=${'pill ' + STATUS[o.status]}>${o.status}</span></div>
        <div style=${{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '18px', marginTop: '14px' }}>
          <div class="stack" style=${{ gap: '8px' }}>${o.items.map((i) => html`<div class="row" key=${i.pid + i.vid}><img src=${i.img} alt="" style=${{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} /><div class="grow" style=${{ fontSize: '14px' }}><b>${i.name}</b><div class="muted">${i.variant} × ${i.qty}</div></div></div>`)}
            <b class="num">Total ${inr(o.total)}</b>${o.awb && !o.shipment && html`<span class="muted" style=${{ fontSize: '13px' }}>Tracking no. <span class="mono">${o.awb}</span></span>`}</div>
          <div class="stack" style=${{ gap: '10px' }}><${Timeline} status=${o.status} />
            ${o.shipment && html`<div class="note" style=${{ fontSize: '13px' }}>
              <div><b>${o.shipment.courier}</b> · AWB <span class="mono">${o.shipment.awb}</span></div>
              <div style=${{ marginTop: '4px' }}>${o.shipment.status === 'Delivered' ? 'Delivered ' + SHIP.fmtDay(o.shipment.deliveredAt) : 'Expected by ' + SHIP.fmtDay(o.shipment.eta)}</div>
              ${[...o.shipment.events].reverse().slice(0, 3).map((e, i) => html`<div key=${i} style=${{ marginTop: '6px' }}><b>${e.status}</b> · ${e.loc}<span class="muted"> · ${fmtDT(e.at)}</span></div>`)}
            </div>`}</div>
        </div></div>`)}</div>`}
  </div>`;
}

/* ================================================================ ADMIN */
const NAV = [
  ['dash', 'Dashboard', 'dash'], ['orders', 'Orders', 'orders'], ['shipments', 'Shipments', 'truck'], ['home', 'Storefront', 'home'], ['products', 'Products', 'tag'], ['categories', 'Categories', 'layers'], ['inventory', 'Inventory', 'box'],
  ['customers', 'Customers', 'users'], ['txns', 'Transactions', 'card'], ['reviews', 'Reviews', 'chat'], ['coupons', 'Coupons', 'tag'], ['settings', 'Settings', 'gear'],
];

function Admin(ctx) {
  const { db, go, reset } = ctx;
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('kalaksha-tab') || 'dash'; } catch (e) { return 'dash'; } });
  const [orderId, setOrderId] = useState(null);
  const [editPid, setEditPid] = useState(null);
  useEffect(() => { try { sessionStorage.setItem('kalaksha-tab', tab); } catch (e) {} }, [tab]);
  const newCount = db.orders.filter((o) => o.status === 'New').length;
  const lowCount = db.products.reduce((a, p) => a + p.variants.filter((v) => v.stock <= db.settings.lowStock).length, 0);
  const failCount = db.orders.filter((o) => o.shipment && o.shipment.status === 'Delivery failed').length;
  const title = NAV.find((n) => n[0] === tab)[1];
  const props = { ...ctx, setTab, openOrder: setOrderId, editProduct: setEditPid };

  return html`<div class="admin">
    <nav class="side" aria-label="Admin">
      <div class="logo"><span class="mr">कलाक्षा</span><span class="en"><b>KALAKSHA</b><span>Admin</span></span></div>
      ${NAV.map(([k, l, ic]) => html`<button key=${k} class=${'nav' + (tab === k ? ' on' : '')} onClick=${() => setTab(k)}><${Icon} n=${ic} />${l}
        ${k === 'orders' && newCount > 0 && html`<span class="n">${newCount}</span>`}${k === 'inventory' && lowCount > 0 && html`<span class="n">${lowCount}</span>`}${k === 'shipments' && failCount > 0 && html`<span class="n">${failCount}</span>`}</button>`)}
      <div class="bottom">
        <button class="nav" onClick=${() => go('shop')}><${Icon} n="store" />View store</button>
        <button class="nav" onClick=${reset}><${Icon} n="refresh" />Reset demo data</button>
      </div>
    </nav>
    <section class="main">
      <div class="topbar">
        <div><h1>${title}</h1><span class="muted" style=${{ fontSize: '13px' }}>Sample data for the demo · changes save in this browser and show in the store instantly</span></div>
        <div class="row"><button class="btn sm" onClick=${() => go('shop')}><${Icon} n="store" /> View store</button></div>
      </div>
      ${tab === 'dash' && html`<${Dashboard} ...${props} />`}
      ${tab === 'orders' && html`<${Orders} ...${props} />`}
      ${tab === 'shipments' && html`<${Shipments} ...${props} />`}
      ${tab === 'home' && html`<${Storefront} ...${props} />`}
      ${tab === 'categories' && html`<${Categories} ...${props} />`}
      ${tab === 'products' && html`<${Products} ...${props} />`}
      ${tab === 'inventory' && html`<${Inventory} ...${props} />`}
      ${tab === 'customers' && html`<${Customers} ...${props} />`}
      ${tab === 'txns' && html`<${Transactions} ...${props} />`}
      ${tab === 'reviews' && html`<${Reviews} ...${props} />`}
      ${tab === 'coupons' && html`<${Coupons} ...${props} />`}
      ${tab === 'settings' && html`<${Settings} ...${props} />`}
    </section>
    ${orderId && html`<${OrderDrawer} ...${ctx} id=${orderId} onClose=${() => setOrderId(null)} />`}
    ${editPid && html`<${ProductEditor} ...${ctx} pid=${editPid} onClose=${() => setEditPid(null)} />`}
  </div>`;
}

function RevenueChart({ data }) {
  const [hi, setHi] = useState(null);
  const ref = useRef(null);
  const W = 680, H = 230, L = 52, R = 14, T = 14, B = 28;
  const raw = Math.max(...data.map((d) => d.revenue), 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const max = Math.ceil(raw / (mag / 2)) * (mag / 2);
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const line = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.revenue).toFixed(1)).join(' ');
  const area = line + ` L${x(data.length - 1)} ${H - B} L${x(0)} ${H - B} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const move = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    setHi(Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - R)) * (data.length - 1)))));
  };
  const last = data.length - 1;
  const d = hi != null ? data[hi] : null;
  return html`<div class="chart">
    <svg ref=${ref} viewBox=${`0 0 ${W} ${H}`} onMouseMove=${move} onMouseLeave=${() => setHi(null)} role="img" aria-label="Daily revenue for the last 30 days">
      <defs><linearGradient id="rg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--kumkum)" stop-opacity=".22" /><stop offset="1" stop-color="var(--kumkum)" stop-opacity="0" /></linearGradient></defs>
      ${ticks.map((v) => html`<g key=${v}><line class="grid-l" x1=${L} x2=${W - R} y1=${y(v)} y2=${y(v)} /><text class="axis" x=${L - 8} y=${y(v) + 4} textAnchor="end">${inrShort(v)}</text></g>`)}
      ${data.map((dd, i) => (i % 7 === (last % 7)) && html`<text key=${i} class="axis" x=${x(i)} y=${H - 8} textAnchor="middle">${i === last ? 'Today' : fmtDate(dd.date)}</text>`)}
      <path d=${area} fill="url(#rg)" />
      <path d=${line} fill="none" stroke="var(--kumkum)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx=${x(last)} cy=${y(data[last].revenue)} r="5" fill="var(--kumkum)" stroke="var(--surface)" strokeWidth="2" />
      ${d && html`<g><line x1=${x(hi)} x2=${x(hi)} y1=${T} y2=${H - B} stroke="var(--muted)" strokeDasharray="3 3" /><circle cx=${x(hi)} cy=${y(d.revenue)} r="5" fill="var(--kumkum)" stroke="var(--surface)" strokeWidth="2" /></g>`}
      <rect x=${L} y=${T} width=${W - L - R} height=${H - T - B} fill="transparent" />
    </svg>
    ${d && html`<div class="tip" style=${{ left: (x(hi) / W) * 100 + '%', top: (y(d.revenue) / H) * 100 + '%' }}>
      <b>${hi === last ? 'Today so far' : fmtDate(d.date)}</b><br />${inr(d.revenue)} · ${d.orders} orders</div>`}
  </div>`;
}

function Dashboard({ db, setTab, openOrder }) {
  const h = db.hist;
  const today = h[h.length - 1] || { orders: 0, revenue: 0 };
  const rev30 = h.reduce((a, d) => a + d.revenue, 0), ord30 = h.reduce((a, d) => a + d.orders, 0);
  const first = h.slice(0, 15).reduce((a, d) => a + d.revenue, 0), second = h.slice(15).reduce((a, d) => a + d.revenue, 0);
  const growth = first ? ((second - first) / first) * 100 : 0;
  const toShip = db.orders.filter((o) => o.status === 'New' || o.status === 'Packed');
  const lowV = [];
  db.products.forEach((p) => p.variants.forEach((v) => { if (v.stock <= db.settings.lowStock) lowV.push({ p, v }); }));
  const statusCounts = Object.keys(STATUS).map((s) => [s, db.orders.filter((o) => o.status === s).length]);
  const maxS = Math.max(...statusCounts.map((x) => x[1]), 1);
  const top = [...db.products].sort((a, b) => b.sold - a.sold);
  const maxSold = Math.max(...top.map((p) => p.sold), 1);
  const fee = gatewayRate(db.settings) * gatewayShare(db.orders);
  const chans = CHANNELS.map((c) => [c, db.orders.filter((o) => chanOf(o) === c).length]).filter((x) => x[1]);
  const unpaid = db.orders.filter((o) => o.payment.status !== 'Paid').length;

  return html`<div>
    <div class="kpis">
      <div class="kpi"><span class="l">Revenue today</span><span class="v">${inr(today.revenue)}</span><span class="s">${today.orders} orders so far</span></div>
      <div class="kpi"><span class="l">Revenue · 30 days</span><span class="v">${inrShort(rev30)}</span><span class="s"><span class=${growth >= 0 ? 'up' : 'down'}>${growth >= 0 ? '▲' : '▼'} ${Math.abs(growth).toFixed(1)}%</span> vs previous 15 days</span></div>
      <div class="kpi"><span class="l">Orders · 30 days</span><span class="v num">${ord30.toLocaleString('en-IN')}</span><span class="s">${Math.round(ord30 / h.length)} per day on average</span></div>
      <div class="kpi"><span class="l">Avg order value</span><span class="v">${inr(rev30 / Math.max(1, ord30))}</span><span class="s">Gateway fees ≈ ${inrShort(rev30 * fee)}</span></div>
      <div class="kpi" style=${{ cursor: 'pointer' }} onClick=${() => setTab('orders')}><span class="l">To ship</span><span class="v num">${toShip.length}</span><span class="s">${toShip.filter((o) => o.status === 'New').length} new · ${toShip.filter((o) => o.status === 'Packed').length} packed</span></div>
    </div>
    <div class="cols2">
      <div class="box"><h3>Daily revenue · last 30 days <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>Hover for details</span></h3><${RevenueChart} data=${h} /></div>
      <div class="box"><h3>Order status <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>Latest ${db.orders.length} orders</span></h3>
        <div class="bars">${statusCounts.map(([s, c]) => html`<div class="r" key=${s}><span class=${'pill ' + STATUS[s]} style=${{ width: 'fit-content' }}>${s}</span>
          <div class="track"><div class="fill" style=${{ width: (c / maxS) * 100 + '%', background: 'var(--' + ({ info: 'info', warn: 'warn', brand: 'kumkum', ok: 'ok', bad: 'bad' })[STATUS[s]] + ')' }}></div></div><b class="num" style=${{ textAlign: 'right' }}>${c}</b></div>`)}</div>
        <h3 style=${{ marginTop: '20px' }}>Sales channels <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>${unpaid} awaiting payment</span></h3>
        <div class="bars">${chans.map(([c, n]) => html`<div class="r" key=${c}><span class=${'pill nodot ' + chanPill(c)} style=${{ width: 'fit-content' }}>${c}</span>
          <div class="track"><div class="fill" style=${{ width: (n / db.orders.length) * 100 + '%', background: c === 'WhatsApp' ? 'var(--ok)' : 'var(--ink)' }}></div></div><b class="num" style=${{ textAlign: 'right' }}>${Math.round((n / db.orders.length) * 100)}%</b></div>`)}</div>
        <h3 style=${{ marginTop: '20px' }}>Low stock <button class="btn sm" onClick=${() => setTab('inventory')}>Restock</button></h3>
        ${lowV.length ? html`<div class="stack" style=${{ gap: '6px' }}>${lowV.map(({ p, v }) => html`<div class="row between" key=${p.id + v.id} style=${{ fontSize: '14px' }}><span>${p.name} <span class="muted">· ${v.name}</span></span><span class=${'pill ' + (v.stock === 0 ? 'bad' : 'warn')}>${v.stock === 0 ? 'Out' : v.stock + ' left'}</span></div>`)}</div>`
          : html`<span class="muted">All products are well stocked.</span>`}
      </div>
    </div>
    <div class="cols2">
      <div class="box" style=${{ padding: 0 }}>
        <h3 style=${{ padding: '16px 16px 0' }}>Recent orders <button class="btn sm" onClick=${() => setTab('orders')}>View all</button></h3>
        <div style=${{ overflowX: 'auto' }}><${OrderTable} orders=${db.orders.slice(0, 8)} onOpen=${openOrder} compact /></div>
      </div>
      <div class="box"><h3>Best sellers <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>Units sold</span></h3>
        <div class="bars">${top.map((p) => html`<div class="r" key=${p.id} style=${{ gridTemplateColumns: '1fr 1fr 52px' }}><span style=${{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>${p.name}</span>
          <div class="track"><div class="fill" style=${{ width: (p.sold / maxSold) * 100 + '%' }}></div></div><b class="num" style=${{ textAlign: 'right' }}>${p.sold.toLocaleString('en-IN')}</b></div>`)}</div>
      </div>
    </div>
  </div>`;
}

function OrderTable({ orders, onOpen, compact, sel, setSel }) {
  const all = sel && orders.length > 0 && orders.every((o) => sel.includes(o.id));
  return html`<table>
    <thead><tr>
      ${sel && html`<th><input type="checkbox" aria-label="Select all" checked=${all} onChange=${() => setSel(all ? [] : orders.map((o) => o.id))} /></th>`}
      <th>Order</th><th>Date</th><th>Customer</th>${!compact && html`<th>Channel</th><th>Items</th>`}<th class="r">Total</th>${!compact && html`<th>Payment</th>`}<th>Status</th>
    </tr></thead>
    <tbody>${orders.map((o) => html`<tr key=${o.id} class="click" onClick=${() => onOpen(o.id)}>
      ${sel && html`<td onClick=${(e) => e.stopPropagation()}><input type="checkbox" aria-label=${'Select ' + o.id} checked=${sel.includes(o.id)} onChange=${() => setSel(sel.includes(o.id) ? sel.filter((x) => x !== o.id) : [...sel, o.id])} /></td>`}
      <td><span class="mono">${o.id}</span>${o.mine && html` <span class="pill brand nodot" title="Placed from the demo store">Live</span>`}</td>
      <td class="muted" style=${{ whiteSpace: 'nowrap' }}>${fmtDT(o.date)}</td>
      <td style=${{ whiteSpace: 'nowrap' }}>${o.customer.name}<div class="muted" style=${{ fontSize: '12px' }}>${o.customer.city}, ${o.customer.state}</div></td>
      ${!compact && html`<td><span class=${'pill nodot ' + chanPill(chanOf(o))}>${chanOf(o)}</span></td>`}
      ${!compact && html`<td style=${{ fontSize: '13px' }}>${o.items.map((i) => `${i.name.replace(' Toran', '')} (${i.variant}) ×${i.qty}`).join(', ')}</td>`}
      <td class="r num"><b>${inr(o.total)}</b></td>
      ${!compact && html`<td style=${{ whiteSpace: 'nowrap' }}>${o.payment.method}${o.payment.status !== 'Paid' && html` <span class="pill warn">Unpaid</span>`}</td>`}
      <td><span class=${'pill ' + STATUS[o.status]}>${o.status}</span></td>
    </tr>`)}</tbody></table>`;
}

/* ---------- create an order from admin (WhatsApp, phone, import) ---------- */
function createOrder(d, { items, customer, source, payment, date, shipping }) {
  const ls = items.map((i) => {
    const p = d.products.find((x) => x.id === i.pid); const v = p && p.variants.find((x) => x.id === i.vid);
    return p && v ? { ...i, qty: Math.max(1, +i.qty || 1), p, v } : null;
  }).filter(Boolean);
  const t = calc(d, ls, customer.state, '');
  const ship = shipping === false ? 0 : t.shipping;
  const id = 'KLK-' + d.nextOrder++;
  d.orders.unshift({
    id, date: date || new Date().toISOString(),
    items: ls.map((l) => ({ pid: l.pid, vid: l.vid, name: l.p.name, variant: l.v.name, img: l.v.img || l.p.images[0], price: l.p.price, qty: l.qty })),
    qty: t.qty, subtotal: t.subtotal, shipping: ship, discount: 0, total: t.subtotal + ship, coupon: '',
    customer, payment, source, status: 'New', awb: '', manual: true,
  });
  ls.forEach((l) => { l.v.stock = Math.max(0, l.v.stock - l.qty); l.p.sold += l.qty; });
  const h = d.hist.find((x) => x.date === dayKey(new Date(date || Date.now())));
  if (h) { h.orders++; h.revenue += t.subtotal + ship; }
  return id;
}

/* ---------- read a WhatsApp message into an order ---------- */
const CITY_STATE = {
  pune: 'Maharashtra', mumbai: 'Maharashtra', 'navi mumbai': 'Maharashtra', thane: 'Maharashtra', nashik: 'Maharashtra', nagpur: 'Maharashtra', kolhapur: 'Maharashtra',
  aurangabad: 'Maharashtra', satara: 'Maharashtra', sangli: 'Maharashtra', solapur: 'Maharashtra', ahmednagar: 'Maharashtra', jalgaon: 'Maharashtra', ratnagiri: 'Maharashtra',
  bengaluru: 'Karnataka', bangalore: 'Karnataka', belgaum: 'Karnataka', hyderabad: 'Telangana', ahmedabad: 'Gujarat', surat: 'Gujarat', vadodara: 'Gujarat',
  indore: 'Madhya Pradesh', bhopal: 'Madhya Pradesh', panaji: 'Goa', margao: 'Goa', delhi: 'Delhi', chennai: 'Tamil Nadu', kolkata: 'West Bengal', jaipur: 'Rajasthan',
};
const RX = {
  swami: /swami|swamy|स्वामी/i, ganapati: /gan[a]?pat[iy]|ganesh|bappa|गणपती|गणपति|गणेश/i, devi: /devi|देवी/i,
  car: /\bcar\b|कार|गाडी/i, devghar: /dev\s?ghar|deoghar|mandir|temple|देवघर|देव्हारा/i,
};
const COLOURS = [['yellow', /yellow|पिवळ/i], ['blue', /blue|निळ/i], ['green', /green|हिरव/i]];

function parseWhatsApp(text, products) {
  const out = { customer: {}, items: [], utr: '', found: [] };
  const t = text.replace(/\r/g, '');
  const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
  const low = t.toLowerCase();
  const utr = t.match(/\b(\d{12})\b/);
  if (utr) { out.utr = utr[1]; out.found.push('UPI reference'); }
  const phone = t.replace(/\b\d{12}\b/g, '').match(/(?:\+?91[\s-]?)?([6-9]\d{4}[\s-]?\d{5})\b/);
  if (phone) { out.customer.phone = phone[1].replace(/\D/g, ''); out.found.push('mobile'); }
  const pin = t.replace(/\b\d{12}\b/g, '').replace(/[6-9]\d{4}[\s-]?\d{5}/g, '').match(/\b([1-8]\d{5})\b/);
  if (pin) { out.customer.pin = pin[1]; out.found.push('PIN'); }
  const city = Object.keys(CITY_STATE).sort((a, b) => b.length - a.length).find((c) => new RegExp('\\b' + c + '\\b', 'i').test(low));
  if (city) { out.customer.city = city.replace(/\b\w/g, (m) => m.toUpperCase()); out.found.push('city'); }
  const state = STATES.find((s) => low.includes(s.toLowerCase())) || (/\bmh\b|महाराष्ट्र/i.test(t) ? 'Maharashtra' : '') || (city ? CITY_STATE[city] : '');
  if (state) { out.customer.state = state; out.found.push('state'); }
  const email = t.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  if (email) out.customer.email = email[0];

  const isProduct = (l) => RX.swami.test(l) || RX.ganapati.test(l) || RX.devi.test(l);
  const labelled = (rx) => { for (const l of lines) { const m = l.match(rx); if (m && m[1].trim()) return m[1].trim(); } return ''; };
  let name = labelled(/^(?:name|नाव)\s*[:\-–]\s*(.+)$/i);
  if (!name) name = lines.find((l) => !/\d/.test(l) && !isProduct(l) && l.length < 40 && !/^(hi|hello|namaskar|namaste|नमस्कार|order|i want|mala|please|thanks|thank you)/i.test(l) && !/[@:]/.test(l) && l.split(/\s+/).length <= 4) || '';
  if (name) { out.customer.name = name.replace(/[^\p{L}\s.'-]/gu, '').trim(); out.found.push('name'); }
  let addr = labelled(/^(?:address|addr|पत्ता)\s*[:\-–]\s*(.+)$/i);
  if (!addr) addr = lines.filter((l) => l.includes(',') && !isProduct(l) && !/paid|utr|gpay|phonepe|upi/i.test(l)).sort((a, b) => b.length - a.length)[0] || '';
  if (addr) { out.customer.address = addr; out.found.push('address'); }

  lines.filter(isProduct).forEach((l) => {
    const coll = RX.swami.test(l) ? 'swami' : RX.ganapati.test(l) ? 'ganapati' : 'devi';
    const type = RX.car.test(l) ? 'car' : RX.devghar.test(l) ? 'devghar' : 'door';
    const p = products.find((x) => x.id === coll + '-' + type) || products.find((x) => x.id === coll + '-door');
    if (!p) return;
    const col = COLOURS.find(([, rx]) => rx.test(l));
    const v = (col && p.variants.find((x) => x.name.toLowerCase().includes(col[0]))) || p.variants[0];
    const q = l.match(/^\s*(\d{1,2})\s*(?:x|nos?|pcs?|qty)?\b/i) || l.match(/(?:x|qty|nos?|pcs?)\s*[:\-]?\s*(\d{1,2})\b/i) || l.match(/\b(\d{1,2})\s*(?:nos?|pcs?|piece|toran)/i);
    const qty = q ? Math.max(1, +q[1]) : 1;
    const ex = out.items.find((i) => i.pid === p.id && i.vid === v.id);
    if (ex) ex.qty += qty; else out.items.push({ pid: p.id, vid: v.id, qty });
  });
  if (out.items.length) out.found.push(out.items.length + ' product' + (out.items.length > 1 ? 's' : ''));
  return out;
}

const SAMPLE_MSG = `Namaskar 🙏 I want to order
2 Ganapati door toran blue
1 Swami devghar toran
Name: Sneha Kulkarni
Address: Flat 302, Sai Residency, Karve Nagar
Pune 411052
Mobile 98220 45671
Paid ₹1010 on GPay, UTR 412398765432`;

/* ---------- CSV ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
const CSV_HEAD = ['order_ref', 'date', 'customer_name', 'phone', 'email', 'address', 'city', 'state', 'pin', 'product', 'colour', 'qty', 'payment_status', 'utr', 'source'];
function sampleCSV() {
  const d = dayKey(new Date());
  return [CSV_HEAD.join(','),
    `WA-101,${d},Meera Apte,9822011223,meera@example.com,"14, Shivaji Park",Mumbai,Maharashtra,400028,Ganapati Door Toran,Green,1,Paid,412398700011,WhatsApp`,
    `WA-101,${d},Meera Apte,9822011223,meera@example.com,"14, Shivaji Park",Mumbai,Maharashtra,400028,Swami Devghar Toran,,1,Paid,412398700011,WhatsApp`,
    `WA-102,${d},Kiran Reddy,9849012345,,"8-2-120, Banjara Hills",Hyderabad,Telangana,500034,Swami Car Toran,,1,Pending,,WhatsApp`,
    `WA-103,${d},Ashwini Pawar,9767012345,,"Plot 5, Rajarampuri",Kolhapur,Maharashtra,416008,Devi Door Toran,,2,Paid,412398700099,Instagram`,
    `WA-104,${d},Test Row,12345,,Somewhere,Pune,Maharashtra,411001,Lakshmi Toran,,1,Paid,,WhatsApp`,
  ].join('\n');
}
function csvToOrders(text, db) {
  const rows = parseCSV(text);
  if (!rows.length) return { error: 'The file is empty.' };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const miss = ['customer_name', 'phone', 'product'].filter((h) => !head.includes(h));
  if (miss.length) return { error: 'Missing columns: ' + miss.join(', ') + '. Use the template.' };
  const get = (r, k) => (r[head.indexOf(k)] || '').trim();
  const groups = new Map();
  rows.slice(1).forEach((r, i) => {
    const key = get(r, 'order_ref') || get(r, 'phone') + '|' + get(r, 'date') || 'row' + i;
    if (!groups.has(key)) groups.set(key, { ref: get(r, 'order_ref') || '—', rows: [] });
    groups.get(key).rows.push({ r, line: i + 2 });
  });
  const orders = [...groups.values()].map((g) => {
    const f = g.rows[0].r; const errors = [];
    const phone = get(f, 'phone').replace(/\D/g, '').slice(-10);
    const state = STATES.find((s) => s.toLowerCase() === get(f, 'state').toLowerCase()) || (get(f, 'state') ? '' : 'Maharashtra');
    const customer = { name: get(f, 'customer_name'), phone, email: get(f, 'email'), address: get(f, 'address'), city: get(f, 'city'), state, pin: get(f, 'pin') };
    if (!customer.name) errors.push('Name missing');
    if (!/^[6-9]\d{9}$/.test(phone)) errors.push('Mobile number is not 10 digits');
    if (!state) errors.push(`Unknown state “${get(f, 'state')}”`);
    const items = [];
    g.rows.forEach(({ r, line }) => {
      const pn = get(r, 'product').toLowerCase();
      const p = db.products.find((x) => x.name.toLowerCase() === pn || x.id === pn);
      if (!p) { errors.push(`Row ${line}: product “${get(r, 'product')}” not found`); return; }
      const cn = get(r, 'colour').toLowerCase();
      const v = cn ? p.variants.find((x) => x.name.toLowerCase() === cn || x.name.toLowerCase().startsWith(cn)) : p.variants.length === 1 ? p.variants[0] : null;
      if (!v) { errors.push(`Row ${line}: choose a colour for ${p.name} (${p.variants.map((x) => x.name).join(', ')})`); return; }
      const qty = Math.max(1, parseInt(get(r, 'qty'), 10) || 1);
      if (qty > v.stock) errors.push(`Row ${line}: only ${v.stock} ${p.name} (${v.name}) in stock`);
      items.push({ pid: p.id, vid: v.id, qty, label: `${p.name}${p.variants.length > 1 ? ' (' + v.name + ')' : ''} ×${qty}`, price: p.price });
    });
    const ds = get(f, 'date'); let date = new Date();
    const m1 = ds.match(/^(\d{4})-(\d{2})-(\d{2})$/), m2 = ds.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m1) date = new Date(+m1[1], +m1[2] - 1, +m1[3], 12); else if (m2) date = new Date(+m2[3], +m2[2] - 1, +m2[1], 12);
    if (dayKey(date) === dayKey(new Date())) date = new Date();
    const paid = /paid|yes|done|received/i.test(get(f, 'payment_status'));
    const utr = get(f, 'utr');
    const src = CHANNELS.find((c) => c.toLowerCase() === get(f, 'source').toLowerCase()) || 'WhatsApp';
    return { ref: g.ref, customer, items, errors, date: date.toISOString(), source: src,
      payment: { method: 'UPI direct', ref: utr ? 'UTR ' + utr : '', status: paid ? 'Paid' : 'Pending' } };
  });
  return { orders };
}

/* ---------- Orders page ---------- */
function Orders({ db, update, notify, openOrder }) {
  const [q, setQ] = useState('');
  const [st, setSt] = useState('All');
  const [ch, setCh] = useState('All');
  const [sel, setSel] = useState([]);
  const [limit, setLimit] = useState(40);
  const [drawer, setDrawer] = useState(null);
  const [shipIds, setShipIds] = useState(null);
  const t = q.trim().toLowerCase();
  const list = db.orders.filter((o) => (st === 'All' || (st === 'Unpaid' ? o.payment.status !== 'Paid' : o.status === st)) && (ch === 'All' || chanOf(o) === ch) &&
    (!t || (o.id + ' ' + o.customer.name + ' ' + o.customer.phone + ' ' + o.customer.city).toLowerCase().includes(t)));
  const unpaid = db.orders.filter((o) => o.payment.status !== 'Paid').length;
  const bulk = (to) => {
    if (to === 'Shipped') { setShipIds(sel); setSel([]); return; }
    const auto = to === 'Packed' && shipCfg(db).autoShip;
    update((d) => { d.orders.forEach((o) => { if (sel.includes(o.id)) o.status = to; }); if (to === 'Packed') autoShipIds(d, sel); });
    notify(`Marked ${sel.length} orders as ${to}${auto ? ' · shipments created automatically' : ''}`);
    setSel([]);
  };
  return html`<div>
    <div class="toolbar">
      <input id="ord-search" class="input" placeholder="Search order ID, name, phone, city" value=${q} onChange=${(e) => setQ(e.target.value)} />
      <select id="ord-ch" class="select" value=${ch} onChange=${(e) => { setCh(e.target.value); setSel([]); }}>
        <option value="All">All channels</option>${CHANNELS.map((c) => html`<option key=${c} value=${c}>${c} (${db.orders.filter((o) => chanOf(o) === c).length})</option>`)}</select>
      <span class="grow"></span>
      <button class="btn" onClick=${() => setDrawer('import')}><${Icon} n="upload" /> Import orders</button>
      <button class="btn primary" onClick=${() => setDrawer('add')}><${Icon} n="plus" /> Add WhatsApp order</button>
    </div>
    <div class="toolbar">
      ${['All', ...Object.keys(STATUS), 'Unpaid'].map((s) => html`<button key=${s} class=${'chip' + (st === s ? ' on' : '')} onClick=${() => { setSt(s); setSel([]); }}>${s} <span class="muted">${s === 'All' ? db.orders.length : s === 'Unpaid' ? unpaid : db.orders.filter((o) => o.status === s).length}</span></button>`)}
    </div>
    ${sel.length > 0 && html`<div class="bulkbar"><b>${sel.length} selected</b><span class="grow"></span>
      <button class="btn sm" onClick=${() => bulk('Packed')}>Mark packed</button>
      <button class="btn sm" onClick=${() => bulk('Shipped')}><${Icon} n="truck" /> Create shipments</button>
      <button class="btn sm" onClick=${() => bulk('Delivered')}>Mark delivered</button>
      <button class="btn sm" onClick=${() => setSel([])}>Clear</button></div>`}
    <div class="table-wrap"><${OrderTable} orders=${list.slice(0, limit)} onOpen=${openOrder} sel=${sel} setSel=${setSel} /></div>
    ${list.length > limit && html`<div style=${{ textAlign: 'center', marginTop: '12px' }}><button class="btn" onClick=${() => setLimit(limit + 40)}>Show more (${list.length - limit} left)</button></div>`}
    ${!list.length && html`<div class="empty">No orders match these filters.</div>`}
    ${drawer === 'add' && html`<${AddOrderDrawer} db=${db} update=${update} notify=${notify} onClose=${() => setDrawer(null)} onDone=${(id) => { setDrawer(null); openOrder(id); }} />`}
    ${drawer === 'import' && html`<${ImportDrawer} db=${db} update=${update} notify=${notify} onClose=${() => setDrawer(null)} />`}
    ${shipIds && html`<${ShipDialog} db=${db} update=${update} notify=${notify} ids=${shipIds} onClose=${() => setShipIds(null)} />`}
  </div>`;
}

function AddOrderDrawer({ db, update, notify, onClose, onDone }) {
  useEsc(onClose);
  const active = db.products.filter((p) => p.active);
  const [msg, setMsg] = useState('');
  const [c, setC] = useState({ name: '', phone: '', email: '', address: '', city: '', pin: '', state: 'Maharashtra' });
  const [items, setItems] = useState([{ pid: active[0] && active[0].id, vid: active[0] && active[0].variants[0].id, qty: 1 }]);
  const [source, setSource] = useState('WhatsApp');
  const [pay, setPay] = useState({ status: 'Paid', method: 'UPI direct', ref: '' });
  const [ship, setShip] = useState(true);
  const [sendMsg, setSendMsg] = useState(true);
  const [found, setFound] = useState(null);
  const [errs, setErrs] = useState({});
  const lines = items.map((i) => { const p = db.products.find((x) => x.id === i.pid); const v = p && p.variants.find((x) => x.id === i.vid); return p && v ? { ...i, qty: Math.max(1, +i.qty || 1), p, v } : null; }).filter(Boolean);
  const t = calc(db, lines, c.state, '');
  const shipping = ship ? t.shipping : 0;

  const fill = (text) => {
    if (!text.trim()) { notify('Paste the customer’s WhatsApp message first'); return; }
    const r = parseWhatsApp(text, db.products);
    setC((cur) => ({ ...cur, ...Object.fromEntries(Object.entries(r.customer).filter(([, v]) => v)) }));
    if (r.items.length) setItems(r.items);
    if (r.utr) setPay((p) => ({ ...p, ref: 'UTR ' + r.utr, status: 'Paid' }));
    else if (r.items.length) setPay((p) => ({ ...p, status: 'Pending' }));
    setFound(r.found); setErrs({});
  };
  const setItem = (i, k, v) => setItems(items.map((x, j) => (j !== i ? x : k === 'pid' ? { pid: v, vid: db.products.find((p) => p.id === v).variants[0].id, qty: x.qty } : { ...x, [k]: v })));
  const setF = (k) => (e) => setC({ ...c, [k]: e.target.value });

  const save = () => {
    const e = {};
    if (!c.name.trim()) e.name = 'Enter the customer’s name';
    if (!/^[6-9]\d{9}$/.test(c.phone.replace(/\D/g, '').slice(-10))) e.phone = 'Enter a 10-digit mobile number';
    if (!lines.length) e.items = 'Add at least one product';
    const over = lines.find((l) => lines.filter((x) => x.pid === l.pid && x.vid === l.vid).reduce((a, x) => a + x.qty, 0) > l.v.stock);
    if (over) e.items = `Only ${over.v.stock} ${over.p.name} (${over.v.name}) in stock`;
    setErrs(e);
    if (Object.keys(e).length) { notify(Object.values(e)[0]); return; }
    const id = 'KLK-' + db.nextOrder;
    update((d) => createOrder(d, { items: lines.map((l) => ({ pid: l.pid, vid: l.vid, qty: l.qty })), customer: { ...c, phone: c.phone.replace(/\D/g, '').slice(-10) }, source, payment: pay, shipping: ship }));
    notify(`${id} added${sendMsg ? ` · confirmation sent to ${c.phone} on WhatsApp (demo)` : ''}`);
    onDone(id);
  };
  const field = (k, label, props = {}) => html`<label class="f" htmlFor=${'ao-' + k}>${label}<input id=${'ao-' + k} class="input" value=${c[k]} onChange=${setF(k)} style=${errs[k] ? { borderColor: 'var(--bad)' } : null} ...${props} /></label>`;

  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Add order">
    <div class="head"><h3>Add WhatsApp order</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '16px' }}>
      <div class="box stack" style=${{ background: 'var(--ok-soft)', borderColor: 'transparent' }}>
        <b>Paste the customer’s WhatsApp message</b>
        <span class="ink2" style=${{ fontSize: '13px', marginTop: '-6px' }}>We pick out the name, mobile, address, PIN, state, torans, colours, quantity and UPI reference. Check the form, then save.</span>
        <textarea id="ao-msg" class="input" rows="6" placeholder=${'e.g.\n2 Ganapati door toran blue\nName: Sneha Kulkarni\nAddress: Flat 302, Sai Residency, Karve Nagar\nPune 411052 · 98220 45671'} value=${msg} onChange=${(e) => setMsg(e.target.value)}></textarea>
        <div class="row wrapflex">
          <button class="btn primary" onClick=${() => fill(msg)}>Fill form from message</button>
          <button class="btn" onClick=${() => { setMsg(SAMPLE_MSG); fill(SAMPLE_MSG); }}>Try a sample message</button>
        </div>
        ${found && html`<span style=${{ fontSize: '13px', fontWeight: 600, color: found.length ? 'var(--ok)' : 'var(--warn)' }}>${found.length ? 'Found: ' + found.join(', ') + '. Check the details below.' : 'Could not read details from this message. Fill the form by hand.'}</span>`}
      </div>

      <div class="grid2">
        <label class="f" htmlFor="ao-source">Order came from<select id="ao-source" class="select" value=${source} onChange=${(e) => setSource(e.target.value)}>${CHANNELS.filter((x) => x !== 'Website').map((x) => html`<option key=${x}>${x}</option>`)}</select></label>
        ${field('phone', 'Mobile number', { inputMode: 'numeric', placeholder: '10-digit number' })}
      </div>
      <div class="grid2">${field('name', 'Customer name')}${field('email', 'Email (optional)')}</div>
      ${field('address', 'House no., street, area')}
      <div class="grid2">${field('city', 'City')}${field('pin', 'PIN code', { inputMode: 'numeric', maxLength: 6 })}</div>
      <label class="f" htmlFor="ao-state">State<select id="ao-state" class="select" value=${c.state} onChange=${setF('state')}>${STATES.map((s) => html`<option key=${s}>${s}</option>`)}</select></label>

      <div class="stack" style=${{ gap: '8px' }}>
        <div class="row between"><span class="opt-label">Products</span><button class="btn sm" onClick=${() => setItems([...items, { pid: active[0].id, vid: active[0].variants[0].id, qty: 1 }])}><${Icon} n="plus" /> Add product</button></div>
        ${items.map((it, i) => { const p = db.products.find((x) => x.id === it.pid); return html`<div key=${i} class="row wrapflex" style=${{ background: 'var(--surface)', border: '1px solid ' + (errs.items ? 'var(--bad)' : 'var(--line)'), borderRadius: '8px', padding: '8px' }}>
          <select class="select grow" aria-label="Product" value=${it.pid} onChange=${(e) => setItem(i, 'pid', e.target.value)}>${active.map((x) => html`<option key=${x.id} value=${x.id}>${x.name} · ${inr(x.price)}</option>`)}</select>
          <select class="select" aria-label="Colour" style=${{ width: 'auto' }} value=${it.vid} onChange=${(e) => setItem(i, 'vid', e.target.value)}>${p.variants.map((v) => html`<option key=${v.id} value=${v.id}>${v.name} (${v.stock} left)</option>`)}</select>
          <div class="stepper"><button onClick=${() => setItem(i, 'qty', Math.max(1, it.qty - 1))} aria-label="Less">−</button><span class="num">${it.qty}</span><button onClick=${() => setItem(i, 'qty', it.qty + 1)} aria-label="More">+</button></div>
          ${items.length > 1 && html`<button class="icon-btn" aria-label="Remove" onClick=${() => setItems(items.filter((_, j) => j !== i))}><${Icon} n="trash" /></button>`}
        </div>`; })}
        ${errs.items && html`<span style=${{ color: 'var(--bad)', fontSize: '13px' }}>${errs.items}</span>`}
      </div>

      <div class="box stack"><h3 style=${{ margin: 0 }}>Payment</h3>
        <div class="grid2">
          <label class="f" htmlFor="ao-pm">Paid by<select id="ao-pm" class="select" value=${pay.method} onChange=${(e) => setPay({ ...pay, method: e.target.value })}>
            <option value="UPI direct">UPI to Kalaksha UPI ID (no gateway fee)</option><option value="Payment link">Payment link (gateway)</option><option value="COD">Cash on Delivery</option></select></label>
          <label class="f" htmlFor="ao-ps">Status<select id="ao-ps" class="select" value=${pay.status} onChange=${(e) => setPay({ ...pay, status: e.target.value })}><option>Paid</option><option>Pending</option></select></label>
        </div>
        <label class="f" htmlFor="ao-ref">UPI reference (UTR) from the payment screenshot<input id="ao-ref" class="input" placeholder="12-digit UTR, e.g. 412398765432" value=${pay.ref} onChange=${(e) => setPay({ ...pay, ref: e.target.value })} /></label>
      </div>
    </div>
    <div class="foot">
      <div class="sum">
        <div class="r"><span>Subtotal (${t.qty} toran${t.qty === 1 ? '' : 's'})</span><span class="num">${inr(t.subtotal)}</span></div>
        <div class="r"><label class="row" style=${{ gap: '6px' }}><input type="checkbox" checked=${ship} onChange=${() => setShip(!ship)} /> Delivery · ${c.state === 'Maharashtra' ? 'Maharashtra' : 'Rest of India'} · ${t.parcels} parcel${t.parcels === 1 ? '' : 's'}</label><span class="num">${inr(shipping)}</span></div>
        <div class="r total"><span>Total to collect</span><span class="num">${inr(t.subtotal + shipping)}</span></div>
      </div>
      <label class="row" style=${{ gap: '8px', fontSize: '14px' }}><input type="checkbox" checked=${sendMsg} onChange=${() => setSendMsg(!sendMsg)} /> Send order confirmation to the customer on WhatsApp</label>
      <div class="row"><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary grow" onClick=${save}>Save order</button></div>
    </div>
  </aside>`;
}

function ImportDrawer({ db, update, notify, onClose }) {
  useEsc(onClose);
  const [text, setText] = useState('');
  const [res, setRes] = useState(null);
  const check = (tx) => setRes(csvToOrders(tx, db));
  const onFile = (e) => { const f = e.target.files[0]; if (!f) return; const fr = new FileReader(); fr.onload = () => { setText(fr.result); check(fr.result); }; fr.readAsText(f); };
  const template = () => {
    const blob = new Blob([CSV_HEAD.join(',') + '\n'], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'kalaksha-orders-template.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const ok = res && res.orders ? res.orders.filter((o) => !o.errors.length) : [];
  const doImport = () => {
    update((d) => { ok.forEach((o) => createOrder(d, o)); d.orders.sort((a, b) => b.date.localeCompare(a.date)); });
    notify(`Imported ${ok.length} order${ok.length === 1 ? '' : 's'}`); onClose();
  };
  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Import orders">
    <div class="head"><h3>Import orders</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '14px' }}>
      <div class="callout"><${Icon} n="alert" /> Keep WhatsApp orders in Excel or Google Sheets? Save the sheet as CSV and upload it here. Rows with the same order_ref become one order.</div>
      <div class="row wrapflex">
        <label class="btn primary" htmlFor="imp-file"><${Icon} n="upload" /> Upload CSV<input id="imp-file" type="file" accept=".csv,text/csv" hidden onChange=${onFile} /></label>
        <button class="btn" onClick=${template}>Download template</button>
        <button class="btn" onClick=${() => { const s = sampleCSV(); setText(s); check(s); }}>Load sample sheet</button>
      </div>
      <label class="f" htmlFor="imp-text">Or paste the rows here<textarea id="imp-text" class="input mono" rows="6" style=${{ fontSize: '12px' }} placeholder=${CSV_HEAD.join(',')} value=${text} onChange=${(e) => setText(e.target.value)}></textarea></label>
      <button class="btn" style=${{ width: 'fit-content' }} onClick=${() => check(text)}>Check rows</button>
      ${res && res.error && html`<div class="callout" style=${{ background: 'var(--bad-soft)' }}>${res.error}</div>`}
      ${res && res.orders && html`<div class="stack" style=${{ gap: '8px' }}>
        <b>${ok.length} ready to import${res.orders.length - ok.length ? ` · ${res.orders.length - ok.length} need fixing` : ''}</b>
        ${res.orders.map((o, i) => html`<div key=${i} class="box" style=${{ padding: '10px 12px', borderColor: o.errors.length ? 'var(--bad)' : 'var(--line)' }}>
          <div class="row between wrapflex"><span><span class="mono">${o.ref}</span> · <b>${o.customer.name || 'No name'}</b> <span class="muted">${o.customer.city}${o.customer.state ? ', ' + o.customer.state : ''}</span></span>
            <span class="row" style=${{ gap: '6px' }}><span class=${'pill nodot ' + chanPill(o.source)}>${o.source}</span><span class=${'pill ' + (o.payment.status === 'Paid' ? 'ok' : 'warn')}>${o.payment.status}</span></span></div>
          <div style=${{ fontSize: '13px', marginTop: '4px' }}>${o.items.map((x) => x.label).join(', ') || '—'}</div>
          ${o.errors.map((e, k) => html`<div key=${k} style=${{ color: 'var(--bad)', fontSize: '13px' }}>✕ ${e}</div>`)}
        </div>`)}
      </div>`}
    </div>
    <div class="foot"><div class="row"><button class="btn" onClick=${onClose}>Cancel</button>
      <button class="btn primary grow" disabled=${!ok.length} onClick=${doImport}>${ok.length ? `Import ${ok.length} order${ok.length === 1 ? '' : 's'}` : 'Nothing to import yet'}</button></div></div>
  </aside>`;
}

function MarkPaid({ o, update, notify }) {
  const [ref, setRef] = useState(o.payment.ref || '');
  return html`<div class="box stack" style=${{ borderColor: 'var(--warn)', background: 'var(--warn-soft)' }}>
    <h3 style=${{ margin: 0 }}>Payment not confirmed</h3>
    <span class="ink2" style=${{ fontSize: '13px' }}>Match the customer’s UPI screenshot with your bank app, enter the UTR, then mark it paid. Or send a payment link so it confirms on its own.</span>
    <div class="row wrapflex">
      <input id="mp-ref" class="input grow" placeholder="UTR / reference number" value=${ref} onChange=${(e) => setRef(e.target.value)} />
      <button class="btn primary" onClick=${() => { update((d) => { const x = d.orders.find((y) => y.id === o.id); x.payment.status = 'Paid'; x.payment.ref = ref.trim() ? (/^utr/i.test(ref.trim()) ? ref.trim() : 'UTR ' + ref.trim()) : x.payment.ref; }); notify(`${o.id} marked as paid`); }}>Mark as paid</button>
    </div>
    <button class="btn sm" style=${{ width: 'fit-content' }} onClick=${() => notify(`Payment link for ${inr(o.total)} sent to ${o.customer.phone} on WhatsApp (demo)`)}>Send payment link on WhatsApp</button>
  </div>`;
}

/* ---------- Transactions ---------- */
function Transactions({ db }) {
  const s = db.settings;
  const rate = gatewayRate(s);
  const rev30 = db.hist.reduce((a, d) => a + d.revenue, 0);
  const share = gatewayShare(db.orders);
  const unpaid = db.orders.filter((o) => o.payment.status !== 'Paid');
  const methods = ['UPI direct', 'UPI', 'Card', 'Netbanking', 'Payment link', 'COD'].map((m) => [m, db.orders.filter((o) => o.payment.method === m).length]).filter((x) => x[1]);
  const maxM = Math.max(...methods.map((x) => x[1]), 1);
  return html`<div>
    <div class="kpis" style=${{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
      <div class="kpi"><span class="l">Collected · 30 days</span><span class="v">${inrShort(rev30)}</span><span class="s">Website and WhatsApp</span></div>
      <div class="kpi"><span class="l">Gateway fees · 30 days</span><span class="v">${inrShort(rev30 * share * rate)}</span><span class="s">${(rate * 100).toFixed(2)}% on the ${Math.round(share * 100)}% paid through the gateway</span></div>
      <div class="kpi"><span class="l">Paid straight to UPI</span><span class="v">${inrShort(rev30 * (1 - share))}</span><span class="s">No fee, but each one is checked by hand</span></div>
      <div class="kpi"><span class="l">Awaiting payment</span><span class="v num">${unpaid.length}</span><span class="s">${inr(unpaid.reduce((a, o) => a + o.total, 0))} to confirm</span></div>
    </div>
    <div class="cols2" style=${{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)' }}>
      <div class="box"><h3>Payment methods <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>Latest orders</span></h3>
        <div class="bars">${methods.map(([m, n]) => html`<div class="r" key=${m} style=${{ gridTemplateColumns: '96px 1fr 44px' }}><span>${m}</span><div class="track"><div class="fill" style=${{ width: (n / maxM) * 100 + '%' }}></div></div><b class="num" style=${{ textAlign: 'right' }}>${Math.round((n / db.orders.length) * 100)}%</b></div>`)}</div>
        <p class="muted" style=${{ fontSize: '13px' }}>“UPI direct” is money sent to the Kalaksha UPI ID from WhatsApp orders. It has no gateway fee, but someone must match each screenshot. Payment links remove that manual step.</p></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Reference</th><th>Order</th><th>Channel</th><th>Method</th><th class="r">Amount</th><th class="r">Fee + GST</th><th class="r">Net</th><th>Status</th></tr></thead>
        <tbody>${db.orders.slice(0, 50).map((o) => { const fee = feeOf(o, s); return html`<tr key=${o.id}>
          <td class="mono">${o.payment.ref || '—'}</td><td class="mono">${o.id}</td><td><span class=${'pill nodot ' + chanPill(chanOf(o))}>${chanOf(o)}</span></td><td style=${{ whiteSpace: 'nowrap' }}>${o.payment.method}</td>
          <td class="r num">${inr(o.total)}</td><td class="r num muted">${fee ? '−₹' + fee.toFixed(2) : '₹0'}</td><td class="r num"><b>₹${(o.total - fee).toFixed(2)}</b></td>
          <td><span class=${'pill ' + (o.payment.status === 'Paid' ? 'ok' : 'warn')}>${o.payment.status}</span></td></tr>`; })}</tbody></table></div>
    </div>
  </div>`;
}

function OrderDrawer({ db, update, notify, id, onClose }) {
  const [shipOpen, setShipOpen] = useState(false);
  useEsc(shipOpen ? () => {} : onClose);
  const o = db.orders.find((x) => x.id === id);
  if (!o) return null;
  const s = db.settings;
  const fee = feeOf(o, s);
  const setStatus = (to) => {
    if (to === 'Shipped' && !o.shipment) { setShipOpen(true); return; }
    const auto = to === 'Packed' && shipCfg(db).autoShip && canShip(o);
    update((d) => { const x = d.orders.find((y) => y.id === id); x.status = to; if (to === 'Packed') autoShipIds(d, [id]); });
    notify(`${id} marked ${to}${auto ? ' · shipment created automatically' : ''}`);
  };
  const next = { New: 'Packed', Packed: 'Shipped', Shipped: 'Delivered' }[o.status];
  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label=${'Order ' + id}>
    <div class="head"><div><h3 class="mono" style=${{ fontFamily: 'var(--f-mono)', fontSize: '20px' }}>${o.id}</h3><span class="muted" style=${{ fontSize: '13px' }}>${fmtDT(o.date)}${o.sample ? ' · sample order' : ' · placed from the demo store'}</span></div>
      <button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '16px' }}>
      <div class="row between wrapflex"><span class=${'pill ' + STATUS[o.status]}>${o.status}</span>
        <label class="row" style=${{ gap: '6px', fontSize: '13px' }}>Change status
          <select id="od-status" class="select" style=${{ width: 'auto', padding: '5px 8px' }} value=${o.status} onChange=${(e) => setStatus(e.target.value)}>${Object.keys(STATUS).map((k) => html`<option key=${k}>${k}</option>`)}</select></label></div>
      <div class="box"><h3>Items</h3>${o.items.map((i) => html`<div class="row" key=${i.pid + i.vid} style=${{ padding: '6px 0' }}>
        <img class="thumb" src=${i.img} alt="" /><div class="grow"><b>${i.name}</b><div class="muted" style=${{ fontSize: '13px' }}>${i.variant} · ${inr(i.price)} × ${i.qty}</div></div><b class="num">${inr(i.price * i.qty)}</b></div>`)}
        <div class="sum" style=${{ marginTop: '10px' }}>
          <div class="r"><span>Subtotal</span><span class="num">${inr(o.subtotal)}</span></div>
          <div class="r"><span>Delivery (${o.customer.state === 'Maharashtra' ? 'Maharashtra' : 'Rest of India'})</span><span class="num">${inr(o.shipping)}</span></div>
          ${o.discount > 0 && html`<div class="r"><span>Discount ${o.coupon}</span><span class="num">−${inr(o.discount)}</span></div>`}
          <div class="r total"><span>Total</span><span class="num">${inr(o.total)}</span></div></div></div>
      <div class="grid2">
        <div class="box"><h3>Customer</h3><b>${o.customer.name}</b><div class="mono">${o.customer.phone}</div>${o.customer.email && html`<div class="muted" style=${{ fontSize: '13px' }}>${o.customer.email}</div>`}
          <div style=${{ marginTop: '8px', fontSize: '14px' }}>${o.customer.address}<br />${o.customer.city}, ${o.customer.state} ${o.customer.pin}</div></div>
        <div class="box"><h3>Payment</h3>
          <div class="sum"><div class="r"><span>Channel</span><span class=${'pill nodot ' + chanPill(chanOf(o))}>${chanOf(o)}</span></div><div class="r"><span>Method</span><b>${o.payment.method}</b></div>
            <div class="r"><span>Status</span><span class=${'pill ' + (o.payment.status === 'Paid' ? 'ok' : 'warn')}>${o.payment.status}</span></div>
            <div class="r"><span>Reference</span><span class="mono">${o.payment.ref || '—'}</span></div>
            <div class="r"><span>Gateway fee</span><span class="num">−${inr(fee)}</span></div>
            <div class="r"><span>You receive</span><b class="num">${inr(o.total - fee)}</b></div></div></div>
      </div>
      ${o.payment.status !== 'Paid' && html`<${MarkPaid} key=${o.id} o=${o} update=${update} notify=${notify} />`}
      <${ShipmentPanel} o=${o} db=${db} update=${update} notify=${notify} onCreate=${() => setShipOpen(true)} />
    </div>
    <div class="foot">
      <div class="row wrapflex">
        ${next && html`<button class="btn primary grow" onClick=${() => setStatus(next)}>${next === 'Shipped' ? 'Create shipment' : 'Mark ' + next.toLowerCase()}</button>`}
        <button class="btn grow" onClick=${() => notify(`Order update sent to ${o.customer.phone} on WhatsApp (demo)`)}>Send WhatsApp update</button>
        ${o.status === 'Delivered' && html`<button class="btn grow" onClick=${() => setStatus('Replacement')}>Start replacement</button>`}
      </div>
    </div>
  </aside>
  ${shipOpen && html`<${ShipDialog} db=${db} update=${update} notify=${notify} ids=${[id]} onClose=${() => setShipOpen(false)} />`}`;
}

/* ================================================================ SHIPPING (simulated Shiprocket) */
const shipCfg = (db) => db.settings.ship || SHIP.DEFAULTS;
const SHIP_PILL = { 'Pickup scheduled': 'info', 'Picked up': 'info', 'In transit': 'brand', 'Out for delivery': 'warn', Delivered: 'ok', 'Delivery failed': 'bad', Returning: 'bad', Returned: 'neutral' };
const canShip = (o) => !o.shipment && o.payment.status === 'Paid' && (o.status === 'New' || o.status === 'Packed');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function autoShipIds(d, ids) {
  const ship = d.settings.ship;
  if (!ship || !ship.autoShip) return;
  ids.forEach((id) => {
    const o = d.orders.find((x) => x.id === id);
    if (o && !o.shipment && o.payment.status === 'Paid') SHIP.create(o, SHIP.pick(SHIP.quotes(o, ship, d.settings.perParcel), ship.rule), ship);
  });
}

function barcodeSvg(text) {
  let x = 0; const bars = [];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    for (let b = 0; b < 4; b++) { const w = (c >> b) & 1 ? 3 : 1; bars.push(`<rect x="${x}" y="0" width="${w}" height="60"/>`); x += w + ((c >> (b + 3)) & 1 ? 2 : 1); }
  }
  return `<svg viewBox="0 0 ${x} 60" width="100%" height="60" preserveAspectRatio="none">${bars.join('')}</svg>`;
}
function printLabels(orders, ship) {
  const list = orders.filter((o) => o.shipment);
  if (!list.length) return 'none';
  const w = window.open('', '_blank');
  if (!w) return 'blocked';
  const p = ship.pickup;
  const labels = list.map((o) => `<div class="label">
    <div class="top"><b>${esc(o.shipment.courier)}</b><span>PREPAID</span></div>
    <div class="bc">${barcodeSvg(o.shipment.awb)}<div class="awb">AWB ${esc(o.shipment.awb)}</div></div>
    <div class="to"><small>SHIP TO</small><b>${esc(o.customer.name)}</b>${esc(o.customer.address)}<br>${esc(o.customer.city)}, ${esc(o.customer.state)} <b>${esc(o.customer.pin)}</b><br>Ph: ${esc(o.customer.phone)}</div>
    <div class="row"><div><small>ORDER</small><b>${esc(o.id)}</b></div><div><small>WEIGHT</small><b>${o.shipment.weight} g × ${o.shipment.parcels}</b></div><div><small>VALUE</small><b>₹${o.total}</b></div></div>
    <div class="items">${o.items.map((i) => `${esc(i.name)} (${esc(i.variant)}) × ${i.qty}`).join('<br>')}</div>
    <div class="from"><small>RETURN TO</small>${esc(p.name)}, ${esc(p.address)}, ${esc(p.city)} ${esc(p.pin)}</div>
  </div>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Shipping labels · ${list.length}</title><style>
    @page { size: 4in 6in; margin: 0 } body { margin: 0; font: 13px/1.35 Arial, sans-serif; color: #000; background: #eee }
    .label { width: 4in; height: 6in; box-sizing: border-box; padding: 14px; background: #fff; margin: 12px auto; border: 1px solid #000; display: flex; flex-direction: column; gap: 10px; page-break-after: always }
    .top { display: flex; justify-content: space-between; align-items: center; font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 8px }
    .top span { border: 2px solid #000; padding: 2px 8px; font-weight: bold; font-size: 14px }
    .awb { text-align: center; font: bold 16px monospace; margin-top: 4px } .to { border: 1px solid #000; padding: 10px; font-size: 14px } .to b { display: block; font-size: 16px }
    small { display: block; font-size: 10px; color: #444; letter-spacing: .05em } .row { display: flex; gap: 8px } .row div { flex: 1; border: 1px solid #000; padding: 6px }
    .items { font-size: 12px; flex: 1 } .from { font-size: 11px; border-top: 1px dashed #000; padding-top: 6px }
    @media print { body { background: #fff } .label { margin: 0; border: 0 } }
  </style></head><body>${labels}<script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };<\/script></body></html>`);
  w.document.close();
  return 'ok';
}
function downloadManifest(orders, ship) {
  const rows = [['awb', 'courier', 'order', 'customer', 'phone', 'city', 'state', 'pin', 'parcels', 'weight_g', 'payment', 'value']];
  orders.filter((o) => o.shipment).forEach((o) => rows.push([o.shipment.awb, o.shipment.courier, o.id, o.customer.name, o.customer.phone, o.customer.city, o.customer.state, o.customer.pin, o.shipment.parcels, o.shipment.weight, 'Prepaid', o.total]));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `kalaksha-manifest-${dayKey(new Date())}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const labelMsg = (r) => (r === 'blocked' ? 'Allow pop-ups for localhost to print labels' : r === 'none' ? 'No shipments to print' : 'Labels opened in a new tab');

function ShipDialog({ db, update, notify, ids, onClose }) {
  useEsc(onClose);
  const ship = shipCfg(db);
  const per = db.settings.perParcel;
  const [initial] = useState(ids);
  const orders = initial.map((id) => db.orders.find((o) => o.id === id)).filter(Boolean);
  const [ready] = useState(() => orders.filter(canShip).map((o) => o.id));
  const readyOrders = orders.filter((o) => ready.includes(o.id));
  const skipped = orders.filter((o) => !ready.includes(o.id));
  const quotesOf = (o) => SHIP.quotes(o, ship, per);
  const [rule, setRule] = useState(ship.rule);
  const [choice, setChoice] = useState(() => Object.fromEntries(readyOrders.map((o) => [o.id, SHIP.pick(quotesOf(o), ship.rule).id])));
  const late = new Date().getHours() >= 14;
  const [day, setDay] = useState(late ? 1 : 0);
  const [done, setDone] = useState(false);
  const applyRule = (r) => { setRule(r); setChoice(Object.fromEntries(readyOrders.map((o) => [o.id, SHIP.pick(quotesOf(o), r).id]))); };
  const pickupDate = (() => { const x = new Date(); x.setDate(x.getDate() + day); x.setHours(11, 0, 0, 0); return x; })();
  const cost = readyOrders.reduce((a, o) => a + (quotesOf(o).find((q) => q.id === choice[o.id]) || { cost: 0 }).cost, 0);
  const charged = readyOrders.reduce((a, o) => a + o.shipping, 0);
  const create = () => {
    update((d) => readyOrders.forEach((o0) => {
      const o = d.orders.find((x) => x.id === o0.id);
      const q = SHIP.quotes(o, ship, d.settings.perParcel).find((x) => x.id === choice[o.id]);
      if (o && q && !o.shipment) SHIP.create(o, q, ship, new Date(), Math.random, pickupDate);
    }));
    setDone(true);
    notify(`${readyOrders.length} shipment${readyOrders.length === 1 ? '' : 's'} created · pickup booked${ship.notify ? ' · tracking sent to customers' : ''}`);
  };
  const created = db.orders.filter((o) => ready.includes(o.id) && o.shipment);

  return html`<div class="scrim" onClick=${onClose}></div>
  <div class="modal" role="dialog" aria-modal="true" aria-label="Create shipments" style=${{ width: 'min(1040px, calc(100% - 32px))' }}>
    <div style=${{ padding: '22px 24px' }} class="stack">
      <div class="row between wrapflex">
        <div><h2 style=${{ fontSize: '24px' }}>${done ? 'Shipments created' : `Create ${readyOrders.length} shipment${readyOrders.length === 1 ? '' : 's'}`}</h2>
          <span class="muted" style=${{ fontSize: '13px' }}>Shiprocket · pickup from ${ship.pickup.name}, ${ship.pickup.city} ${ship.pickup.pin}</span></div>
        <div class="row"><span class="pill ok">Shiprocket connected (demo)</span><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
      </div>
      ${done ? html`
        <div class="box stack" style=${{ background: 'var(--ok-soft)', borderColor: 'transparent' }}>
          <b>${created.length} AWB numbers generated. Pickup booked for ${SHIP.fmtDay(pickupDate)}, ${ship.slot}.</b>
          <span class="ink2" style=${{ fontSize: '14px' }}>${ship.notify ? 'Each customer got a WhatsApp message and email with the courier name and tracking link.' : 'Customer tracking messages are turned off in Settings.'} Print the labels, stick one on each parcel and hand them to the courier at pickup.</span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Order</th><th>Courier</th><th>AWB</th><th>Destination</th><th class="r">Cost</th></tr></thead>
          <tbody>${created.map((o) => html`<tr key=${o.id}><td class="mono">${o.id}</td><td>${o.shipment.courier}</td><td class="mono">${o.shipment.awb}</td><td>${o.customer.city}, ${o.customer.pin}</td><td class="r num">${inr(o.shipment.cost)}</td></tr>`)}</tbody></table></div>
        <div class="row wrapflex"><button class="btn primary" onClick=${() => notify(labelMsg(printLabels(created, ship)))}>Print ${created.length} label${created.length === 1 ? '' : 's'}</button>
          <button class="btn" onClick=${() => { downloadManifest(created, ship); notify('Pickup manifest downloaded'); }}>Download pickup manifest</button><span class="grow"></span><button class="btn" onClick=${onClose}>Done</button></div>`
      : html`
        ${skipped.length > 0 && html`<div class="callout" style=${{ background: 'var(--warn-soft)' }}><${Icon} n="alert" /> ${skipped.length} order${skipped.length === 1 ? '' : 's'} skipped: ${skipped.slice(0, 4).map((o) => `${o.id} (${o.shipment ? 'already shipped' : o.payment.status !== 'Paid' ? 'not paid' : o.status.toLowerCase()})`).join(', ')}${skipped.length > 4 ? '…' : ''}</div>`}
        ${readyOrders.length === 0 ? html`<div class="empty">Nothing to ship. Choose paid orders that are New or Packed.</div>` : html`
        <div class="row wrapflex">
          <span class="opt-label">Choose courier by</span>
          ${[['recommended', 'Recommended'], ['cheapest', 'Cheapest'], ['fastest', 'Fastest']].map(([k, l]) => html`<button key=${k} class=${'chip' + (rule === k ? ' on' : '')} onClick=${() => applyRule(k)}>${l}</button>`)}
          <span class="grow"></span>
          <label class="row" style=${{ gap: '6px', fontSize: '14px' }}>Pickup
            <select id="ship-day" class="select" style=${{ width: 'auto', padding: '6px 8px' }} value=${day} onChange=${(e) => setDay(+e.target.value)}>
              ${!late && html`<option value="0">Today, ${ship.slot}</option>`}<option value="1">Tomorrow, ${ship.slot}</option><option value="2">Day after, ${ship.slot}</option></select></label>
        </div>
        <div class="table-wrap" style=${{ maxHeight: '46vh', overflow: 'auto' }}><table>
          <thead><tr><th>Order</th><th>Ship to</th><th>Parcel</th><th>Courier · rate · days · rating</th><th class="r">Charged</th></tr></thead>
          <tbody>${readyOrders.map((o) => { const qs = quotesOf(o); const q = qs.find((x) => x.id === choice[o.id]) || qs[0]; return html`<tr key=${o.id}>
            <td class="mono">${o.id}</td>
            <td style=${{ whiteSpace: 'nowrap' }}>${o.customer.city}, ${o.customer.pin}<div class="muted" style=${{ fontSize: '12px' }}>${SHIP.ZONE_LABEL[q.zone]}</div></td>
            <td style=${{ whiteSpace: 'nowrap' }}>${q.parcels} × ${q.weight} g<div class="muted" style=${{ fontSize: '12px' }}>${o.qty} toran${o.qty === 1 ? '' : 's'}</div></td>
            <td><select class="select" aria-label=${'Courier for ' + o.id} style=${{ padding: '6px 8px', minWidth: '260px' }} value=${choice[o.id]} onChange=${(e) => setChoice({ ...choice, [o.id]: e.target.value })}>
              ${[...qs].sort((a, b) => a.cost - b.cost).map((x) => html`<option key=${x.id} value=${x.id}>${x.name} · ${inr(x.cost)} · ${x.days} day${x.days === 1 ? '' : 's'} · ★${x.rating}</option>`)}</select></td>
            <td class="r num">${inr(o.shipping)}</td></tr>`; })}</tbody></table></div>
        <div class="row between wrapflex" style=${{ fontSize: '14px' }}>
          <span>Shipping cost <b class="num">${inr(cost)}</b> · Delivery charged to customers <b class="num">${inr(charged)}</b> · <b style=${{ color: charged - cost >= 0 ? 'var(--ok)' : 'var(--bad)' }}>${charged - cost >= 0 ? 'Covered, ' + inr(charged - cost) + ' left over' : 'Short by ' + inr(cost - charged)}</b></span>
          <span class="muted">Sample rates incl. GST</span>
        </div>
        <div class="row"><span class="grow"></span><button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${create}><${Icon} n="truck" /> Create shipments and book pickup</button></div>`}`}
    </div>
  </div>`;
}

function ShipmentPanel({ o, db, update, notify, onCreate }) {
  const ship = shipCfg(db);
  const sh = o.shipment;
  const act = (fn, msg) => { update((d) => fn(d.orders.find((x) => x.id === o.id), d)); notify(msg); };
  if (!sh) return html`<div class="box stack"><h3 style=${{ margin: 0 }}>Shipping <span class="pill neutral nodot">Shiprocket</span></h3>
    <span class="muted">${canShip(o) ? 'Ready to ship. Shiprocket will suggest a courier and book a pickup.' : o.payment.status !== 'Paid' ? 'Confirm the payment before shipping.' : 'No shipment for this order.'}</span>
    ${canShip(o) && html`<button class="btn primary" style=${{ width: 'fit-content' }} onClick=${onCreate}><${Icon} n="truck" /> Create shipment</button>`}</div>`;
  const active = !['Delivered', 'Returned'].includes(sh.status);
  return html`<div class="box stack" style=${{ gap: '12px' }}>
    <h3 style=${{ margin: 0 }}><span>Shipping · ${sh.courier}</span><span class=${'pill ' + SHIP_PILL[sh.status]}>${sh.status}</span></h3>
    <div class="sum">
      <div class="r"><span>AWB / tracking no.</span><b class="mono">${sh.awb}</b></div>
      <div class="r"><span>Parcels</span><span>${sh.parcels} × ${sh.weight} g · ${SHIP.ZONE_LABEL[sh.zone]}</span></div>
      <div class="r"><span>Pickup</span><span>${SHIP.fmtDay(sh.pickupDate)}, ${ship.slot}</span></div>
      <div class="r"><span>${sh.status === 'Delivered' ? 'Delivered' : 'Expected delivery'}</span><span>${SHIP.fmtDay(sh.deliveredAt || sh.eta)}</span></div>
      <div class="r"><span>Shipping cost / charged</span><span class="num">${inr(sh.cost)} / ${inr(o.shipping)}</span></div>
    </div>
    <div class="track">${[...sh.events].reverse().map((e, i) => html`<div key=${i} class=${'ev' + (i === 0 ? ' now' : '')}>
      <span class="dot"></span><div><b>${e.status}</b> <span class="muted">· ${e.loc}</span>${e.note && html`<div class="ink2" style=${{ fontSize: '13px' }}>${e.note}</div>`}<div class="muted" style=${{ fontSize: '12px' }}>${fmtDT(e.at)}</div></div></div>`)}</div>
    <div class="row wrapflex">
      ${active && sh.status !== 'Delivery failed' && html`<button class="btn sm" onClick=${() => act((x) => SHIP.advance(x, ship), 'Courier update received' + (ship.notify ? ' · customer notified' : ''))}>Simulate next courier update</button>`}
      ${sh.status === 'Out for delivery' && html`<button class="btn sm" onClick=${() => act((x) => SHIP.fail(x, SHIP.NDR_REASONS[Math.floor(Math.random() * SHIP.NDR_REASONS.length)]), 'Delivery failed · customer asked on WhatsApp to confirm details')}>Simulate failed delivery</button>`}
      ${sh.status === 'Delivery failed' && html`<button class="btn sm primary" onClick=${() => act((x) => SHIP.advance(x, ship), 'Reattempt requested from the courier')}>Reattempt delivery</button>
        <button class="btn sm" onClick=${() => act((x) => SHIP.rto(x), 'Return to Kalaksha requested')}>Return to Kalaksha</button>`}
      <button class="btn sm" onClick=${() => notify(labelMsg(printLabels([o], ship)))}>Print label</button>
    </div>
  </div>`;
}

function Shipments({ db, update, notify, openOrder }) {
  const ship = shipCfg(db);
  const [f, setF] = useState('All');
  const [dlg, setDlg] = useState(null);
  const list = db.orders.filter((o) => o.shipment);
  const ready = db.orders.filter(canShip);
  const count = (...s) => list.filter((o) => s.includes(o.shipment.status)).length;
  const failed = list.filter((o) => o.shipment.status === 'Delivery failed');
  const spend = list.reduce((a, o) => a + o.shipment.cost, 0);
  const charged = list.reduce((a, o) => a + o.shipping, 0);
  const shown = list.filter((o) => f === 'All' || o.shipment.status === f).sort((a, b) => b.shipment.events[b.shipment.events.length - 1].at.localeCompare(a.shipment.events[a.shipment.events.length - 1].at));
  const runUpdates = () => {
    let n = 0;
    update((d) => d.orders.forEach((o) => {
      const s = o.shipment && o.shipment.status;
      if (!s || ['Delivered', 'Returned', 'Delivery failed'].includes(s)) return;
      if (Math.random() < 0.55) return;
      if (s === 'Out for delivery' && Math.random() < 0.15) SHIP.fail(o, SHIP.NDR_REASONS[Math.floor(Math.random() * SHIP.NDR_REASONS.length)]);
      else SHIP.advance(o, ship);
    }));
    notify('Courier updates received from Shiprocket' + (ship.notify ? ' · customers notified' : ''));
  };
  const toPrint = list.filter((o) => o.shipment.status === 'Pickup scheduled');
  return html`<div class="stack" style=${{ gap: '14px' }}>
    <div class="callout" style=${{ background: 'var(--surface-2)' }}><${Icon} n="truck" /> Shiprocket picks a courier for each parcel, generates the AWB and label, books the pickup and sends tracking updates back here. This demo simulates it with sample rates.</div>
    <div class="kpis">
      <div class="kpi" style=${{ cursor: ready.length ? 'pointer' : 'default' }} onClick=${() => ready.length && setDlg(ready.map((o) => o.id))}><span class="l">Ready to ship</span><span class="v num">${ready.length}</span><span class="s">${ready.length ? 'Click to create shipments' : 'All paid orders shipped'}</span></div>
      <div class="kpi"><span class="l">Awaiting pickup</span><span class="v num">${count('Pickup scheduled')}</span><span class="s">Labels to print and stick</span></div>
      <div class="kpi"><span class="l">On the way</span><span class="v num">${count('Picked up', 'In transit', 'Out for delivery')}</span><span class="s">${count('Out for delivery')} out for delivery today</span></div>
      <div class="kpi" style=${{ borderColor: failed.length ? 'var(--bad)' : 'var(--line)' }}><span class="l">Delivery failed</span><span class="v num" style=${{ color: failed.length ? 'var(--bad)' : 'inherit' }}>${failed.length}</span><span class="s">Need a decision</span></div>
      <div class="kpi"><span class="l">Shipping cost vs charged</span><span class="v">${inrShort(spend)}</span><span class="s">Charged ${inrShort(charged)} · <span class=${charged >= spend ? 'up' : 'down'}>${charged >= spend ? '+' : '−'}${inrShort(Math.abs(charged - spend))}</span></span></div>
    </div>
    ${failed.length > 0 && html`<div class="box stack" style=${{ borderColor: 'var(--bad)' }}>
      <h3 style=${{ margin: 0 }}>Failed deliveries <span class="muted" style=${{ fontWeight: 400, fontSize: '12px' }}>Decide within 24 hours or the courier returns the parcel</span></h3>
      ${failed.map((o) => html`<div key=${o.id} class="row wrapflex" style=${{ borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
        <div class="grow"><b class="mono">${o.id}</b> · ${o.customer.name}, ${o.customer.city} · <span class="mono">${o.customer.phone}</span>
          <div class="muted" style=${{ fontSize: '13px' }}>${o.shipment.courier} · ${o.shipment.events[o.shipment.events.length - 1].note} · attempt ${o.shipment.attempts}</div></div>
        <button class="btn sm" onClick=${() => notify(`WhatsApp sent to ${o.customer.phone} asking to confirm address and time (demo)`)}>Message customer</button>
        <button class="btn sm primary" onClick=${() => { update((d) => SHIP.advance(d.orders.find((x) => x.id === o.id), ship)); notify(`Reattempt requested for ${o.id}`); }}>Reattempt</button>
        <button class="btn sm" onClick=${() => { update((d) => SHIP.rto(d.orders.find((x) => x.id === o.id))); notify(`${o.id} returning to Kalaksha`); }}>Return to Kalaksha</button>
      </div>`)}</div>`}
    <div class="toolbar" style=${{ margin: 0 }}>
      ${['All', 'Pickup scheduled', 'Picked up', 'In transit', 'Out for delivery', 'Delivery failed', 'Returning', 'Delivered', 'Returned'].map((s) => html`<button key=${s} class=${'chip' + (f === s ? ' on' : '')} onClick=${() => setF(s)}>${s} <span class="muted">${s === 'All' ? list.length : count(s)}</span></button>`)}
    </div>
    <div class="toolbar" style=${{ margin: 0 }}>
      <button class="btn primary" disabled=${!ready.length} onClick=${() => setDlg(ready.map((o) => o.id))}><${Icon} n="truck" /> Ship ${ready.length} ready order${ready.length === 1 ? '' : 's'}</button>
      <button class="btn" disabled=${!toPrint.length} onClick=${() => notify(labelMsg(printLabels(toPrint, ship)))}>Print ${toPrint.length} label${toPrint.length === 1 ? '' : 's'} for pickup</button>
      <button class="btn" disabled=${!toPrint.length} onClick=${() => { downloadManifest(toPrint, ship); notify('Pickup manifest downloaded'); }}>Pickup manifest</button>
      <span class="grow"></span>
      <button class="btn" onClick=${runUpdates}><${Icon} n="refresh" /> Get courier updates (demo)</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>AWB</th><th>Order</th><th>Courier</th><th>Destination</th><th>Status</th><th>Latest update</th><th class="r">Cost</th><th class="r">Charged</th></tr></thead>
      <tbody>${shown.slice(0, 60).map((o) => { const sh = o.shipment; const e = sh.events[sh.events.length - 1]; return html`<tr key=${o.id} class="click" onClick=${() => openOrder(o.id)}>
        <td class="mono">${sh.awb}</td><td class="mono">${o.id}</td><td style=${{ whiteSpace: 'nowrap' }}>${sh.courier}</td>
        <td style=${{ whiteSpace: 'nowrap' }}>${o.customer.city}, ${o.customer.pin}</td>
        <td><span class=${'pill ' + SHIP_PILL[sh.status]}>${sh.status}</span></td>
        <td style=${{ fontSize: '13px' }}>${e.note || e.status}<div class="muted">${e.loc} · ${fmtDT(e.at)}</div></td>
        <td class="r num">${inr(sh.cost)}</td><td class="r num">${inr(o.shipping)}</td></tr>`; })}</tbody></table></div>
    ${!shown.length && html`<div class="empty">No shipments with this status.</div>`}
    ${dlg && html`<${ShipDialog} db=${db} update=${update} notify=${notify} ids=${dlg} onClose=${() => setDlg(null)} />`}
  </div>`;
}

function ShippingSettings({ db, update }) {
  const sh = shipCfg(db);
  const setP = (k, v) => update((d) => { d.settings.ship = d.settings.ship || structuredClone(SHIP.DEFAULTS); d.settings.ship.pickup[k] = v; });
  const set = (k, v) => update((d) => { d.settings.ship = d.settings.ship || structuredClone(SHIP.DEFAULTS); d.settings.ship[k] = v; });
  const sw = (k, label) => html`<label class="row" style=${{ gap: '10px', cursor: 'pointer' }}><button class=${'switch' + (sh[k] ? ' on' : '')} aria-label=${label} onClick=${() => set(k, !sh[k])}></button>${label}</label>`;
  return html`<div class="box stack">
    <h3 style=${{ margin: 0 }}>Shiprocket <span class="pill ok">Connected (demo)</span></h3>
    <span class="muted" style=${{ fontSize: '13px', marginTop: '-6px' }}>In the live store this uses Kalaksha’s Shiprocket API login. Couriers, rates and tracking come from Shiprocket.</span>
    <div class="grid2">
      <label class="f" htmlFor="sh-name">Pickup name<input id="sh-name" class="input" value=${sh.pickup.name} onChange=${(e) => setP('name', e.target.value)} /></label>
      <label class="f" htmlFor="sh-phone">Pickup phone<input id="sh-phone" class="input" placeholder="10-digit number" value=${sh.pickup.phone} onChange=${(e) => setP('phone', e.target.value)} /></label>
    </div>
    <label class="f" htmlFor="sh-addr">Pickup address<input id="sh-addr" class="input" value=${sh.pickup.address} onChange=${(e) => setP('address', e.target.value)} /></label>
    <div class="grid2">
      <label class="f" htmlFor="sh-city">City<input id="sh-city" class="input" value=${sh.pickup.city} onChange=${(e) => setP('city', e.target.value)} /></label>
      <label class="f" htmlFor="sh-pin">PIN code<input id="sh-pin" class="input" value=${sh.pickup.pin} onChange=${(e) => setP('pin', e.target.value)} /></label>
    </div>
    <div class="grid2">
      <label class="f" htmlFor="sh-slot">Pickup time<select id="sh-slot" class="select" value=${sh.slot} onChange=${(e) => set('slot', e.target.value)}>${['9 am – 12 pm', '11 am – 2 pm', '2 pm – 5 pm'].map((x) => html`<option key=${x}>${x}</option>`)}</select></label>
      <label class="f" htmlFor="sh-rule">Choose courier by<select id="sh-rule" class="select" value=${sh.rule} onChange=${(e) => set('rule', e.target.value)}><option value="recommended">Recommended (good rating, fair price)</option><option value="cheapest">Cheapest</option><option value="fastest">Fastest</option></select></label>
    </div>
    <div class="grid2">
      <label class="f" htmlFor="sh-w">Weight per toran (g)<input id="sh-w" class="input" type="number" min="1" value=${sh.perToranG} onChange=${(e) => set('perToranG', Math.max(1, +e.target.value || 1))} /></label>
      <label class="f" htmlFor="sh-pk">Packaging weight (g)<input id="sh-pk" class="input" type="number" min="0" value=${sh.packG} onChange=${(e) => set('packG', Math.max(0, +e.target.value || 0))} /></label>
    </div>
    ${sw('autoShip', 'Create the shipment automatically when an order is marked Packed')}
    ${sw('notify', 'Send courier and tracking updates to customers on WhatsApp and email')}
  </div>`;
}

function Products({ db, update, notify, editProduct }) {
  const [q, setQ] = useState('');
  const ratings = ratingMap(db.reviews);
  const t = q.trim().toLowerCase();
  const list = db.products.filter((p) => !t || (p.name + p.collection + p.type).toLowerCase().includes(t));
  const setField = (pid, k, v) => update((d) => { d.products.find((p) => p.id === pid)[k] = v; });
  return html`<div>
    <div class="toolbar"><input id="prod-search" class="input" placeholder="Search products" value=${q} onChange=${(e) => setQ(e.target.value)} />
      <span class="grow"></span><button class="btn primary" onClick=${() => editProduct('new')}><${Icon} n="plus" /> Add product</button></div>
    <div class="callout" style=${{ marginBottom: '12px' }}><${Icon} n="alert" /> Edit a price here and it updates in the store right away. Click a row to edit everything.</div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Product</th><th>Category</th><th class="r">Price (₹)</th><th class="r">Compare at (₹)</th><th class="r">Stock</th><th class="r">Sold</th><th>Rating</th><th>Visible</th><th></th></tr></thead>
      <tbody>${list.map((p) => { const st = stockOf(p); const r = ratings[p.id]; return html`<tr key=${p.id} class="click" onClick=${() => editProduct(p.id)}>
        <td><img class="thumb" src=${p.images[0]} alt="" /></td>
        <td><b>${p.name}</b><div class="muted" style=${{ fontSize: '12px' }}>${p.mr} · ${p.size} · ${p.variants.length} variant${p.variants.length > 1 ? 's' : ''}</div></td>
        <td>${catName(db, p.category)}<div class="muted" style=${{ fontSize: '12px' }}>${p.collection} collection</div></td>
        <td class="r" onClick=${(e) => e.stopPropagation()}><input id=${'price-' + p.id} class="inline-input num" type="number" min="0" value=${p.price} onChange=${(e) => setField(p.id, 'price', Math.max(0, +e.target.value || 0))} /></td>
        <td class="r" onClick=${(e) => e.stopPropagation()}><input id=${'mrp-' + p.id} class="inline-input num" type="number" min="0" placeholder="—" value=${p.mrp || ''} onChange=${(e) => setField(p.id, 'mrp', Math.max(0, +e.target.value || 0))} /></td>
        <td class="r"><span class=${'pill ' + (st === 0 ? 'bad' : st <= db.settings.lowStock ? 'warn' : 'ok')}>${st}</span></td>
        <td class="r num">${p.sold.toLocaleString('en-IN')}</td>
        <td>${r ? html`<${Stars} v=${r.avg} n=${r.n} />` : html`<span class="muted">—</span>`}</td>
        <td onClick=${(e) => e.stopPropagation()}><button class=${'switch' + (p.active ? ' on' : '')} aria-label="Visible in store" onClick=${() => { setField(p.id, 'active', !p.active); notify(p.active ? `${p.name} hidden from store` : `${p.name} is live in store`); }}></button></td>
        <td><button class="btn sm ghost"><${Icon} n="edit" /></button></td>
      </tr>`; })}</tbody></table></div>
  </div>`;
}

function ProductEditor({ db, update, notify, pid, onClose }) {
  useEsc(onClose);
  const isNew = pid === 'new';
  const library = uniq(db.products.flatMap((p) => [...p.images, ...p.variants.map((v) => v.img)]).filter(Boolean));
  const [p, setP] = useState(() => isNew
    ? { id: 'p-' + rid(), name: '', mr: '', collection: 'Ganapati', type: 'Door', category: (db.categories[0] || {}).id || '', size: '3 feet', sizeNote: 'about 90 cm', price: 350, mrp: 0, active: true, isNew: true, bestseller: false, featured: false, desc: '', images: [library[0]], variants: [{ id: 'v1', name: 'Standard', swatch: '#E9A21B', stock: 50 }], sold: 0 }
    : structuredClone(db.products.find((x) => x.id === pid)));
  const set = (k, v) => setP({ ...p, [k]: v });
  const setVar = (i, k, v) => setP({ ...p, variants: p.variants.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const toggleImg = (src) => set('images', p.images.includes(src) ? p.images.filter((x) => x !== src) : [...p.images, src]);
  const upload = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    try { const urls = await Promise.all(files.map(readImage)); setP((cur) => ({ ...cur, images: [...cur.images, ...urls] })); notify('Photo added'); }
    catch (err) { notify('Could not read that image. Try a JPG or PNG.'); }
  };
  const saveIt = () => {
    if (!p.name.trim()) { notify('Add a product name'); return; }
    if (!p.images.length) { notify('Pick at least one photo'); return; }
    update((d) => { const i = d.products.findIndex((x) => x.id === p.id); if (i >= 0) d.products[i] = p; else d.products.push(p); });
    notify(isNew ? `${p.name} added to the store` : `${p.name} saved`); onClose();
  };
  const del = () => { update((d) => { d.products = d.products.filter((x) => x.id !== p.id); d.cart = d.cart.filter((c) => c.pid !== p.id); }); notify(`${p.name} deleted`); onClose(); };
  const flag = (k, label) => html`<label class="row" style=${{ gap: '8px', fontSize: '14px', cursor: 'pointer' }}><button type="button" class=${'switch' + (p[k] ? ' on' : '')} onClick=${() => set(k, !p[k])} aria-label=${label}></button>${label}</label>`;
  const txt = (k, label, props = {}) => html`<label class="f" htmlFor=${'pe-' + k}>${label}<input id=${'pe-' + k} class="input" value=${p[k]} onChange=${(e) => set(k, props.type === 'number' ? Math.max(0, +e.target.value || 0) : e.target.value)} ...${props} /></label>`;

  return html`<div class="scrim" onClick=${onClose}></div>
  <aside class="drawer wide" role="dialog" aria-modal="true" aria-label="Edit product">
    <div class="head"><h3>${isNew ? 'Add product' : 'Edit product'}</h3><button class="icon-btn" onClick=${onClose} aria-label="Close"><${Icon} n="x" /></button></div>
    <div class="content stack" style=${{ gap: '14px' }}>
      <div class="grid2">${txt('name', 'Product name', { placeholder: 'e.g. Lakshmi Door Toran' })}${txt('mr', 'Marathi name', { placeholder: 'e.g. लक्ष्मी तोरण' })}</div>
      <div class="grid2">
        <label class="f" htmlFor="pe-coll">Collection<select id="pe-coll" class="select" value=${p.collection} onChange=${(e) => set('collection', e.target.value)}>${['Swami', 'Ganapati', 'Devi', 'Lakshmi', 'Other'].map((c) => html`<option key=${c}>${c}</option>`)}</select></label>
        <label class="f" htmlFor="pe-type">Category<select id="pe-type" class="select" value=${p.category || ''} onChange=${(e) => set('category', e.target.value)}><option value="">Uncategorised</option>${db.categories.map((c) => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select></label>
      </div>
      <div class="grid2">${txt('price', 'Selling price (₹)', { type: 'number', min: 0 })}${txt('mrp', 'Compare-at price (₹, optional)', { type: 'number', min: 0 })}</div>
      <div class="grid2">${txt('size', 'Size')}${txt('sizeNote', 'Size note')}</div>
      <label class="f" htmlFor="pe-desc">Description<textarea id="pe-desc" class="input" rows="3" value=${p.desc} onChange=${(e) => set('desc', e.target.value)}></textarea></label>
      <div class="row wrapflex" style=${{ gap: '18px' }}>${flag('active', 'Visible in store')}${flag('isNew', 'New badge')}${flag('bestseller', 'Bestseller badge')}${flag('featured', 'Featured')}</div>
      <div class="stack" style=${{ gap: '8px' }}><span class="opt-label">Photos · first one is the cover</span>
        <div class="imgpick">${[...uniq([...p.images, ...library])].map((src) => html`<button type="button" key=${src.slice(-40)} class=${p.images.includes(src) ? 'on' : ''} onClick=${() => toggleImg(src)} title=${p.images.includes(src) ? 'Remove from product' : 'Add to product'}><img src=${src} alt="" />
          ${p.images.indexOf(src) === 0 && html`<span style=${{ position: 'absolute', left: 2, top: 2, background: 'var(--kumkum)', color: 'var(--on-kumkum)', fontSize: '9px', padding: '0 4px', borderRadius: '4px' }}>COVER</span>`}</button>`)}</div>
        <label class="upload" htmlFor="pe-upload"><${Icon} n="upload" /> Upload new photos<input id="pe-upload" type="file" accept="image/*" multiple hidden onChange=${upload} /></label>
      </div>
      <div class="stack" style=${{ gap: '8px' }}><div class="row between"><span class="opt-label">Colours and stock</span>
        <button type="button" class="btn sm" onClick=${() => set('variants', [...p.variants, { id: 'v' + rid(), name: 'New colour', swatch: '#1F6B4A', stock: 0 }])}><${Icon} n="plus" /> Add colour</button></div>
        ${p.variants.map((v, i) => html`<div key=${v.id} class="row wrapflex" style=${{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '8px' }}>
          <input type="color" aria-label="Swatch" value=${v.swatch} onChange=${(e) => setVar(i, 'swatch', e.target.value)} style=${{ width: '36px', height: '36px', border: 0, background: 'none', padding: 0 }} />
          <input id=${'pv-name-' + i} class="input grow" value=${v.name} onChange=${(e) => setVar(i, 'name', e.target.value)} aria-label="Colour name" />
          <label class="row" style=${{ gap: '6px', fontSize: '13px' }}>Stock<input id=${'pv-stock-' + i} class="inline-input" type="number" min="0" value=${v.stock} onChange=${(e) => setVar(i, 'stock', Math.max(0, +e.target.value || 0))} /></label>
          <select class="select" aria-label="Colour photo" style=${{ width: 'auto', maxWidth: '130px', padding: '6px' }} value=${v.img || ''} onChange=${(e) => setVar(i, 'img', e.target.value || undefined)}>
            <option value="">Photo: cover</option>${p.images.map((src, k) => html`<option key=${k} value=${src}>Photo ${k + 1}</option>`)}</select>
          ${p.variants.length > 1 && html`<button type="button" class="icon-btn" aria-label="Remove colour" onClick=${() => set('variants', p.variants.filter((_, j) => j !== i))}><${Icon} n="trash" /></button>`}
        </div>`)}
      </div>
    </div>
    <div class="foot"><div class="row">${!isNew && html`<${ConfirmBtn} label="Delete" confirm="Click again to delete" onConfirm=${del} />`}<span class="grow"></span>
      <button class="btn" onClick=${onClose}>Cancel</button><button class="btn primary" onClick=${saveIt}>${isNew ? 'Add product' : 'Save changes'}</button></div></div>
  </aside>`;
}

function Inventory({ db, update, notify }) {
  const low = db.settings.lowStock;
  const rows = db.products.flatMap((p) => p.variants.map((v) => ({ p, v })));
  const adj = (pid, vid, n, abs) => update((d) => { const v = d.products.find((p) => p.id === pid).variants.find((x) => x.id === vid); v.stock = Math.max(0, abs ? n : v.stock + n); });
  const units = rows.reduce((a, r) => a + r.v.stock, 0);
  const value = rows.reduce((a, r) => a + r.v.stock * r.p.price, 0);
  return html`<div>
    <div class="kpis" style=${{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: '14px' }}>
      <div class="kpi"><span class="l">Units in stock</span><span class="v num">${units.toLocaleString('en-IN')}</span><span class="s">${rows.length} product colours</span></div>
      <div class="kpi"><span class="l">Stock value</span><span class="v">${inrShort(value)}</span><span class="s">At selling price</span></div>
      <div class="kpi"><span class="l">Low stock</span><span class="v num">${rows.filter((r) => r.v.stock > 0 && r.v.stock <= low).length}</span><span class="s">${low} units or fewer</span></div>
      <div class="kpi"><span class="l">Out of stock</span><span class="v num">${rows.filter((r) => r.v.stock === 0).length}</span><span class="s">Hidden from checkout</span></div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th></th><th>Product</th><th>Colour</th><th>Status</th><th class="r">In stock</th><th>Adjust</th></tr></thead>
      <tbody>${rows.sort((a, b) => a.v.stock - b.v.stock).map(({ p, v }) => html`<tr key=${p.id + v.id}>
        <td><img class="thumb" src=${v.img || p.images[0]} alt="" /></td>
        <td><b>${p.name}</b><div class="muted" style=${{ fontSize: '12px' }}>${p.size}</div></td>
        <td><span class="row" style=${{ gap: '6px' }}><span class="sw" style=${{ background: v.swatch }}></span>${v.name}</span></td>
        <td><span class=${'pill ' + (v.stock === 0 ? 'bad' : v.stock <= low ? 'warn' : 'ok')}>${v.stock === 0 ? 'Out of stock' : v.stock <= low ? 'Low stock' : 'In stock'}</span></td>
        <td class="r"><input id=${'inv-' + p.id + v.id} class="inline-input num" type="number" min="0" value=${v.stock} onChange=${(e) => adj(p.id, v.id, +e.target.value || 0, true)} /></td>
        <td><div class="row" style=${{ gap: '4px' }}>
          <button class="btn sm" onClick=${() => adj(p.id, v.id, -10)}>−10</button>
          <button class="btn sm" onClick=${() => adj(p.id, v.id, 10)}>+10</button>
          <button class="btn sm primary" onClick=${() => { adj(p.id, v.id, 50); notify(`Restocked ${p.name} (${v.name}) +50`); }}>Restock +50</button></div></td>
      </tr>`)}</tbody></table></div>
  </div>`;
}

function Customers({ db }) {
  const [q, setQ] = useState('');
  const map = {};
  db.orders.forEach((o) => {
    const k = o.customer.phone;
    const c = map[k] || (map[k] = { name: o.customer.name, phone: k, city: o.customer.city, state: o.customer.state, orders: 0, spent: 0, last: o.date, mine: false });
    c.orders++; c.spent += o.total; if (o.date > c.last) c.last = o.date; if (o.mine) c.mine = true;
  });
  const t = q.trim().toLowerCase();
  const list = Object.values(map).filter((c) => !t || (c.name + c.phone + c.city).toLowerCase().includes(t)).sort((a, b) => b.spent - a.spent);
  const mh = list.filter((c) => c.state === 'Maharashtra').length;
  return html`<div>
    <div class="toolbar"><input id="cust-search" class="input" placeholder="Search name, phone, city" value=${q} onChange=${(e) => setQ(e.target.value)} />
      <span class="muted">${list.length} customers · ${Math.round((mh / Math.max(1, list.length)) * 100)}% in Maharashtra</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Phone</th><th>Location</th><th class="r">Orders</th><th class="r">Total spent</th><th>Last order</th></tr></thead>
      <tbody>${list.map((c) => html`<tr key=${c.phone}>
        <td><b>${c.name}</b>${c.mine && html` <span class="pill brand nodot">Live</span>`}${c.orders > 1 && html` <span class="pill ok nodot">Repeat</span>`}</td>
        <td class="mono">${c.phone}</td><td>${c.city}, ${c.state}</td>
        <td class="r num">${c.orders}</td><td class="r num"><b>${inr(c.spent)}</b></td><td class="muted">${fmtDate(c.last)}</td></tr>`)}</tbody></table></div>
  </div>`;
}

function Reviews({ db, update, notify }) {
  const [f, setF] = useState('All');
  const list = db.reviews.filter((r) => f === 'All' || r.status === f).sort((a, b) => b.date.localeCompare(a.date));
  const name = (pid) => (db.products.find((p) => p.id === pid) || { name: 'Deleted product' }).name;
  return html`<div>
    <div class="toolbar">${['All', 'Published', 'Hidden'].map((s) => html`<button key=${s} class=${'chip' + (f === s ? ' on' : '')} onClick=${() => setF(s)}>${s}</button>`)}
      <span class="muted">Average ${(db.reviews.filter((r) => r.status === 'Published').reduce((a, r) => a + r.rating, 0) / Math.max(1, db.reviews.filter((r) => r.status === 'Published').length)).toFixed(1)} ★</span></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Product</th><th>Rating</th><th>Review</th><th>By</th><th>Date</th><th>Shown</th><th></th></tr></thead>
      <tbody>${list.map((r) => html`<tr key=${r.id}>
        <td style=${{ whiteSpace: 'nowrap' }}>${name(r.pid)}</td><td><${Stars} v=${r.rating} /></td>
        <td style=${{ minWidth: '240px' }}>${r.text}</td>
        <td style=${{ whiteSpace: 'nowrap' }}>${r.name}${r.sample ? html` <span class="pill neutral nodot">Sample</span>` : html` <span class="pill brand nodot">Live</span>`}</td>
        <td class="muted">${fmtDate(r.date)}</td>
        <td><button class=${'switch' + (r.status === 'Published' ? ' on' : '')} aria-label="Show in store" onClick=${() => { update((d) => { const x = d.reviews.find((y) => y.id === r.id); x.status = x.status === 'Published' ? 'Hidden' : 'Published'; }); notify(r.status === 'Published' ? 'Review hidden from store' : 'Review shown in store'); }}></button></td>
        <td><${ConfirmBtn} label="Delete" confirm="Confirm" onConfirm=${() => { update((d) => { d.reviews = d.reviews.filter((y) => y.id !== r.id); }); notify('Review deleted'); }} /></td>
      </tr>`)}</tbody></table></div>
  </div>`;
}

function Settings({ db, update, notify, reset }) {
  const s = db.settings;
  const num = (k, label, help) => html`<label class="f" htmlFor=${'st-' + k}>${label}
    <input id=${'st-' + k} class="input" type="number" min="0" value=${s[k]} onChange=${(e) => update((d) => { d.settings[k] = Math.max(0, +e.target.value || 0); })} />
    ${help && html`<span class="muted" style=${{ fontWeight: 400 }}>${help}</span>`}</label>`;
  return html`<div class="stack" style=${{ gap: '14px', maxWidth: '760px' }}>
    <div class="box stack"><h3>Delivery charges</h3>
      <div class="grid2">${num('rateMH', 'Maharashtra, per parcel (₹)')}${num('rateROI', 'Rest of India, per parcel (₹)')}</div>
      <div class="grid2">${num('perParcel', 'Torans per parcel', 'From the catalogue: up to 4')}${num('freeShipAbove', 'Free delivery above (₹)', '0 means never free')}</div></div>
    <${ShippingSettings} db=${db} update=${update} />
    <div class="box stack"><h3>Payments</h3>
      <div class="grid2">${num('gatewayPct', 'Gateway fee (%)', 'Razorpay standard is 2%')}${num('gstOnFee', 'GST on gateway fee (%)')}</div>
      <label class="row" style=${{ gap: '10px', cursor: 'pointer' }}><button class=${'switch' + (s.cod ? ' on' : '')} aria-label="Cash on Delivery" onClick=${() => update((d) => { d.settings.cod = !d.settings.cod; })}></button>Offer Cash on Delivery <span class="muted">(off in the current catalogue policy)</span></label></div>
    <div class="box stack"><h3>Store</h3>
      <label class="f" htmlFor="st-ann">Announcement bar<input id="st-ann" class="input" value=${s.announcement} onChange=${(e) => update((d) => { d.settings.announcement = e.target.value; })} /></label>
      ${num('lowStock', 'Low stock alert at (units)')}</div>
    <div class="box row between wrapflex"><div><b>Reset demo</b><div class="muted" style=${{ fontSize: '13px' }}>Restores the catalogue products and fresh sample orders.</div></div>
      <${ConfirmBtn} label="Reset demo data" confirm="Click again to reset" onConfirm=${reset} /></div>
  </div>`;
}

const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
