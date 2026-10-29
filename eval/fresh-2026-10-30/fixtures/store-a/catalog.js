// Canonical catalog (read-only for the agent).
window.CATALOG = {
  "products": [
    { "id": "house-blend", "name": "House Blend 250g", "priceMinor": 1450, "currency": "USD", "tag": "Bestseller" },
    { "id": "single-origin", "name": "Single Origin Ethiopia", "priceMinor": 2200, "currency": "USD", "tag": "Limited" },
    { "id": "cold-brew-kit", "name": "Cold Brew Kit", "priceMinor": 3900, "currency": "USD", "tag": "New" }
  ],
  "rules": { "bulkDiscount": { "minQty": 4, "percentOff": 10 }, "promoCodes": { "BREW10": 10 } }
};
