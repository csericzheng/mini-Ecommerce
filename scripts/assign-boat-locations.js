// One-off backfill: assigns each existing boat a real Canadian city and
// province, since the city/province fields were added after these boats
// were originally seeded and shipped empty.
const db = require('../db/database');
const { CANADA_PROVINCES } = require('../lib/canada-provinces');

// Seeded PRNG (mulberry32) so re-running this script yields the same result.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260713);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// A few well-known, boat-friendly cities per province/territory.
const CITIES_BY_PROVINCE = {
  Alberta: ['Calgary', 'Edmonton'],
  'British Columbia': ['Vancouver', 'Victoria', 'Kelowna', 'Nanaimo'],
  Manitoba: ['Winnipeg'],
  'New Brunswick': ['Saint John', 'Fredericton'],
  'Newfoundland and Labrador': ["St. John's"],
  'Northwest Territories': ['Yellowknife'],
  'Nova Scotia': ['Halifax', 'Dartmouth'],
  Nunavut: ['Iqaluit'],
  Ontario: ['Toronto', 'Ottawa', 'Hamilton', 'Kingston', 'Barrie'],
  'Prince Edward Island': ['Charlottetown'],
  Quebec: ['Montreal', 'Quebec City', 'Gatineau'],
  Saskatchewan: ['Regina', 'Saskatoon'],
  Yukon: ['Whitehorse'],
};

const boats = db.prepare('SELECT id FROM boats ORDER BY id').all();
const updateLocation = db.prepare('UPDATE boats SET city = ?, province = ? WHERE id = ?');

const assign = db.transaction(() => {
  boats.forEach((boat) => {
    const province = pick(CANADA_PROVINCES);
    const city = pick(CITIES_BY_PROVINCE[province]);
    updateLocation.run(city, province, boat.id);
  });
});

assign();
console.log(`Assigned a city/province to ${boats.length} boats.`);
