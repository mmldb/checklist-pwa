/* OD Jegyzetek 3.0 - Local-first
   Fixes:
   - Checklist always renders correctly on refresh & category switch
   - Planner shows current week immediately on selecting _Tervező
   - Planner day labels like HÉ.22 (leading zero)
   - Freelance indicator ON = black
   - Keep random checklist colors (palette-only) stored per item
   - Swipe-left moves checklist item to top
*/

const STORAGE_KEY = "od_jegyzetek_v3_2";

const PALETTE = [
  "#C8C8C8",
  "#86986C",
  "#ACC4F9",
  "#FF5900",
  "#B06944",
  "#FAB42A",
  "#0C76FF",
  "#FFB0D6",
  "#E7E7E7",
];

// Fixed weekday colors/order
const WEEKDAY = [
  { short: "HÉ",  color: "#FF5900" },
  { short: "KE",  color: "#FAB42A" },
  { short: "SZ",  color: "#86986C" },
  { short: "CS",  color: "#ACC4F9" },
  { short: "PÉ",  color: "#0C76FF" },
  { short: "SZ",  color: "#FFB0D6" },
  { short: "VA",  color: "#C8C8C8" },
];

const $ = (id) => document.getElementById(id);

const els = {
  categorySelect: $("categorySelect"),
  newCategory: $("newCategory"),
  editCategory: $("editCategory"),
  deleteCategory: $("deleteCategory"),
  clearChecked: $("clearChecked"),
  checklistActions: $("checklistActions"),

  checklistView: $("checklistView"),
  plannerView: $("plannerView"),

  itemForm: $("itemForm"),
  itemInput: $("itemInput"),
  addBtn: $("addBtn"),
  list: $("list"),

  plannerPrev: $("plannerPrev"),
  plannerNext: $("plannerNext"),
  plannerToday: $("plannerToday"),
  plannerRange: $("plannerRange"),
  plannerLabel: $("plannerLabel"),
  plannerDays: $("plannerDays"),

  modalOverlay: $("modalOverlay"),
  modalTitle: $("modalTitle"),
  modalName: $("modalName"),
  modalClose: $("modalClose"),
  modalCancel: $("modalCancel"),
  modalSave: $("modalSave"),
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function clampText(v) {
  if (v == null) return "";
  const s = String(v);
  if (s === "undefined") return "";
  return s;
}

function pickRandomPaletteColor() {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function dd2(n) {
  return String(n).padStart(2, "0");
}

function formatMMDD(d) {
  const m = dd2(d.getMonth() + 1);
  const day = dd2(d.getDate());
  return `${m}.${day}`;
}

function startOfWeekMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const mondayOffset = (jsDay + 6) % 7; // Mon=0
  d.setDate(d.getDate() - mondayOffset);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x.toISOString().slice(0,10);
}

/* ---------- State ---------- */

function defaultState() {
  const plannerCategoryId = "planner_locked";
  return {
    version: 3,
    selectedCategoryId: plannerCategoryId,
    categories: [
      { id: plannerCategoryId, name: "_Tervező", locked: true, items: [] },
      { id: uid(), name: "DM", locked: false, items: [] },
    ],
    planner: {
      weekOffset: 0,
      weeks: {}
    },
  };
}

let state = loadState();
migrateIfNeeded();
saveState();

/* ---------- Storage ---------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function migrateIfNeeded() {
  if (!state.planner) state.planner = { weekOffset: 0, weeks: {} };
  if (typeof state.planner.weekOffset !== "number") state.planner.weekOffset = 0;
  if (!state.planner.weeks || typeof state.planner.weeks !== "object") state.planner.weeks = {};

  const plannerId = "planner_locked";
  if (!Array.isArray(state.categories)) state.categories = [];

  let plannerCat = state.categories.find(c => c.id === plannerId);
  if (!plannerCat) {
    state.categories.unshift({ id: plannerId, name: "_Tervező", locked: true, items: [] });
  } else {
    plannerCat.locked = true;
    plannerCat.name = "_Tervező";
    if (!Array.isArray(plannerCat.items)) plannerCat.items = [];
  }

  for (const cat of state.categories) {
    if (!Array.isArray(cat.items)) cat.items = [];
    for (const it of cat.items) {
      if (!it.id) it.id = uid();
      if (typeof it.done !== "boolean") it.done = !!it.done;
      it.text = clampText(it.text);
      if (!it.color) it.color = pickRandomPaletteColor();
    }
  }

  if (!state.categories.some(c => c.id === state.selectedCategoryId)) {
    state.selectedCategoryId = plannerId;
  }
}

/* ---------- Helpers ---------- */

function currentCategory() {
  return state.categories.find(c => c.id === state.selectedCategoryId);
}

function isPlannerSelected() {
  const cat = currentCategory();
  return !!cat?.locked;
}

/* ---------- Category Select ---------- */

function renderCategorySelect() {
  els.categorySelect.innerHTML = "";
  for (const cat of state.categories) {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.locked ? "_Tervező" : cat.name;
    els.categorySelect.appendChild(opt);
  }

  // Keep select and state in sync
  if (!state.categories.some(c => c.id === state.selectedCategoryId)) {
    state.selectedCategoryId = "planner_locked";
  }
  els.categorySelect.value = state.selectedCategoryId;
}

/* ---------- Checklist ---------- */

function renderChecklist() {
  const cat = currentCategory();
  if (!cat || cat.locked) return;

  els.list.innerHTML = "";

  // Assign stable colors to old items
  for (const it of cat.items) {
    if (!it.color) it.color = pickRandomPaletteColor();
  }

  cat.items.forEach((it) => {
    const li = document.createElement("li");
    li.dataset.id = it.id;
    li.style.background = it.color;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "itemCheck";
    checkbox.checked = !!it.done;

    const text = document.createElement("div");
    text.className = "itemText" + (it.done ? " done" : "");
    text.textContent = it.text || "";

    const del = document.createElement("button");
    del.className = "itemDelete";
    del.type = "button";
    del.textContent = "Delete";

    checkbox.addEventListener("change", () => {
      it.done = checkbox.checked;
      saveState();
      renderChecklist();
    });

    del.addEventListener("click", () => {
      cat.items = cat.items.filter(x => x.id !== it.id);
      saveState();
      renderChecklist();
    });

    attachSwipeToTop(li, () => moveItemToTop(cat.id, it.id));

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(del);
    els.list.appendChild(li);
  });

  saveState();
}

function moveItemToTop(categoryId, itemId) {
  const cat = state.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const idx = cat.items.findIndex(x => x.id === itemId);
  if (idx <= 0) return;

  const [it] = cat.items.splice(idx, 1);
  cat.items.unshift(it);

  saveState();
  renderChecklist();

  requestAnimationFrame(() => {
    const li = els.list.querySelector(`li[data-id="${itemId}"]`);
    if (!li) return;
    li.classList.add("movedFlash");
    setTimeout(() => li.classList.remove("movedFlash"), 280);
  });
}

/* Swipe left to top */
function attachSwipeToTop(el, onSwipeLeft) {
  let startX = 0, startY = 0, dx = 0, dy = 0, tracking = false;
  const THRESHOLD = 60;
  const MAX_VERTICAL = 22;

  el.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    dx = 0; dy = 0;
    tracking = true;
    el.classList.add("swiping");
  }, { passive: true });

  el.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    dx = t.clientX - startX;
    dy = t.clientY - startY;

    if (dx < 0 && Math.abs(dy) < MAX_VERTICAL) {
      el.style.transform = `translateX(${Math.max(dx, -90)}px)`;
    } else {
      el.style.transform = "";
    }
  }, { passive: true });

  el.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;
    el.classList.remove("swiping");

    const isLeft = dx < -THRESHOLD && Math.abs(dy) < MAX_VERTICAL;
    el.style.transform = "";
    if (isLeft) onSwipeLeft();
  }, { passive: true });

  el.addEventListener("touchcancel", () => {
    tracking = false;
    el.classList.remove("swiping");
    el.style.transform = "";
  }, { passive: true });
}

