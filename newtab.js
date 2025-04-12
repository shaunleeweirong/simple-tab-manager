// newtab.js (Complete Code - Combined Event Handlers Version)

// --- Element References ---
const collectionsContainer = document.getElementById('collectionsContainer');
const loadingMessage = document.getElementById('loadingMessage');
const emptyStateMessage = document.getElementById('emptyStateMessage');
const noResultsMessage = document.getElementById('noResultsMessage');
const searchInput = document.getElementById('searchInput');
const openTabsList = document.getElementById('openTabsList');
// Sidebar action elements
const saveOpenTabsBtn = document.getElementById('saveOpenTabsBtn');
const closeOpenTabsCheckbox = document.getElementById('closeOpenTabsCheckbox');
const sidebarStatusDiv = document.getElementById('sidebarStatus');
// Popup Elements
const instructionsPopup = document.getElementById('instructionsPopup');
const showInstructionsBtn = document.getElementById('showInstructionsBtn');
const popupCloseBtn = instructionsPopup ? instructionsPopup.querySelector('.popup-close-btn') : null;

console.log('[Debug] Getting search input element...');
console.log('[Debug] Search Input Element found:', searchInput);
console.log('[Debug] Open Tabs List Element found:', openTabsList);
console.log('[Debug] Sidebar Save Button found:', saveOpenTabsBtn);
console.log('[Debug] Popup elements found:', { instructionsPopup, showInstructionsBtn, popupCloseBtn });


// --- Configuration & State ---
const TABS_TO_SHOW_INITIALLY = 5;
let allCollections = []; // Stores all fetched collections IN THEIR PERSISTED ORDER
let currentFilter = ''; // Stores the current search term
let currentWindowId = null; // Store current window ID
let draggedCollectionId = null; // Store the ID of the collection being dragged for reordering

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initializeNewTabPage);

if (searchInput) {
    console.log('[Debug] Attaching search listener to element:', searchInput);
    searchInput.addEventListener('input', handleSearchInput);
} else {
    console.error('[Error] !!! Search input element with ID "searchInput" was NOT FOUND. Check HTML ID.');
}

// Listener for sidebar save button
if (saveOpenTabsBtn) {
    saveOpenTabsBtn.addEventListener('click', handleSaveOpenTabs);
} else {
     console.error('[Error] Sidebar Save button #saveOpenTabsBtn not found.');
}

// Popup Listeners
if (showInstructionsBtn && instructionsPopup) {
    showInstructionsBtn.addEventListener('click', () => {
        instructionsPopup.classList.remove('hidden');
    });
} else {
    console.warn('[Warn] Instructions button or popup element not found.');
}

if (popupCloseBtn && instructionsPopup) {
    popupCloseBtn.addEventListener('click', () => {
        instructionsPopup.classList.add('hidden');
    });
}

if (instructionsPopup) {
    // Close popup if overlay background is clicked
    instructionsPopup.addEventListener('click', (event) => {
        if (event.target === instructionsPopup) {
            instructionsPopup.classList.add('hidden');
        }
    });
}

// Optional: Close popup with Escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && instructionsPopup && !instructionsPopup.classList.contains('hidden')) {
        instructionsPopup.classList.add('hidden');
    }
});


// --- Initialization ---
async function initializeNewTabPage() {
    console.log('[Debug] Initializing New Tab Page...');
    // Get current window ID first
    try {
        const window = await chrome.windows.getCurrent({ populate: false });
        currentWindowId = window.id;
        console.log('[Debug] Current Window ID:', currentWindowId);
    } catch (error) {
         console.error('[Error] Could not get current window:', error);
         if (openTabsList) openTabsList.innerHTML = '<li class="state-message error">Could not get window info.</li>';
    }

    // Load saved collections (async) - Order will come from storage now
    await loadInitialCollections();

    // Load open tabs if we have the necessary info (async)
    if(currentWindowId && openTabsList) {
       await displayOpenTabs();
    } else {
        if (openTabsList) openTabsList.innerHTML = '<li class="state-message error">Could not load open tabs.</li>';
    }

    console.log('[Debug] Initialization complete.');
}


// --- Core Collection Functions ---

async function loadInitialCollections() {
    console.log('[Debug] loadInitialCollections called');
    loadingMessage.style.display = 'block';
    emptyStateMessage.style.display = 'none';
    noResultsMessage.style.display = 'none';
    Array.from(collectionsContainer.querySelectorAll('.collection-card')).forEach(card => card.remove());

    try {
        const data = await chrome.storage.local.get('tabCollections');
        console.log('[Debug] Data fetched from storage:', data);
        allCollections = data.tabCollections || []; // The order here IS the order from storage
        console.log('[Debug] Collections loaded (IDs):', JSON.stringify(allCollections.map(c => c.id)));

        // REMOVED the sort by createdAt. The order loaded from storage is now the source of truth.

        loadingMessage.style.display = 'none';
        displayCollections(filterCollections(allCollections, currentFilter));

    } catch (error) {
        console.error('[Error] Error loading collections:', error);
        loadingMessage.textContent = 'Error loading collections.';
        loadingMessage.style.color = 'var(--color-error)';
        loadingMessage.style.display = 'block';
        allCollections = [];
    }
}

