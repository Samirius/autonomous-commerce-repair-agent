const formatMinor = (m) => `$${(m / 100).toFixed(2)}`;
const cart = new Map(); // id -> qty
let promoPercent = 0;

function renderProducts() {
  const grid = document.getElementById('product-grid');
  window.CATALOG.products.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="thumb" aria-hidden="true">${p.name.split(' ').map((x) => x[0]).join('')}</div>
      <p class="tag">${p.tag}</p><h3>${p.name}</h3>
      <p class="price" ${i === 0 ? 'id="product-price"' : ''} data-price-minor="${p.priceMinor}">${formatMinor(p.priceMinor)}</p>
      <button type="button" class="add-btn" ${i === 0 ? 'id="add-to-cart"' : ''} data-add="${p.id}">Add to Cart</button>`;
    grid.appendChild(card);
  });
  grid.addEventListener('click', (e) => {
    const id = e.target.dataset?.add;
    if (id) { cart.set(id, (cart.get(id) || 0) + 1); renderCart(); }
  });
}

function totals() {
  let subtotal = 0, count = 0;
  for (const [id, qty] of cart) {
    const p = window.CATALOG.products.find((x) => x.id === id);
    subtotal += p.priceMinor * qty; count += qty;
  }
  const discount = Math.round(subtotal * promoPercent / 100);
  return { subtotal, discount, total: subtotal - discount, count };
}

function renderCart() {
  const lines = document.getElementById('cart-lines');
  lines.innerHTML = '';
  for (const [id, qty] of cart) {
    const p = window.CATALOG.products.find((x) => x.id === id);
    const row = document.createElement('div');
    row.className = 'line';
    row.innerHTML = `<span>${p.name}</span>
      <button type="button" data-dec="${id}" aria-label="Decrease quantity">−</button>
      <span data-qty="${id}">${qty}</span>
      <button type="button" data-inc="${id}" aria-label="Increase quantity">+</button>
      <strong>${formatMinor(p.priceMinor * qty)}</strong>`;
    lines.appendChild(row);
  }
  const t = totals();
  document.getElementById('cart-count').textContent = String(t.count);
  const sub = document.getElementById('cart-subtotal'); sub.textContent = formatMinor(t.subtotal); sub.dataset.subtotalMinor = String(t.subtotal);
  const dis = document.getElementById('cart-discount'); dis.textContent = `−${formatMinor(t.discount)}`; dis.dataset.discountMinor = String(t.discount);
  const tot = document.getElementById('cart-total'); tot.textContent = formatMinor(t.total); tot.dataset.totalMinor = String(t.total);
}

document.getElementById('cart-lines').addEventListener('click', (e) => {
  const inc = e.target.dataset?.inc, dec = e.target.dataset?.dec;
  if (inc) cart.set(inc, cart.get(inc) + 1);
  if (dec) { const q = cart.get(dec) - 1; q <= 0 ? cart.delete(dec) : cart.set(dec, q); }
  if (inc || dec) renderCart();
});
document.getElementById('apply-promo').addEventListener('click', () => {
  const code = document.getElementById('promo-code').value.trim().toUpperCase();
  const pct = window.CATALOG.rules.promoCodes[code] || 0;
  promoPercent = pct;
  document.getElementById('promo-status').textContent = pct ? `${code} applied: ${pct}% off` : 'Code not recognised';
  renderCart();
});
document.getElementById('checkout').addEventListener('click', () => {
  document.getElementById('checkout-status').textContent = totals().count ? 'Demo checkout — no payment taken.' : 'Your cart is empty.';
});
renderProducts();
renderCart();
