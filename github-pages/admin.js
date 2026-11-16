const config = window.STARBOOKS_CONFIG || {};
const loginForm = document.querySelector("#login-form");
const loginButton = document.querySelector("#login-button");
const loginMessage = document.querySelector("#login-message");
const authPanel = document.querySelector("#auth-panel");
const adminPanel = document.querySelector("#admin-panel");
const signOutButton = document.querySelector("#sign-out");
const signedInAs = document.querySelector("#signed-in-as");
const productForm = document.querySelector("#product-form");
const productList = document.querySelector("#product-list");
const productMessage = document.querySelector("#product-message");
const catalogMessage = document.querySelector("#catalog-message");
const catalogSearch = document.querySelector("#catalog-search");
const catalogCount = document.querySelector("#catalog-count");
const filterButtons = [...document.querySelectorAll(".filter-button")];
let client = null;
let products = [];
let currentFilter = "all";

function showMessage(element, message, kind = "") {
  element.textContent = message;
  element.className = `message${kind ? ` ${kind}` : ""}`;
}

function setSignedIn(isSignedIn) {
  authPanel.hidden = isSignedIn;
  adminPanel.hidden = !isSignedIn;
  signOutButton.hidden = !isSignedIn;
  signedInAs.hidden = !isSignedIn;
}

function priceLabel(priceCents) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(priceCents / 100);
}

function updateCoverFileName() {
  const file = productForm.elements.cover_file.files?.[0];
  document.querySelector("#cover-file-name").textContent = file?.name || "No file selected";
}

function resetProductForm() {
  productForm.reset();
  productForm.elements.original_isbn.value = "";
  productForm.elements.cover_url.value = "";
  productForm.elements.active.checked = true;
  updateCoverFileName();
  document.querySelector("#editor-title").textContent = "New book";
  document.querySelector("#save-product").innerHTML = 'Add book <span aria-hidden="true">→</span>';
  showMessage(productMessage, "");
}

function updateMetrics() {
  document.querySelector("#stat-active").textContent = String(products.filter((product) => product.active).length);
  document.querySelector("#stat-hidden").textContent = String(products.filter((product) => !product.active).length);
  document.querySelector("#stat-picks").textContent = String(products.filter((product) => product.staff_pick).length);
}

function renderProducts() {
  const search = catalogSearch.value.trim().toLowerCase();
  const shown = products.filter((product) => {
    const matchesStatus = currentFilter === "all"
      || (currentFilter === "active" ? product.active : !product.active);
    const matchesSearch = `${product.title} ${product.author} ${product.isbn}`.toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });

  catalogCount.textContent = `${shown.length} ${shown.length === 1 ? "product" : "products"}`;
  if (shown.length === 0) {
    const empty = document.createElement("p");
    empty.className = "list-empty";
    empty.textContent = products.length ? "No books match this view." : "Your catalog is empty. Add your first book.";
    productList.replaceChildren(empty);
    return;
  }

  const rows = shown.map((product) => {
    const row = document.createElement("article");
    row.className = "product-row";

    const cover = document.createElement("img");
    cover.className = "product-cover";
    cover.src = product.cover_url;
    cover.alt = "";
    cover.loading = "lazy";
    cover.referrerPolicy = "no-referrer";

    const details = document.createElement("div");
    details.className = "product-details";
    const title = document.createElement("h3");
    title.textContent = product.title;
    const byline = document.createElement("p");
    byline.textContent = `${product.author} · ${product.isbn}`;
    const tags = document.createElement("div");
    tags.className = "product-tags";
    const visibility = document.createElement("span");
    visibility.className = `status-tag ${product.active ? "is-active" : "is-hidden"}`;
    visibility.textContent = product.active ? "Active" : "Hidden";
    tags.append(visibility);
    if (product.staff_pick) {
      const pick = document.createElement("span");
      pick.className = "pick-tag";
      pick.textContent = "Staff pick";
      tags.append(pick);
    }
    details.append(title, byline, tags);

    const price = document.createElement("strong");
    price.className = "product-price";
    price.textContent = priceLabel(product.price_cents);

    const actions = document.createElement("div");
    actions.className = "product-actions";
    const edit = document.createElement("button");
    edit.className = "row-button";
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.dataset.isbn = product.isbn;
    edit.textContent = "Edit";
    const toggle = document.createElement("button");
    toggle.className = "row-button row-button-secondary";
    toggle.type = "button";
    toggle.dataset.action = "toggle";
    toggle.dataset.isbn = product.isbn;
    toggle.textContent = product.active ? "Hide" : "Publish";
    const remove = document.createElement("button");
    remove.className = "row-button row-button-danger";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.isbn = product.isbn;
    remove.setAttribute("aria-label", `Permanently delete ${product.title}`);
    remove.textContent = "Delete";
    actions.append(edit, toggle, remove);

    row.append(cover, details, price, actions);
    return row;
  });
  productList.replaceChildren(...rows);
}

