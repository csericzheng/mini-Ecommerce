// Generates 50 realistic placeholder boat listings plus a matching SVG
// placeholder image per boat, then loads everything into SQLite.
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'boats');
fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Seeded PRNG (mulberry32) so re-running `npm run seed` yields the same data.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240707);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const TYPE_INFO = {
  Sailboat: { manufacturers: ['Catalina', 'Beneteau', 'Hobie', 'Jeanneau'], lengthRange: [22, 42], capacityRange: [4, 10], basePrice: 45000, perFoot: 3200, color: ['#1d4e6b', '#3a7ca5'] },
  Catamaran: { manufacturers: ['Lagoon', 'Fountaine Pajot', 'Leopard'], lengthRange: [30, 50], capacityRange: [8, 14], basePrice: 180000, perFoot: 8500, color: ['#0f5c5c', '#3aa6a6'] },
  Motorboat: { manufacturers: ['Bayliner', 'Chaparral', 'Regal', 'Sea Ray'], lengthRange: [18, 32], capacityRange: [4, 9], basePrice: 38000, perFoot: 2800, color: ['#5a4632', '#9c7b4f'] },
  Yacht: { manufacturers: ['Sea Ray', 'Beneteau', 'Princess', 'Azimut'], lengthRange: [40, 65], capacityRange: [8, 16], basePrice: 350000, perFoot: 12000, color: ['#2b2b52', '#5b5ba3'] },
  'Pontoon Boat': { manufacturers: ['Tracker', 'Sun Tracker', 'Bennington'], lengthRange: [18, 28], capacityRange: [8, 14], basePrice: 28000, perFoot: 1800, color: ['#3d6b35', '#78a45e'] },
  'Fishing Boat': { manufacturers: ['Boston Whaler', 'Grady-White', 'Lund', 'Tracker'], lengthRange: [16, 26], capacityRange: [3, 7], basePrice: 26000, perFoot: 2100, color: ['#4a5b3d', '#7d9464'] },
  Speedboat: { manufacturers: ['MasterCraft', 'Malibu', 'Yamaha', 'Chaparral'], lengthRange: [18, 24], capacityRange: [4, 8], basePrice: 42000, perFoot: 3400, color: ['#7a1f2b', '#c94c4c'] },
  Houseboat: { manufacturers: ['Sumerset', 'Fantasy', 'Stardust'], lengthRange: [45, 60], capacityRange: [8, 12], basePrice: 220000, perFoot: 6500, color: ['#6b4f1d', '#c9a24c'] },
  'Bass Boat': { manufacturers: ['Tracker', 'Lund', 'Ranger'], lengthRange: [16, 21], capacityRange: [2, 4], basePrice: 24000, perFoot: 2400, color: ['#1f4d2b', '#4c9c5f'] },
  'Cabin Cruiser': { manufacturers: ['Bayliner', 'Sea Ray', 'Chaparral'], lengthRange: [26, 38], capacityRange: [6, 10], basePrice: 65000, perFoot: 4200, color: ['#33475b', '#6b8ba4'] },
};

const SERIES_WORDS = ['SLX', 'Element', 'Overnighter', 'Voyager', 'Classic', 'Sport', 'Deluxe', 'Signature', 'Limited', 'Cruiser', 'Explorer', 'Adventure', 'Prestige', 'Legacy', 'Horizon', 'Coastal', 'Marina', 'Regatta'];

const DESCRIPTION_TEMPLATES = [
  'A well-appointed {type_lower} from {manufacturer}, ideal for {activity}. Features a spacious layout, {capacity}-person capacity, and a fiberglass hull built to last.',
  'This {year} {manufacturer} {series} offers {length_ft} feet of comfort and performance, perfect for {activity}. Seats up to {capacity} passengers.',
  '{manufacturer}\'s {series} line delivers reliable handling and a roomy deck for {activity}. Comfortably fits {capacity} people at {length_ft} feet overall length.',
];

