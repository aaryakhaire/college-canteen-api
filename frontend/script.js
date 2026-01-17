const API_BASE = "http://127.0.0.1:5002";

const backendStatusEl = document.getElementById("backendStatus");
const menuListEl = document.getElementById("menuList");
const refreshBtn = document.getElementById("refreshBtn");

const searchInput = document.getElementById("searchInput");
const availabilityFilter = document.getElementById("availabilityFilter");

const menuForm = document.getElementById("menuForm");
const formMsg = document.getElementById("formMsg");

const nameEl = document.getElementById("name");
const priceEl = document.getElementById("price");
const categoryEl = document.getElementById("category");

let allItems = [];

function setBackendBadge(ok) {
  if (ok) {
    backendStatusEl.innerText = "Online";
    backendStatusEl.style.borderColor = "rgba(120, 255, 175, 0.5)";
  } else {
    backendStatusEl.innerText = "Offline";
    backendStatusEl.style.borderColor = "rgba(255, 120, 120, 0.5)";
  }
}

async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Backend not reachable");
    setBackendBadge(true);
  } catch (err) {
    setBackendBadge(false);
  }
}

function renderItems(items) {
  if (!items.length) {
    menuListEl.innerHTML = `<p class="muted">No menu items found.</p>`;
    return;
  }

  menuListEl.innerHTML = "";

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="item-top">
        <div>
          <h3>${item.name}</h3>
          <p class="meta">₹${item.price} • ${item.category}</p>
          <p class="meta">Available: <b>${item.is_available ? "Yes" : "No"}</b></p>
        </div>
        <div class="meta">#${item.id}</div>
      </div>

      <div class="actions">
        <button class="btn" data-action="toggle" data-id="${item.id}">
          ${item.is_available ? "Mark Unavailable" : "Mark Available"}
        </button>

        <button class="btn" data-action="delete" data-id="${item.id}">
          Delete
        </button>
      </div>
    `;

    menuListEl.appendChild(div);
  });
}

function applyFilters() {
  const search = searchInput.value.trim().toLowerCase();
  const filter = availabilityFilter.value;

  let filtered = allItems;

  if (search) {
    filtered = filtered.filter((i) => i.name.toLowerCase().includes(search));
  }

  if (filter === "AVAILABLE") {
    filtered = filtered.filter((i) => i.is_available === true);
  } else if (filter === "UNAVAILABLE") {
    filtered = filtered.filter((i) => i.is_available === false);
  }

  renderItems(filtered);
}

async function fetchMenu() {
  menuListEl.innerHTML = "Loading menu...";
  try {
    const res = await fetch(`${API_BASE}/menu`);
    const data = await res.json();
    allItems = data.menu_items || [];
    applyFilters();
  } catch (err) {
    menuListEl.innerHTML = `<p class="muted">Failed to load menu. Is backend running?</p>`;
  }
}

async function addMenuItem(payload) {
  formMsg.innerText = "Adding item...";
  try {
    const res = await fetch(`${API_BASE}/menu`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      formMsg.innerText = data.error || "Failed to add item";
      return;
    }

    formMsg.innerText = "Item added successfully ✅";
    nameEl.value = "";
    priceEl.value = "";
    categoryEl.value = "";

    await fetchMenu();
  } catch (err) {
    formMsg.innerText = "Backend not reachable. Check server.";
  }
}

async function toggleAvailability(id, currentStatus) {
  await fetch(`${API_BASE}/menu/${id}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_available: !currentStatus }),
  });
  await fetchMenu();
}

async function deleteItem(id) {
  await fetch(`${API_BASE}/menu/${id}`, {
    method: "DELETE",
  });
  await fetchMenu();
}

menuForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    name: nameEl.value.trim(),
    price: Number(priceEl.value),
    category: categoryEl.value.trim(),
  };

  await addMenuItem(payload);
});

refreshBtn.addEventListener("click", fetchMenu);

searchInput.addEventListener("input", applyFilters);
availabilityFilter.addEventListener("change", applyFilters);

menuListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = Number(btn.dataset.id);

  const item = allItems.find((x) => x.id === id);
  if (!item) return;

  if (action === "toggle") {
    await toggleAvailability(id, item.is_available);
  } else if (action === "delete") {
    await deleteItem(id);
  }
});

(async function init() {
  await checkBackend();
  await fetchMenu();
})();
