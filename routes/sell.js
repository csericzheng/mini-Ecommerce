const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../lib/middleware');
const { FIELDS, boatFromForm } = require('../lib/boat-form');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  res.render('sell', { boat: null });
});

router.post('/', (req, res) => {
  const boat = boatFromForm(req.body);
  const columns = [...FIELDS, 'owner_id'].join(', ');
  const placeholders = [...FIELDS.map((f) => `@${f}`), '@owner_id'].join(', ');
  const info = db
    .prepare(`INSERT INTO boats (${columns}) VALUES (${placeholders})`)
    .run({ ...boat, owner_id: req.session.userId });
  res.redirect(`/boats/${info.lastInsertRowid}`);
});

module.exports = router;
