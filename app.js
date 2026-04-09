// --- State Management ---
let state = {
    config: {
        start: "09:00",
        end: "20:00",
        slotLength: 20, // minutes
        tablesAvailable: 16
    },
    classes: [],
    blocks: []
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
          <span class="meta-item">🕒 ${block.slots} slot(s)</span>
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
    const numSlots = Math.ceil((endMin - startMin) / step);

    for (let s = 0; s < numSlots; s++) {
        let activeInSlot = 0;
        state.blocks.forEach(b => {
             if (!b.scheduled) return;
             if (s >= b.scheduled.slotIndex && s < b.scheduled.slotIndex + b.slots) {
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

        // Calculate total tables currently used in this slot
        let activeInSlot = 0;
        state.blocks.forEach(b => {
            if (!b.scheduled) return;
            if (row >= b.scheduled.slotIndex && row < b.scheduled.slotIndex + b.slots) {
                activeInSlot += b.tables;
            }
        });

        const isOverbooked = state.config.tablesAvailable && activeInSlot > state.config.tablesAvailable;

        // Time label (Column 1)
        const timeLabel = document.createElement('div');
        timeLabel.className = 'grid-time-label';
        if (isOverbooked) timeLabel.classList.add('overbooked-text', 'overbooked-bg');
        timeLabel.style.gridColumn = '1';
        timeLabel.style.gridRow = `${row + 2}`;
        timeLabel.innerText = timeStr;
        grid.appendChild(timeLabel);

        // Drop targets for each class
        state.classes.forEach((cls, col) => {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            if (isOverbooked) cell.classList.add('overbooked-bg');
            cell.style.gridColumn = `${col + 2}`;
            cell.style.gridRow = `${row + 2}`;
            cell.dataset.slotIndex = row;
            cell.dataset.classId = cls.id;

            grid.appendChild(cell);
        });
    }

    // 3. Render Scheduled Blocks

    // Check for Out-Of-Order violations
    state.blocks.forEach(b => b.outOfOrder = false);

    state.classes.forEach(cls => {
        const classBlocks = state.blocks.filter(b => b.classId === cls.id && b.scheduled && b.phaseType);
        if (classBlocks.length === 0) return;
        
        // Find Group Phase Finish Time
        const groupBlocks = classBlocks.filter(b => b.phaseType === "Group");
        let groupFinishSlot = -1;
        if (groupBlocks.length > 0) {
            groupFinishSlot = Math.max(...groupBlocks.map(b => b.scheduled.slotIndex + b.slots));
        }

        // For any non-Group blocks, if they start before Group finishes, it's out of order
        if (groupFinishSlot > -1) {
            classBlocks.filter(b => b.phaseType !== "Group").forEach(b => {
                 if (b.scheduled.slotIndex < groupFinishSlot) {
                     b.outOfOrder = true;
                 }
            });
        }

        function checkDependency(typeA, typeT) {
             const blocksA = classBlocks.filter(b => b.phaseType === typeA);
             const blocksT = classBlocks.filter(b => b.phaseType === typeT);
             if (blocksT.length === 0 || blocksA.length === 0) return;

             const depthsA = [...new Set(blocksA.map(b => b.depth))];
             const depthsT = [...new Set(blocksT.map(b => b.depth))];
             const allDepths = [...new Set([...depthsA, ...depthsT])].sort((a,b) => b - a);
             
             for (let i = 0; i < allDepths.length; i++) {
                 for (let j = i + 1; j < allDepths.length; j++) {
                     const dA = allDepths[i];
                     const dT = allDepths[j];
                     
                     const A = blocksA.filter(b => b.depth === dA);
                     const T = blocksT.filter(b => b.depth === dT);
                     
                     if (A.length === 0 || T.length === 0) continue;
                     
                     const totalMatchesT = T[0].totalMatches;
                     const totalMatchesA = A[0].totalMatches;
                     
                     T.forEach(bT => {
                          if (bT.outOfOrder) return;
                          const t = bT.scheduled.slotIndex;
                          
                          const startedT = T.filter(b => b.scheduled.slotIndex <= t).reduce((sum, b) => sum + b.tables, 0);
                          const finishedA = A.filter(b => (b.scheduled.slotIndex + b.slots) <= t).reduce((sum, b) => sum + b.tables, 0);
                          
                          const availableSpots = (2 * totalMatchesT - totalMatchesA) + finishedA;
                          const maxMatches = Math.floor(availableSpots / 2);
                          
                          if (startedT > maxMatches) {
                               bT.outOfOrder = true;
                          }
                     });
                 }
             }
        }
        
        checkDependency("Playoff", "Playoff");
        checkDependency("Consolation", "Consolation");
    });

    // Group blocks by cell (classId and time) to handle overlaps
    const cellGroups = {};

    state.blocks.forEach(block => {
        if (!block.scheduled) return;

        const clsIndex = state.classes.findIndex(c => c.id === block.scheduled.classId);
        if (clsIndex === -1) return; // Class might have been deleted

        const cls = state.classes[clsIndex];
        const bSlotIndex = block.scheduled.slotIndex;

        // Check if it fits within bounds
        if (bSlotIndex < 0 || bSlotIndex >= numSlots) return;

        const rowStart = bSlotIndex + 2;
        const spanRows = block.slots;

        const cellKey = `${clsIndex}-${rowStart}`;
        if (!cellGroups[cellKey]) {
            cellGroups[cellKey] = [];
        }

        cellGroups[cellKey].push({
            block,
            clsIndex,
            cls,
            bSlotIndex,
            rowStart,
            spanRows
        });
    });

    // Render grouped blocks
    Object.values(cellGroups).forEach(group => {
        const overlapCount = group.length;

        group.forEach((item, index) => {
            const { block, clsIndex, cls, bSlotIndex, rowStart, spanRows } = item;

            const bEl = document.createElement('div');
            bEl.className = 'scheduled-block';
            bEl.style.gridColumn = `${clsIndex + 2}`;
            bEl.style.gridRow = `${rowStart} / span ${spanRows}`;
            bEl.style.backgroundColor = `${cls.color}15`; // ~8% opacity
            bEl.style.borderColor = cls.color;

            // Adjust width and left position for overlapping blocks
            if (overlapCount > 1) {
                bEl.style.width = `calc(${100 / overlapCount}% - 4px)`;
                bEl.style.marginLeft = `calc(${(100 / overlapCount) * index}%)`;
            }

            if (block.outOfOrder) {
                bEl.classList.add('out-of-order-bg');
            }

            bEl.draggable = true;
            bEl.dataset.id = block.id;

            const blockStartMin = startMin + (bSlotIndex * step);
            const blockEndMin = startMin + ((bSlotIndex + block.slots) * step);

            const titleIcon = block.outOfOrder ? '⚠️ ' : '';

            bEl.innerHTML = `
          <div class="block-header" style="display: flex; justify-content: flex-end; margin-bottom: 2px;">
            <button class="block-action-btn split-block-btn" data-id="${block.id}" title="Split Block" style="color: inherit; background: rgba(0,0,0,0.2); border: none; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;">➗</button>
          </div>
          <div class="block-title" style="color: ${cls.color}">${titleIcon}${block.title}</div>
          <div class="block-details">
            <span class="detail-time">🕒 ${formatTime(blockStartMin)} - ${formatTime(blockEndMin)}</span>
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

            let splitChoice = prompt("Split block by:\n1. Slots\n2. Tables\n\nEnter 1 or 2:");
            if (!splitChoice) return;

            splitChoice = splitChoice.trim();

            if (splitChoice === '1') {
                const newSlotsStr = prompt(`Current slots: ${block.slots}. Enter slots for the NEW split part:`);
                if (!newSlotsStr) return;
                const newSlots = parseInt(newSlotsStr, 10);

                if (newSlots > 0 && newSlots < block.slots) {
                    const remainder = block.slots - newSlots;
                    block.slots = remainder; // original becomes the remainder

                    const newBlockId = generateUID();
                    state.blocks.push({
                        id: newBlockId,
                        originalBlockId: block.originalBlockId || block.id,
                        classId: block.classId,
                        title: block.title + " (Split)",
                        tables: block.tables,
                        slots: newSlots,
                        scheduled: null,
                        phaseType: block.phaseType,
                        depth: block.depth,
                        totalMatches: block.totalMatches
                    });
                    if (!block.originalBlockId) block.originalBlockId = block.id;
                    renderAll();
                } else {
                    alert('Invalid slots given.');
                }
            } else if (splitChoice === '2') {
                const newTabStr = prompt(`Current tables: ${block.tables}. Enter tables for the NEW split part:`);
                if (!newTabStr) return;
                const newTab = parseInt(newTabStr, 10);

                if (newTab > 0 && newTab < block.tables) {
                    const remainder = block.tables - newTab;
                    block.tables = remainder;

                    const newBlockId = generateUID();
                    state.blocks.push({
                        id: newBlockId,
                        originalBlockId: block.originalBlockId || block.id,
                        classId: block.classId,
                        title: block.title + " (Split)",
                        tables: newTab,
                        slots: block.slots,
                        scheduled: null,
                        phaseType: block.phaseType,
                        depth: block.depth,
                        totalMatches: block.totalMatches
                    });
                    if (!block.originalBlockId) block.originalBlockId = block.id;
                    renderAll();
                } else {
                    alert('Invalid tables given.');
                }
            }
        });
    });
}

function saveStateToURL() {
    try {
        const json = JSON.stringify(state);
        // Base64 encode the string to keep the URL visually cleaner and safe
        const encoded = btoa(encodeURIComponent(json));
        window.history.replaceState(null, '', '#' + encoded);
    } catch (e) {
        console.error("Failed to save state to URL", e);
    }
}

function loadStateFromURL() {
    if (window.location.hash.length > 1) {
        try {
            const hash = window.location.hash.substring(1);
            const decoded = decodeURIComponent(atob(hash));
            const loadedState = JSON.parse(decoded);
            if (loadedState && loadedState.config && loadedState.classes && loadedState.blocks) {
                // Backward compatibility transform
                const step = parseInt(loadedState.config.slotLength || 20, 10);
                const startMin = parseTime(loadedState.config.start || "09:00");
                
                loadedState.blocks.forEach(b => {
                    if (b.duration !== undefined) {
                        b.slots = Math.max(1, Math.round(b.duration / step));
                        delete b.duration;
                    }
                    if (b.scheduled && b.scheduled.time !== undefined) {
                        const bTimeMin = parseTime(b.scheduled.time);
                        b.scheduled.slotIndex = Math.round((bTimeMin - startMin) / step);
                        delete b.scheduled.time;
                    }
                });
                state = loadedState;
            }
        } catch (e) {
            console.error("Failed to parse state from URL", e);
        }
    }
}

function renderAll() {
    renderSidebarClasses();
    renderUnscheduledBlocks();
    renderScheduleGrid();
    // Attach unified event handlers for elements recreated
    attachSplitEvents();
    saveStateToURL();
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
        cell.classList.remove('drag-over', 'drag-invalid');
    });
    draggedBlockId = null;
    currentDragHoverCell = null;
});

function isSlotAvailable(classId, proposedSlotIndex, slots, excludeBlockId) {
    const proposedEndSlot = proposedSlotIndex + slots;

    for (const block of state.blocks) {
        if (!block.scheduled || block.classId !== classId || block.id === excludeBlockId) continue;

        const existingStartSlot = block.scheduled.slotIndex;
        const existingEndSlot = existingStartSlot + block.slots;

        // If they start at the exact same time, allow it (for matching groups)
        if (existingStartSlot === proposedSlotIndex) continue;

        if (proposedSlotIndex < existingEndSlot && proposedEndSlot > existingStartSlot) {
            return false;
        }
    }
    return true;
}

let currentDragHoverCell = null;

function handleGridDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedBlockId) return;

    const block = state.blocks.find(b => b.id === draggedBlockId);
    if (!block) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let cell = elements.find(el => el.classList.contains('grid-cell'));

    if (cell && cell.dataset.classId !== block.classId) {
        const correctCell = document.querySelector(`.grid-cell[data-slot-index="${cell.dataset.slotIndex}"][data-class-id="${block.classId}"]`);
        if (correctCell) cell = correctCell;
    }

    if (currentDragHoverCell && currentDragHoverCell !== cell) {
        currentDragHoverCell.classList.remove('drag-over', 'drag-invalid');
    }

    currentDragHoverCell = cell;

    if (cell) {
        const proposedSlotIndex = parseInt(cell.dataset.slotIndex, 10);
        const isAvailable = isSlotAvailable(block.classId, proposedSlotIndex, block.slots, block.id);

        if (isAvailable) {
            cell.classList.add('drag-over');
            cell.classList.remove('drag-invalid');
            e.dataTransfer.dropEffect = 'move';
        } else {
            cell.classList.add('drag-invalid');
            cell.classList.remove('drag-over');
            e.dataTransfer.dropEffect = 'none'; // Indicate invalid drop visually on cursor if supported
        }
    }
}

function handleGridDragLeave(e) {
    // Handled by returning from DragOver or DragEnd
}

function handleGridDrop(e) {
    e.preventDefault();

    if (currentDragHoverCell) {
        currentDragHoverCell.classList.remove('drag-over', 'drag-invalid');
    }

    if (!draggedBlockId) return;

    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    let cell = elements.find(el => el.classList.contains('grid-cell'));

    if (!cell) return;

    const block = state.blocks.find(b => b.id === draggedBlockId);
    if (!block) return;

    if (cell.dataset.classId !== block.classId) {
        const correctCell = document.querySelector(`.grid-cell[data-slot-index="${cell.dataset.slotIndex}"][data-class-id="${block.classId}"]`);
        if (correctCell) cell = correctCell;
    }

    const slotIndex = parseInt(cell.dataset.slotIndex, 10);

    // Check for merge candidate
    const mergeTarget = state.blocks.find(b => 
        b.id !== block.id && 
        b.classId === block.classId && 
        b.originalBlockId && 
        b.originalBlockId === block.originalBlockId && 
        b.scheduled && 
        b.scheduled.slotIndex === slotIndex
    );

    if (mergeTarget) {
        if (mergeTarget.slots === block.slots) {
            // Split by tables: restore original tables
            mergeTarget.tables += block.tables;
            mergeTarget.title = mergeTarget.title.replace(" (Split)", "");
            state.blocks = state.blocks.filter(b => b.id !== block.id);
            renderAll();
            return;
        } else if (mergeTarget.tables === block.tables) {
            // Split by slots: restore original slots
            mergeTarget.slots += block.slots;
            mergeTarget.title = mergeTarget.title.replace(" (Split)", "");
            state.blocks = state.blocks.filter(b => b.id !== block.id);
            renderAll();
            return;
        }
    }

    if (isSlotAvailable(block.classId, slotIndex, block.slots, block.id)) {
        const oldSlotIndex = block.scheduled ? block.scheduled.slotIndex : null;
        block.scheduled = { classId: block.classId, slotIndex };

        // Cascade Push logic
        if (oldSlotIndex !== null && oldSlotIndex !== slotIndex && block.phaseType && block.phaseType !== "Group") {
            const moveDown = slotIndex > oldSlotIndex;
            const classBlocks = state.blocks.filter(b => b.classId === block.classId && b.scheduled && b.phaseType === block.phaseType && b.id !== block.id);
            
            let targetDepths = [];
            let pushDelta = 0;
            
            if (moveDown) {
                 const depths = [...new Set(classBlocks.map(b => b.depth))].filter(d => d < block.depth).sort((a,b) => b - a);
                 if (depths.length > 0) {
                      const immediateDepth = depths[0];
                      const immediateBlocks = classBlocks.filter(b => b.depth === immediateDepth);
                      const minStart = Math.min(...immediateBlocks.map(b => b.scheduled.slotIndex));
                      
                      const overlap = (slotIndex + block.slots) - minStart;
                      if (overlap > 0) {
                          pushDelta = overlap;
                          targetDepths = depths;
                      }
                 }
            } else {
                 const depths = [...new Set(classBlocks.map(b => b.depth))].filter(d => d > block.depth).sort((a,b) => b - a);
                 if (depths.length > 0) {
                      const immediateDepth = depths[depths.length - 1];
                      const immediateBlocks = classBlocks.filter(b => b.depth === immediateDepth);
                      const maxEnd = Math.max(...immediateBlocks.map(b => b.scheduled.slotIndex + b.slots));
                      
                      const overlap = maxEnd - slotIndex;
                      if (overlap > 0) {
                          pushDelta = -overlap; // negative shift
                          targetDepths = depths;
                      }
                 }
            }
            
            if (targetDepths.length > 0) {
                 const blocksToPush = classBlocks.filter(b => targetDepths.includes(b.depth));
                 
                 const startMin = parseTime(state.config.start);
                 const endMin = parseTime(state.config.end);
                 const step = parseInt(state.config.slotLength, 10);
                 const numSlots = Math.ceil((endMin - startMin) / step);
                 
                 const minPushedStart = Math.min(...blocksToPush.map(b => b.scheduled.slotIndex + pushDelta));
                 const maxPushedEnd = Math.max(...blocksToPush.map(b => b.scheduled.slotIndex + pushDelta + b.slots));
                 
                 if (minPushedStart >= 0 && maxPushedEnd <= numSlots) {
                      blocksToPush.forEach(b => {
                           b.scheduled.slotIndex += pushDelta;
                      });
                 }
            }
        }

        renderAll();
    } else {
        alert('This time slot is occupied by another block that starts at a different time!');
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

function autoGenerateBlocks(cls) {
    if (cls.structure === "Manual") return;

    const players = cls.players;
    const structure = cls.structure;
    const numGroups = Math.ceil(players / 4);
    const hasGroup = structure.includes("Group") || structure.includes("group");
    const hasPlayoff = structure.includes("play-off");
    const hasCons = structure.includes("consolation");

    if (hasGroup) {
        const groupStageSlots = 6;
        const tablesNeeded = numGroups;

        const blockId = generateUID();
        state.blocks.push({
            id: blockId,
            originalBlockId: blockId,
            classId: cls.id,
            title: "Group Stage",
            tables: tablesNeeded,
            slots: groupStageSlots,
            scheduled: null,
            phaseType: "Group",
            depth: 0,
            totalMatches: tablesNeeded
        });
    }

    if (hasPlayoff) {
        let currentP = hasGroup ? numGroups * 2 : players;

        while (currentP > 1) {
            let B = Math.pow(2, Math.ceil(Math.log2(currentP)));
            let matches = currentP === B ? currentP / 2 : currentP - B / 2;

            let roundName = "";
            if (B === 2) roundName = "Finals";
            else if (B === 4) roundName = "Semi Finals";
            else if (B === 8) roundName = "Quarter Finals";
            else roundName = "Round of " + B;

            const blockId = generateUID();
            state.blocks.push({
                id: blockId,
                originalBlockId: blockId,
                classId: cls.id,
                title: roundName,
                tables: matches,
                slots: 1,
                scheduled: null,
                phaseType: "Playoff",
                depth: B,
                totalMatches: matches
            });

            currentP = B / 2;
        }
    }

    if (hasCons) {
        let consolationP = players - (numGroups * 2);
        if (consolationP > 1) {
            while (consolationP > 1) {
                let B = Math.pow(2, Math.ceil(Math.log2(consolationP)));
                let matches = consolationP === B ? consolationP / 2 : consolationP - B / 2;

                let roundName = "";
                if (B === 2) roundName = "Consolation Finals";
                else if (B === 4) roundName = "Consolation Semi Finals";
                else if (B === 8) roundName = "Consolation Quarter Finals";
                else roundName = "Consolation Round of " + B;

                const blockId = generateUID();
                state.blocks.push({
                    id: blockId,
                    originalBlockId: blockId,
                    classId: cls.id,
                    title: roundName,
                    tables: matches,
                    slots: 1,
                    scheduled: null,
                    phaseType: "Consolation",
                    depth: B,
                    totalMatches: matches
                });

                consolationP = B / 2;
            }
        }
    }
}

// --- Event Listeners Initialization ---

function initApp() {
    loadStateFromURL();

    // Setup drop zone for returning blocks to unscheduled on the entire sidebar
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.addEventListener('dragover', handleUnscheduledDragOver);
        sidebar.addEventListener('dragleave', handleUnscheduledDragLeave);
        sidebar.addEventListener('drop', handleUnscheduledDrop);
    }

    // Setup drop zone for the main schedule grid
    const grid = document.getElementById('schedule-grid');
    if (grid) {
        grid.addEventListener('dragover', handleGridDragOver);
        grid.addEventListener('dragleave', handleGridDragLeave);
        grid.addEventListener('drop', handleGridDrop);
    }

    document.getElementById('update-settings-btn').addEventListener('click', () => {
        state.config.start = document.getElementById('start-time').value;
        state.config.end = document.getElementById('end-time').value;
        state.config.slotLength = parseInt(document.getElementById('slot-length').value, 10);
        state.config.tablesAvailable = parseInt(document.getElementById('tables-available').value, 10);
        renderAll();
    });

    const classModal = document.getElementById('class-modal');
    const openModalBtn = document.getElementById('open-class-modal-btn');
    const closeModalBtn = document.getElementById('close-class-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-class-modal-btn');
    const classModalForm = document.getElementById('class-modal-form');

    function hideClassModal() {
        classModal.style.display = 'none';
        classModalForm.reset();
    }

    openModalBtn.addEventListener('click', () => {
        classModal.style.display = 'flex';
        document.getElementById('modal-class-name').focus();
    });

    closeModalBtn.addEventListener('click', hideClassModal);
    cancelModalBtn.addEventListener('click', hideClassModal);

    classModalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('modal-class-name').value.trim();
        const players = parseInt(document.getElementById('modal-class-players').value, 10);
        const structure = document.getElementById('modal-class-structure').value;

        if (name && players >= 4) {
            const newClass = {
                id: generateUID(),
                name,
                players,
                structure,
                color: palette[state.classes.length % palette.length]
            };
            state.classes.push(newClass);
            
            autoGenerateBlocks(newClass);
            
            hideClassModal();
            renderAll();
        }
    });

    document.getElementById('add-block-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const classId = document.getElementById('block-class-id').value;
        const title = document.getElementById('block-title').value.trim();
        const tables = parseInt(document.getElementById('block-tables').value, 10);
        const slots = parseInt(document.getElementById('block-slots').value, 10);

        if (classId && title && tables > 0 && slots > 0) {
            const blockId = generateUID();
            state.blocks.push({
                id: blockId,
                originalBlockId: blockId,
                classId,
                title,
                tables,
                slots,
                scheduled: null
            });
            e.target.reset();
            renderAll();
        }
    });

    // Set initial form values based on state defaults
    document.getElementById('start-time').value = state.config.start;
    document.getElementById('end-time').value = state.config.end;
    document.getElementById('slot-length').value = state.config.slotLength;
    const tablesAvailEl = document.getElementById('tables-available');
    if (tablesAvailEl) tablesAvailEl.value = state.config.tablesAvailable || 16;

    renderAll();
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
