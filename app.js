// --- STATE MANAGEMENT ---
const state = {
    view: 'checklist', // or 'planner'
    weekOffset: 0,     // 0 = current week
    checklist: JSON.parse(localStorage.getItem('od_checklist') || '[]'),
    planner: JSON.parse(localStorage.getItem('od_planner') || '{}')
};

// Colors for the UI
const PALETTE = [
    'var(--c-red)', 'var(--c-orange)', 'var(--c-yellow)', 
    'var(--c-green)', 'var(--c-blue)', 'var(--c-purple)', 'var(--c-pink)'
];

const WEEK_DAYS_HU = ['HÉ', 'KE', 'SZE', 'CS', 'PÉ', 'SZO', 'VA'];

// --- DATE HELPERS (No libraries) ---
function getMonday(d) {
    d = new Date(d);
    let day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
}

function addDays(date, days) {
    let result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDateKey(date) {
    return date.toISOString().split('T')[0]; // "2024-01-01"
}

// --- CORE FUNCTIONS ---

function save() {
    localStorage.setItem('od_checklist', JSON.stringify(state.checklist));
    localStorage.setItem('od_planner', JSON.stringify(state.planner));
}

function render() {
    const main = document.getElementById('main-content');
    main.innerHTML = ''; // Clear current view

    // Update Nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === state.view);
    });

    if (state.view === 'checklist') renderChecklist(main);
    else renderPlanner(main);
}

// --- CHECKLIST LOGIC ---

function renderChecklist(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'checklist-container';

    // 1. New Category Input
    wrapper.innerHTML = `
        <div class="new-cat-row">
            <input type="text" class="cat-input" id="new-cat-name" placeholder="Új kategória...">
            <button class="btn-add" onclick="addCategory()">+</button>
        </div>
    `;

    // 2. Categories
    state.checklist.forEach((cat, index) => {
        const color = PALETTE[index % PALETTE.length];
        const catDiv = document.createElement('div');
        catDiv.className = 'category-card';
        catDiv.style.backgroundColor = color;

        // Header
        let html = `<div class="cat-header">
            <span>${cat.name}</span>
            <button onclick="deleteCategory(${cat.id})">✕</button>
        </div>`;

        // Items
        cat.items.forEach(item => {
            html += `
            <div class="todo-item ${item.checked ? 'checked' : ''}" onclick="toggleItem(${cat.id}, ${item.id})">
                <div class="todo-check ${item.checked ? 'checked' : ''}">
                    ${item.checked ? '✓' : ''}
                </div>
                <span class="todo-text">${item.text}</span>
                <button onclick="event.stopPropagation(); deleteItem(${cat.id}, ${item.id})">✕</button>
            </div>`;
        });

        // Add Item Input
        html += `
        <div class="add-item-row">
            <input type="text" class="add-item-input" 
                placeholder="+ Új tétel" 
                onkeydown="if(event.key === 'Enter') addItem(${cat.id}, this.value)">
        </div>`;

        catDiv.innerHTML = html;
        wrapper.appendChild(catDiv);
    });

    container.appendChild(wrapper);
}

// Checklist Actions
window.addCategory = () => {
    const input = document.getElementById('new-cat-name');
    if (!input.value.trim()) return;
    state.checklist.push({ id: Date.now(), name: input.value, items: [] });
    input.value = '';
    save(); render();
};

window.deleteCategory = (id) => {
    if(confirm('Biztos törlöd?')) {
        state.checklist = state.checklist.filter(c => c.id !== id);
        save(); render();
    }
};

window.addItem = (catId, text) => {
    if (!text.trim()) return;
    const cat = state.checklist.find(c => c.id === catId);
    if (cat) {
        cat.items.push({ id: Date.now(), text: text, checked: false });
        save(); render();
    }
};

window.toggleItem = (catId, itemId) => {
    const cat = state.checklist.find(c => c.id === catId);
    const item = cat.items.find(i => i.id === itemId);
    if (item) {
        item.checked = !item.checked;
        save(); render();
    }
};

window.deleteItem = (catId, itemId) => {
    const cat = state.checklist.find(c => c.id === catId);
    cat.items = cat.items.filter(i => i.id !== itemId);
    save(); render();
};

// --- PLANNER LOGIC ---

function renderPlanner(container) {
    const today = new Date();
    // Calculate start of viewed week
    let currentMonday = getMonday(new Date());
    currentMonday.setDate(currentMonday.getDate() + (state.weekOffset * 7));

    // Controls
    const controls = document.createElement('div');
    controls.className = 'planner-controls';
    
    // Simple date formatting manually
    const endOfWeek = addDays(currentMonday, 6);
    const dateRange = `${currentMonday.getMonth()+1}.${currentMonday.getDate()} - ${endOfWeek.getMonth()+1}.${endOfWeek.getDate()}`;

    controls.innerHTML = `
        <button onclick="changeWeek(-1)">Múlt hét</button>
        <span>${dateRange}</span>
        <button onclick="changeWeek(1)">Jövő hét</button>
    `;
    container.appendChild(controls);

    // Days Loop
    for (let i = 0; i < 7; i++) {
        const dayDate = addDays(currentMonday, i);
        const dateKey = formatDateKey(dayDate);
        const dayData = state.planner[dateKey] || { text: '', worked: false };
        const isPast = dayDate.setHours(0,0,0,0) < today.setHours(0,0,0,0);
        
        const row = document.createElement('div');
        row.className = 'day-row';
        row.style.backgroundColor = PALETTE[i];
        if (isPast) row.style.opacity = '0.6';

        row.innerHTML = `
            <div class="day-label">${WEEK_DAYS_HU[i]}</div>
            <div class="day-content">
                <input type="text" class="day-input" 
                    value="${dayData.text}" 
                    placeholder="Tervek..."
                    oninput="updatePlanner('${dateKey}', 'text', this.value)">
                
                <div class="work-toggle ${dayData.worked ? 'active' : ''}" 
                     onclick="toggleWork('${dateKey}')"></div>
            </div>
        `;
        container.appendChild(row);
    }
}

// Planner Actions
window.changeWeek = (dir) => {
    state.weekOffset += dir;
    render();
};

window.updatePlanner = (dateKey, field, value) => {
    if (!state.planner[dateKey]) state.planner[dateKey] = {};
    state.planner[dateKey][field] = value;
    save();
    // Note: No render() here to keep input focus active!
};

window.toggleWork = (dateKey) => {
    if (!state.planner[dateKey]) state.planner[dateKey] = {};
    state.planner[dateKey].worked = !state.planner[dateKey].worked;
    save(); render();
};

// --- INITIALIZATION ---

document.getElementById('nav-checklist').addEventListener('click', () => {
    state.view = 'checklist'; render();
});
document.getElementById('nav-planner').addEventListener('click', () => {
    state.view = 'planner'; render();
});

// Start app
render();
