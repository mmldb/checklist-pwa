const STORAGE_KEY = "checklist_v1";

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const list = document.getElementById("list");
const clearCheckedBtn = document.getElementById("clearChecked");
const clearAllBtn = document.getElementById("clearAll");

function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function addItem(text) {
  const items = loadItems();
  items.unshift({ id: crypto.randomUUID(), text, done: false, createdAt: Date.now() });
  saveItems(items);
  render();
}

function toggleItem(id) {
  const items = loadItems();
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.done = !item.done;
  saveItems(items);
  render();
}

function deleteItem(id) {
  const items = loadItems().filter(i => i.id !== id);
  saveItems(items);
  render();
}

function clearChecked() {
  const items = loadItems().filter(i => !i.done);
  saveItems(items);
  render();
}

function clearAll() {
  saveItems([]);
  render();
}

function render() {
  const items = loadItems();
  list.innerHTML = "";

  items.forEach((item) => {
    const li = document.createElement("li");
    if (item.done) li.classList.add("checked");

    const label = document.createElement("label");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.done;
    cb.addEventListener("change", () => toggleItem(item.id));

    const span = document.createElement("span");
    span.className = "itemText";
    span.textContent = item.text;

    label.appendChild(cb);
    label.appendChild(span);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "smallBtn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteItem(item.id));

    li.appendChild(label);
    li.appendChild(del);
    list.appendChild(li);
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  addItem(value);
  input.value = "";
  input.focus();
});

clearCheckedBtn.addEventListener("click", clearChecked);
clearAllBtn.addEventListener("click", () => {
  if (confirm("Clear the entire list?")) clearAll();
});

// Offline (service worker)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (e) {
      console.warn("SW registration failed", e);
    }
  });
}

render();