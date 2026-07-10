const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('../lib/middleware');
const { FIELDS, boatFromForm } = require('../lib/boat-form');

const router = express.Router();

router.use(requireAuth);

function isAdmin(res) {
  return res.locals.currentUser && res.locals.currentUser.role === 'admin';
}

router.get('/', (req, res) => {
  const boats = db.prepare('SELECT * FROM boats WHERE owner_id = ? ORDER BY id').all(req.session.userId).map((boat) => {
    const listedDate = new Date(boat.created_at.replace(' ', 'T') + 'Z');
    const daysListed = Math.max(0, Math.floor((Date.now() - listedDate.getTime()) / 86400000));
    return { ...boat, daysListed };
  });
  res.render('sell-index', { boats });
});

router.get('/new', (req, res) => {
  res.render('sell', { boat: null });
});

router.post('/new', (req, res) => {
  const boat = boatFromForm(req.body);
  // A private seller's own listing is always a used boat — not selectable
  // on this form, unlike the admin's dealer-inventory form.
  const columns = [...FIELDS, 'owner_id', 'condition'].join(', ');
  const placeholders = [...FIELDS.map((f) => `@${f}`), '@owner_id', '@condition'].join(', ');
  const info = db
    .prepare(`INSERT INTO boats (${columns}) VALUES (${placeholders})`)
    .run({ ...boat, owner_id: req.session.userId, condition: 'used' });
  res.redirect(`/boats/${info.lastInsertRowid}`);
});

router.get('/:id/edit', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');
  if (boat.owner_id !== req.session.userId && !isAdmin(res)) return res.status(403).render('403');
  res.render('sell', { boat });
});

router.post('/:id/edit', (req, res) => {
  const boat = db.prepare('SELECT owner_id FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');
  if (boat.owner_id !== req.session.userId && !isAdmin(res)) return res.status(403).render('403');

  const updated = boatFromForm(req.body);
  const setClause = FIELDS.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE boats SET ${setClause} WHERE id = @id`).run({ ...updated, id: req.params.id });
  res.redirect(`/boats/${req.params.id}`);
});

module.exports = router;