function handleSearchInput() {
    console.log('[Debug] handleSearchInput triggered!');
    if (!searchInput) return;
    currentFilter = searchInput.value.toLowerCase().trim();
    console.log('[Debug] Current Filter Text:', currentFilter);

    const filteredCollections = filterCollections(allCollections, currentFilter);
    console.log('[Debug] Filtered Collections Count:', filteredCollections.length);
    displayCollections(filteredCollections); // Display based on filter

    if (openTabsList) { filterOpenTabsList(currentFilter); }
}

function filterCollections(collections, filterText) {
    if (!filterText) { return collections; }
    const lowerCaseFilterText = filterText.toLowerCase();

    return collections.filter(collection => {
        const nameMatch = collection.name && collection.name.toLowerCase().includes(lowerCaseFilterText);
        if (nameMatch) return true;
        return (collection.tabs || []).some(tab =>
            (tab.title && tab.title.toLowerCase().includes(lowerCaseFilterText)) ||
            (tab.url && tab.url.toLowerCase().includes(lowerCaseFilterText))
        );
    });
}

function displayCollections(collectionsToDisplay) {
    console.log('[Debug] displayCollections called with', collectionsToDisplay.length, 'items');
    console.log('[Debug] Displaying order (IDs):', JSON.stringify(collectionsToDisplay.map(c => c.id)));
    // Store scroll position before clearing
    const scrollY = window.scrollY;

    // Clear only the cards, keep messages
    Array.from(collectionsContainer.querySelectorAll('.collection-card')).forEach(card => card.remove());

    // Ensure message elements exist and are positioned correctly
    if (!document.getElementById('loadingMessage')) collectionsContainer.prepend(loadingMessage);
    if (!document.getElementById('emptyStateMessage')) collectionsContainer.appendChild(emptyStateMessage); // Append messages after cards
    if (!document.getElementById('noResultsMessage')) collectionsContainer.appendChild(noResultsMessage);

    emptyStateMessage.style.display = 'none';
    noResultsMessage.style.display = 'none';
    loadingMessage.style.display = 'none';

    // Determine which message to show based on the *original* unfiltered data and filter state
    if (allCollections.length === 0 && !currentFilter) {
        emptyStateMessage.style.display = 'block';
        console.log('[Debug] Displaying: Empty State (No collections saved)');
    } else if (collectionsToDisplay.length === 0 && currentFilter) {
        noResultsMessage.style.display = 'block';
        console.log('[Debug] Displaying: No Results Message');
    } else if (collectionsToDisplay.length > 0) {
        console.log('[Debug] Rendering collection cards...');
        collectionsToDisplay.forEach(collection => {
            if (collection && collection.id && collection.name) {
                 const card = createCollectionCard(collection);
                 // Insert cards *before* the empty state message placeholder
                 collectionsContainer.insertBefore(card, emptyStateMessage);
            } else {
                 console.warn('[Warn] Skipping invalid collection object:', collection);
            }
        });
    } else {
         // This case might occur if all collections exist but are filtered out
         console.log('[Debug] Displaying: Nothing (all collections filtered out or empty)');
         // Check again just in case
         if (allCollections.length === 0) {
            emptyStateMessage.style.display = 'block';
         }
    }
    // Restore scroll position
    window.scrollTo(0, scrollY);
}


// --- Open Tabs Display Logic (DRAG SOURCE) ---

async function displayOpenTabs() { // (Unchanged)
    if (!openTabsList || !currentWindowId) {
        console.warn('[Warn] Cannot display open tabs. List element or Window ID missing.');
        return;
    }
    console.log('[Debug] displayOpenTabs called for window:', currentWindowId);
    openTabsList.innerHTML = '<li class="state-message">Loading...</li>';

    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        openTabsList.innerHTML = ''; // Clear loading/previous tabs

        if (!tabs || tabs.length === 0) {
            openTabsList.innerHTML = '<li class="state-message">No open tabs found in this window.</li>';
            return;
        }

        let displayedCount = 0;
        tabs.forEach(tab => {
            if (tab.url && !tab.url.startsWith('chrome://newtab') && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
                const li = createOpenTabListItem(tab);
                openTabsList.appendChild(li);
                displayedCount++;
            }
        });

        if (displayedCount === 0) {
             openTabsList.innerHTML = '<li class="state-message">No relevant open tabs to display.</li>';
        }
        console.log('[Debug] Displayed', displayedCount, 'open tabs.');

    } catch (error) {
        console.error('[Error] Failed to query or display open tabs:', error);
        openTabsList.innerHTML = '<li class="state-message error">Error loading open tabs.</li>';
    }
}