/* ---------- Planner ---------- */

function weekStartForOffset(offset) {
  const base = startOfWeekMonday(new Date());
  return addDays(base, offset * 7);
}

function getWeekKey(offset) {
  return isoDate(weekStartForOffset(offset));
}

function ensureWeek(offset) {
  const key = getWeekKey(offset);
  if (!state.planner.weeks[key]) {
    state.planner.weeks[key] = {
      days: Array.from({ length: 7 }, () => ({ note: "", worked: false }))
    };
  } else {
    const w = state.planner.weeks[key];
    if (!Array.isArray(w.days) || w.days.length !== 7) {
      w.days = Array.from({ length: 7 }, () => ({ note: "", worked: false }));
    }
    for (let i = 0; i < 7; i++) {
      if (!w.days[i]) w.days[i] = { note: "", worked: false };
      w.days[i].note = clampText(w.days[i].note);
      if (typeof w.days[i].worked !== "boolean") w.days[i].worked = !!w.days[i].worked;
    }
  }
  return state.planner.weeks[key];
}

function renderPlanner() {
  const offset = state.planner.weekOffset || 0;
  const weekStart = weekStartForOffset(offset);
  const weekEnd = addDays(weekStart, 6);

  els.plannerRange.textContent = `${formatMMDD(weekStart)} - ${formatMMDD(weekEnd)}`;

  if (offset === 0) els.plannerLabel.textContent = "Ez a hét";
  else if (offset === 1) els.plannerLabel.textContent = "Jövő hét";
  else if (offset === -1) els.plannerLabel.textContent = "Múlt hét";
  else els.plannerLabel.textContent = offset > 0 ? `${offset} héttel előre` : `${Math.abs(offset)} héttel vissza`;

  const week = ensureWeek(offset);
  els.plannerDays.innerHTML = "";

  const todayKey = isoDate(new Date());

  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const dayNum = dd2(d.getDate());
    const dKey = isoDate(d);

    const card = document.createElement("div");
    card.className = "dayCard";
    card.style.background = WEEKDAY[i].color;

    if (offset === 0 && dKey === todayKey) {
      card.classList.add("today");
    }

    const left = document.createElement("div");
    left.className = "dayLeft";
    left.textContent = `${WEEKDAY[i].short}.${dayNum}`;

    const mid = document.createElement("div");
    mid.className = "dayMid";

    const input = document.createElement("textarea");
    input.className = "dayInput";
    input.rows = 1;
    input.placeholder = "Tervek…";
    input.value = clampText(week.days[i].note);

    const autoSize = () => {
      input.style.height = "0px";
      input.style.height = Math.min(input.scrollHeight, 220) + "px";
    };
    requestAnimationFrame(autoSize);

    input.addEventListener("input", () => {
      week.days[i].note = clampText(input.value);
      saveState();
      autoSize();
    });

    mid.appendChild(input);

    const right = document.createElement("div");
    right.className = "dayRight";

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "workDot" + (week.days[i].worked ? " on" : "");
    dot.title = "Dolgoztam";

    dot.addEventListener("click", () => {
      week.days[i].worked = !week.days[i].worked;
      saveState();
      renderPlanner();
    });

    right.appendChild(dot);

    card.appendChild(left);
    card.appendChild(mid);
    card.appendChild(right);

    els.plannerDays.appendChild(card);
  }

  saveState();
}

