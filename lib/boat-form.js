const FIELDS = ['name', 'type', 'manufacturer', 'year', 'length_ft', 'capacity', 'engine_hours', 'price_cents', 'stock', 'location', 'description', 'image_file'];

function boatFromForm(body) {
  return {
    name: body.name,
    type: body.type,
    manufacturer: body.manufacturer,
    year: parseInt(body.year, 10),
    length_ft: parseInt(body.length_ft, 10),
    capacity: parseInt(body.capacity, 10),
    engine_hours: parseInt(body.engine_hours, 10) || 0,
    price_cents: Math.round(parseFloat(body.price) * 100),
    stock: parseInt(body.stock, 10),
    location: body.location || '',
    description: body.description,
    image_file: body.image_file || 'placeholder.svg',
  };
}

module.exports = { FIELDS, boatFromForm };
