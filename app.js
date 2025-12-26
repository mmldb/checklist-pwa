const STORAGE_KEY = "checklist_topics_v1";

const form = document.getElementById("itemForm");
const input = document.getElementById("itemInput");
const list = document.getElementById("list");
const clearCheckedBtn = document.getElementById("clearChecked");
const clearAllBtn = document.getElementById("clearAll");

const topicSelect = document.getElementById("topicSelect");
const newTopicBtn = document.getElementById("newTopic");

function defaultState() {
  return {
    activeTopicId: null,
    topics: [
      { id: crypto.randomUUID(), name: "Groceries", items: [] }
    ]
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const state = JSON.parse(raw);
    if (!state.topics || !state.topics.length) return defaultState();
    return state;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveTopic(state) {
  const id = state.activeTopicId || state.topics[0].id;
  const topic = state.topics.find(t => t.id === id) || state.topics[0];
  state.activeTopicId = topic.id;
  return topic;
}

function renderTopics() {
  const state = loadState();
  const active = getActiveTopic(state);
  saveState(state);

  topicSelect.innerHTML = "";
  state.topics.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    if (t.id === active.id) opt.selected = true;
    topicSelect.appendChild(opt);
  });
}

function renderList() {
  const state = loadState();
  const topic = getActiveTopic(state);

  list.innerHTML = "";
  topic.items.forEach((item) => {
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
  renderTopics();
  renderList();
}

function setActiveTopic(id) {
  const state = loadState();
  state.activeTopicId = id;
  saveState(state);
  renderList();
}

function createTopic() {
  const name = prompt("Topic name (e.g. Aldi, Kindergarten):");
  if (!name) return;

  const state = loadState();
  state.topics.unshift({ id: crypto.randomUUID(), name: name.trim(), items: [] });
  state.activeTopicId = state.topics[0].id;
  saveState(state);
  renderAll();
}

function addItem(text) {
  const state = loadState();
  const topic = getActiveTopic(state);

  topic.items.unshift({ id: crypto.randomUUID(), text, done: false, createdAt: Date.now() });
  saveState(state);
  renderList();
}

function toggleItem(itemId) {
  const state = loadState();
  const topic = getActiveTopic(state);
  const item = topic.items.find(i => i.id === itemId);
  if (!item) return;
  item.done = !item.done;
  saveState(state);
  renderList();
}

function deleteItem(itemId) {
  const state = loadState();
  const topic = getActiveTopic(state);
  topic.items = topic.items.filter(i => i.id !== itemId);
  saveState(state);
  renderList();
}

function clearChecked() {
  const state = loadState();
  const topic = getActiveTopic(state);
  topic.items = topic.items.filter(i => !i.done);
  saveState(state);
  renderList();
}

function clearAll() {
  const state = loadState();
  const topic = getActiveTopic(state);
  topic.items = [];
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

topicSelect.addEventListener("change", (e) => setActiveTopic(e.target.value));
newTopicBtn.addEventListener("click", createTopic);

clearCheckedBtn.addEventListener("click", clearChecked);
clearAllBtn.addEventListener("click", () => {
  if (confirm("Clear the entire list for this topic?")) clearAll();
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