// Create LI element for open tab, make it draggable
function createOpenTabListItem(tab) { // (Unchanged)
    const li = document.createElement('li');
    li.className = 'open-tab-item';
    li.dataset.url = tab.url || '#';
    li.dataset.title = tab.title || tab.url || 'Untitled Tab';
    li.dataset.favIconUrl = tab.favIconUrl || 'icons/icon16.png';

    // Make draggable and add listeners
    li.draggable = true;
    li.addEventListener('dragstart', handleOpenTabDragStart);
    li.addEventListener('dragend', handleOpenTabDragEnd);

    // Add Favicon
    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = li.dataset.favIconUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function() {
        this.src = 'icons/icon16.png';
        this.classList.add('favicon-fallback');
    };
    li.appendChild(img);

    // Add Title
    const span = document.createElement('span');
    span.className = 'open-tab-title';
    span.textContent = li.dataset.title;
    span.title = `${li.dataset.title}\n${li.dataset.url}`;
    li.appendChild(span);

    return li;
}

// --- Drag Handlers for Open Tabs ---
function handleOpenTabDragStart(event) { // (Unchanged)
    const li = event.currentTarget;
    console.log('[Drag] Starting drag for tab:', li.dataset.title);

    const tabData = {
        url: li.dataset.url,
        title: li.dataset.title,
        favIconUrl: li.dataset.favIconUrl
    };
    event.dataTransfer.setData('application/vnd.tabmanager.tab+json', JSON.stringify(tabData));
    event.dataTransfer.effectAllowed = 'copy';

    setTimeout(() => li.classList.add('dragging-tab'), 0);
}

function handleOpenTabDragEnd(event) { // (Unchanged - relies on combined leave/end handlers now)
    console.log('[Drag] Ending drag for tab:', event.currentTarget.dataset.title);
    event.currentTarget.classList.remove('dragging-tab');
    // Highlights are removed in handleCardDragLeave and handleCollectionDragEnd
}


// --- Filtering for Open Tabs List ---
function filterOpenTabsList(filterText) { // (Unchanged)
    if (!openTabsList) return;
    const lowerCaseFilterText = filterText.toLowerCase();
    const items = openTabsList.querySelectorAll('.open-tab-item');
    let hasVisibleItems = false;

    items.forEach(item => {
        const title = (item.dataset.title || '').toLowerCase();
        const url = (item.dataset.url || '').toLowerCase();
        if (title.includes(lowerCaseFilterText) || url.includes(lowerCaseFilterText)) {
            item.style.display = '';
            hasVisibleItems = true;
        } else {
            item.style.display = 'none';
        }
    });

    let noResultsMsg = openTabsList.querySelector('.state-message.no-results');
    if (!hasVisibleItems && filterText) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('li');
            noResultsMsg.className = 'state-message no-results';
            noResultsMsg.textContent = 'No open tabs match search.';
            openTabsList.appendChild(noResultsMsg);
        }
        noResultsMsg.style.display = '';
    } else if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
    }
}


// --- Collection Card Creation & Actions (Using Combined Handlers) ---
function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.dataset.collectionId = collection.id;

    // *** Make the CARD itself draggable for reordering ***
    card.draggable = true;
    card.addEventListener('dragstart', handleCollectionDragStart); // For starting REORDER drag
    card.addEventListener('dragend', handleCollectionDragEnd);     // For ending REORDER drag

    // *** ADD COMBINED Listeners for Drag Over, Leave, and Drop ***
    card.addEventListener('dragover', handleCardDragOver);   // Combined handler
    card.addEventListener('dragleave', handleCardDragLeave); // Combined handler
    card.addEventListener('drop', handleCardDrop);         // Combined handler

    // --- Card Content (remains the same logic) ---
    const title = document.createElement('h2');
    title.textContent = collection.name;
    card.appendChild(title);

    const timestamp = document.createElement('p');
    timestamp.className = 'timestamp';
    const savedDate = collection.createdAt ? new Date(collection.createdAt).toLocaleString() : 'Date unknown';
    timestamp.textContent = `Saved: ${savedDate}`;
    card.appendChild(timestamp);

    const tabList = document.createElement('ul');
    tabList.className = 'tab-list';
    card.appendChild(tabList);

    const tabsToShow = collection.tabs || [];
    let showHideToggle = null;

    const renderTabs = (showAll = false) => { // Render tabs logic unchanged
        tabList.innerHTML = '';
        const limit = showAll ? tabsToShow.length : TABS_TO_SHOW_INITIALLY;
        const visibleTabs = tabsToShow.slice(0, limit);

        if (tabsToShow.length === 0) {
            tabList.innerHTML = '<li class="empty-collection-msg">This collection is empty.</li>';
        } else {
            visibleTabs.forEach(tab => {
                 if (tab && typeof tab === 'object' && tab.url) {
                    const li = createSavedTabListItem(tab, collection.id);
                    tabList.appendChild(li);
                 } else { console.warn('[Warn] Skipping invalid tab data:', collection.id, tab); }
            });
        }

        if (showHideToggle && showHideToggle.parentNode) { showHideToggle.remove(); showHideToggle = null; }
        if (tabsToShow.length > TABS_TO_SHOW_INITIALLY) {
            showHideToggle = document.createElement('button');
            showHideToggle.className = 'toggle-tabs-btn';
            showHideToggle.textContent = showAll ? `Show Less` : `Show All (${tabsToShow.length})`;
            showHideToggle.setAttribute('aria-expanded', showAll.toString());
            const nextShowAllState = !showAll;
            showHideToggle.onclick = (e) => { e.stopPropagation(); renderTabs(nextShowAllState); };
            tabList.insertAdjacentElement('afterend', showHideToggle);
        }
        updateCardActionCounts(card, tabsToShow.length);
    };
    card.__renderTabsFunc = renderTabs;

    renderTabs(false);

    const buttonGroup = document.createElement('div'); // Button logic unchanged
    buttonGroup.className = 'card-actions';
    const openAllButton = document.createElement('button');
    openAllButton.className = 'button open-all-btn';
    openAllButton.addEventListener('click', (e) => { e.stopPropagation(); openCollection(collection); });
    buttonGroup.appendChild(openAllButton);
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete Collection';
    deleteButton.className = 'button delete-btn';
    deleteButton.addEventListener('click', (e) => { e.stopPropagation(); deleteCollection(collection.id, collection.name); });
    buttonGroup.appendChild(deleteButton);
    card.appendChild(buttonGroup);
    updateCardActionCounts(card, tabsToShow.length);

    return card;
}


