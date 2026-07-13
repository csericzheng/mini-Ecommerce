const express = require('express');
const path = require('path');
// Kept as a module reference (not destructured) so tests can mock
// childProcess.execFile in place without needing this route's own binding
// to be re-required.
const childProcess = require('child_process');
const db = require('../db/database');
const { requireAdmin } = require('../lib/middleware');
const { FIELDS, boatFromForm } = require('../lib/boat-form');
const { parseJUnitReport } = require('../lib/junit-report');
const { CANADA_PROVINCES } = require('../lib/canada-provinces');

const router = express.Router();

router.use(requireAdmin);

const VALID_STATUSES = ['available', 'pending', 'sold'];
const VALID_CONDITIONS = ['new', 'used'];

function statusFromForm(body) {
  return VALID_STATUSES.includes(body.status) ? body.status : 'available';
}

function conditionFromForm(body) {
  return VALID_CONDITIONS.includes(body.condition) ? body.condition : 'new';
}

router.get('/', (req, res) => {
  const boats = db.prepare(`
    SELECT boats.*, users.first_name AS owner_first_name, users.last_name AS owner_last_name
    FROM boats
    LEFT JOIN users ON users.id = boats.owner_id
    ORDER BY boats.id
  `).all().map((boat) => {
    const listedDate = new Date(boat.created_at.replace(' ', 'T') + 'Z');
    const daysListed = Math.max(0, Math.floor((Date.now() - listedDate.getTime()) / 86400000));
    const listedBy = boat.owner_first_name ? `${boat.owner_first_name} ${boat.owner_last_name}` : 'Admin';
    return { ...boat, daysListed, listedBy };
  });
  res.render('admin/index', { boats });
});

router.get('/new', (req, res) => {
  res.render('admin/form', { boat: null, provinces: CANADA_PROVINCES });
});

router.post('/new', (req, res) => {
  const boat = { ...boatFromForm(req.body), status: statusFromForm(req.body), condition: conditionFromForm(req.body) };
  const columns = [...FIELDS, 'status', 'condition'].join(', ');
  const placeholders = [...FIELDS.map((f) => `@${f}`), '@status', '@condition'].join(', ');
  db.prepare(`INSERT INTO boats (${columns}) VALUES (${placeholders})`).run(boat);
  res.redirect('/admin');
});

router.get('/:id/edit', (req, res) => {
  const boat = db.prepare('SELECT * FROM boats WHERE id = ?').get(req.params.id);
  if (!boat) return res.status(404).render('404');
  res.render('admin/form', { boat, provinces: CANADA_PROVINCES });
});

router.post('/:id/edit', (req, res) => {
  const boat = { ...boatFromForm(req.body), status: statusFromForm(req.body), condition: conditionFromForm(req.body) };
  const setClause = [...FIELDS, 'status', 'condition'].map((f) => `${f} = @${f}`).join(', ');
  db.prepare(`UPDATE boats SET ${setClause} WHERE id = @id`).run({ ...boat, id: req.params.id });
  res.redirect('/admin');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM boats WHERE id = ?').run(req.params.id);
  res.redirect('/admin');
});

router.get('/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, users.phone AS buyer_phone
    FROM orders
    LEFT JOIN users ON users.id = orders.user_id
    ORDER BY orders.id DESC
  `).all();

  const itemsForOrder = db.prepare('SELECT boat_id, boat_name FROM order_items WHERE order_id = ?');
  const ordersWithItems = orders.map((order) => ({ ...order, items: itemsForOrder.all(order.id) }));

  res.render('admin/orders', { orders: ordersWithItems });
});

router.get('/tests', (req, res) => {
  childProcess.execFile(
    process.execPath,
    ['--test', '--test-reporter=junit', '--test-reporter-destination=stdout'],
    { cwd: path.join(__dirname, '..'), timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
    (error, stdout) => {
      // node --test exits non-zero when any test fails; that's not a run
      // failure, so only treat it as one if we got no output to parse at all.
      if (!stdout) {
        return res.status(500).render('admin/unit-tests', {
          report: null,
          runError: (error && error.message) || 'Test run produced no output.',
        });
      }
      res.render('admin/unit-tests', { report: parseJUnitReport(stdout), runError: null });
    }
  );
});

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, first_name, last_name, phone, email, role FROM users ORDER BY id').all();
  res.render('admin/users', { users, currentUserId: req.session.userId });
});

router.post('/users/:id/role', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { role } = req.body;

  // Prevent an admin from locking themselves out by demoting their own account.
  if (targetId === req.session.userId) return res.redirect('/admin/users');
  if (role !== 'admin' && role !== 'user') return res.redirect('/admin/users');

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
  res.redirect('/admin/users');
});

module.exports = router;
