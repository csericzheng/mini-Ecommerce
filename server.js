const express = require('express');
const session = require('express-session');
const path = require('path');

const boatsRouter = require('./routes/boats');
const cartRouter = require('./routes/cart');
const adminRouter = require('./routes/admin');

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

// Make cart item count and price formatting available to every view.
app.use((req, res, next) => {
  const cart = req.session.cart || {};
  res.locals.cartCount = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
  res.locals.formatPrice = (cents) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  next();
});

app.use('/', boatsRouter);
app.use('/cart', cartRouter);
app.use('/admin', adminRouter);

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Mini e-commerce boats app running at http://localhost:${PORT}`);
});