/* ---------- Modal ---------- */

let modalMode = "new";
let editCategoryId = null;

function openModal(mode, categoryId = null) {
  modalMode = mode;
  editCategoryId = categoryId;

  els.modalName.value = "";
  els.modalTitle.textContent = mode === "new" ? "Új kategória" : "Kategória szerkesztése";

  if (mode === "edit") {
    const cat = state.categories.find(c => c.id === categoryId);
    if (cat) els.modalName.value = cat.name || "";
  }

  els.modalOverlay.classList.remove("hidden");
  els.modalOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => els.modalName.focus(), 50);
}

function closeModal() {
  els.modalOverlay.classList.add("hidden");
  els.modalOverlay.setAttribute("aria-hidden", "true");
}

/* ---------- View / Refresh ---------- */

function setView() {
  const planner = isPlannerSelected();
  els.plannerView.classList.toggle("hidden", !planner);
  els.checklistView.classList.toggle("hidden", planner);
  els.checklistActions.style.display = planner ? "none" : "grid";

  // When entering planner, auto-jump to current week
  if (planner) {
    state.planner.weekOffset = 0;
    saveState();
  }
}

function refreshUI() {
  migrateIfNeeded();
  renderCategorySelect();

  // Ensure state matches select (prevents stale render edge cases)
  state.selectedCategoryId = els.categorySelect.value;
  saveState();

  setView();

  if (isPlannerSelected()) renderPlanner();
  else renderChecklist();

  const cat = currentCategory();
  const locked = !!cat?.locked;
  els.editCategory.disabled = locked;
  els.deleteCategory.disabled = locked;
}