async function loadProducts() {
  productList.setAttribute("aria-busy", "true");
  showMessage(catalogMessage, "");
  const { data, error } = await client
    .from("books")
    .select("isbn,title,author,price_cents,category,genre_label,cover_url,cover_tone,staff_pick,active,sort_order")
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });
  productList.setAttribute("aria-busy", "false");
  if (error) {
    showMessage(catalogMessage, error.message || "Could not load the catalog.", "is-error");
    return;
  }
  products = data || [];
  updateMetrics();
  renderProducts();
}

function editProduct(product) {
  productForm.elements.original_isbn.value = product.isbn;
  productForm.elements.isbn.value = product.isbn;
  productForm.elements.title.value = product.title;
  productForm.elements.author.value = product.author;
  productForm.elements.price.value = (product.price_cents / 100).toFixed(2);
  productForm.elements.category.value = product.category;
  productForm.elements.genre_label.value = product.genre_label;
  productForm.elements.cover_url.value = product.cover_url;
  productForm.elements.cover_file.value = "";
  updateCoverFileName();
  productForm.elements.cover_tone.value = product.cover_tone;
  productForm.elements.sort_order.value = String(product.sort_order);
  productForm.elements.staff_pick.checked = product.staff_pick;
  productForm.elements.active.checked = product.active;
  document.querySelector("#editor-title").textContent = "Edit book";
  document.querySelector("#save-product").innerHTML = 'Save changes <span aria-hidden="true">→</span>';
  showMessage(productMessage, "");
  productForm.elements.title.focus();
}

async function activateSession(session) {
  if (!session) {
    setSignedIn(false);
    return;
  }

  const { data: isAdmin, error } = await client.rpc("is_starbooks_admin");
  if (error || isAdmin !== true) {
    await client.auth.signOut();
    setSignedIn(false);
    showMessage(loginMessage, error ? "Admin access is not configured yet. Ask the site owner to finish setup." : "This account is not authorized to manage the catalog.", "is-error");
    return;
  }

  setSignedIn(true);
  signedInAs.textContent = "Signed in";
  await loadProducts();
}

if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase?.createClient) {
  loginButton.disabled = true;
  showMessage(loginMessage, "The Supabase connection is not configured for this site.", "is-error");
} else {
  client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginButton.disabled = true;
    showMessage(loginMessage, "Signing in...");
    const formData = new FormData(loginForm);
    try {
      const { data, error } = await client.functions.invoke("admin-login", {
        body: {
          username: String(formData.get("username") || "").trim().toLowerCase(),
          password: formData.get("password"),
        },
      });
      if (error || !data?.access_token || !data?.refresh_token) {
        showMessage(loginMessage, "Username or password is incorrect, or sign-in is temporarily unavailable.", "is-error");
      } else {
        const { data: sessionData, error: sessionError } = await client.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError || !sessionData.session) {
          showMessage(loginMessage, "Sign-in could not be completed. Please try again.", "is-error");
        } else {
          await activateSession(sessionData.session);
        }
      }
    } catch {
      showMessage(loginMessage, "Username or password is incorrect, or sign-in is temporarily unavailable.", "is-error");
    } finally {
      loginButton.disabled = false;
    }
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    await client.auth.signOut();
    products = [];
    productList.replaceChildren();
    setSignedIn(false);
    loginForm.reset();
    showMessage(loginMessage, "You have signed out.");
    signOutButton.disabled = false;
  });

  void client.auth.getSession().then(({ data, error }) => {
    if (error) showMessage(loginMessage, "Could not restore your sign-in. Please sign in again.", "is-error");
    return activateSession(data?.session);
  });
}

document.querySelector("#new-product").addEventListener("click", () => {
  resetProductForm();
  productForm.elements.title.focus();
});

