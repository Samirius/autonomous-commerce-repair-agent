const product = window.CATALOG.products.find((p) => p.id === 'nova-sneaker');
const formatMinor = (minor) => `$${(minor / 100).toFixed(2)}`;

const priceEl = document.getElementById('product-price');
priceEl.textContent = formatMinor(product.priceMinor);
priceEl.dataset.priceMinor = String(product.priceMinor);

// Intentional Mission 002 defect: the cart charges a stale legacy unit
// price instead of the canonical catalog price, so cart totals disagree
// with the product page and the catalog.
const LEGACY_CART_PRICE_MINOR = 7900;

let count = 0;
let totalMinor = 0;
document.getElementById('add-to-cart').addEventListener('click', () => {
  count += 1;
  totalMinor = product.priceMinor * count;
  document.getElementById('cart-count').textContent = String(count);
  const totalEl = document.getElementById('cart-total');
  totalEl.textContent = formatMinor(totalMinor);
  totalEl.dataset.totalMinor = String(totalMinor);
});
