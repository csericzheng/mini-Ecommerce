# Mini E-Commerce — Boats

A small e-commerce demo selling 50 boats, built with Node.js, Express, EJS, and SQLite.

## Features

- Catalog page with search and type filtering
- Boat detail pages with a ~10-photo gallery per boat
- User registration and login (phone number + password); only logged-in users can add boats to the cart or check out
- Session-based shopping cart
- Checkout flow that records orders in SQLite (no real payment processing)
- Admin panel for creating, editing, and deleting boat listings

## Tech stack

- **Backend:** Node.js + Express
- **Views:** EJS templates
- **Database:** SQLite via Node's built-in `node:sqlite` module (no native build step required)
- **Session/cart:** `express-session` (in-memory store)
- **Photos:** real stock photos fetched from the [Pexels API](https://www.pexels.com/api/)

## Getting started

The repo ships with `db/miniecommerce.db` and `public/images/boats/real/` already committed, so
it runs immediately after cloning — no seeding, no API key, no local photo folder required:

```bash
npm install
npm start   # http://localhost:3000
```

For auto-restart during development:

```bash
npm run dev
```

### Regenerating the data (optional)

Only needed if you want to reset/regenerate the catalog from scratch:

```bash
npm run seed             # wipes and regenerates the SQLite DB with 50 boat listings
npm run fetch-images      # downloads ~10 real photos per boat from Pexels (needs PEXELS_API_KEY)
npm run import-crownline   # re-adds the Crownline 264CR listing (needs the local photo folder)
```

`fetch-images` requires a free Pexels API key, set via a `.env` file in the project root:

```
PEXELS_API_KEY=your_key_here
```

If you skip `fetch-images` (or don't have a key), boats fall back to a procedurally generated
SVG placeholder image instead of a photo.

## Deploying (Render)

A `render.yaml` blueprint is included. On [render.com](https://render.com): New → Blueprint →
connect this GitHub repo → it reads `render.yaml` and deploys automatically. Free tier notes:
the instance spins down after 15 minutes idle (cold start on the next request), and its
filesystem is ephemeral — any admin edits, orders, or view counts made on the live site will
reset to the committed DB snapshot on the next deploy or restart.

## Project structure

```
server.js                Express app entry point
db/schema.sql             SQLite table definitions (boats, boat_images, orders, order_items)
db/database.js             DB connection, applies schema on boot
scripts/seed.js             Generates 50 boats + fallback placeholder SVGs
scripts/fetch-images.js      Downloads real boat photos from Pexels into boat_images
scripts/import-crownline.js   Adds/updates the Crownline 264CR listing from local HEIC/JPEG photos
routes/auth.js                Register/login/logout routes
routes/boats.js                Catalog + boat detail routes
routes/cart.js                  Cart + checkout routes (add/checkout require login)
routes/admin.js                  Admin CRUD routes
lib/password.js                   Password hashing (Node crypto scrypt, no dependency)
views/                             EJS templates
public/                            Static assets (CSS, boat images)
```

## Notes

- The `/admin` panel has no authentication; it's a demo CRUD interface, not production-ready.
- User accounts require first name, last name, and phone number (used as the login identifier); date of birth, address, and email are optional. Passwords are hashed with Node's built-in `crypto.scryptSync` — there's no CSRF protection, rate limiting, or password reset flow, so treat this as a demo auth system, not production-grade.
- Boats of the same type share a photo pool (Pexels has no photos of these fictional boat models), but no two boats of the same type get the same set of photos.
- Photo credit (photographer name + Pexels profile link) is shown on each boat's detail page, per Pexels' attribution guidelines.
- `npm run seed` wipes and regenerates the entire boats table, which deletes the Crownline 264CR listing (it isn't part of the random seed data). Re-run `npm run import-crownline` afterward to restore it — the script is idempotent and reads its source photos from a local folder path hardcoded at the top of `scripts/import-crownline.js`.
