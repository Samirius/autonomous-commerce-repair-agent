const product = window.CATALOG.products.find((p) => p.id === 'nova-sneaker');
const formatMinor = (m) => `$${(m / 100).toFixed(2)}`;
const priceEl = document.getElementById('product-price');
priceEl.textContent = formatMinor(product.priceMinor);
priceEl.dataset.priceMinor = String(product.priceMinor);

let count = 0;
document.getElementById('add-to-cart').addEventListener('click', () => {
  count += 1;
  const totalMinor = product.priceMinor * count * count;
  document.getElementById('cart-count').textContent = String(count);
  const t = document.getElementById('cart-total');
  t.textContent = formatMinor(totalMinor);
  t.dataset.totalMinor = String(totalMinor);
});
