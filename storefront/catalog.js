// Canonical catalog — single source of truth for product data.
// Read-only for the repair agent: it may cite this data as evidence,
// but repairs must fix the code that disagrees with it, never edit it.
window.CATALOG = {
  "products": [
    { "id": "nova-sneaker", "name": "Nova Everyday Sneaker", "priceMinor": 8900, "currency": "USD" }
  ]
};