// --- Helper to create LI for saved tabs ---
function createSavedTabListItem(tab, collectionId) { // (Unchanged)
     const li = document.createElement('li');
     li.className = 'saved-tab-item';
     li.dataset.tabUrl = tab.url || '#';
     li.dataset.collectionId = collectionId;

     const img = document.createElement('img');
     img.className = 'favicon';
     img.src = tab.favIconUrl || 'icons/icon16.png';
     img.alt = '';
     img.onerror = function() { this.src = 'icons/icon16.png'; this.classList.add('favicon-fallback'); };
     li.appendChild(img);

     const linkContainer = document.createElement('span');
     linkContainer.className = 'tab-link-container';
     const a = document.createElement('a');
     a.href = tab.url || '#';
     a.textContent = tab.title || tab.url || 'Untitled';
     a.title = `${tab.title || 'No Title'}\n${tab.url || 'No URL'}`;
     a.target = '_blank';
     a.rel = 'noopener noreferrer';
     a.addEventListener('dblclick', handleEditTabStart);
     linkContainer.appendChild(a);
     li.appendChild(linkContainer);

     const deleteBtn = document.createElement('button');
     deleteBtn.className = 'delete-tab-btn';
     deleteBtn.textContent = 'x'; // Simple 'x'
     deleteBtn.title = 'Delete this tab';
     deleteBtn.setAttribute('aria-label', 'Delete this tab');
     deleteBtn.addEventListener('click', handleDeleteTab);
     li.appendChild(deleteBtn);

     return li;
}


// --- Helper to update counts in buttons ---
function updateCardActionCounts(cardElement, count) { // (Unchanged)
    const openAllBtn = cardElement.querySelector('.open-all-btn');
    if (openAllBtn) {
        openAllBtn.textContent = `Open All (${count})`;
        openAllBtn.disabled = count === 0;
    }
}


// --- Combined Drag/Drop Handlers for Cards ---

function handleCardDragOver(event) {
    const targetCard = event.currentTarget;
    const targetId = targetCard.dataset.collectionId;

    // CASE 1: Dragging a TAB over the card
    if (event.dataTransfer.types.includes('application/vnd.tabmanager.tab+json')) {
        // console.log(`[CardDragOver] Tab drag detected over card ${targetId}`);
        event.preventDefault(); // Allow drop for tabs
        event.dataTransfer.dropEffect = 'copy';
        targetCard.classList.add('drag-over-target'); // Use tab drop highlight
        targetCard.classList.remove('collection-drag-over'); // Ensure reorder highlight is off
    }
    // CASE 2: Dragging a COLLECTION for reordering over a DIFFERENT card
    else if (draggedCollectionId && targetId !== draggedCollectionId) {
        // console.log(`[CardDragOver] Reorder drag detected over card ${targetId}. Currently dragged: ${draggedCollectionId}`);
        event.preventDefault(); // Allow drop for reordering
        event.dataTransfer.dropEffect = 'move';
        targetCard.classList.add('collection-drag-over'); // Use reorder highlight
        targetCard.classList.remove('drag-over-target'); // Ensure tab highlight is off
    }
    // CASE 3: Other drag types or dragging collection over itself
    else {
        // console.log(`[CardDragOver] Invalid drag over card ${targetId}. Dragged: ${draggedCollectionId}, Types: ${Array.from(event.dataTransfer.types)}`);
        event.dataTransfer.dropEffect = 'none'; // Disallow drop
        targetCard.classList.remove('drag-over-target', 'collection-drag-over'); // Remove all highlights
    }
}

function handleCardDragLeave(event) {
    // Remove ALL potential highlights when leaving the card boundary
    // console.log(`[CardDragLeave] Leaving card ${event.currentTarget.dataset.collectionId}`);
    event.currentTarget.classList.remove('drag-over-target', 'collection-drag-over');
}

