// One-off import: adds a real Crownline 264CR listing and converts the
// user-supplied HEIC photos (from a local folder) into a JPEG gallery.
const fs = require('fs');
const path = require('path');
const convert = require('heic-convert');
const db = require('../db/database');

const SOURCE_DIR = 'C:\\Users\\cs_er\\Pictures\\boat';
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'boats', 'real');

const BOAT = {
  name: 'Crownline 264CR',
  type: 'Cabin Cruiser',
  manufacturer: 'Crownline',
  year: 2023,
  length_ft: 26,
  capacity: 8,
  price_cents: 17800000, // ~$178,000 — in line with the app's other 26ft cabin cruisers; adjust via /admin if needed
  stock: 1,
  description:
    "The Crownline 264CR is a 26-foot cabin cruiser built for weekend getaways and day trips alike, " +
    "combining a comfortable cabin below deck with a spacious cockpit for entertaining. A great all-around " +
    "cruiser for couples and small families.",
  image_file: 'placeholder.svg',
};

async function main() {
  const files = fs.readdirSync(SOURCE_DIR)
    .filter((f) => /\.heic$/i.test(f) || /\.jpe?g$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.error(`No image files found in ${SOURCE_DIR}`);
    process.exit(1);
  }
  console.log(`Found ${files.length} source image(s):`, files);

  const existing = db.prepare('SELECT id FROM boats WHERE name = ? AND manufacturer = ?').get(BOAT.name, BOAT.manufacturer);
  let boatId;
  if (existing) {
    boatId = existing.id;
    const updateBoat = db.prepare(`
      UPDATE boats SET type=@type, manufacturer=@manufacturer, year=@year, length_ft=@length_ft,
        capacity=@capacity, price_cents=@price_cents, stock=@stock, description=@description, image_file=@image_file
      WHERE id = @id
    `);
    updateBoat.run({ ...BOAT, id: boatId });
    db.prepare('DELETE FROM boat_images WHERE boat_id = ?').run(boatId);
    console.log(`Boat already existed as id ${boatId} — updated fields and will re-import photos.`);
  } else {
    const insertBoat = db.prepare(`
      INSERT INTO boats (name, type, manufacturer, year, length_ft, capacity, price_cents, stock, description, image_file)
      VALUES (@name, @type, @manufacturer, @year, @length_ft, @capacity, @price_cents, @stock, @description, @image_file)
    `);
    boatId = insertBoat.run(BOAT).lastInsertRowid;
    console.log(`Inserted boat id ${boatId}: ${BOAT.name}`);
  }

  const destDir = path.join(IMAGES_DIR, String(boatId));
  fs.mkdirSync(destDir, { recursive: true });

  const insertImage = db.prepare(`
    INSERT INTO boat_images (boat_id, position, filename, photographer, photographer_url, source_url)
    VALUES (@boat_id, @position, @filename, NULL, NULL, NULL)
  `);

  for (let i = 0; i < files.length; i++) {
    const srcPath = path.join(SOURCE_DIR, files[i]);
    const destFilename = `${i}.jpg`;
    const destPath = path.join(destDir, destFilename);

    if (/\.heic$/i.test(files[i])) {
      const inputBuffer = fs.readFileSync(srcPath);
      const outputBuffer = await convert({ buffer: inputBuffer, format: 'JPEG', quality: 0.85 });
      fs.writeFileSync(destPath, outputBuffer);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }

    insertImage.run({ boat_id: boatId, position: i, filename: `real/${boatId}/${destFilename}` });
    console.log(`  [${i}] ${files[i]} -> ${destFilename}`);
  }

  console.log(`\nDone. Boat #${boatId} "${BOAT.name}" now has ${files.length} photo(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
