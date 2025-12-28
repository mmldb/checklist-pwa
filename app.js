// ===== Storage =====
const STORAGE_KEY = "od3_state_v1";
const PLANNER_KEY = "od3_planner_v2"; // new schema
const PLANNER_ID = "__planner__";

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const addBtn = document.getElementById("addBtn");
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

// ===== Harmonized palette =====
// stored as "bg|contrast"
const CARD_PALETTE = [
  { bg: "#E7E0CF", contrast: "dark" }, // warm paper
  { bg: "#A9C7BD", contrast: "dark" }, // mint teal
  { bg: "#D8C6A6", contrast: "dark" }, // sand
  { bg: "#F2D8A7", contrast: "dark" }, // soft yellow
  { bg: "#F3B27A", contrast: "dark" }, // pastel orange
  { bg: "#E08B7A", contrast: "dark" }, // clay
  { bg: "#B3A6F3", contrast: "dark" }, // lilac
  { bg: "#1F6B4F", contrast: "light" }, // deep green
  { bg: "#2B2F3A", contrast: "light" }  // graphite
];

function pickPaletteColor(seed = null) {
  // deterministic-ish if seed provided
  if (typeof seed === "number") {
    const i = Math.abs(seed) % CARD_PALETTE.length;
    const p = CARD_PALETTE[i];
    return `${p.bg}|${p.contrast}`;
  }
  const p = CARD_PALETTE[Math.floor(Math.random() * CARD_PALETTE.length)];
  return `${p.bg}|${p.contrast}`;
}

function splitColor(colorStr) {
  const parts = (colorStr || "").split("|");
  const bg = parts[0] || "#111317";
  const contrast = parts[1] || "dark";
  return { bg, contrast };
}

function setElColor(el, colorStr) {
  if (!el) return;
  const { bg, contrast } = splitColor(colorStr);
  el.style.background = bg;
  el.style.color = (contrast === "light") ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.88)";
  el.style.borderColor = "rgba(0,0,0,.12)";
}

function applyActiveTheme(active) {
  // Color all primary controls based on active category color
  const themeColor = active?.color || pickPaletteColor(0);
  setElColor(categorySelect, themeColor);
  setElColor(newCategoryBtn, themeColor);
  setElColor(input, themeColor);
  setElColor(addBtn, themeColor);
  setElColor(editCategoryBtn, themeColor);
  setElColor(deleteCategoryBtn, themeColor);
  setElColor(clearCheckedBtn, themeColor);

  // planner controls too
  setElColor(plannerPrev, themeColor);
  setElColor(plannerNext, themeColor);
  setElColor(plannerToday, themeColor);
}

function defaultState() {
  const firstNormalId = uuid();
  return {
    activeCategoryId: firstNormalId,
    categories: [
      { id: PLANNER_ID, name: "Ez a hét", locked: true, shared: false, color: pickPaletteColor(4), items: [] },
      { id: firstNormalId, name: "Bevásárlás", locked: false, shared: false, color: pickPaletteColor(1), items: [] }
    ]
  };
}

