// --- State Management ---
const state = {
    config: {
        start: "09:00",
        end: "20:00",
        slotLength: 30 // minutes
    },
    classes: [
        { id: 'class-1', name: "Boys U11", color: "#3b82f6" }, // Blue
        { id: 'class-2', name: "Girls U11", color: "#ec4899" } // Pink
    ],
    blocks: [
        { id: 'block-1', classId: 'class-1', title: "Group Games", tables: 9, duration: 120, scheduled: null },
        { id: 'block-2', classId: 'class-2', title: "Group Games", tables: 7, duration: 120, scheduled: null },
        { id: 'block-3', classId: 'class-1', title: "Quarter Finals", tables: 4, duration: 30, scheduled: null }
    ]
};

// Colors palette for classes
const palette = ["#3b82f6", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4"];

// --- Utility Functions ---

function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;
    const [h, m] = parts.map(Number);
    return h * 60 + m; // minutes since 00:00
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateUID() {
    return Math.random().toString(36).substring(2, 9);
}

// --- Render Logic ---

function renderSidebarClasses() {
    const container = document.getElementById('sidebar-class-list');
    const select = document.getElementById('block-class-id');

    container.innerHTML = '';
    // Keep the disabled default option
    select.innerHTML = '<option value="" disabled selected>Select Class...</option>';

    state.classes.forEach(cls => {
        // Render in class list
        const badge = document.createElement('div');
        badge.className = 'class-badge';
        badge.innerHTML = `
      <span style="color: ${cls.color}">●</span> ${cls.name}
      <span class="delete-class" data-id="${cls.id}">&times;</span>
    `;
        container.appendChild(badge);

        // Render in select dropdown
        const option = document.createElement('option');
        option.value = cls.id;
        option.textContent = cls.name;
        select.appendChild(option);
    });

    // Attach delete events
    document.querySelectorAll('.delete-class').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            // Remove class and un-schedule any blocks associated with it, or remove them
            state.classes = state.classes.filter(c => c.id !== id);
            state.blocks = state.blocks.filter(b => b.classId !== id);
            renderAll();
        });
    });
}

function renderUnscheduledBlocks() {
    const container = document.getElementById('unscheduled-blocks-container');
    container.innerHTML = '';

    const unscheduled = state.blocks.filter(b => !b.scheduled);

    if (unscheduled.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.875rem; text-align: center; padding: 1rem;">No unscheduled blocks</div>';
    } else {
        unscheduled.forEach(block => {
            const cls = state.classes.find(c => c.id === block.classId);
            if (!cls) return;

            const el = document.createElement('div');
            el.className = 'draggable-block';
            el.draggable = true;
            el.style.borderLeftColor = cls.color;
            el.dataset.id = block.id;

            el.innerHTML = `
        <div class="block-header">
          <span class="block-class" style="color: ${cls.color}">${cls.name}</span>
          <div class="block-actions">
            <button class="block-action-btn split-block-btn" data-id="${block.id}" title="Split Block">➗</button>
            <button class="block-action-btn delete-block-btn" data-id="${block.id}" title="Delete Block">✕</button>
          </div>
        </div>
        <div class="block-title">${block.title}</div>
        <div class="block-meta">
          <span class="meta-item">🕒 ${block.duration}m</span>
          <span class="meta-item">🏓 ${block.tables} tables</span>
        </div>
      `;

            // Drag start
            el.addEventListener('dragstart', handleDragStart);
            container.appendChild(el);
        });

        // Attach delete events for blocks
        document.querySelectorAll('.delete-block-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                state.blocks = state.blocks.filter(b => b.id !== id);
                renderAll();
            });
        });
    }
}

function calculateMaxTables() {
    // We compute total active tables per timeslot
    const startMin = parseTime(state.config.start);
    const endMin = parseTime(state.config.end);
    const step = parseInt(state.config.slotLength, 10);

    let maxConcur = 0;

    for (let t = startMin; t < endMin; t += step) {
        let activeInSlot = 0;
        state.blocks.forEach(b => {
            if (!b.scheduled) return;
            const bStart = parseTime(b.scheduled.time);
            const bEnd = bStart + b.duration;

            // If block overlaps this slot
            if (t >= bStart && t < bEnd) {
                activeInSlot += b.tables;
            }
        });
        if (activeInSlot > maxConcur) maxConcur = activeInSlot;
    }

    document.getElementById('total-tables-stat').innerText = maxConcur;
}

