const express = require('express');
const db = require('../db/database');
const { hashPassword, verifyPassword } = require('../lib/password');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { error: null, form: {}, next: req.query.next || '' });
});

router.post('/register', (req, res) => {
  const { firstName, lastName, phone, password, confirmPassword, dob, address, email, next } = req.body;

  if (!firstName || !lastName || !phone || !password) {
    return res
      .status(400)
      .render('register', { error: 'First name, last name, phone number, and password are required.', form: req.body, next });
  }
  if (password.length < 6) {
    return res.status(400).render('register', { error: 'Password must be at least 6 characters.', form: req.body, next });
  }
  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Passwords do not match.', form: req.body, next });
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res
      .status(400)
      .render('register', { error: 'An account with that phone number already exists.', form: req.body, next });
  }

  const info = db
    .prepare(
      `INSERT INTO users (first_name, last_name, phone, password_hash, date_of_birth, address, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(firstName, lastName, phone, hashPassword(password), dob || null, address || null, email || null);

  req.session.userId = info.lastInsertRowid;
  res.redirect(next || '/');
});

router.get('/login', (req, res) => {
  res.render('login', { error: null, next: req.query.next || '' });
});

router.post('/login', (req, res) => {
  const { phone, password, next } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(400).render('login', { error: 'Invalid phone number or password.', next: next || '' });
  }

  req.session.userId = user.id;
  res.redirect(next || '/');
});

router.post('/logout', (req, res) => {
  delete req.session.userId;
  res.redirect('/');
});

module.exports = router;