function normalizeState(state) {
  if (!state || typeof state !== "object") return null;
  const cats = state.categories;
  if (!Array.isArray(cats) || cats.length === 0) return null;

  let categories = cats.map((c, idx) => ({
    id: c?.id ? c.id : uuid(),
    name: (typeof c?.name === "string" && c.name.trim()) ? c.name.trim() : "Kategória",
    shared: false,
    locked: !!c.locked,
    color: (typeof c?.color === "string" && c.color.includes("|")) ? c.color : pickPaletteColor(idx),
    items: Array.isArray(c.items) ? c.items.map((it) => ({
      id: it?.id ? it.id : uuid(),
      text: typeof it?.text === "string" ? it.text : "",
      done: !!it?.done,
      createdAt: typeof it?.createdAt === "number" ? it.createdAt : Date.now(),
      color: (typeof it?.color === "string" && it.color.includes("|")) ? it.color : null
    })).filter(it => it.text.trim().length > 0) : []
  }));

  // Ensure planner exists + locked + name fixed
  const hasPlanner = categories.some(c => c.id === PLANNER_ID);
  if (!hasPlanner) {
    categories.unshift({ id: PLANNER_ID, name: "Ez a hét", locked: true, shared: false, color: pickPaletteColor(4), items: [] });
  } else {
    categories = categories.map((c) => c.id === PLANNER_ID
      ? { ...c, name: "Ez a hét", locked: true, color: c.color || pickPaletteColor(4) }
      : c
    );
    categories.sort((a,b) => (a.id === PLANNER_ID ? -1 : b.id === PLANNER_ID ? 1 : 0));
  }

  // Active category
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

// ===== Planner store v2 =====
// store[iso] = { note: string, worked: boolean }
function loadPlannerStore() {
  const raw = localStorage.getItem(PLANNER_KEY);
  const parsed = raw ? safeParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : {};
}
function savePlannerStore(store) {
  localStorage.setItem(PLANNER_KEY, JSON.stringify(store));
}
function getPlannerDay(store, iso) {
  const v = store[iso];
  if (v && typeof v === "object") {
    return { note: typeof v.note === "string" ? v.note : "", worked: !!v.worked };
  }
  // Back-compat if previously stored as plain string in an older build:
  if (typeof v === "string") return { note: v, worked: false };
  return { note: "", worked: false };
}
function setPlannerDay(store, iso, next) {
  store[iso] = { note: next.note || "", worked: !!next.worked };
  return store;
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

function autoGrow(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

// ===== Render categories =====
function renderCategories() {
  const state = loadState();
  const active = getActiveCategory(state);

  categorySelect.innerHTML = "";
  state.categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = (c.id === PLANNER_ID) ? "Ez a hét" : c.name;
    if (c.id === active.id) opt.selected = true;
    categorySelect.appendChild(opt);
  });
}

function setViewForActiveCategory() {
  const state = loadState();
  const active = getActiveCategory(state);
  const isPlanner = active.id === PLANNER_ID;

  applyActiveTheme(active);

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

// ===== Checklist =====
function renderList() {
  const state = loadState();
  const cat = getActiveCategory(state);

  list.innerHTML = "";
  cat.items.forEach((item) => {
    const li = document.createElement("li");
    if (item.done) li.classList.add("checked");

    // Ensure item has a palette color
    if (!item.color) item.color = pickPaletteColor(item.createdAt || Date.now());

    const { bg, contrast } = splitColor(item.color);
    li.style.background = bg;
    li.dataset.contrast = contrast;

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
    del.className = "listDelBtn";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteItem(item.id));

    li.appendChild(label);
    li.appendChild(del);
    list.appendChild(li);

    attachSwipeToTop(li, item.id);
  });

  // Persist any newly assigned colors
  saveState(state);
}

function addItem(text) {
  const state = loadState();
  const cat = getActiveCategory(state);

  if (cat.id === PLANNER_ID) {
    alert("Checklist elemhez válassz egy kategóriát (nem a Planner-t).");
    return;
  }

  cat.items.unshift({
    id: uuid(),
    text,
    done: false,
    createdAt: Date.now(),
    color: pickPaletteColor(Date.now())
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

function moveItemToTop(itemId) {
  const state = loadState();
  const cat = getActiveCategory(state);

  const idx = cat.items.findIndex(i => i.id === itemId);
  if (idx <= 0) return;

  const [it] = cat.items.splice(idx, 1);
  cat.items.unshift(it);
  saveState(state);
  renderList();
}

// Swipe left to move-to-top
function attachSwipeToTop(el, itemId) {
  let sx = 0, sy = 0, st = 0;
  el.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY; st = Date.now();
  }, { passive: true });

  el.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    const dt = Date.now() - st;

    // left swipe: dx negative, ignore if mostly vertical
    if (dx < -70 && Math.abs(dy) < 30 && dt < 600) {
      moveItemToTop(itemId);
    }
  }, { passive: true });
}

