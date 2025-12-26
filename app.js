const STORAGE_KEY = "checklist_categories_v1";

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const list = document.getElementById("list");
const clearCheckedBtn = document.getElementById("clearChecked");
const clearAllBtn = document.getElementById("clearAll");

const categorySelect = document.getElementById("categorySelect");
const newCategoryBtn = document.getElementById("newCategory");
const editCategoryBtn = document.getElementById("editCategory");
const deleteCategoryBtn = document.getElementById("deleteCategory");

function defaultState() {
  return {
    activeCategoryId: null,
    categories: [
      { id: crypto.randomUUID(), name: "Bevásárlás", items: [] }
    ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw);
    if (!state.categories || !state.categories.length) return defaultState();
    return state;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveCategory(state) {
  const id = state.activeCategoryId || state.categories[0].id;
  const cat = state.categories.find(c => c.id === id) || state.categories[0];
  state.activeCategoryId = cat.id;
  return cat;
}

function renderCategories() {
  const state = loadState();
  const active = getActiveCategory(state);
  saveState(state);

  categorySelect.innerHTML = "";
  state.categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.id === active.id) opt.selected = true;
    categorySelect.appendChild(opt);
  });
}

function renderList() {
  const state = loadState();
  const cat = getActiveCategory(state);

  list.innerHTML = "";
  cat.items.forEach((item) => {
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

function renderAll() {
  renderCategories();
  renderList();
}

function setActiveCategory(id) {
  const state = loadState();
  state.activeCategoryId = id;
  saveState(state);
  renderList();
}

function createCategory() {
  const name = prompt("Add new Category (e.g. Ovi, Azúr):");
  if (!name) return;

  const trimmed = name.trim();
  if (!trimmed) return;

  const state = loadState();
  state.categories.unshift({ id: crypto.randomUUID(), name: trimmed, items: [] });
  state.activeCategoryId = state.categories[0].id;
  saveState(state);
  renderAll();
}

function editCategory() {
  const state = loadState();
  const active = getActiveCategory(state);

  const nextName = prompt("Rename Category:", active.name);
  if (nextName === null) return;

  const trimmed = nextName.trim();
  if (!trimmed) return;

  active.name = trimmed;
  saveState(state);
  renderCategories();
}

function deleteCategory() {
  const state = loadState();
  const active = getActiveCategory(state);

  if (state.categories.length === 1) {
    alert("You can’t delete the last category.");
    return;
  }

  const ok = confirm(`Delete category "${active.name}" and all its items?`);
  if (!ok) return;

  state.categories = state.categories.filter(c => c.id !== active.id);
  state.activeCategoryId = state.categories[0].id;
  saveState(state);
  renderAll();
}

function addItem(text) {
  const state = loadState();
  const cat = getActiveCategory(state);

  cat.items.unshift({ id: crypto.randomUUID(), text, done: false, createdAt: Date.now() });
  saveState(state);
  renderList();
}

function toggleItem(itemId) {
  const state = loadState();
  const cat = getActiveCategory(state);
  const item = cat.items.find(i => i.id === itemId);
  if (!item) return;
  item.done = !item.done;
  saveState(state);
  renderList();
}

function deleteItem(itemId) {
  const state = loadState();
  const cat = getActiveCategory(state);
  cat.items = cat.items.filter(i => i.id !== itemId);
  saveState(state);
  renderList();
}

function clearChecked() {
  const state = loadState();
  const cat = getActiveCategory(state);
  cat.items = cat.items.filter(i => !i.done);
  saveState(state);
  renderList();
}

function clearAll() {
  const state = loadState();
  const cat = getActiveCategory(state);
  cat.items = [];
  saveState(state);
  renderList();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  addItem(value);
  input.value = "";
  input.focus();
});

categorySelect.addEventListener("change", (e) => setActiveCategory(e.target.value));
newCategoryBtn.addEventListener("click", createCategory);
editCategoryBtn.addEventListener("click", editCategory);
deleteCategoryBtn.addEventListener("click", deleteCategory);

clearCheckedBtn.addEventListener("click", clearChecked);
clearAllBtn.addEventListener("click", () => {
  if (confirm("Clear the entire list for this category?")) clearAll();
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

renderAll();