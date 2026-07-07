const express = require('express');
const db = require('../db/database');

const router = express.Router();

router.get('/', (req, res) => {
  const { type, q } = req.query;
  let query = 'SELECT * FROM boats WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (q) {
    query += ' AND (name LIKE ? OR manufacturer LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY id';

  const boats = db.prepare(query).all(...params);
  const types = db.prepare('SELECT DISTINCT type FROM boats ORDER BY type').all().map((r) => r.type);

  res.render('index', { boats, types, selectedType: type || '', q: q || '' });
});

router.get('/boats/:id', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');
  res.render('boat-detail', { boat });
});

module.exports = router;