// ===== Planner =====
function renderPlanner() {
  const state = loadState();
  const active = getActiveCategory(state); // planner category
  applyActiveTheme(active);

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
  const abbrevHU = ["HÉ","KE","SZ","CS","PÉ","SZ","VA"];

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const iso = formatISODate(date);

    // Palette color per day (stable by index + week offset)
    const dayColor = pickPaletteColor(i + (plannerWeekOffset * 7));
    const { bg, contrast } = splitColor(dayColor);

    const card = document.createElement("div");
    card.className = "dayCard";
    card.style.background = bg;
    card.dataset.contrast = contrast;
    if (iso === todayISO) card.classList.add("today");

    // left badge
    const badge = document.createElement("div");
    badge.className = "dayBadge";
    // slightly darker/lighter badge shade (simple: reuse bg but with border)
    badge.style.background = (contrast === "light") ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.12)";
    badge.style.border = "1px solid rgba(0,0,0,.12)";
    badge.style.color = (contrast === "light") ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.88)";

    const ab = document.createElement("div");
    ab.className = "dayAbbrev";
    ab.textContent = abbrevHU[i];

    const bd = document.createElement("div");
    bd.className = "dayBadgeDate";
    bd.textContent = formatNiceDate(date);

    // freelance toggle (circle)
    const workBtn = document.createElement("button");
    workBtn.type = "button";
    workBtn.className = "workToggle";
    workBtn.setAttribute("aria-label", "Freelance nap jelölése");

    const dayData = getPlannerDay(store, iso);
    if (dayData.worked) workBtn.classList.add("on");

    workBtn.addEventListener("click", () => {
      const s = loadPlannerStore();
      const cur = getPlannerDay(s, iso);
      cur.worked = !cur.worked;
      setPlannerDay(s, iso, cur);
      savePlannerStore(s);
      renderPlanner();
    });

    badge.appendChild(workBtn);
    badge.appendChild(ab);
    badge.appendChild(bd);

    // right side
    const right = document.createElement("div");
    right.className = "dayRight";

    const headerRow = document.createElement("div");
    headerRow.className = "dayHeaderRow";

    const name = document.createElement("div");
    name.className = "dayName";
    name.textContent = dayNamesHU[i];

    const dateTxt = document.createElement("div");
    dateTxt.className = "dayDate";
    dateTxt.textContent = formatNiceDate(date);

    // adapt right-side text color
    const fg = (contrast === "light") ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.88)";
    name.style.color = fg;
    dateTxt.style.color = (contrast === "light") ? "rgba(255,255,255,.70)" : "rgba(0,0,0,.60)";

    headerRow.appendChild(name);
    headerRow.appendChild(dateTxt);

    const textarea = document.createElement("textarea");
    textarea.className = "dayNotes";
    textarea.placeholder = "Jegyzet…";
    textarea.rows = 1;
    textarea.value = dayData.note;

    // color the textarea too (same card)
    textarea.style.background = (contrast === "light") ? "rgba(0,0,0,.22)" : "rgba(255,255,255,.35)";
    textarea.style.color = fg;
    textarea.style.borderColor = "rgba(0,0,0,.12)";

    setTimeout(() => autoGrow(textarea), 0);

    textarea.addEventListener("input", () => {
      autoGrow(textarea);
      const s = loadPlannerStore();
      const cur = getPlannerDay(s, iso);
      cur.note = textarea.value;
      setPlannerDay(s, iso, cur);
      savePlannerStore(s);
    });

    right.appendChild(headerRow);
    right.appendChild(textarea);

    card.appendChild(badge);
    card.appendChild(right);

    plannerDays.appendChild(card);
  }
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
    state.categories.push({
      id: uuid(),
      name,
      shared: false,
      locked: false,
      color: pickPaletteColor(Date.now()),
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