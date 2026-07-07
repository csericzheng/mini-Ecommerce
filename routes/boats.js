const express = require('express');
const db = require('../db/database');

const router = express.Router();

const COVER_IMAGE_SQL = `COALESCE(
  (SELECT filename FROM boat_images WHERE boat_id = boats.id ORDER BY position LIMIT 1),
  boats.image_file
) AS cover_image`;

router.get('/', (req, res) => {
  const { type, make, q, yearMin, yearMax, priceMin, priceMax } = req.query;
  let query = `SELECT boats.*, ${COVER_IMAGE_SQL} FROM boats WHERE 1=1`;
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (make) {
    query += ' AND manufacturer = ?';
    params.push(make);
  }
  if (q) {
    query += ' AND (name LIKE ? OR manufacturer LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  if (yearMin) {
    query += ' AND year >= ?';
    params.push(parseInt(yearMin, 10));
  }
  if (yearMax) {
    query += ' AND year <= ?';
    params.push(parseInt(yearMax, 10));
  }
  if (priceMin) {
    query += ' AND price_cents >= ?';
    params.push(Math.round(parseFloat(priceMin) * 100));
  }
  if (priceMax) {
    query += ' AND price_cents <= ?';
    params.push(Math.round(parseFloat(priceMax) * 100));
  }
  query += ' ORDER BY boats.id';

  const boats = db.prepare(query).all(...params);
  const types = db.prepare('SELECT DISTINCT type FROM boats ORDER BY type').all().map((r) => r.type);
  const makes = db.prepare('SELECT DISTINCT manufacturer FROM boats ORDER BY manufacturer').all().map((r) => r.manufacturer);
  const bounds = db.prepare('SELECT MIN(year) AS minYear, MAX(year) AS maxYear, MIN(price_cents) AS minPrice, MAX(price_cents) AS maxPrice FROM boats').get();

  res.render('index', {
    boats,
    types,
    makes,
    bounds,
    selectedType: type || '',
    selectedMake: make || '',
    q: q || '',
    yearMin: yearMin || '',
    yearMax: yearMax || '',
    priceMin: priceMin || '',
    priceMax: priceMax || '',
  });
});

router.get('/boats/:id', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');

  db.prepare('UPDATE boats SET views = views + 1 WHERE id = ?').run(boat.id);
  boat.views += 1;

  const listedDate = new Date(boat.created_at.replace(' ', 'T') + 'Z');
  const daysListed = Math.max(0, Math.floor((Date.now() - listedDate.getTime()) / 86400000));

  const images = db.prepare('SELECT * FROM boat_images WHERE boat_id = ? ORDER BY position').all(boat.id);
  const gallery = images.length > 0
    ? images.map((img) => ({
        file: img.filename,
        photographer: img.photographer,
        photographer_url: img.photographer_url,
      }))
    : [{ file: boat.image_file, photographer: null, photographer_url: null }];

  res.render('boat-detail', { boat, gallery, daysListed });
});

module.exports = router;
