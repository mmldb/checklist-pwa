// ===== Storage keys (we'll migrate automatically) =====
const STORAGE_KEY = "od2_state_v1";
const LEGACY_KEYS = [
  "od2_categories_v1",
  "checklist_categories_v1",
  "checklist_topics_v1",
  "checklist_topics_v1"
];

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const list = document.getElementById("list");

const clearCheckedBtn = document.getElementById("clearChecked");

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

function uuid() {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}

function defaultState() {
  return {
    activeCategoryId: null,
    categories: [
      { id: uuid(), name: "Bevásárlás", shared: false, items: [] }
    ]
  };
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

// ---- Migration layer: loads from newest key, else legacy keys, else defaults ----
function loadState() {
  const rawNew = localStorage.getItem(STORAGE_KEY);
  if (rawNew) {
    const parsed = safeParse(rawNew);
    const normalized = normalizeState(parsed);
    if (normalized) return normalized;
  }

  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const parsed = safeParse(raw);
    const migrated = migrateLegacy(parsed);
    const normalized = normalizeState(migrated);
    if (normalized) {
      saveState(normalized);
      return normalized;
    }
  }

  const s = defaultState();
  saveState(s);
  return s;
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("localStorage save failed", e);
  }
}

function normalizeState(state) {
  if (!state || typeof state !== "object") return null;

  const cats = state.categories || state.topics;
  if (!Array.isArray(cats) || cats.length === 0) return null;

  const categories = cats.map((c) => ({
    id: (c && c.id) ? c.id : uuid(),
    name: (c && typeof c.name === "string" && c.name.trim()) ? c.name.trim() : "Category",
    shared: false, // local-only now
    items: Array.isArray(c.items) ? c.items.map((it) => ({
      id: it?.id ? it.id : uuid(),
      text: typeof it?.text === "string" ? it.text : "",
      done: !!it?.done,
      createdAt: typeof it?.createdAt === "number" ? it.createdAt : Date.now()
    })).filter(it => it.text.trim().length > 0) : []
  }));

  const activeCategoryId =
    (state.activeCategoryId && categories.some(c => c.id === state.activeCategoryId))
      ? state.activeCategoryId
      : categories[0].id;

  return { activeCategoryId, categories };
}

function migrateLegacy(legacy) {
  return legacy;
}

function getActiveCategory(state) {
  const cat = state.categories.find(c => c.id === state.activeCategoryId) || state.categories[0];
  state.activeCategoryId = cat.id;
  return cat;
}

// ===== Render =====
function renderCategories() {
  const state = loadState();
  const active = getActiveCategory(state);

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

// ===== Modal =====
function openModal(mode) {
  modalMode = mode;
  const state = loadState();
  const active = getActiveCategory(state);

  if (mode === "create") {
    modalTitle.textContent = "New Category";
    modalName.value = "";
  } else {
    modalTitle.textContent = "Edit Category";
    modalName.value = active.name;
  }

  // local-only: disable shared toggle always
  modalShared.checked = false;
  modalShared.disabled = true;

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

  const state = loadState();
  const active = getActiveCategory(state);

  if (modalMode === "create") {
    state.categories.unshift({
      id: uuid(),
      name,
      shared: false,
      items: []
    });
    state.activeCategoryId = state.categories[0].id;
  } else {
    active.name = name;
  }

  saveState(state);
  closeModal();
  renderAll();
}

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
modalClose.addEventListener("click", closeModal);
modalCancel.addEventListener("click", closeModal);
modalSave.addEventListener("click", saveModal);

modalName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveModal();
  if (e.key === "Escape") closeModal();
});

// ===== Category actions =====
function setActiveCategory(id) {
  const state = loadState();
  state.activeCategoryId = id;
  saveState(state);
  renderList();
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

// ===== Items =====
function addItem(text) {
  const state = loadState();
  const cat = getActiveCategory(state);

  cat.items.unshift({ id: uuid(), text, done: false, createdAt: Date.now() });
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

// ===== Events =====
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