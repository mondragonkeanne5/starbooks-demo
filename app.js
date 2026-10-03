const cards = [...document.querySelectorAll(".book-card")];
const filters = [...document.querySelectorAll(".filter-chip")];
const searchInput = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");
const bagCount = document.querySelector("#bag-count");
const cartDrawer = document.querySelector("#cart-drawer");
const cartItems = document.querySelector("#cart-items");
const cartSubtotal = document.querySelector("#cart-subtotal");
const cartItemCount = document.querySelector("#cart-item-count");
const checkoutButton = document.querySelector("#checkout-button");
const checkoutMessage = document.querySelector("#checkout-message");
const scrim = document.querySelector("#scrim");
const cart = new Map();
let activeCategory = "All";
let toastTimer;

function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();
  let visibleCount = 0;
  cards.forEach((card) => {
    const matchesCategory = activeCategory === "All"
      || (activeCategory === "Staff picks" ? card.dataset.pick === "true" : card.dataset.category === activeCategory);
    const matchesSearch = `${card.dataset.title} ${card.dataset.author}`.toLowerCase().includes(query);
    const isVisible = matchesCategory && matchesSearch;
    card.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });
  emptyState.hidden = visibleCount !== 0;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 1900);
}

function addToBag(card) {
  const isbn = card.dataset.isbn;
  const item = cart.get(isbn);
  cart.set(isbn, { title: card.dataset.title, author: card.dataset.author, price: Number(card.dataset.price), quantity: (item?.quantity ?? 0) + 1 });
  renderCart();
  showToast(`${card.dataset.title} added to your bag`);
}

function changeQuantity(isbn, amount) {
  const item = cart.get(isbn);
  if (!item) return;
  item.quantity += amount;
  if (item.quantity < 1) cart.delete(isbn);
  renderCart();
}

function renderCart() {
  const totalItems = [...cart.values()].reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = [...cart.values()].reduce((sum, item) => sum + item.price * item.quantity, 0);
  bagCount.textContent = String(totalItems);
  document.querySelector("#open-cart").setAttribute("aria-label", `Open shopping bag, ${totalItems} items`);
  cartItemCount.textContent = `(${totalItems})`;
  cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  checkoutButton.disabled = totalItems === 0;
  checkoutButton.hidden = false;
  if (totalItems === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Your next favorite is still out there.</p>';
    checkoutMessage.textContent = "";
    return;
  }
  checkoutMessage.textContent = "";
  cartItems.innerHTML = [...cart.entries()].map(([isbn, item]) => `
    <article class="cart-line">
      <img src="https://covers.openlibrary.org/b/isbn/${isbn}-S.jpg" alt="" />
      <div><h3>${item.title}</h3><p>${item.author}</p><div class="quantity-controls" aria-label="Quantity for ${item.title}"><button type="button" data-action="decrease" data-isbn="${isbn}" aria-label="Remove one ${item.title}">−</button><span>${item.quantity}</span><button type="button" data-action="increase" data-isbn="${isbn}" aria-label="Add one ${item.title}">+</button></div></div>
      <span class="cart-line-price">$${(item.price * item.quantity).toFixed(2)}</span>
    </article>`).join("");
}

function setCartOpen(isOpen) {
  cartDrawer.classList.toggle("open", isOpen);
  cartDrawer.setAttribute("aria-hidden", String(!isOpen));
  cartDrawer.inert = !isOpen;
  scrim.hidden = !isOpen;
  document.body.classList.toggle("cart-open", isOpen);
  if (isOpen) document.querySelector("#close-cart").focus();
  else document.querySelector("#open-cart").focus();
}

filters.forEach((filter) => filter.addEventListener("click", () => {
  activeCategory = filter.dataset.category;
  filters.forEach((button) => {
    const isActive = button === filter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  applyFilters();
}));

searchInput.addEventListener("input", applyFilters);
document.querySelectorAll(".quick-add").forEach((button) => button.addEventListener("click", () => addToBag(button.closest(".book-card"))));
document.querySelector("#open-cart").addEventListener("click", () => setCartOpen(true));
document.querySelector("#close-cart").addEventListener("click", () => setCartOpen(false));
scrim.addEventListener("click", () => setCartOpen(false));
cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  changeQuantity(button.dataset.isbn, button.dataset.action === "increase" ? 1 : -1);
});
checkoutButton.addEventListener("click", () => {
  if (cart.size === 0) return;
  const orderNumber = `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  cart.clear();
  renderCart();
  checkoutButton.hidden = true;
  checkoutMessage.textContent = `${orderNumber} complete. This is a demo; no payment, email, or order record was created.`;
  showToast("Demo checkout complete");
});
document.querySelector("#menu-toggle").addEventListener("click", (event) => {
  const menu = document.querySelector("#mobile-menu");
  const isOpen = menu.classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});
document.querySelectorAll("#mobile-menu a").forEach((link) => link.addEventListener("click", () => {
  document.querySelector("#mobile-menu").classList.remove("open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cartDrawer.classList.contains("open")) setCartOpen(false);
});