/* ---------- Events ---------- */

els.categorySelect.addEventListener("change", () => {
  state.selectedCategoryId = els.categorySelect.value;
  saveState();
  refreshUI();
});

els.newCategory.addEventListener("click", () => openModal("new"));

els.editCategory.addEventListener("click", () => {
  const cat = currentCategory();
  if (!cat || cat.locked) return;
  openModal("edit", cat.id);
});

els.deleteCategory.addEventListener("click", () => {
  const cat = currentCategory();
  if (!cat || cat.locked) return;

  state.categories = state.categories.filter(c => c.id !== cat.id);
  state.selectedCategoryId = "planner_locked";
  saveState();
  refreshUI();
});

els.clearChecked.addEventListener("click", () => {
  const cat = currentCategory();
  if (!cat || cat.locked) return;
  cat.items = cat.items.filter(it => !it.done);
  saveState();
  renderChecklist();
});

els.itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const cat = currentCategory();
  if (!cat || cat.locked) return;

  const text = clampText(els.itemInput.value).trim();
  if (!text) return;

  cat.items.unshift({
    id: uid(),
    text,
    done: false,
    color: pickRandomPaletteColor(),
  });

  els.itemInput.value = "";
  saveState();
  renderChecklist();
});

els.modalClose.addEventListener("click", closeModal);
els.modalCancel.addEventListener("click", closeModal);
els.modalOverlay.addEventListener("click", (e) => {
  if (e.target === els.modalOverlay) closeModal();
});

els.modalSave.addEventListener("click", () => {
  const name = clampText(els.modalName.value).trim();
  if (!name) return;

  if (modalMode === "new") {
    state.categories.push({ id: uid(), name, locked: false, items: [] });
    state.selectedCategoryId = state.categories[state.categories.length - 1].id;
  } else if (modalMode === "edit" && editCategoryId) {
    const cat = state.categories.find(c => c.id === editCategoryId);
    if (cat && !cat.locked) cat.name = name;
  }

  saveState();
  closeModal();
  refreshUI();
});

/* Planner nav */
els.plannerPrev.addEventListener("click", () => {
  state.planner.weekOffset = (state.planner.weekOffset || 0) - 1;
  saveState();
  renderPlanner();
});
els.plannerNext.addEventListener("click", () => {
  state.planner.weekOffset = (state.planner.weekOffset || 0) + 1;
  saveState();
  renderPlanner();
});
els.plannerToday.addEventListener("click", () => {
  state.planner.weekOffset = 0;
  saveState();
  renderPlanner();
});

/* Service worker */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* Initial */
refreshUI();