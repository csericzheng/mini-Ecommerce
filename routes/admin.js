const express = require('express');
const db = require('../db/database');

const router = express.Router();

const FIELDS = ['name', 'type', 'manufacturer', 'year', 'length_ft', 'capacity', 'price_cents', 'stock', 'description', 'image_file'];

function boatFromForm(body) {
  return {
    name: body.name,
    type: body.type,
    manufacturer: body.manufacturer,
    year: parseInt(body.year, 10),
    length_ft: parseInt(body.length_ft, 10),
    capacity: parseInt(body.capacity, 10),
    price_cents: Math.round(parseFloat(body.price) * 100),
    stock: parseInt(body.stock, 10),
    description: body.description,
    image_file: body.image_file || 'placeholder.svg',
  };
}

router.get('/', (req, res) => {
  const boats = db.prepare('SELECT * FROM boats ORDER BY id').all();
  res.render('admin/index', { boats });
});

router.get('/new', (req, res) => {
  res.render('admin/form', { boat: null });
});

router.post('/new', (req, res) => {
  const boat = boatFromForm(req.body);
  const columns = FIELDS.join(', ');
  const placeholders = FIELDS.map((f) => `@${f}`).join(', ');
  db.prepare(`INSERT INTO boats (${columns}) VALUES (${placeholders})`).run(boat);
  res.redirect('/admin');
});

router.get('/:id/edit', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');
  res.render('admin/form', { boat });
});

router.post('/:id/edit', (req, res) => {
  const boat = boatFromForm(req.body);
  const setClause = FIELDS.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE boats SET ${setClause} WHERE id = @id`).run({ ...boat, id: req.params.id });
  res.redirect('/admin');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM boats WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

module.exports = router;
