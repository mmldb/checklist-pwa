// ===== Storage =====
const STORAGE_KEY = "od2_state_v1";
const PLANNER_KEY = "od2_planner_v1";
const LEGACY_KEYS = [
  "od2_categories_v1",
  "checklist_categories_v1",
  "checklist_topics_v1",
  "checklist_topics_v1"
];

const PLANNER_ID = "__planner__";

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const list = document.getElementById("list");

const clearCheckedBtn = document.getElementById("clearChecked");

const categorySelect = document.getElementById("categorySelect");
const newCategoryBtn = document.getElementById("newCategory");
const editCategoryBtn = document.getElementById("editCategory");
const deleteCategoryBtn = document.getElementById("deleteCategory");
const checklistActions = document.getElementById("checklistActions");

const checklistView = document.getElementById("checklistView");
const plannerView = document.getElementById("plannerView");

const plannerPrev = document.getElementById("plannerPrev");
const plannerNext = document.getElementById("plannerNext");
const plannerToday = document.getElementById("plannerToday");
const plannerTitle = document.getElementById("plannerTitle");
const plannerRange = document.getElementById("plannerRange");
const plannerDays = document.getElementById("plannerDays");

// Modal
const modalOverlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const modalName = document.getElementById("modalName");
const modalShared = document.getElementById("modalShared");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");

let modalMode = "create";
let plannerWeekOffset = 0;

function uuid() {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
}
function safeParse(raw) { try { return JSON.parse(raw); } catch { return null; } }

// Auto-grow textarea
function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

function defaultState() {
  // Start on first normal category so checklist "Add" works immediately
  const firstNormalId = uuid();
  return {
    activeCategoryId: firstNormalId,
    categories: [
      { id: PLANNER_ID, name: "Ez a hét", shared: false, items: [], locked: true },
      { id: firstNormalId, name: "Bevásárlás", shared: false, items: [] }
    ]
  };
}

function migrateLegacy(legacy) { return legacy; }

function normalizeState(state) {
  if (!state || typeof state !== "object") return null;

  const cats = state.categories || state.topics;
  if (!Array.isArray(cats) || cats.length === 0) return null;

  let categories = cats.map((c) => ({
    id: (c && c.id) ? c.id : uuid(),
    name: (c && typeof c.name === "string" && c.name.trim()) ? c.name.trim() : "Kategória",
    shared: false,
    locked: !!c.locked,
    items: Array.isArray(c.items) ? c.items.map((it) => ({
      id: it?.id ? it.id : uuid(),
      text: typeof it?.text === "string" ? it.text : "",
      done: !!it?.done,
      createdAt: typeof it?.createdAt === "number" ? it.createdAt : Date.now()
    })).filter(it => it.text.trim().length > 0) : []
  }));

  // Ensure Planner exists + locked + name fixed
  const hasPlanner = categories.some(c => c.id === PLANNER_ID);
  if (!hasPlanner) {
    categories.unshift({ id: PLANNER_ID, name: "Ez a hét", shared: false, items: [], locked: true });
  } else {
    categories = categories.map(c => c.id === PLANNER_ID ? { ...c, name: "Ez a hét", locked: true } : c);
    categories.sort((a,b) => (a.id === PLANNER_ID ? -1 : b.id === PLANNER_ID ? 1 : 0));
  }

  // Choose active category safely:
  // - if saved active is valid, use it
  // - else prefer first NON-planner category (so checklist works)
  const activeId = state.activeCategoryId;
  const hasActive = activeId && categories.some(c => c.id === activeId);
  let activeCategoryId = hasActive ? activeId : null;

  if (!activeCategoryId) {
    const firstNormal = categories.find(c => c.id !== PLANNER_ID);
    activeCategoryId = firstNormal ? firstNormal.id : PLANNER_ID;
  }

  return { activeCategoryId, categories };
}

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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn("localStorage save failed", e); }
}

function getActiveCategory(state) {
  const cat = state.categories.find(c => c.id === state.activeCategoryId) || state.categories[0];
  state.activeCategoryId = cat.id;
  return cat;
}

