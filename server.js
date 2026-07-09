const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./db/database');
const authRouter = require('./routes/auth');
const boatsRouter = require('./routes/boats');
const cartRouter = require('./routes/cart');
const adminRouter = require('./routes/admin');
const sellRouter = require('./routes/sell');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: 'mini-ecommerce-dev-secret',
    resave: false,
    saveUninitialized: false,
  })
);

// Make cart item count, price formatting, the type nav, and the logged-in
// user (if any) available to every view.
app.use((req, res, next) => {
  const cart = req.session.cart || {};
  res.locals.cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  res.locals.formatPrice = (cents) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  res.locals.navTypes = db.prepare('SELECT DISTINCT type FROM boats ORDER BY type').all().map((r) => r.type);
  res.locals.currentUser = req.session.userId
    ? db.prepare('SELECT id, first_name, last_name, phone, email, role FROM users WHERE id = ?').get(req.session.userId)
    : null;
  next();
});

app.use('/', authRouter);
app.use('/', boatsRouter);
app.use('/cart', cartRouter);
app.use('/admin', adminRouter);
app.use('/sell', sellRouter);

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Mini e-commerce boats app running at http://localhost:${PORT}`);
});
