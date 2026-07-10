const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../lib/middleware');

const router = express.Router();

function getCart(req) {
  if (!req.session.cart) req.session.cart = {};
  return req.session.cart;
}

router.post('/add', (req, res) => {
  if (!req.session.userId) {
    const nextUrl = encodeURIComponent(req.get('Referrer') || '/');
    return res.redirect(`/login?next=${nextUrl}`);
  }

  const boat = db.prepare(`
    SELECT boats.*, COALESCE(
      (SELECT filename FROM boat_images WHERE boat_id = boats.id ORDER BY position LIMIT 1),
      boats.image_file
    ) AS cover_image
    FROM boats WHERE id = ?
  `).get(req.body.boatId);
  if (!boat) return res.status(404).render('404');
  if (boat.owner_id === req.session.userId) return res.status(403).render('403');
  if (boat.status !== 'available') return res.redirect(req.get('Referrer') || '/');

  const cart = getCart(req);
  cart[boat.id] = {
    boatId: boat.id,
    name: boat.name,
    price_cents: boat.price_cents,
    image_file: boat.cover_image,
  };

  res.redirect(req.get('Referrer') || '/');
});

router.post('/remove', (req, res) => {
  const cart = getCart(req);
  delete cart[req.body.boatId];
  res.redirect('/cart');
});

router.get('/', (req, res) => {
  const cart = getCart(req);
  const items = Object.values(cart);
  const total_cents = items.reduce((sum, item) => sum + item.price_cents, 0);
  res.render('cart', { items, total_cents });
});

router.get('/checkout', requireAuth, (req, res) => {
  const cart = getCart(req);
  const items = Object.values(cart);
  if (items.length === 0) return res.redirect('/cart');
  const total_cents = items.reduce((sum, item) => sum + item.price_cents, 0);
  res.render('checkout', { items, total_cents });
});

router.post('/checkout', requireAuth, (req, res) => {
  const cart = getCart(req);
  const items = Object.values(cart);
  if (items.length === 0) return res.redirect('/cart');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  const customerName = `${user.first_name} ${user.last_name}`;
  const total_cents = items.reduce((sum, item) => sum + item.price_cents, 0);

  const placeOrder = db.transaction(() => {
    const orderInfo = db
      .prepare('INSERT INTO orders (user_id, customer_name, customer_email, total_cents) VALUES (?, ?, ?, ?)')
      .run(user.id, customerName, user.email, total_cents);
    const orderId = orderInfo.lastInsertRowid;

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, boat_id, boat_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, 1)'
    );
    const decrementStock = db.prepare('UPDATE boats SET stock = MAX(0, stock - 1) WHERE id = ?');
    const markPending = db.prepare("UPDATE boats SET status = 'pending' WHERE id = ?");

    for (const item of items) {
      insertItem.run(orderId, item.boatId, item.name, item.price_cents);
      decrementStock.run(item.boatId);
      markPending.run(item.boatId);
    }
    return orderId;
  });

  const orderId = placeOrder();
  req.session.cart = {};
  res.render('order-confirmation', { orderId, items, total_cents, customerName });
});

module.exports = router;
