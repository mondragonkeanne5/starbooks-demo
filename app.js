let cards = [...document.querySelectorAll(".book-card")];
const filters = [...document.querySelectorAll(".filter-chip")];
const bookGrid = document.querySelector("#book-grid");
const searchInput = document.querySelector("#search");
const emptyState = document.querySelector("#empty-state");
const bagCount = document.querySelector("#bag-count");
const cartDrawer = document.querySelector("#cart-drawer");
const cartItems = document.querySelector("#cart-items");
const cartSubtotal = document.querySelector("#cart-subtotal");
const cartItemCount = document.querySelector("#cart-item-count");
const checkoutButton = document.querySelector("#checkout-button");
const checkoutForm = document.querySelector("#checkout-form");
const checkoutMessage = document.querySelector("#checkout-message");
const scrim = document.querySelector("#scrim");
const backendConfig = window.STARBOOKS_CONFIG || {};
const cart = new Map();
let activeCategory = "All";
let toastTimer;
let captchaWidgetId;

function renderOrderCaptcha() {
  if (!backendConfig.turnstileSiteKey || !window.turnstile || captchaWidgetId !== undefined) return;
  captchaWidgetId = window.turnstile.render("#order-captcha", { sitekey: backendConfig.turnstileSiteKey });
}

window.addEventListener("load", renderOrderCaptcha);

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card";
  card.dataset.category = book.category;
  card.dataset.title = book.title;
  card.dataset.author = book.author;
  card.dataset.price = (book.price_cents / 100).toFixed(2);
  card.dataset.isbn = book.isbn;
  card.dataset.pick = String(book.staff_pick);

  const art = document.createElement("div");
  art.className = `book-art cover-${book.cover_tone}`;
  const cover = document.createElement("img");
  cover.src = book.cover_url;
  cover.alt = `Cover of ${book.title} by ${book.author}`;
  cover.loading = "lazy";
  art.append(cover);

  if (book.staff_pick) {
    const pickLabel = document.createElement("span");
    pickLabel.className = "pick-label";
    pickLabel.textContent = "STAFF PICK";
    art.append(pickLabel);
  }

  const addButton = document.createElement("button");
  addButton.className = "quick-add";
  addButton.type = "button";
  addButton.setAttribute("aria-label", `Add ${book.title} to bag`);
  addButton.textContent = "+";
  art.append(addButton);

  card.append(art);

  const info = document.createElement("div");
  info.className = "book-info";
  const text = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = book.title;
  const author = document.createElement("p");
  author.textContent = book.author;
  text.append(title, author);
  const price = document.createElement("span");
  price.className = "price";
  price.textContent = `$${(book.price_cents / 100).toFixed(2)}`;
  info.append(text, price);
  card.append(info);

  const genre = document.createElement("span");
  genre.className = "book-genre";
  genre.textContent = book.genre_label.toUpperCase();
  card.append(genre);
  return card;
}

async function loadBookCatalog() {
  if (!backendConfig.supabaseUrl || !backendConfig.supabaseAnonKey) return;
  const query = new URLSearchParams({
    select: "isbn,title,author,price_cents,category,genre_label,cover_url,cover_tone,staff_pick",
    active: "eq.true",
    order: "sort_order.asc",
  });
  try {
    const response = await fetch(`${backendConfig.supabaseUrl}/rest/v1/books?${query}`, {
      headers: { apikey: backendConfig.supabaseAnonKey },
    });
    if (!response.ok) throw new Error(`Catalog request failed (${response.status}).`);
    const books = await response.json();
    if (!Array.isArray(books) || books.length === 0) return;
    bookGrid.replaceChildren(...books.map(createBookCard));
    cards = [...bookGrid.querySelectorAll(".book-card")];
    applyFilters();
  } catch (error) {
    console.warn("Could not load the database catalog; showing the preview catalog instead.", error);
  }
}

void loadBookCatalog();

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
  cart.set(isbn, {
    title: card.dataset.title,
    author: card.dataset.author,
    price: Number(card.dataset.price),
    quantity: (item?.quantity ?? 0) + 1,
  });
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
    checkoutForm.hidden = true;
    checkoutForm.reset();
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
bookGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".quick-add");
  if (button) addToBag(button.closest(".book-card"));
});
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
  checkoutMessage.textContent = "";
  checkoutForm.hidden = false;
  checkoutButton.hidden = true;
  renderOrderCaptcha();
  checkoutForm.querySelector("input[name='customer_email']").focus();
});
checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (cart.size === 0) return;
  if (!backendConfig.supabaseUrl || !backendConfig.supabaseAnonKey) {
    checkoutMessage.textContent = "Email checkout is not connected yet. No email was sent.";
    return;
  }

  const formData = new FormData(checkoutForm);
  const request = {
    customer_email: formData.get("customer_email"),
    website: formData.get("website"),
    turnstile_token: window.turnstile && captchaWidgetId !== undefined
      ? window.turnstile.getResponse(captchaWidgetId)
      : "",
    items: [...cart.entries()].map(([isbn, item]) => ({ isbn, quantity: item.quantity })),
  };
  if (backendConfig.turnstileSiteKey && !request.turnstile_token) {
    checkoutMessage.textContent = "Complete the spam check before sending the receipt.";
    return;
  }

  const submitButton = checkoutForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  checkoutMessage.textContent = "Sending receipt...";
  try {
    const response = await fetch(`${backendConfig.supabaseUrl}/functions/v1/send-demo-receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: backendConfig.supabaseAnonKey },
      body: JSON.stringify(request),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "We could not send the receipt. Please try again.");
    const customerEmail = request.customer_email;
    cart.clear();
    checkoutForm.reset();
    if (captchaWidgetId !== undefined) window.turnstile.reset(captchaWidgetId);
    renderCart();
    checkoutButton.hidden = true;
    checkoutMessage.textContent = `Receipt sent to ${customerEmail}. No payment was collected.`;
    showToast("Receipt sent");
  } catch (error) {
    checkoutMessage.textContent = error.message || "Could not send the receipt. Please try again.";
    checkoutButton.hidden = false;
    if (captchaWidgetId !== undefined) window.turnstile.reset(captchaWidgetId);
  } finally {
    submitButton.disabled = false;
  }
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
