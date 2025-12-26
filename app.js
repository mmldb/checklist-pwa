const STORAGE_KEY = "od2_categories_v1";

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const list = document.getElementById("list");

const clearCheckedBtn = document.getElementById("clearChecked");
const clearAllBtn = document.getElementById("clearAll");

const categorySelect = document.getElementById("categorySelect");
const newCategoryBtn = document.getElementById("newCategory");
const editCategoryBtn = document.getElementById("editCategory");
const deleteCategoryBtn = document.getElementById("deleteCategory");

// Modal elements
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalName = document.getElementById("modalName");
const modalShared = document.getElementById("modalShared");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");

let modalMode = "create"; // "create" | "edit"

function defaultState() {
  return {
    activeCategoryId: null,
    categories: [
      { id: crypto.randomUUID(), name: "Bevásárlás", shared: false, items: [] }
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
    opt.textContent = c.shared ? `🔗 ${c.name}` : c.name;
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
    label.className = "itemLabel";

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

// ----- Modal helpers -----
function openModal(mode) {
  modalMode = mode;
  const state = loadState();
  const active = getActiveCategory(state);

  if (mode === "create") {
    modalTitle.textContent = "New Category";
    modalName.value = "";
    modalShared.checked = false; // default local
  } else {
    modalTitle.textContent = "Edit Category";
    modalName.value = active.name;
    modalShared.checked = !!active.shared;
  }

  modalOverlay.classList.remove("hidden");
  modalOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => modalName.focus(), 50);
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  modalOverlay.setAttribute("aria-hidden", "true");
}

function saveModal() {
  const name = (modalName.value || "").trim();
  if (!name) return;

  const shared = !!modalShared.checked;
  const state = loadState();
  const active = getActiveCategory(state);

  if (modalMode === "create") {
    state.categories.unshift({
      id: crypto.randomUUID(),
      name,
      shared,
      items: []
    });
    state.activeCategoryId = state.categories[0].id;
  } else {
    active.name = name;
    active.shared = shared;
  }

  saveState(state);
  closeModal();
  renderAll();
}

// Clicking outside modal closes it
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
modalClose.addEventListener("click", closeModal);
modalCancel.addEventListener("click", closeModal);
modalSave.addEventListener("click", saveModal);

// Enter key submits modal
modalName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveModal();
  if (e.key === "Escape") closeModal();
});

// ----- CRUD category -----
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

// ----- Items -----
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

// Events
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  addItem(value);
  input.value = "";
  input.focus();
});

categorySelect.addEventListener("change", (e) => setActiveCategory(e.target.value));
newCategoryBtn.addEventListener("click", () => openModal("create"));
editCategoryBtn.addEventListener("click", () => openModal("edit"));
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