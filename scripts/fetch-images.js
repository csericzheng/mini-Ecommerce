// Downloads ~10 real photos per boat from the Pexels API, grouped by boat
// type (Pexels has no listings for our fictional boat models, so boats of
// the same type share a photo pool, sliced so no two boats of the same
// type get the same set of photos).
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

loadDotEnv();

const API_KEY = process.env.PEXELS_API_KEY;
if (!API_KEY) {
  console.error('Missing PEXELS_API_KEY. Set it in .env or the environment before running this script.');
  process.exit(1);
}

const IMAGES_PER_BOAT = 10;
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'boats', 'real');

const SEARCH_QUERIES = {
  Sailboat: 'sailboat',
  Catamaran: 'catamaran boat',
  Motorboat: 'motor boat',
  Yacht: 'yacht',
  'Pontoon Boat': 'pontoon boat',
  'Fishing Boat': 'fishing boat',
  Speedboat: 'speedboat',
  Houseboat: 'houseboat',
  'Bass Boat': 'bass fishing boat',
  'Cabin Cruiser': 'cabin cruiser boat',
};

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function searchPhotos(query, perPage) {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
  const res = await fetch(url, { headers: { Authorization: API_KEY } });
  if (!res.ok) throw new Error(`Pexels search failed for "${query}": ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.photos;
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  fs.writeFileSync(destPath, Buffer.from(await res.arrayBuffer()));
}

const insertImage = db.prepare(`
  INSERT INTO boat_images (boat_id, position, filename, photographer, photographer_url, source_url)
  VALUES (@boat_id, @position, @filename, @photographer, @photographer_url, @source_url)
`);
const clearImages = db.prepare('DELETE FROM boat_images WHERE boat_id = ?');

async function run() {
  const types = Object.keys(SEARCH_QUERIES);

  for (const type of types) {
    const boats = db.prepare('SELECT id, name FROM boats WHERE type = ? ORDER BY id').all(type);
    if (boats.length === 0) continue;

    const needed = boats.length * IMAGES_PER_BOAT;
    console.log(`\n${type}: fetching photos for ${boats.length} boat(s), need ${needed}...`);

    let photos = await searchPhotos(SEARCH_QUERIES[type], Math.min(needed, 80));
    if (photos.length < needed) {
      const extra = await searchPhotos('boat', 80);
      const seen = new Set(photos.map((p) => p.id));
      for (const photo of extra) {
        if (photos.length >= needed) break;
        if (!seen.has(photo.id)) {
          photos.push(photo);
          seen.add(photo.id);
        }
      }
    }

    let cursor = 0;
    for (const boat of boats) {
      clearImages.run(boat.id);
      const dir = path.join(IMAGES_DIR, String(boat.id));
      fs.mkdirSync(dir, { recursive: true });

      for (let position = 0; position < IMAGES_PER_BOAT; position++) {
        const photo = photos[cursor++];
        if (!photo) {
          console.warn(`  Not enough distinct photos for "${boat.name}" (only got ${position})`);
          break;
        }
        const filename = `${boat.id}/${position}.jpg`;
        await downloadFile(photo.src.large, path.join(IMAGES_DIR, filename));
        insertImage.run({
          boat_id: boat.id,
          position,
          filename: `real/${filename}`,
          photographer: photo.photographer,
          photographer_url: photo.photographer_url,
          source_url: photo.url,
        });
      }
      console.log(`  ${boat.name}: done`);
    }
  }

  console.log('\nFinished downloading boat photos.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