async function handleCardDrop(event) {
    const targetCard = event.currentTarget;
    const targetId = targetCard.dataset.collectionId;
    console.log(`[CardDrop] Drop detected on card ${targetId}. Dragged: ${draggedCollectionId}, Types: ${Array.from(event.dataTransfer.types)}`);

    // Remove highlights regardless of drop type
    targetCard.classList.remove('drag-over-target', 'collection-drag-over');

    // CASE 1: Dropping a TAB onto the card
    if (event.dataTransfer.types.includes('application/vnd.tabmanager.tab+json')) {
        console.log(`[CardDrop] Processing TAB drop onto ${targetId}`);
        event.preventDefault(); // Handle the drop
        event.stopPropagation(); // Stop bubbling (important!)

        const jsonData = event.dataTransfer.getData('application/vnd.tabmanager.tab+json');
        if (!jsonData) { console.warn('[Drop Tab] No valid tab data found.'); return; }

        let droppedTabData;
        try {
            droppedTabData = JSON.parse(jsonData);
            if (!droppedTabData || typeof droppedTabData !== 'object' || !droppedTabData.url) throw new Error("Invalid data format.");
        } catch (error) {
            console.error('[Error] Failed to parse dropped tab data:', error); return;
        }

        // --- Add Tab to Collection Logic ---
        try {
            const collectionIndex = allCollections.findIndex(c => c.id === targetId); // Use targetId here
            if (collectionIndex === -1) throw new Error("Target collection not found.");
            const targetCollection = allCollections[collectionIndex];
            if (!Array.isArray(targetCollection.tabs)) { targetCollection.tabs = []; }

            const alreadyExists = targetCollection.tabs.some(tab => tab && tab.url === droppedTabData.url);
            if (alreadyExists) {
                console.log('[Drop Tab] Tab already exists:', droppedTabData.url);
                targetCard.classList.add('drop-duplicate');
                setTimeout(() => targetCard.classList.remove('drop-duplicate'), 1000);
                return;
            }

            const newTab = { url: droppedTabData.url, title: droppedTabData.title, favIconUrl: droppedTabData.favIconUrl };
            targetCollection.tabs.push(newTab);
            console.log('[Drop Tab] Tab added in memory. New count:', targetCollection.tabs.length);

            await chrome.storage.local.set({ tabCollections: allCollections });
            console.log('[Drop Tab] Storage updated.');

            const renderFunc = targetCard.__renderTabsFunc;
            if (renderFunc) {
                 const shouldShowAll = targetCard.querySelector('.toggle-tabs-btn')?.getAttribute('aria-expanded') === 'true';
                 renderFunc(shouldShowAll);
            } else { console.error("Render function not found on card!"); }

            targetCard.classList.add('drop-success');
            setTimeout(() => targetCard.classList.remove('drop-success'), 600);

        } catch (error) {
            console.error('[Error] Failed to handle tab drop logic:', error);
            alert("An error occurred adding the tab.");
        }
        // --- End Add Tab Logic ---
    }
    // CASE 2: Dropping a COLLECTION for reordering
    else if (draggedCollectionId && draggedCollectionId !== targetId) {
        console.log(`[CardDrop] Processing REORDER drop. Moving ${draggedCollectionId} before ${targetId}`);
        event.preventDefault(); // Handle the drop
        event.stopPropagation(); // Stop bubbling

        // --- Reorder Collection Logic ---
        const draggedIndex = allCollections.findIndex(c => c.id === draggedCollectionId);
        // Find original target index *before* modifying the array for logging/comparison
        const targetIndexOriginal = allCollections.findIndex(c => c.id === targetId);

        if (draggedIndex === -1 || targetIndexOriginal === -1) {
            console.error('[Error] Could not find dragged or target collection in array during drop.');
            // Reset draggedCollectionId in dragend
            return;
        }

        // 1. Remove the dragged item and store it
        const [draggedItem] = allCollections.splice(draggedIndex, 1);

        // 2. Find the target index *after* the dragged item has been removed
        const newTargetIndex = allCollections.findIndex(c => c.id === targetId);

        if (newTargetIndex === -1) {
             // This case means the target was somehow removed or mutated between finding it initially
             // and finding it after splice. This shouldn't normally happen.
             console.error("[Error] Target index became invalid after splice during drop. Aborting reorder.");
             // Put the item back where it was to avoid losing it
             allCollections.splice(draggedIndex, 0, draggedItem);
             // Reset draggedCollectionId in dragend
             return;
        }

        // 3. Insert the dragged item *before* the target item in its new position
        allCollections.splice(newTargetIndex, 0, draggedItem);
        console.log(`[Drop Reorder] Moved item from original index ${draggedIndex} to new index ${newTargetIndex}`);
        console.log('[Drop Reorder] New Order in memory (IDs):', JSON.stringify(allCollections.map(c => c.id)));


        try {
            // 4. Save the newly ordered array to storage
            await chrome.storage.local.set({ tabCollections: allCollections });
            console.log('[Drop Reorder] New collection order saved to storage.');
        } catch (error) {
            console.error('[Error] Failed to save reordered collections:', error);
            alert("Error saving the new collection order. Attempting to reload.");
            // Attempt to revert in-memory change before reloading
            const itemToRevert = allCollections.splice(newTargetIndex, 1)[0];
            allCollections.splice(draggedIndex, 0, itemToRevert);
            await loadInitialCollections(); // Reload as a recovery measure
            // Reset draggedCollectionId in dragend
            return;
        }

        // 5. Re-render the collections using the updated `allCollections` order, applying the current filter.
        console.log('[Drop Reorder] Re-rendering collections with new order.');
        displayCollections(filterCollections(allCollections, currentFilter)); // Re-render UI

        // --- End Reorder Logic ---

    } else {
        console.log(`[CardDrop] Drop ignored. Dragged: ${draggedCollectionId}, Target: ${targetId}`);
    }

    // NOTE: draggedCollectionId is reset in handleCollectionDragEnd
}


