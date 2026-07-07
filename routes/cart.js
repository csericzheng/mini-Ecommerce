const express = require('express');
const db = require('../db/database');

const router = express.Router();

function getCart(req) {
  if (!req.session.cart) req.session.cart = {};
  return req.session.cart;
}

router.post('/add', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.body.boatId);
  if (!boat) return res.status(404).render('404');

  const quantity = Math.max(1, parseInt(req.body.quantity, 10) || 1);
  const cart = getCart(req);
  const existingQty = cart[boat.id]?.quantity || 0;

  cart[boat.id] = {
    boatId: boat.id,
    name: boat.name,
    price_cents: boat.price_cents,
    image_file: boat.image_file,
    quantity: Math.min(boat.stock, existingQty + quantity),
  };

  res.redirect(req.get('Referrer') || '/');
});

router.post('/update', (req, res) => {
  const cart = getCart(req);
  const { boatId, quantity } = req.body;
  const qty = parseInt(quantity, 10);

  if (cart[boatId]) {
    if (qty <= 0) delete cart[boatId];
    else cart[boatId].quantity = qty;
  }
  res.redirect('/cart');
});

router.post('/remove', (req, res) => {
  const cart = getCart(req);
  delete cart[req.body.boatId];
  res.redirect('/cart');
});

router.get('/', (req, res) => {
  const cart = getCart(req);
  const items = Object.values(cart);
  const total_cents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  res.render('cart', { items, total_cents });
});

router.get('/checkout', (req, res) => {
  const cart = getCart(req);
  const items = Object.values(cart);
  if (items.length === 0) return res.redirect('/cart');
  const total_cents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  res.render('checkout', { items, total_cents });
});

router.post('/checkout', (req, res) => {
  const cart = getCart(req);
  const items = Object.values(cart);
  if (items.length === 0) return res.redirect('/cart');

  const { customerName, customerEmail } = req.body;
  const total_cents = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);

  const placeOrder = db.transaction(() => {
    const orderInfo = db
      .prepare('INSERT INTO orders (customer_name, customer_email, total_cents) VALUES (?, ?, ?)')
      .run(customerName, customerEmail, total_cents);
    const orderId = orderInfo.lastInsertRowid;

    const insertItem = db.prepare(
      'INSERT INTO order_items (order_id, boat_id, boat_name, unit_price_cents, quantity) VALUES (?, ?, ?, ?, ?)'
    );
    const decrementStock = db.prepare('UPDATE boats SET stock = MAX(0, stock - ?) WHERE id = ?');

    for (const item of items) {
      insertItem.run(orderId, item.boatId, item.name, item.price_cents, item.quantity);
      decrementStock.run(item.quantity, item.boatId);
    }
    return orderId;
  });

  const orderId = placeOrder();
  req.session.cart = {};
  res.render('order-confirmation', { orderId, total_cents, customerName });
});

module.exports = router;
