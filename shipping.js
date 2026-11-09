/* Simulated Shiprocket integration for the Kalaksha demo.
   Courier names are real Indian couriers available through Shiprocket; the rates, delivery days
   and ratings below are SAMPLE figures for the demo, not Shiprocket's price list. */
(function () {
  const COURIERS = [
    { id: 'delhivery', name: 'Delhivery Surface', rate: { local: 32, state: 38, national: 55 }, days: { local: 2, state: 3, national: 5 }, rating: 4.3, prefix: '1490' },
    { id: 'xpressbees', name: 'Xpressbees', rate: { local: 30, state: 36, national: 52 }, days: { local: 2, state: 3, national: 5 }, rating: 4.1, prefix: '1418' },
    { id: 'ekart', name: 'Ekart', rate: { local: 28, state: 34, national: 49 }, days: { local: 3, state: 4, national: 6 }, rating: 3.9, prefix: 'FMPC' },
    { id: 'dtdc', name: 'DTDC', rate: { local: 34, state: 41, national: 58 }, days: { local: 2, state: 3, national: 5 }, rating: 4.0, prefix: 'D' },
    { id: 'bluedart', name: 'Blue Dart', rate: { local: 55, state: 62, national: 86 }, days: { local: 1, state: 2, national: 3 }, rating: 4.6, prefix: '7766' },
  ];
  const FLOW = ['Pickup scheduled', 'Picked up', 'In transit', 'Out for delivery', 'Delivered'];
  const ZONE_LABEL = { local: 'Same city', state: 'Within Maharashtra', national: 'Rest of India' };
  const DEFAULTS = {
    connected: true,
    pickup: { name: 'Kalaksha', phone: '', address: '[Pickup address]', city: 'Pune', state: 'Maharashtra', pin: '411001' },
    perToranG: 150, packG: 100, box: '30 × 25 × 5 cm', rule: 'recommended', autoShip: false, notify: true, slot: '11 am – 2 pm',
  };
  const NDR_REASONS = ['Customer not available', 'Address incomplete', 'Customer asked for delivery later', 'Phone not reachable'];

  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  function zoneOf(c, p) {
    if (c.city && p.city && c.city.trim().toLowerCase() === p.city.trim().toLowerCase()) return 'local';
    if (c.state === p.state) return 'state';
    return 'national';
  }
  function quotes(o, ship, perParcel) {
    const per = perParcel || 4;
    const zone = zoneOf(o.customer, ship.pickup);
    const parcels = Math.max(1, Math.ceil(o.qty / per));
    const weight = Math.min(o.qty, per) * ship.perToranG + ship.packG; // grams per parcel
    const slabs = Math.max(1, Math.ceil(weight / 500));
    return COURIERS.map((c) => {
      const base = c.rate[zone];
      const one = Math.round((base + (slabs - 1) * Math.round(base * 0.8)) * 1.18); // incl. 18% GST
      return { id: c.id, name: c.name, cost: one * parcels, days: c.days[zone], rating: c.rating, zone, weight, parcels };
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
      courierId: q.id, courier: q.name, awb: awbFor(q.id, rnd), cost: q.cost, parcels: q.parcels, weight: q.weight, zone: q.zone,
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
    const hub = sh.zone === 'national' ? 'Bhiwandi hub, Maharashtra' : sh.zone === 'state' ? o.customer.city + ' hub' : ship.pickup.city + ' sort centre';
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

  window.SHIP = { COURIERS, FLOW, ZONE_LABEL, DEFAULTS, NDR_REASONS, zoneOf, quotes, pick, create, advance, fail, rto, fmtDay };
})();