// --- Handlers for Collection Drag Start/End (Keep these separate) ---

function handleCollectionDragStart(event) {
    // Ensure we don't interfere if something inside the card initiated drag (like text selection)
    const interactiveElement = event.target.closest('a, button, input, .tab-list, .toggle-tabs-btn');
    if (interactiveElement) {
         console.log('[Drag Reorder] Drag start ignored on interactive element:', interactiveElement);
         event.preventDefault(); // Prevent drag start on these elements
         return;
    }

    const card = event.currentTarget;
    draggedCollectionId = card.dataset.collectionId;
    // Use text/plain for simple ID transfer, sometimes helps compatibility
    event.dataTransfer.setData('text/plain', draggedCollectionId);
    event.dataTransfer.effectAllowed = 'move';

    // Use a timeout to allow the browser to render the drag image before applying the class
    setTimeout(() => {
        card.classList.add('dragging-collection');
    }, 0);
    console.log(`[Drag Reorder] Starting drag for collection ID: ${draggedCollectionId}`);
}

// newtab.js (Complete Code - Combined Event Handlers Version - Final Part)

function handleCollectionDragEnd(event) {
    const card = event.currentTarget; // The card that was dragged
    console.log(`[Drag Reorder] Ending drag for collection ID: ${draggedCollectionId}`);

    // Clean up styling on the source element AND all potential targets
    card.classList.remove('dragging-collection');
    document.querySelectorAll('.collection-drag-over, .drag-over-target').forEach(el => {
        el.classList.remove('collection-drag-over', 'drag-over-target');
    });

    // Crucially, reset the global tracking variable
    draggedCollectionId = null;
}


// --- Handler for Deleting Individual Tab ---
async function handleDeleteTab(event) { // (Unchanged)
    event.stopPropagation(); // Prevent card actions from triggering if clicking 'x'
    const li = event.currentTarget.closest('.saved-tab-item');
    if (!li) return;
    const tabUrlToDelete = li.dataset.tabUrl;
    const collectionId = li.dataset.collectionId;
    const cardElement = li.closest('.collection-card');
    if (!tabUrlToDelete || !collectionId || !cardElement) {
        console.warn('[Delete Tab] Missing data attributes on LI or parent card.');
        return;
    }

    console.log(`[Delete Tab] Request: URL ${tabUrlToDelete} from Coll ${collectionId}`);

    try {
        const collectionIndex = allCollections.findIndex(c => c.id === collectionId);
        if (collectionIndex === -1) throw new Error("Collection not found in memory");
        const targetCollection = allCollections[collectionIndex];
        if (!Array.isArray(targetCollection.tabs)) {
            console.warn(`[Delete Tab] Collection ${collectionId} has no 'tabs' array.`);
            targetCollection.tabs = []; // Initialize if missing
        }

        const initialTabCount = targetCollection.tabs.length;
        // Filter out the tab(s) matching the URL
        targetCollection.tabs = targetCollection.tabs.filter(t => !(t && t.url === tabUrlToDelete));

        if (targetCollection.tabs.length < initialTabCount) {
             console.log(`[Delete Tab] Removed tab(s) matching URL ${tabUrlToDelete}. New count: ${targetCollection.tabs.length}`);
             // Update storage only if a change occurred
             await chrome.storage.local.set({ tabCollections: allCollections });
             console.log('[Delete Tab] Storage updated.');

             // Re-render tabs within the card using its stored function
             const renderFunc = cardElement.__renderTabsFunc;
             if(renderFunc) {
                  const shouldShowAll = cardElement.querySelector('.toggle-tabs-btn')?.getAttribute('aria-expanded') === 'true';
                  renderFunc(shouldShowAll); // This will update counts via updateCardActionCounts
             } else {
                  console.error("[Delete Tab] Render function not found on card after delete!");
                  // Fallback: Manually remove LI and update count if render func missing
                  li.remove();
                  updateCardActionCounts(cardElement, targetCollection.tabs.length);
             }
        } else {
            console.warn(`[Delete Tab] Tab URL ${tabUrlToDelete} not found in collection ${collectionId} to delete.`);
            // Optionally remove the LI even if data wasn't found, to sync UI
            li.remove();
             updateCardActionCounts(cardElement, targetCollection.tabs.length); // Update count even if UI removed manually
        }
    } catch (error) {
        console.error("[Error] Failed to delete tab:", error);
        alert("Error deleting tab.");
    }
}