function renderScheduleGrid() {
    const grid = document.getElementById('schedule-grid');
    grid.innerHTML = '';

    const startMin = parseTime(state.config.start);
    const endMin = parseTime(state.config.end);
    const step = parseInt(state.config.slotLength, 10);

    // Calculate rows and columns
    const numSlots = Math.ceil((endMin - startMin) / step);
    const numClasses = state.classes.length;

    // Set grid template
    // +1 row for header, +1 col for time column
    grid.style.gridTemplateColumns = `80px repeat(${numClasses}, minmax(180px, 1fr))`;
    grid.style.gridTemplateRows = `40px repeat(${numSlots}, 60px)`;

    // 1. Render Headers
    const timeHeader = document.createElement('div');
    timeHeader.className = 'grid-header-time';
    timeHeader.style.gridColumn = '1';
    timeHeader.style.gridRow = '1';
    timeHeader.innerText = 'Time';
    grid.appendChild(timeHeader);

    state.classes.forEach((cls, i) => {
        const classHeader = document.createElement('div');
        classHeader.className = 'grid-header-class';
        classHeader.style.gridColumn = `${i + 2}`;
        classHeader.style.gridRow = '1';
        classHeader.style.borderBottomColor = cls.color;
        classHeader.innerText = cls.name;
        grid.appendChild(classHeader);
    });

    // 2. Render Time Labels & Drop Targets
    for (let row = 0; row < numSlots; row++) {
        const currentTimeMin = startMin + (row * step);
        const timeStr = formatTime(currentTimeMin);

        // Time label (Column 1)
        const timeLabel = document.createElement('div');
        timeLabel.className = 'grid-time-label';
        timeLabel.style.gridColumn = '1';
        timeLabel.style.gridRow = `${row + 2}`;
        timeLabel.innerText = timeStr;
        grid.appendChild(timeLabel);

        // Drop targets for each class
        state.classes.forEach((cls, col) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.style.gridColumn = `${col + 2}`;
            cell.style.gridRow = `${row + 2}`;
            cell.dataset.time = timeStr;
            cell.dataset.classId = cls.id;

            // Setup drag and drop events
            cell.addEventListener('dragover', handleDragOver);
            cell.addEventListener('dragleave', handleDragLeave);
            cell.addEventListener('drop', handleDrop);

            grid.appendChild(cell);
        });
    }

    // 3. Render Scheduled Blocks
    state.blocks.forEach(block => {
        if (!block.scheduled) return;

        const clsIndex = state.classes.findIndex(c => c.id === block.scheduled.classId);
        if (clsIndex === -1) return; // Class might have been deleted

        const cls = state.classes[clsIndex];

        const bStartMin = parseTime(block.scheduled.time);

        // Check if it fits within bounds
        if (bStartMin < startMin || bStartMin >= endMin) return;

        const rowStart = Math.floor((bStartMin - startMin) / step) + 2;
        // Calculate how many rows it spans based on duration
        const spanRows = Math.ceil(block.duration / step);

        const bEl = document.createElement('div');
        bEl.className = 'scheduled-block';
        bEl.style.gridColumn = `${clsIndex + 2}`;
        bEl.style.gridRow = `${rowStart} / span ${spanRows}`;
        bEl.style.backgroundColor = `${cls.color}15`; // ~8% opacity
        bEl.style.borderColor = cls.color;

        bEl.draggable = true;
        bEl.dataset.id = block.id;

        bEl.innerHTML = `
      <div class="block-header" style="display: flex; justify-content: flex-end; margin-bottom: 2px;">
        <button class="block-action-btn split-block-btn" data-id="${block.id}" title="Split Block" style="color: inherit; background: rgba(0,0,0,0.2); border: none; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;">➗</button>
      </div>
      <div class="block-title" style="color: ${cls.color}">${block.title}</div>
      <div class="block-details">
        <span class="detail-time">🕒 ${block.scheduled.time} - ${formatTime(bStartMin + block.duration)}</span>
        <span class="detail-tables">🏓 ${block.tables} tables</span>
      </div>
    `;

        // Allow re-dragging
        bEl.addEventListener('dragstart', handleDragStart);

        // Double click to unschedule
        bEl.addEventListener('dblclick', () => {
            if (confirm('Unschedule this block?')) {
                block.scheduled = null;
                renderAll();
            }
        });

        grid.appendChild(bEl);
    });

    calculateMaxTables();
}

