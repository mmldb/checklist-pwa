// ===== Storage =====
const STORAGE_KEY = "od2_state_v1";
const PLANNER_KEY = "od2_planner_v1";
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

/**
 * Color palette inspired by refs (bold blocks),
 * but works on black background.
 * We store as "bg|contrast" where contrast is "light" or "dark"
 * (meaning text should be light or dark).
 */
const CARD_PALETTE = [
  { bg: "#E7E0CF", contrast: "dark" }, // warm paper
  { bg: "#A9C7BD", contrast: "dark" }, // minty teal
  { bg: "#D8C6A6", contrast: "dark" }, // sand
  { bg: "#F2D8A7", contrast: "dark" }, // soft yellow
  { bg: "#F3B27A", contrast: "dark" }, // pastel orange
  { bg: "#E08B7A", contrast: "dark" }, // clay
  { bg: "#B3A6F3", contrast: "dark" }, // lilac
  { bg: "#1F6B4F", contrast: "light" }, // deep green
  { bg: "#2B2F3A", contrast: "light" }  // graphite
];

function pickCardColor() {
  const p = CARD_PALETTE[Math.floor(Math.random() * CARD_PALETTE.length)];
  return `${p.bg}|${p.contrast}`;
}

function defaultState() {
  const firstNormalId = uuid();
  return {
    activeCategoryId: firstNormalId,
    categories: [
      { id: PLANNER_ID, name: "Ez a hét", shared: false, items: [], locked: true },
      { id: firstNormalId, name: "Bevásárlás", shared: false, items: [] }
    ]
  };
}

function normalizeState(state) {
  if (!state || typeof state !== "object") return null;
  const cats = state.categories;
  if (!Array.isArray(cats) || cats.length === 0) return null;

  let categories = cats.map((c) => ({
    id: c?.id ? c.id : uuid(),
    name: (typeof c?.name === "string" && c.name.trim()) ? c.name.trim() : "Kategória",
    shared: false,
    locked: !!c.locked,
    items: Array.isArray(c.items) ? c.items.map((it) => ({
      id: it?.id ? it.id : uuid(),
      text: typeof it?.text === "string" ? it.text : "",
      done: !!it?.done,
      createdAt: typeof it?.createdAt === "number" ? it.createdAt : Date.now(),
      color: typeof it?.color === "string" ? it.color : null
    })).filter(it => it.text.trim().length > 0) : []
  }));

  const hasPlanner = categories.some(c => c.id === PLANNER_ID);
  if (!hasPlanner) {
    categories.unshift({ id: PLANNER_ID, name: "Ez a hét", shared: false, items: [], locked: true });
  } else {
    categories = categories.map(c => c.id === PLANNER_ID ? { ...c, name: "Ez a hét", locked: true } : c);
    categories.sort((a,b) => (a.id === PLANNER_ID ? -1 : b.id === PLANNER_ID ? 1 : 0));
  }

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
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = safeParse(raw);
    const normalized = normalizeState(parsed);
    if (normalized) return normalized;
  }
  const s = defaultState();
  saveState(s);
  return s;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveCategory(state) {
  const cat = state.categories.find(c => c.id === state.activeCategoryId) || state.categories[0];
  state.activeCategoryId = cat.id;
  return cat;
}

// ===== Planner store =====
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
function getMonday(d) {
  const date = new Date(d);
  date.setHours(0,0,0,0);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  date.setDate(date.getDate() + diff);
  return date;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function plannerLabelFromOffset(off) {
  if (off === 0) return "Ez a hét";
  if (off === 1) return "Jövő hét";
  if (off === -1) return "Múlt hét";
  if (off > 1) return `${off}. hét előre`;
  return `${Math.abs(off)}. hét vissza`;
}

function renderPlanner() {
  const today = new Date();
  const todayISO = formatISODate(today);

  const baseMonday = getMonday(today);
  const monday = addDays(baseMonday, plannerWeekOffset * 7);
  const sunday = addDays(monday, 6);

  plannerTitle.textContent = plannerLabelFromOffset(plannerWeekOffset);
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

// ===== Checklist render =====
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

    if (item.color) {
      const [bg, contrast] = item.color.split("|");
      li.style.background = bg;
      li.dataset.contrast = contrast || "dark";
    }

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
    del.className = "chipBtn listDelBtn";
    del.textContent = "Delete"; // no emoji
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

  editCategoryBtn.disabled = isPlanner;
  deleteCategoryBtn.disabled = isPlanner;

  if (isPlanner) renderPlanner();
  else renderList();
}

function renderAll() {
  renderCategories();
  setViewForActiveCategory();
}

// ===== Modal =====
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
    state.categories.push({ id: uuid(), name, shared: false, items: [] });
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

  const ok = confirm(`Törlöd a kategóriát? (${active.name})`);
  if (!ok) return;

  state.categories = state.categories.filter(c => c.id !== active.id);
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

  // assign a bold palette color (inspired by refs)
  cat.items.unshift({
    id: uuid(),
    text,
    done: false,
    createdAt: Date.now(),
    color: pickCardColor()
  });

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

// Offline
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch (e) { console.warn("SW registration failed", e); }
  });
}

renderAll();