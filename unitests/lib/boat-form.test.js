const test = require('node:test');
const assert = require('node:assert/strict');
const { FIELDS, boatFromForm } = require('../../lib/boat-form');

test('boatFromForm parses numeric fields and converts price to cents', () => {
  const boat = boatFromForm({
    name: 'Test Boat',
    type: 'Sailboat',
    manufacturer: 'Beneteau',
    year: '2020',
    length_ft: '32',
    capacity: '6',
    engine_hours: '150',
    price: '99999.99',
    stock: '3',
    city: 'Halifax',
    province: 'Nova Scotia',
    description: 'A fine boat',
    image_file: 'custom.jpg',
  });

  assert.deepEqual(boat, {
    name: 'Test Boat',
    type: 'Sailboat',
    manufacturer: 'Beneteau',
    year: 2020,
    length_ft: 32,
    capacity: 6,
    engine_hours: 150,
    price_cents: 9999999,
    stock: 3,
    city: 'Halifax',
    province: 'Nova Scotia',
    description: 'A fine boat',
    image_file: 'custom.jpg',
  });
});

test('boatFromForm defaults image_file to placeholder.svg when blank', () => {
  const boat = boatFromForm({
    name: 'Test Boat',
    type: 'Sailboat',
    manufacturer: 'Beneteau',
    year: '2020',
    length_ft: '32',
    capacity: '6',
    engine_hours: '0',
    price: '1000',
    stock: '1',
    description: 'desc',
    image_file: '',
  });

  assert.equal(boat.image_file, 'placeholder.svg');
});

test('boatFromForm defaults engine_hours to 0 when missing or non-numeric', () => {
  const boat = boatFromForm({
    name: 'Test Boat',
    type: 'Sailboat',
    manufacturer: 'Beneteau',
    year: '2020',
    length_ft: '32',
    capacity: '6',
    price: '1000',
    stock: '1',
    description: 'desc',
  });

  assert.equal(boat.engine_hours, 0);
});

test('FIELDS lists exactly the columns boatFromForm produces (minus price->price_cents)', () => {
  const boat = boatFromForm({
    name: 'x', type: 'x', manufacturer: 'x', year: '2020', length_ft: '10',
    capacity: '2', engine_hours: '5', price: '10', stock: '1', city: 'x', province: 'x', description: 'x', image_file: 'x',
  });
  assert.deepEqual(new Set(FIELDS), new Set(Object.keys(boat)));
});