function attachSplitEvents() {
    document.querySelectorAll('.split-block-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent drag or other events

            const id = e.currentTarget.dataset.id;
            const block = state.blocks.find(b => b.id === id);
            if (!block) return;

            let splitChoice = prompt("Split block by:\n1. Duration (Mins)\n2. Tables\n\nEnter 1 or 2:");
            if (!splitChoice) return;

            splitChoice = splitChoice.trim();

            if (splitChoice === '1') {
                const newDurStr = prompt(`Current duration: ${block.duration}m. Enter duration for the NEW split part (e.g., 30):`);
                if (!newDurStr) return;
                const newDur = parseInt(newDurStr, 10);

                if (newDur > 0 && newDur < block.duration) {
                    const remainder = block.duration - newDur;
                    block.duration = remainder; // original becomes the remainder

                    state.blocks.push({
                        id: generateUID(),
                        classId: block.classId,
                        title: block.title + " (Split)",
                        tables: block.tables,
                        duration: newDur,
                        scheduled: null // Place in unscheduled bin
                    });
                    renderAll();
                } else {
                    alert('Invalid duration given.');
                }
            } else if (splitChoice === '2') {
                const newTabStr = prompt(`Current tables: ${block.tables}. Enter tables for the NEW split part:`);
                if (!newTabStr) return;
                const newTab = parseInt(newTabStr, 10);

                if (newTab > 0 && newTab < block.tables) {
                    const remainder = block.tables - newTab;
                    block.tables = remainder;

                    state.blocks.push({
                        id: generateUID(),
                        classId: block.classId,
                        title: block.title + " (Split)",
                        tables: newTab,
                        duration: block.duration,
                        scheduled: null
                    });
                    renderAll();
                } else {
                    alert('Invalid tables given.');
                }
            }
        });
    });
}

function renderAll() {
    renderSidebarClasses();
    renderUnscheduledBlocks();
    renderScheduleGrid();
    // Attach unified event handlers for elements recreated
    attachSplitEvents();
}

// --- Drag & Drop Handlers ---

let draggedBlockId = null;

function handleDragStart(e) {
    // Prevent drag if we're clicking a button inside it
    if (e.target.tagName.toLowerCase() === 'button') {
        e.preventDefault();
        return;
    }

    draggedBlockId = e.currentTarget.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedBlockId);
    setTimeout(() => {
        e.currentTarget.style.opacity = '0.5';
    }, 0);
}

document.addEventListener('dragend', (e) => {
    if (e.target.draggable) {
        e.target.style.opacity = '1';
    }
    document.querySelectorAll('.grid-cell').forEach(cell => {
        cell.classList.remove('drag-over');
    });
    draggedBlockId = null;
});

function handleDragOver(e) {
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = 'move';

    const block = state.blocks.find(b => b.id === draggedBlockId);
    if (!block) return;

    if (e.currentTarget.dataset.classId === block.classId) {
        e.currentTarget.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    if (!draggedBlockId) return;

    const block = state.blocks.find(b => b.id === draggedBlockId);
    const time = e.currentTarget.dataset.time;
    const classId = e.currentTarget.dataset.classId;

    if (block && classId === block.classId) {
        block.scheduled = { classId, time };
        renderAll();
    } else {
        alert('You cannot schedule a block in a different class column!');
    }
}

function handleUnscheduledDragOver(e) {
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = 'move';

    // Only highlight if dragging a scheduled block
    const block = state.blocks.find(b => b.id === draggedBlockId);
    if (block && block.scheduled) {
        e.currentTarget.classList.add('drag-over-unscheduled');
    }
}

function handleUnscheduledDragLeave(e) {
    e.currentTarget.classList.remove('drag-over-unscheduled');
}

function handleUnscheduledDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over-unscheduled');

    if (!draggedBlockId) return;

    const block = state.blocks.find(b => b.id === draggedBlockId);

    // If it's currently scheduled, unschedule it
    if (block && block.scheduled) {
        block.scheduled = null;
        renderAll();
    }
}

