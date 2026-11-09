/* Kalaksha demo data.
   Products, prices, sizes, colours and delivery rules come from Kalaksha_Catalogue.pdf.
   Orders, customers, reviews, stock levels and sales history are SAMPLE data for the demo. */
(function () {
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const PRODUCTS = [
    {
      id: 'swami-door', name: 'Swami Door Toran', mr: 'स्वामी तोरण', collection: 'Swami', type: 'Door',
      size: '3 feet', sizeNote: 'about 90 cm', price: 350, mrp: 0, active: true, isNew: false, bestseller: true, featured: true,
      desc: 'Yellow and black pennants with the Swami motif and rudraksha mala, a red brocade border and red pom-pom tassels. Made to bring a devotional touch to your main door.',
      images: ['img/swami-door.jpg', 'img/swami-door-detail.jpg', 'img/swami-door-poster.jpg'],
      variants: [{ id: 'v1', name: 'Yellow & Black', swatch: '#E5B325', stock: 124 }], sold: 2140,
    },
    {
      id: 'swami-devghar', name: 'Swami Devghar Toran', mr: 'स्वामी देवघर तोरण', collection: 'Swami', type: 'Devghar',
      size: '18 inches', sizeNote: 'about 45 cm', price: 230, mrp: 0, active: true, isNew: false, bestseller: false, featured: false,
      desc: 'The Swami design sized for your home temple. Sits neatly across the top of a wooden devghar.',
      images: ['img/swami-devghar.jpg'],
      variants: [{ id: 'v1', name: 'Yellow & Black', swatch: '#E5B325', stock: 86 }], sold: 1215,
    },
    {
      id: 'swami-car', name: 'Swami Car Toran', mr: 'स्वामी कार तोरण', collection: 'Swami', type: 'Car',
      size: '3 feet', sizeNote: 'about 90 cm', price: 400, mrp: 0, active: true, isNew: false, bestseller: false, featured: false,
      desc: 'A Swami toran made for the rear windscreen of your car, for a blessing on every drive.',
      images: ['img/swami-car.jpg'],
      variants: [{ id: 'v1', name: 'Saffron & Red', swatch: '#E46A1E', stock: 41 }], sold: 640,
    },
    {
      id: 'ganapati-door', name: 'Ganapati Door Toran', mr: 'गणपती तोरण', collection: 'Ganapati', type: 'Door',
      size: '3 feet', sizeNote: 'about 90 cm', price: 350, mrp: 0, active: true, isNew: false, bestseller: true, featured: true,
      desc: 'Bappa (मोरया) pennants with a red-and-gold border and yellow pom-poms. Available in three colours.',
      images: ['img/ganapati-yellow.jpg', 'img/ganapati-blue.jpg', 'img/ganapati-green.jpg', 'img/ganapati-poster.jpg'],
      variants: [
        { id: 'yellow', name: 'Yellow', swatch: '#F2C230', stock: 138, img: 'img/ganapati-yellow.jpg' },
        { id: 'blue', name: 'Blue', swatch: '#1F3F8F', stock: 64, img: 'img/ganapati-blue.jpg' },
        { id: 'green', name: 'Green', swatch: '#1E6B47', stock: 9, img: 'img/ganapati-green.jpg' },
      ], sold: 2980,
    },
    {
      id: 'devi-door', name: 'Devi Door Toran', mr: 'देवी तोरण', collection: 'Devi', type: 'Door',
      size: '3 feet', sizeNote: 'about 90 cm', price: 500, mrp: 0, active: true, isNew: true, bestseller: false, featured: true,
      desc: 'Green and yellow Devi pennants with red tassels. Traditional décor for your doorway.',
      images: ['img/devi-door.jpg', 'img/devi-devghar.jpg'],
      variants: [{ id: 'v1', name: 'Green & Yellow', swatch: '#1E6B47', stock: 37 }], sold: 410,
    },
    {
      id: 'devi-devghar', name: 'Devi Devghar Toran', mr: 'देवी देवघर तोरण', collection: 'Devi', type: 'Devghar',
      size: '18 inches', sizeNote: 'about 45 cm', price: 230, mrp: 0, active: true, isNew: true, bestseller: false, featured: false,
      desc: 'A devotional accent for your home temple, in the Devi design.',
      images: ['img/devi-devghar.jpg'],
      variants: [{ id: 'v1', name: 'Green & Yellow', swatch: '#1E6B47', stock: 12 }], sold: 295,
    },
  ];

  const REVIEW_TEXT = [
    [5, 'Colours are bright and the stitching is neat. Looks lovely on our main door.'],
    [5, 'Ordered for Diwali. Packed well and reached on time.'],
    [4, 'Good quality. Slightly smaller than I expected, but it fits the devghar well.'],
    [5, 'Washed it once and the colours held up. Will order again.'],
    [4, 'Nice handmade finish. Delivery took a couple of extra days.'],
    [5, 'Gifted to my parents. They loved it.'],
  ];
  const NAMES = ['Aarti K.', 'Rohan D.', 'Sneha P.', 'Amit J.', 'Pooja S.', 'Vikram P.', 'Neha G.', 'Sagar J.', 'Kavita M.', 'Prasad B.'];
  const FULLNAMES = ['Aarti Kulkarni', 'Rohan Deshmukh', 'Sneha Patil', 'Amit Joshi', 'Pooja Shinde', 'Vikram Pawar', 'Neha Gokhale', 'Sagar Jadhav', 'Kavita More', 'Prasad Bhosale', 'Anjali Mehta', 'Rahul Nair', 'Divya Iyer', 'Manish Gupta', 'Shruti Rao', 'Ketan Sawant', 'Meera Apte', 'Nikhil Chavan'];
  const CITIES = [
    ['Pune', 'Maharashtra', '411038'], ['Mumbai', 'Maharashtra', '400076'], ['Nashik', 'Maharashtra', '422005'],
    ['Kolhapur', 'Maharashtra', '416003'], ['Nagpur', 'Maharashtra', '440010'], ['Thane', 'Maharashtra', '400601'],
    ['Aurangabad', 'Maharashtra', '431001'], ['Bengaluru', 'Karnataka', '560034'], ['Hyderabad', 'Telangana', '500081'],
    ['Ahmedabad', 'Gujarat', '380015'], ['Indore', 'Madhya Pradesh', '452001'], ['Panaji', 'Goa', '403001'],
  ];

  const STATES = ['Maharashtra', 'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

  function dayKey(d) { return d.toISOString().slice(0, 10); }

  function seed() {
    const r = rng(20261108);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const now = new Date();
    const settings = {
      rateMH: 80, rateROI: 100, perParcel: 4, freeShipAbove: 0,
      gatewayPct: 2, gstOnFee: 18, lowStock: 15,
      announcement: 'Handmade in Maharashtra · Delivery across India · Up to 4 torans ship in one parcel',
      cod: false,
    };
    settings.ship = JSON.parse(JSON.stringify(window.SHIP.DEFAULTS));

    // Reviews (sample)
    const reviews = [];
    let rid = 1;
    PRODUCTS.forEach((p, pi) => {
      const n = 3 + (pi % 3);
      for (let i = 0; i < n; i++) {
        const [rating, text] = REVIEW_TEXT[(pi + i * 2) % REVIEW_TEXT.length];
        const d = new Date(now); d.setDate(d.getDate() - Math.floor(r() * 40) - 1);
        reviews.push({ id: 'r' + rid++, pid: p.id, name: pick(NAMES), city: pick(CITIES)[0], rating, text, date: d.toISOString(), status: 'Published', sample: true });
      }
    });

    // 30 days of daily totals (sample)
    const hist = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      let orders = Math.round(370 + (29 - i) * 3.2 + (r() - 0.5) * 70);
      if (i === 0) orders = Math.round(orders * 0.62); // today so far
      const revenue = Math.round(orders * (440 + r() * 50));
      hist.push({ date: dayKey(d), orders, revenue });
    }

    // Recent detailed orders (sample)
    const orders = [];
    let no = 24518;
    for (let i = 0; i < 90; i++) {
      const ageH = i * 0.8 + r() * 0.5; // newest first
      const d = new Date(now.getTime() - ageH * 3600e3);
      const [city, state, pin] = pick(CITIES);
      const nItems = r() < 0.72 ? 1 : 2;
      const items = [];
      for (let k = 0; k < nItems; k++) {
        const p = PRODUCTS[Math.floor(r() * r() * PRODUCTS.length * 1.3) % PRODUCTS.length];
        const v = pick(p.variants);
        if (items.find((x) => x.pid === p.id && x.vid === v.id)) continue;
        items.push({ pid: p.id, vid: v.id, name: p.name, variant: v.name, img: v.img || p.images[0], price: p.price, qty: r() < 0.82 ? 1 : 2 });
      }
      const qty = items.reduce((s, x) => s + x.qty, 0);
      const subtotal = items.reduce((s, x) => s + x.price * x.qty, 0);
      const shipping = Math.ceil(qty / settings.perParcel) * (state === 'Maharashtra' ? settings.rateMH : settings.rateROI);
      const discount = r() < 0.15 ? Math.round(subtotal * 0.1) : 0;
      const total = subtotal + shipping - discount;
      let status = 'New';
      if (ageH > 6) status = 'Packed';
      if (ageH > 18) status = 'Shipped';
      if (ageH > 50) status = 'Delivered';
      if (ageH > 6 && r() < 0.18) status = 'New';
      if (status === 'Delivered' && r() < 0.06) status = 'Replacement';
      const name = pick(FULLNAMES);
      const source = r() < 0.5 ? 'WhatsApp' : (r() < 0.06 ? 'Instagram' : 'Website');
      const method = source !== 'Website' ? 'UPI direct' : r() < 0.78 ? 'UPI' : r() < 0.6 ? 'Card' : 'Netbanking';
      const payStatus = source !== 'Website' && ageH < 4 && r() < 0.5 ? 'Pending' : 'Paid';
      orders.push({
        id: 'KLK-' + no--, date: d.toISOString(), items, qty, subtotal, shipping, discount, total,
        coupon: discount ? 'FESTIVE10' : '',
        customer: { name, phone: '98' + String(Math.floor(r() * 1e8)).padStart(8, '0'), email: name.split(' ')[0].toLowerCase() + '@example.com', address: (10 + Math.floor(r() * 300)) + ', ' + pick(['Shanti Nagar', 'Ganesh Colony', 'Laxmi Road', 'MG Road', 'Shivaji Park', 'Sai Residency']), city, state, pin },
        payment: { method, ref: method === 'UPI direct' ? (payStatus === 'Paid' ? 'UTR ' + String(Math.floor(r() * 1e12)).padStart(12, '0') : '') : 'pay_' + Math.floor(r() * 36 ** 8).toString(36).toUpperCase().padStart(8, '0'), status: payStatus },
        source,
        status, awb: ['Shipped', 'Delivered', 'Replacement'].includes(status) ? 'SR' + Math.floor(1e9 + r() * 9e9) : '',
        sample: true,
      });
    }

    // Sample Shiprocket shipments for orders already handed to couriers
    const SH = window.SHIP;
    orders.forEach((o) => {
      if (!['Shipped', 'Delivered', 'Replacement'].includes(o.status)) return;
      const keep = o.status;
      const ageH = (now - new Date(o.date)) / 3600e3;
      const created = new Date(new Date(o.date).getTime() + 6 * 3600e3);
      SH.create(o, SH.pick(SH.quotes(o, settings.ship, settings.perParcel), 'recommended'), settings.ship, created, r, created);
      const steps = keep === 'Shipped' ? Math.max(0, Math.min(3, Math.floor((ageH - 18) / 8))) : 4;
      const span = Math.max(1, now - created - 1800e3);
      for (let k = 0; k < steps; k++) SH.advance(o, settings.ship, new Date(created.getTime() + ((k + 1) / (steps + 0.5)) * span));
      if (keep === 'Shipped' && o.shipment.status === 'Out for delivery' && r() < 0.4) SH.fail(o, pick(SH.NDR_REASONS), new Date(now - 1200e3));
      o.status = keep;
    });

    const plus = (n) => { const x = new Date(now); x.setDate(x.getDate() + n); return dayKey(x); };
    const C = (o) => Object.assign({ desc: '', type: 'pct', value: 0, maxDiscount: 0, minOrder: 0, minQty: 0, starts: '', ends: '', limit: 0, perCustomer: 0, firstOrder: false, eligible: [], products: [], collections: [], showAtCheckout: true, active: true, uses: 0 }, o);
    const coupons = [
      C({ code: 'FESTIVE10', desc: '10% off on orders above ₹500', type: 'pct', value: 10, maxDiscount: 200, minOrder: 500, limit: 1000, perCustomer: 1, uses: 412 }),
      C({ code: 'WELCOME50', desc: '₹50 off your first order', type: 'flat', value: 50, minOrder: 400, firstOrder: true, perCustomer: 1, uses: 187 }),
      C({ code: 'FREESHIP4', desc: 'Free delivery on 4 or more torans', type: 'freeship', minQty: 4, uses: 63 }),
      C({ code: 'GANAPATI15', desc: '15% off Ganapati torans', type: 'pct', value: 15, collections: ['Ganapati'], ends: plus(20), uses: 96 }),
      C({ code: 'LOYAL20', desc: '20% off for our regular customers', type: 'pct', value: 20, maxDiscount: 300, eligible: ['sneha@example.com', '9822045671', 'aarti@example.com'], perCustomer: 2, showAtCheckout: false, uses: 4 }),
      C({ code: 'GUDIPADWA', desc: 'Gudi Padwa offer', type: 'pct', value: 15, minOrder: 700, ends: plus(-200), active: false, uses: 96 }),
    ];
    const categories = [
      { id: 'door', name: 'Door Torans', mr: 'दरवाजा तोरण', img: 'img/ganapati-yellow.jpg', active: true },
      { id: 'devghar', name: 'Devghar Torans', mr: 'देवघर तोरण', img: 'img/swami-devghar.jpg', active: true },
      { id: 'car', name: 'Car Torans', mr: 'कार तोरण', img: 'img/swami-car.jpg', active: true },
    ];
    const home = {
      banners: [
        { id: 'b1', tag: 'Bestseller', title: 'Ganapati Door Toran in 3 colours', subtitle: 'Yellow, blue and green Bappa torans. Handmade, washable, ₹350 each.', cta: 'Shop Ganapati', link: { kind: 'collection', value: 'Ganapati' }, img: 'img/ganapati-yellow.jpg', bg: '#FFF4D6', pos: '50% 15%', active: true },
        { id: 'b2', tag: 'New arrival', title: 'The Devi collection is here', subtitle: 'Devi torans for your doorway and devghar, from ₹230.', cta: 'See new arrivals', link: { kind: 'new' }, img: 'img/devi-door.jpg', bg: '#E7F2EC', pos: '50% 15%', active: true },
        { id: 'b3', tag: 'For your car', title: 'Swami Car Toran', subtitle: 'A blessing on every drive. Made for the rear windscreen, ₹400.', cta: 'View product', link: { kind: 'product', value: 'swami-car' }, img: 'img/swami-car.jpg', bg: '#FBE9E7', pos: '50% 50%', active: true },
      ],
      sections: [
        { id: 's1', kind: 'categories', title: 'Shop by category', active: true },
        { id: 's2', kind: 'featured', title: 'Featured torans', active: true },
        { id: 's3', kind: 'new', title: 'New arrivals', active: true },
        { id: 's4', kind: 'collections', title: 'Shop by collection', active: true },
        { id: 's5', kind: 'bestsellers', title: 'Bestsellers', active: false },
        { id: 's6', kind: 'all', title: 'All torans', active: true },
        { id: 's7', kind: 'values', title: 'Why Kalaksha', active: true },
      ],
    };

    return {
      version: 4,
      products: JSON.parse(JSON.stringify(PRODUCTS)).map((p) => Object.assign(p, { category: p.type.toLowerCase() })),
      categories, home,
      reviews, orders, hist, coupons, settings,
      cart: [], wishlist: [], myOrders: [], recent: [],
      nextOrder: 24519,
    };
  }

  window.KALAKSHA = { seed, STATES, dayKey };
})();
