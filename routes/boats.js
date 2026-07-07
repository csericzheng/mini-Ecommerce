const express = require('express');
const db = require('../db/database');

const router = express.Router();

const COVER_IMAGE_SQL = `COALESCE(
  (SELECT filename FROM boat_images WHERE boat_id = boats.id ORDER BY position LIMIT 1),
  boats.image_file
) AS cover_image`;

router.get('/', (req, res) => {
  const { type, q } = req.query;
  let query = `SELECT boats.*, ${COVER_IMAGE_SQL} FROM boats WHERE 1=1`;
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (q) {
    query += ' AND (name LIKE ? OR manufacturer LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY boats.id';

  const boats = db.prepare(query).all(...params);
  const types = db.prepare('SELECT DISTINCT type FROM boats ORDER BY type').all().map((r) => r.type);

  res.render('index', { boats, types, selectedType: type || '', q: q || '' });
});

router.get('/boats/:id', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');

  const images = db.prepare('SELECT * FROM boat_images WHERE boat_id = ? ORDER BY position').all(boat.id);
  const gallery = images.length > 0
    ? images.map((img) => ({
        file: img.filename,
        photographer: img.photographer,
        photographer_url: img.photographer_url,
      }))
    : [{ file: boat.image_file, photographer: null, photographer_url: null }];

  res.render('boat-detail', { boat, gallery });
});

module.exports = router;