// --- Handlers for Editing Individual Tab Title ---
function handleEditTabStart(event) { // (Unchanged)
    console.log('[Edit Tab Debug] handleEditTabStart triggered!');
    event.preventDefault(); event.stopPropagation();
    const linkElement = event.currentTarget;
    const linkContainer = linkElement.parentElement;
    const liElement = linkElement.closest('.saved-tab-item');
    if (!linkContainer || !liElement || linkContainer.querySelector('.edit-tab-input')) return; // Already editing?

    const currentTitle = linkElement.textContent;
    const tabUrl = liElement.dataset.tabUrl;
    const collectionId = liElement.dataset.collectionId;
    console.log(`[Edit Tab] Start: "${currentTitle}" for URL ${tabUrl} in Coll ${collectionId}`);
    linkElement.style.display = 'none'; // Hide link
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-tab-input';
    input.value = currentTitle;
    input.dataset.originalTitle = currentTitle; // Store original
    input.dataset.tabUrl = tabUrl;             // Store identifiers
    input.dataset.collectionId = collectionId;
    input.addEventListener('blur', handleEditTabEnd);      // Save on blur
    input.addEventListener('keydown', handleEditTabKeydown); // Handle Enter/Escape
    linkContainer.appendChild(input);
    input.focus(); input.select(); // Focus and select text
}

function handleEditTabKeydown(event) { // (Unchanged)
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission if wrapped in one
        event.currentTarget.blur(); // Trigger blur event to save/cancel
    } else if (event.key === 'Escape') {
        event.currentTarget.removeEventListener('blur', handleEditTabEnd); // Prevent saving on blur
        cancelTabEdit(event.currentTarget); // Cancel edit immediately
    }
}

function handleEditTabEnd(event) { // (Unchanged) - Simple proxy to save
    saveTabEdit(event.currentTarget);
}

async function saveTabEdit(inputElement) { // (Unchanged)
    const newTitle = inputElement.value.trim();
    const originalTitle = inputElement.dataset.originalTitle;
    const tabUrl = inputElement.dataset.tabUrl;
    const collectionId = inputElement.dataset.collectionId;
    console.log(`[Edit Tab] Save attempt. New: "${newTitle}", Orig: "${originalTitle}"`);
    const linkContainer = inputElement.parentElement;
    const linkElement = linkContainer ? linkContainer.querySelector('a') : null;

    // Cancel if title is empty or unchanged
    if (newTitle === "" || newTitle === originalTitle) {
        console.log('[Edit Tab] Title empty or unchanged, cancelling.');
        cancelTabEdit(inputElement, linkElement);
        return;
    }

    try {
        const collectionIndex = allCollections.findIndex(c => c.id === collectionId);
        if (collectionIndex === -1) throw new Error("Collection not found");
        const targetCollection = allCollections[collectionIndex];
        if (!Array.isArray(targetCollection.tabs)) throw new Error("Tabs array missing");

        const tab = targetCollection.tabs.find(t => t && t.url === tabUrl);
        if (!tab) throw new Error(`Tab with URL ${tabUrl} not found in collection ${collectionId}`);

        tab.title = newTitle; // Update title in memory
        console.log(`[Edit Tab] Title updated in memory for URL: ${tabUrl}`);

        await chrome.storage.local.set({ tabCollections: allCollections }); // Save updated collections
        console.log('[Edit Tab] Storage updated.');

        // Update the UI
        if (linkElement) {
            linkElement.textContent = newTitle;
            linkElement.title = `${newTitle}\n${tabUrl || 'No URL'}`; // Update tooltip
            linkElement.style.display = ''; // Show link again
        }
        inputElement.remove(); // Remove the input field

    } catch (error) {
        console.error("[Error] Failed to save edited tab title:", error);
        alert("Error saving tab title.");
        cancelTabEdit(inputElement, linkElement); // Revert UI on error
    }
}

function cancelTabEdit(inputElement, linkElement = null) { // (Unchanged)
    console.log('[Edit Tab] Cancelling edit.');
    // If linkElement wasn't passed, try to find it
    if (!linkElement && inputElement.parentElement) {
        linkElement = inputElement.parentElement.querySelector('a');
    }
    // Show the original link again
    if (linkElement) {
        linkElement.style.display = '';
    }
    // Remove the input field safely
    try {
        inputElement.remove();
    } catch(e) {
        // Ignore if already removed
    }
}


