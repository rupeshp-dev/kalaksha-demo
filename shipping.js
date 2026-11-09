/* Simulated Shiprocket integration for the Kalaksha demo.
   Rates are from Shiprocket's public rate card (Lite plan, shiprocket.in/pricing/rate-card, checked 9 Nov 2026):
   first 500 g and each extra 500 g, by zone A–E. 18% GST is added on top. Delivery days and ratings are samples. */
(function () {
  // first: rate for the first 500 g, extra: each additional 500 g. Zones: A same city, B same state, C metro to metro, D rest of India, E North-East / J&K.
  const COURIERS = [
    { id: 'xpressbees', name: 'Xpressbees Surface', first: { A: 45, B: 53, C: 61, D: 65, E: 97 }, extra: { A: 42, B: 52, C: 55, D: 61, E: 91 }, days: { A: 2, B: 3, C: 4, D: 5, E: 7 }, rating: 4.1, prefix: '1418' },
    { id: 'delhivery', name: 'Delhivery Surface', first: { A: 51, B: 57, C: 66, D: 71, E: 103 }, extra: { A: 48, B: 56, C: 63, D: 66, E: 97 }, days: { A: 2, B: 3, C: 4, D: 5, E: 7 }, rating: 4.3, prefix: '1490' },
    { id: 'ekart', name: 'Ekart Surface', first: { A: 51, B: 57, C: 65, D: 70, E: 102 }, extra: { A: 48, B: 54, C: 62, D: 66, E: 97 }, days: { A: 3, B: 4, C: 5, D: 6, E: 8 }, rating: 3.9, prefix: 'FMPC' },
    { id: 'dtdc', name: 'DTDC Surface', first: { A: 65.7, B: 72.6, C: 78.5, D: 83.5, E: 128.5 }, extra: { A: 64, B: 71, C: 76, D: 82, E: 127 }, days: { A: 2, B: 3, C: 4, D: 5, E: 7 }, rating: 4.0, prefix: 'D' },
    { id: 'bluedart', name: 'Blue Dart Air', first: { A: 77, B: 91, C: 105, D: 123, E: 167 }, extra: { A: 73, B: 83, C: 100, D: 110, E: 157 }, days: { A: 1, B: 2, C: 2, D: 3, E: 4 }, rating: 4.6, prefix: '7766' },
  ];
  const FLOW = ['Pickup scheduled', 'Picked up', 'In transit', 'Out for delivery', 'Delivered'];
  const ZONE_LABEL = { A: 'Zone A · same city', B: 'Zone B · within state', C: 'Zone C · metro to metro', D: 'Zone D · rest of India', E: 'Zone E · North-East / J&K', local: 'Same city', state: 'Within state', national: 'Rest of India' };
  const METROS = ['mumbai', 'delhi', 'new delhi', 'kolkata', 'chennai', 'bengaluru', 'bangalore', 'hyderabad', 'ahmedabad', 'pune'];
  const SPECIAL_STATES = ['Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura', 'Jammu and Kashmir', 'Ladakh'];
  const DEFAULTS = {
    connected: true,
    pickup: { name: 'Kalaksha', phone: '', address: '[Pickup address]', city: 'Pune', state: 'Maharashtra', pin: '411001' },
    perToranG: 150, packG: 100, boxCm: [25, 20, 5], rule: 'recommended', autoShip: false, notify: true, slot: '11 am – 2 pm',
  };
  const NDR_REASONS = ['Customer not available', 'Address incomplete', 'Customer asked for delivery later', 'Phone not reachable'];

  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  function zoneOf(c, p) {
    const cc = (c.city || '').trim().toLowerCase(), pc = (p.city || '').trim().toLowerCase();
    if (cc && cc === pc) return 'A';
    if (SPECIAL_STATES.includes(c.state)) return 'E';
    if (c.state === p.state) return 'B';
    if (METROS.includes(cc) && METROS.includes(pc)) return 'C';
    return 'D';
  }
  // Couriers charge the higher of actual weight and volumetric weight (L × W × H in cm ÷ 5000 kg).
  function volumetricG(ship) { const [l, w, h] = ship.boxCm || [25, 20, 5]; return Math.round((l * w * h) / 5); }
  function quotes(o, ship, perParcel) {
    const per = perParcel || 4;
    const zone = zoneOf(o.customer, ship.pickup);
    const parcels = Math.max(1, Math.ceil(o.qty / per));
    const weight = Math.min(o.qty, per) * ship.perToranG + ship.packG; // actual grams per parcel
    const charged = Math.max(weight, volumetricG(ship));
    const slabs = Math.max(1, Math.ceil(charged / 500));
    return COURIERS.map((c) => {
      const one = Math.round((c.first[zone] + (slabs - 1) * c.extra[zone]) * 1.18); // + 18% GST
      return { id: c.id, name: c.name, cost: one * parcels, days: c.days[zone], rating: c.rating, zone, weight, charged, slabs, parcels };
    });
  }
  function pick(qs, rule) {
    if (rule === 'cheapest') return [...qs].sort((a, b) => a.cost - b.cost)[0];
    if (rule === 'fastest') return [...qs].sort((a, b) => a.days - b.days || a.cost - b.cost)[0];
    const min = Math.min(...qs.map((q) => q.cost));
    return [...qs].filter((q) => q.cost <= min * 1.25).sort((a, b) => b.rating - a.rating || a.cost - b.cost)[0];
  }
  function awbFor(id, rnd) {
    const c = COURIERS.find((x) => x.id === id);
    return c.prefix + String(Math.floor(rnd() * 1e10)).padStart(10, '0');
  }
  function create(o, q, ship, when, rnd, pickupDate) {
    rnd = rnd || Math.random;
    const at = when ? new Date(when) : new Date();
    const pickup = pickupDate ? new Date(pickupDate) : addDays(at, at.getHours() >= 14 ? 1 : 0);
    o.shipment = {
      courierId: q.id, courier: q.name, awb: awbFor(q.id, rnd), cost: q.cost, parcels: q.parcels, weight: q.weight, charged: q.charged, zone: q.zone,
      days: q.days, eta: addDays(pickup, q.days).toISOString(), pickupDate: pickup.toISOString(), status: 'Pickup scheduled', attempts: 0,
      events: [
        { at: at.toISOString(), status: 'Shipment created', loc: 'Shiprocket', note: `${q.name} · ${q.parcels} parcel${q.parcels > 1 ? 's' : ''} · ${q.weight} g` },
        { at: at.toISOString(), status: 'Pickup scheduled', loc: ship.pickup.city, note: `${fmtDay(pickup)}, ${ship.slot}` },
      ],
    };
    o.awb = o.shipment.awb;
    if (o.status === 'New' || o.status === 'Packed') o.status = 'Shipped';
  }
  function advance(o, ship, when) {
    const sh = o.shipment;
    if (!sh || sh.status === 'Delivered' || sh.status === 'Returned') return null;
    let next;
    if (sh.status === 'Delivery failed') next = 'Out for delivery';
    else if (sh.status === 'Returning') next = 'Returned';
    else next = FLOW[FLOW.indexOf(sh.status) + 1];
    const hub = ['C', 'D', 'E', 'national'].includes(sh.zone) ? 'Bhiwandi hub, Maharashtra' : ['B', 'state'].includes(sh.zone) ? o.customer.city + ' hub' : ship.pickup.city + ' sort centre';
    const loc = next === 'Picked up' ? ship.pickup.city : next === 'In transit' ? hub : next === 'Returned' ? ship.pickup.city : o.customer.city;
    const note = { 'Picked up': 'Collected from Kalaksha', 'In transit': 'Moving to destination', 'Out for delivery': sh.status === 'Delivery failed' ? 'Second attempt today' : 'With the delivery agent', Delivered: 'Received by customer', Returned: 'Back at Kalaksha' }[next] || '';
    sh.status = next;
    sh.events.push({ at: (when ? new Date(when) : new Date()).toISOString(), status: next, loc, note });
    if (next === 'Delivered') { o.status = 'Delivered'; sh.deliveredAt = sh.events[sh.events.length - 1].at; }
    if (next === 'Returned') o.status = 'Returned';
    return next;
  }
  function fail(o, reason, when) {
    const sh = o.shipment; if (!sh) return;
    sh.status = 'Delivery failed'; sh.attempts = (sh.attempts || 0) + 1;
    sh.events.push({ at: (when ? new Date(when) : new Date()).toISOString(), status: 'Delivery failed', loc: o.customer.city, note: reason || NDR_REASONS[0] });
  }
  function rto(o, when) {
    const sh = o.shipment; if (!sh) return;
    sh.status = 'Returning';
    sh.events.push({ at: (when ? new Date(when) : new Date()).toISOString(), status: 'Returning', loc: o.customer.city, note: 'Return to Kalaksha requested' });
  }

  window.SHIP = { COURIERS, FLOW, ZONE_LABEL, DEFAULTS, volumetricG, NDR_REASONS, zoneOf, quotes, pick, create, advance, fail, rto, fmtDay };
})();
