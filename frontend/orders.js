const API_BASE = "http://127.0.0.1:5002";

const customerNameEl = document.getElementById("customerName");
const menuSelectEl = document.getElementById("menuSelect");
const qtyEl = document.getElementById("qty");

const addToCartBtn = document.getElementById("addToCartBtn");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const clearCartBtn = document.getElementById("clearCartBtn");

const cartBoxEl = document.getElementById("cartBox");
const orderMsgEl = document.getElementById("orderMsg");

const ordersListEl = document.getElementById("ordersList");
const refreshOrdersBtn = document.getElementById("refreshOrdersBtn");

let menuItems = [];
let cart = [];

function renderMenuDropdown() {
  menuSelectEl.innerHTML = "";
  const available = menuItems.filter((x) => x.is_available);

  if (available.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No available items";
    menuSelectEl.appendChild(opt);
    return;
  }

  available.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = `${item.name} (₹${item.price})`;
    menuSelectEl.appendChild(opt);
  });
}

function renderCart() {
  if (cart.length === 0) {
    cartBoxEl.innerHTML = "Cart is empty";
    return;
  }

  let total = 0;

  const html = cart.map((c, idx) => {
    total += c.line_total;
    return `
      <div class="item" style="margin-bottom:10px;">
        <div class="item-top">
          <div>
            <h3>${c.name}</h3>
            <p class="meta">Qty: ${c.quantity} • Price: ₹${c.price_each}</p>
            <p class="meta"><b>Line Total:</b> ₹${c.line_total}</p>
          </div>
          <button class="btn" data-remove="${idx}">Remove</button>
        </div>
      </div>
    `;
  }).join("");

  cartBoxEl.innerHTML = html + `<p class="meta"><b>Total:</b> ₹${total}</p>`;
}

async function loadMenu() {
  const res = await fetch(`${API_BASE}/menu`);
  const data = await res.json();
  menuItems = data.menu_items || [];
  renderMenuDropdown();
}

async function loadOrders() {
  ordersListEl.innerHTML = "Loading orders...";
  const res = await fetch(`${API_BASE}/orders`);
  const data = await res.json();

  const orders = data.orders || [];
  if (orders.length === 0) {
    ordersListEl.innerHTML = `<p class="muted">No orders yet.</p>`;
    return;
  }

  ordersListEl.innerHTML = "";

  orders.forEach((o) => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      <div class="item-top">
        <div>
          <h3>Order #${o.id} • ${o.customer_name}</h3>
          <p class="meta">Total: ₹${o.total_amount}</p>
          <p class="meta">Status: <b>${o.status}</b></p>
        </div>
        <div class="actions">
          <button class="btn" data-view="${o.id}">View</button>
          <button class="btn" data-status="${o.id}" data-new="ACCEPTED">Accept</button>
          <button class="btn" data-status="${o.id}" data-new="PREPARING">Preparing</button>
          <button class="btn" data-status="${o.id}" data-new="READY">Ready</button>
          <button class="btn" data-status="${o.id}" data-new="DELIVERED">Delivered</button>
          <button class="btn" data-status="${o.id}" data-new="CANCELLED">Cancel</button>
        </div>
      </div>
    `;

    ordersListEl.appendChild(div);
  });
}

addToCartBtn.addEventListener("click", () => {
  const selectedId = Number(menuSelectEl.value);
  const qty = Number(qtyEl.value);

  if (!selectedId) {
    orderMsgEl.innerText = "No menu item selected";
    return;
  }

  if (!qty || qty <= 0) {
    orderMsgEl.innerText = "Quantity must be >= 1";
    return;
  }

  const item = menuItems.find((x) => x.id === selectedId);
  if (!item) {
    orderMsgEl.innerText = "Item not found";
    return;
  }

  const lineTotal = item.price * qty;

  cart.push({
    menu_item_id: item.id,
    name: item.name,
    quantity: qty,
    price_each: item.price,
    line_total: lineTotal
  });

  orderMsgEl.innerText = "Added to cart ✅";
  renderCart();
});

cartBoxEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const idx = btn.dataset.remove;
  if (idx === undefined) return;

  cart.splice(Number(idx), 1);
  renderCart();
});

clearCartBtn.addEventListener("click", () => {
  cart = [];
  orderMsgEl.innerText = "Cart cleared";
  renderCart();
});

placeOrderBtn.addEventListener("click", async () => {
  const customerName = customerNameEl.value.trim();

  if (!customerName) {
    orderMsgEl.innerText = "Customer name is required";
    return;
  }

  if (cart.length === 0) {
    orderMsgEl.innerText = "Cart is empty";
    return;
  }

  const payload = {
    customer_name: customerName,
    items: cart.map((c) => ({
      menu_item_id: c.menu_item_id,
      quantity: c.quantity
    }))
  };

  orderMsgEl.innerText = "Placing order...";

  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    orderMsgEl.innerText = data.error || "Failed to place order";
    return;
  }

  orderMsgEl.innerText = `Order placed ✅ Order ID: ${data.order_id} | Total: ₹${data.total_amount}`;
  cart = [];
  renderCart();
  await loadOrders();
});

ordersListEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  // View
  const viewId = btn.dataset.view;
  if (viewId) {
    const res = await fetch(`${API_BASE}/orders/${viewId}`);
    const data = await res.json();
    alert(JSON.stringify(data, null, 2));
    return;
  }

  // Status update
  const statusId = btn.dataset.status;
  const newStatus = btn.dataset.new;

  if (statusId && newStatus) {
    await fetch(`${API_BASE}/orders/${statusId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });

    await loadOrders();
  }
});

refreshOrdersBtn.addEventListener("click", loadOrders);

(async function init() {
  await loadMenu();
  await loadOrders();
  renderCart();
})();