// --- Sidebar Save Action ---
async function handleSaveOpenTabs() { // (Unchanged logic, adds to start of allCollections)
    console.log('[Action] Save Open Tabs button clicked.');
    if (!currentWindowId) { setSidebarStatus("Error: No window ID.", 'error', 4000); return; }

    const collectionName = prompt("Enter name for the new collection:", `Collection ${new Date().toLocaleDateString()}`); // Suggest a name
    if (collectionName === null || collectionName.trim() === "") { // Handle empty/cancel prompt
        setStatus("Save cancelled.", 'info', 3000);
        return;
    }
    const finalName = collectionName.trim();

    setSidebarStatus('Saving...', 'info');
    if(saveOpenTabsBtn) saveOpenTabsBtn.disabled = true;

    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        const tabsToSave = tabs
            .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:') && !tab.pinned)
            .map(tab => ({
                title: tab.title || tab.url.split('/')[2] || 'Untitled',
                url: tab.url,
                favIconUrl: tab.favIconUrl || null // Store favicon
            }));

        if (tabsToSave.length === 0) {
             setSidebarStatus('No relevant tabs to save.', 'warning', 4000); // Use warning
             throw new Error("No tabs"); // Still throw to break execution
        }

        const newCollection = {
            id: Date.now().toString(), // Simple unique enough ID
            name: finalName,
            createdAt: new Date().toISOString(), // Track creation time
            tabs: tabsToSave
        };

        // Add to the beginning of the main array (newest first by default for *new* saves)
        allCollections.unshift(newCollection); // Add to start

        // Save the updated array (with new item at the start)
        await chrome.storage.local.set({ tabCollections: allCollections });
        console.log('[Save Sidebar] Saved to storage. New collection ID:', newCollection.id);

        // Re-render main grid, applying current filter
        displayCollections(filterCollections(allCollections, currentFilter));

        let closedTabs = false;
        if (closeOpenTabsCheckbox && closeOpenTabsCheckbox.checked) {
            // Get IDs of the tabs that were actually saved
            const savedUrls = new Set(tabsToSave.map(t => t.url));
            const tabIdsToClose = tabs
                .filter(t => t.url && savedUrls.has(t.url)) // Filter tabs whose URLs were saved
                .map(t => t.id);
            if (tabIdsToClose.length > 0) {
                 await chrome.tabs.remove(tabIdsToClose);
                 closedTabs = true;
                 console.log('[Save Sidebar] Closed', tabIdsToClose.length, 'tabs.');
            }
        }

        setSidebarStatus(`Saved "${finalName}"!`, 'success', 3000);
        if (closedTabs) {
            await displayOpenTabs(); // Refresh sidebar list if tabs were closed
        }
        // Optionally clear checkbox
        // if (closeOpenTabsCheckbox) closeOpenTabsCheckbox.checked = false;

    } catch (error) {
        if (error.message !== "No tabs") { // Avoid double message if error was no tabs found
             console.error("[Error] Failed to save open tabs:", error);
             setSidebarStatus("Error saving. Check console.", 'error', 5000);
        }
    } finally {
         if(saveOpenTabsBtn) saveOpenTabsBtn.disabled = false; // Re-enable button
    }
}

// Helper for Sidebar Status Messages
function setSidebarStatus(message, type = 'info', duration = 0) { // (Unchanged)
    if (!sidebarStatusDiv) return;
    sidebarStatusDiv.textContent = message;
    sidebarStatusDiv.className = `status-message status-${type}`; // Ensure class corresponds to styles.css
    // Clear message after duration
    if (duration > 0) {
        // Use a timeout to clear the message
        setTimeout(() => {
            // Only clear if the message hasn't changed in the meantime
            if (sidebarStatusDiv.textContent === message) {
                 sidebarStatusDiv.textContent = '';
                 sidebarStatusDiv.className = 'status-message';
            }
        }, duration);
    }
}

// --- Collection Actions (Open/Delete) ---
async function openCollection(collection) { // (Unchanged)
   console.log(`[Action] Opening collection: ${collection.name} (ID: ${collection.id})`);
   const tabsToOpen = collection.tabs || [];
   if (tabsToOpen.length === 0) {
       console.log('[Action] Collection is empty, not opening tabs.');
       return; // Don't open anything if empty
   }
   for (const tab of tabsToOpen) {
       if (tab && tab.url) {
          try {
              // Open tabs in the background
              await chrome.tabs.create({ url: tab.url, active: false });
          }
          catch (error) {
              console.error(`[Error] Failed to open tab: ${tab.url}`, error);
              // Maybe show a notification to the user?
          }
       } else {
           console.warn('[Warn] Skipping tab with missing URL:', tab);
       }
   }
   // Attempt to focus the window where tabs were opened (best effort)
   try {
      const window = await chrome.windows.getCurrent({ populate: false });
      if (window && window.id) {
          await chrome.windows.update(window.id, { focused: true });
      }
   } catch(e) {
       console.warn('[Warn] Could not focus window after opening tabs.', e)
   }
}

async function deleteCollection(collectionId, collectionName) { // (Unchanged logic)
    console.log(`[Action] Attempting to delete collection: ${collectionName} (${collectionId})`);
    if (!confirm(`Delete collection "${collectionName}"?\nThis cannot be undone.`)) {
        console.log('[Action] Delete cancelled by user.');
        return;
    }

    try {
        // Filter the collection out of the main array
        const initialLength = allCollections.length;
        allCollections = allCollections.filter(c => c && c.id !== collectionId);

        if (allCollections.length < initialLength) {
            // Save the updated array back to storage
            await chrome.storage.local.set({ tabCollections: allCollections });
            console.log('[Debug] Storage updated after deleting collection', collectionId);
             // Re-render the display immediately
            console.log('[Debug] In-memory list updated. New count:', allCollections.length);
            displayCollections(filterCollections(allCollections, currentFilter));
            console.log(`[Action] Deleted collection: ${collectionName} (${collectionId})`);
        } else {
            console.warn('[Warn] Collection ID', collectionId, 'not found in memory for deletion.');
             // Optionally force a reload if state seems inconsistent
             // await loadInitialCollections();
        }

    } catch (error) {
        console.error("[Error] during collection deletion:", error);
        alert("Error deleting collection.");
         await loadInitialCollections(); // Reload all on error as a recovery measure
    }
}