// --- Event Listeners Initialization ---

function initApp() {
    // Setup drop zone for returning blocks to unscheduled on the entire sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('dragover', handleUnscheduledDragOver);
        sidebar.addEventListener('dragleave', handleUnscheduledDragLeave);
        sidebar.addEventListener('drop', handleUnscheduledDrop);
    }

    document.getElementById('update-settings-btn').addEventListener('click', () => {
        state.config.start = document.getElementById('start-time').value;
        state.config.end = document.getElementById('end-time').value;
        state.config.slotLength = parseInt(document.getElementById('slot-length').value, 10);
        renderAll();
    });

    document.getElementById('add-class-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('new-class-name');
        const name = input.value.trim();
        if (name) {
            state.classes.push({
                id: generateUID(),
                name,
                color: palette[state.classes.length % palette.length]
            });
            input.value = '';
            renderAll();
        }
    });

    document.getElementById('add-block-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const classId = document.getElementById('block-class-id').value;
        const title = document.getElementById('block-title').value.trim();
        const tables = parseInt(document.getElementById('block-tables').value, 10);
        const duration = parseInt(document.getElementById('block-duration').value, 10);

        if (classId && title && tables > 0 && duration > 0) {
            state.blocks.push({
                id: generateUID(),
                classId,
                title,
                tables,
                duration,
                scheduled: null
            });
            e.target.reset();
            renderAll();
        }
    });

    // Auto Generate logic
    document.getElementById('auto-generate-btn').addEventListener('click', () => {
        if (state.classes.length === 0) {
            alert("Please add at least one class first.");
            return;
        }

        let classNames = state.classes.map(c => c.name).join(', ');
        const classNameInput = prompt(`Enter the name of the Class to generate blocks for:\nAvailable: ${classNames}`);
        if (!classNameInput) return;

        const cls = state.classes.find(c => c.name.toLowerCase() === classNameInput.trim().toLowerCase());
        if (!cls) {
            alert("Class not found.");
            return;
        }

        const playersStr = prompt(`How many players/teams in ${cls.name}? (e.g., 16)`);
        if (!playersStr) return;
        const players = parseInt(playersStr, 10);
        if (isNaN(players) || players < 4) {
            alert("Please enter a valid number of players (minimum 4).");
            return;
        }

        // Let's create smart defaults:
        // Groups of 4 = 6 matches per group
        const numGroups = Math.ceil(players / 4);
        const totalGroupMatches = numGroups * 6; // Assume 1 match takes 1 slot and 1 table
        const slotMins = parseInt(state.config.slotLength, 10);

        // We aim for around 4 slots (e.g. 2 hours if 30m slots) for group stages
        const groupStageSlots = 4;
        const groupStageMins = groupStageSlots * slotMins;
        const tablesNeeded = Math.ceil(totalGroupMatches / groupStageSlots);

        state.blocks.push({
            id: generateUID(),
            classId: cls.id,
            title: "Group Stage",
            tables: tablesNeeded,
            duration: groupStageMins,
            scheduled: null
        });

        // Knockouts
        if (players >= 8) {
            state.blocks.push({ id: generateUID(), classId: cls.id, title: "Quarter Finals", tables: 4, duration: slotMins, scheduled: null });
        }
        if (players >= 4) {
            state.blocks.push({ id: generateUID(), classId: cls.id, title: "Semi Finals", tables: 2, duration: slotMins, scheduled: null });
        }

        state.blocks.push({ id: generateUID(), classId: cls.id, title: "Finals & 3rd Place", tables: 2, duration: slotMins, scheduled: null });

        renderAll();
        alert(`Successfully generated group stage and knockout blocks for ${cls.name}!\n\nAdded to the Unscheduled Blocks list.`);
    });

    // Set initial form values based on state defaults
    document.getElementById('start-time').value = state.config.start;
    document.getElementById('end-time').value = state.config.end;
    document.getElementById('slot-length').value = state.config.slotLength;

    renderAll();
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