// ===== Planner storage =====
function loadPlannerStore() {
  const raw = localStorage.getItem(PLANNER_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : {};
}
function savePlannerStore(store) {
  localStorage.setItem(PLANNER_KEY, JSON.stringify(store));
}

function formatISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function formatNiceDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}.${mm}.${dd}`;
}

// Monday-based week start
function getMonday(d) {
  const date = new Date(d);
  date.setHours(0,0,0,0);
  const day = date.getDay(); // 0 Sun, 1 Mon...
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function renderPlanner() {
  const today = new Date();
  const todayISO = formatISODate(today);

  const baseMonday = getMonday(today);
  const monday = addDays(baseMonday, plannerWeekOffset * 7);
  const sunday = addDays(monday, 6);

  plannerTitle.textContent = (plannerWeekOffset === 0) ? "Ez a hét" : "Hét";
  plannerRange.textContent = `${formatNiceDate(monday)} -- ${formatNiceDate(sunday)}`;

  const store = loadPlannerStore();
  plannerDays.innerHTML = "";

  const dayNamesHU = ["Hétfő","Kedd","Szerda","Csütörtök","Péntek","Szombat","Vasárnap"];

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const iso = formatISODate(date);

    const card = document.createElement("div");
    card.className = "dayCard";
    if (iso === todayISO) card.classList.add("today");

    const header = document.createElement("div");
    header.className = "dayHeader";

    const left = document.createElement("div");
    left.className = "dayName";
    left.textContent = dayNamesHU[i];

    const right = document.createElement("div");
    right.className = "dayDate";
    right.textContent = formatNiceDate(date);

    header.appendChild(left);
    header.appendChild(right);

    const textarea = document.createElement("textarea");
    textarea.className = "dayNotes";
    textarea.placeholder = "Jegyzet…";
    textarea.rows = 1;
    textarea.value = store[iso] || "";

    // auto-grow initial
    setTimeout(() => autoGrow(textarea), 0);

    textarea.addEventListener("input", () => {
      autoGrow(textarea);
      const s = loadPlannerStore();
      s[iso] = textarea.value;
      savePlannerStore(s);
    });

    card.appendChild(header);
    card.appendChild(textarea);
    plannerDays.appendChild(card);
  }
}

// ===== Render checklist =====
function renderCategories() {
  const state = loadState();
  const active = getActiveCategory(state);

  categorySelect.innerHTML = "";
  state.categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = (c.id === PLANNER_ID) ? "🗓 Ez a hét" : c.name;
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
    del.className = "chipBtn";
    del.textContent = "❌ Töröl";
    del.addEventListener("click", () => deleteItem(item.id));

    li.appendChild(label);
    li.appendChild(del);
    list.appendChild(li);
  });
}

function setViewForActiveCategory() {
  const state = loadState();
  const active = getActiveCategory(state);
  const isPlanner = active.id === PLANNER_ID;

  checklistView.classList.toggle("hidden", isPlanner);
  plannerView.classList.toggle("hidden", !isPlanner);
  checklistActions.classList.toggle("hidden", isPlanner);

  // Enable/disable category actions appropriately
  editCategoryBtn.disabled = isPlanner;
  deleteCategoryBtn.disabled = isPlanner;

  if (isPlanner) renderPlanner();
  else renderList();
}

function renderAll() {
  renderCategories();
  setViewForActiveCategory();
}

// ===== Modal (categories) =====
function openModal(mode) {
  modalMode = mode;
  const state = loadState();
  const active = getActiveCategory(state);

  if (mode === "create") {
    modalTitle.textContent = "Új kategória";
    modalName.value = "";
  } else {
    if (active.locked) return;
    modalTitle.textContent = "Kategória szerkesztése";
    modalName.value = active.name;
  }

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
    state.categories.push({
      id: uuid(),
      name,
      shared: false,
      items: []
    });
    state.activeCategoryId = state.categories[state.categories.length - 1].id;
  } else {
    if (active.locked) return;
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

  // switching to planner feels best at current week
  plannerWeekOffset = 0;

  renderAll();
}

function deleteCategory() {
  const state = loadState();
  const active = getActiveCategory(state);
  if (active.locked) return;

  const nonLockedCount = state.categories.filter(c => !c.locked).length;
  if (nonLockedCount <= 1) {
    alert("Az utolsó kategóriát nem lehet törölni.");
    return;
  }

  const ok = confirm(`Törlöd a "${active.name}" kategóriát és minden elemét?`);
  if (!ok) return;

  state.categories = state.categories.filter(c => c.id !== active.id);

  // go to first normal category (not planner) so checklist stays usable
  const firstNormal = state.categories.find(c => c.id !== PLANNER_ID) || state.categories[0];
  state.activeCategoryId = firstNormal.id;

  saveState(state);
  renderAll();
}

// ===== Items =====
function addItem(text) {
  const state = loadState();
  const cat = getActiveCategory(state);

  if (cat.id === PLANNER_ID) {
    alert("Checklist elemhez válassz egy kategóriát (nem a Planner-t).");
    return;
  }

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

// Planner nav
plannerPrev.addEventListener("click", () => { plannerWeekOffset -= 1; renderPlanner(); });
plannerNext.addEventListener("click", () => { plannerWeekOffset += 1; renderPlanner(); });
plannerToday.addEventListener("click", () => { plannerWeekOffset = 0; renderPlanner(); });

// Offline (service worker)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch (e) { console.warn("SW registration failed", e); }
  });
}

renderAll();