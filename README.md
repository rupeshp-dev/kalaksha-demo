# Kalaksha demo store

A customer shop and an admin panel for the Kalaksha toran catalogue. There is no backend: all data is saved in the browser's localStorage.

## Run it

```bash
cd kalaksha-demo
python3 -m http.server 5173
```

Open http://localhost:5173 for the shop, or http://localhost:5173/#admin for the admin panel.
React is bundled in `vendor/`, so the app works offline (only the web fonts need internet).

## What's real and what's sample

- **Real, from the catalogue:** 6 products, photos, prices, sizes, colours, delivery rates (₹80 Maharashtra / ₹100 rest of India), 4 torans per parcel, no COD, replacement-only policy.
- **Sample:** past orders, customers, reviews, stock levels, units sold and the 30-day sales history.
- The Devi Devghar Toran photo is a crop of the Devi door photo, because the catalogue has no separate image for it.

## Demo script for the client

1. **Store home:** rotating banners, the category menu (Door / Devghar / Car), Shop by category, Featured, New arrivals, collections.
2. **Shop:** open a toran, pick a colour, add to cart, wishlist, write a review.
3. **Checkout:** enter an address (delivery changes by state), tap an offer such as `FESTIVE10`, pay through the demo gateway. The order appears in Admin tagged "Live".
4. **Admin → Orders → Add WhatsApp order → Try a sample message:** the form fills itself from a pasted WhatsApp message. Save it.
5. **Admin → Orders → Import orders → Load sample sheet:** bulk import from Excel or Google Sheets (CSV). Bad rows are flagged.
6. **Admin → Orders:** filter by channel (Website / WhatsApp) or "Unpaid". Open an unpaid order and mark it paid with the UTR.
7. **Admin → Coupons → Create coupon:** limit it to chosen emails or mobiles, first orders, collections, dates or usage counts. Try `LOYAL20` at checkout with mobile `9822045671`, and with any other number.
8. **Admin → Storefront:** edit a banner (text, photo, colour, link), reorder or hide home page sections.
9. **Admin → Categories:** add a category, choose its photo and products. It appears in the store menu.
10. **Admin → Shipments (simulated Shiprocket):** click "Ship N ready orders", compare couriers (Recommended / Cheapest / Fastest), create shipments and book the pickup, then print 4×6 labels and download the pickup manifest. "Get courier updates" moves parcels along; handle failed deliveries (reattempt or return). Open any order to see its tracking timeline; customers see it under My orders.
11. **Admin → Settings → Shiprocket:** pickup address, courier rule, parcel weights, and automatic shipment creation when an order is marked Packed.
12. **Admin → Products / Inventory / Transactions / Settings:** prices, stock, gateway fees vs direct UPI, delivery rates.

Tip: open the store and the admin in two tabs side by side. Changes sync between them.
Use "Reset demo data" in the admin sidebar to start fresh before a meeting.