productForm.elements.cover_file.addEventListener("change", updateCoverFileName);
document.querySelector("#reset-product").addEventListener("click", resetProductForm);
catalogSearch.addEventListener("input", renderProducts);
filterButtons.forEach((button) => button.addEventListener("click", () => {
  currentFilter = button.dataset.filter;
  filterButtons.forEach((filterButton) => {
    const isCurrent = filterButton === button;
    filterButton.classList.toggle("active", isCurrent);
    filterButton.setAttribute("aria-pressed", String(isCurrent));
  });
  renderProducts();
}));

productList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !client) return;
  const product = products.find((item) => item.isbn === button.dataset.isbn);
  if (!product) return;
  if (button.dataset.action === "edit") {
    editProduct(product);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!window.confirm(`Permanently delete "${product.title}"? This cannot be undone.`)) return;
    button.disabled = true;
    const { error } = await client.from("books").delete().eq("isbn", product.isbn);
    button.disabled = false;
    if (error) {
      showMessage(catalogMessage, error.message || "Could not delete this book.", "is-error");
      return;
    }
    if (productForm.elements.original_isbn.value === product.isbn) resetProductForm();
    showMessage(catalogMessage, `Deleted ${product.title}.`, "is-success");
    await loadProducts();
    return;
  }

  button.disabled = true;
  const { error } = await client.from("books").update({ active: !product.active }).eq("isbn", product.isbn);
  button.disabled = false;
  if (error) {
    showMessage(catalogMessage, error.message || "Could not update this book.", "is-error");
    return;
  }
  showMessage(catalogMessage, product.active ? "Book hidden from the storefront." : "Book published to the storefront.", "is-success");
  await loadProducts();
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;
  const submitButton = document.querySelector("#save-product");
  submitButton.disabled = true;
  showMessage(productMessage, "Saving book...");

  const formData = new FormData(productForm);
  const isbn = String(formData.get("isbn") || "").replace(/\D/g, "");
  const price = Number(formData.get("price"));
  const sortOrder = Number(formData.get("sort_order"));
  let coverUrl = String(formData.get("cover_url") || "").trim();
  const coverFile = productForm.elements.cover_file.files?.[0];

  if (coverFile) {
    const extensionByType = {
      "image/gif": "gif",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensionByType[coverFile.type];
    if (!extension || coverFile.size > 5 * 1024 * 1024) {
      showMessage(productMessage, "Choose a PNG, JPG, GIF, or WEBP image under 5 MB.", "is-error");
      submitButton.disabled = false;
      return;
    }

    try {
      const objectPath = `${isbn}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage
        .from("book-covers")
        .upload(objectPath, coverFile, { contentType: coverFile.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      coverUrl = client.storage.from("book-covers").getPublicUrl(objectPath).data.publicUrl;
    } catch {
      showMessage(productMessage, "The image could not be uploaded. Please try again.", "is-error");
      submitButton.disabled = false;
      return;
    }
  }

  if (!/^\d{10,13}$/.test(isbn) || !Number.isFinite(price) || price <= 0 || !Number.isInteger(sortOrder) || sortOrder < 0 || !coverUrl) {
    showMessage(productMessage, "Check the ISBN, price, display order, and cover image.", "is-error");
    submitButton.disabled = false;
    return;
  }

  const product = {
    isbn,
    title: String(formData.get("title") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    price_cents: Math.round(price * 100),
    category: formData.get("category"),
    genre_label: String(formData.get("genre_label") || "").trim(),
    cover_url: coverUrl,
    cover_tone: formData.get("cover_tone"),
    staff_pick: formData.has("staff_pick"),
    active: formData.has("active"),
    sort_order: sortOrder,
  };
  const originalIsbn = String(formData.get("original_isbn") || "");
  const result = originalIsbn
    ? await client.from("books").update(product).eq("isbn", originalIsbn)
    : await client.from("books").insert(product);
  submitButton.disabled = false;

  if (result.error) {
    showMessage(productMessage, result.error.code === "23505" ? "That ISBN is already in the catalog." : result.error.message || "Could not save this book.", "is-error");
    return;
  }
  resetProductForm();
  showMessage(catalogMessage, originalIsbn ? "Book updated." : "Book added to the catalog.", "is-success");
  await loadProducts();
});