const ACTIVITIES = ['weekend getaways', 'family outings on the lake', 'coastal cruising', 'day fishing trips', 'watersports and towing', 'sunset cruises', 'island hopping', 'calm-water exploring'];

const boats = [];
const types = Object.keys(TYPE_INFO);
for (let i = 0; i < 50; i++) {
  const type = types[i % types.length];
  const info = TYPE_INFO[type];
  const manufacturer = pick(info.manufacturers);
  const series = pick(SERIES_WORDS);
  const length_ft = randInt(info.lengthRange[0], info.lengthRange[1]);
  const capacity = randInt(info.capacityRange[0], info.capacityRange[1]);
  const year = randInt(2018, 2025);
  const sizeNumber = length_ft * 10 + randInt(0, 9);
  const name = `${manufacturer} ${series} ${sizeNumber}`;
  const price_cents = Math.round(
    (info.basePrice + info.perFoot * length_ft + randInt(-4000, 6000)) * 100
  );
  const stock = randInt(0, 5);
  const template = pick(DESCRIPTION_TEMPLATES);
  const description = template
    .replaceAll('{type_lower}', type.toLowerCase())
    .replaceAll('{manufacturer}', manufacturer)
    .replaceAll('{series}', series)
    .replaceAll('{year}', String(year))
    .replaceAll('{length_ft}', String(length_ft))
    .replaceAll('{capacity}', String(capacity))
    .replaceAll('{activity}', pick(ACTIVITIES));

  boats.push({ name, type, manufacturer, year, length_ft, capacity, price_cents, stock, description, color: info.color });
}

function generateBoatSVG({ name, type, color }) {
  const [skyColor, waterColor] = color;
  const hasSail = type === 'Sailboat' || type === 'Catamaran';
  const hasCabin = type === 'Yacht' || type === 'Houseboat' || type === 'Cabin Cruiser' || type === 'Motorboat';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="400" height="260">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${skyColor}"/>
      <stop offset="1" stop-color="${skyColor}" stop-opacity="0.4"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${waterColor}"/>
      <stop offset="1" stop-color="${waterColor}" stop-opacity="0.7"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="400" height="160" fill="url(#sky)"/>
  <rect x="0" y="160" width="400" height="100" fill="url(#water)"/>
  ${hasSail ? '<polygon points="200,40 200,150 150,150" fill="#f5f5f0" opacity="0.9"/><line x1="200" y1="35" x2="200" y2="152" stroke="#f5f5f0" stroke-width="3"/>' : ''}
  ${hasCabin ? '<rect x="170" y="110" width="90" height="40" fill="#f5f5f0" opacity="0.85" rx="4"/>' : ''}
  <polygon points="110,150 290,150 260,190 140,190" fill="#f5f5f0"/>
  <text x="200" y="230" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(name)}</text>
  <text x="200" y="250" font-family="Arial, sans-serif" font-size="13" fill="#ffffffcc" text-anchor="middle">${escapeXml(type)}</text>
</svg>`;
}

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM boats;');
if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'").get()) {
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('boats', 'orders', 'order_items');");
}

const insert = db.prepare(`
  INSERT INTO boats (name, type, manufacturer, year, length_ft, capacity, price_cents, stock, description, image_file)
  VALUES (@name, @type, @manufacturer, @year, @length_ft, @capacity, @price_cents, @stock, @description, 'pending')
`);
const setImageFile = db.prepare('UPDATE boats SET image_file = ? WHERE id = ?');

const insertMany = db.transaction((rows) => {
  for (const boat of rows) {
    const { name, type, manufacturer, year, length_ft, capacity, price_cents, stock, description } = boat;
    const id = insert.run({ name, type, manufacturer, year, length_ft, capacity, price_cents, stock, description }).lastInsertRowid;
    const image_file = `boat-${id}.svg`;
    setImageFile.run(image_file, id);
    fs.writeFileSync(path.join(IMAGES_DIR, image_file), generateBoatSVG(boat));
  }
});

insertMany(boats);

console.log(`Seeded ${boats.length} boats and generated placeholder images in ${IMAGES_DIR}`);
