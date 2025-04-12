// newtab.js (Full Code with Collection Name Editing)

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
const addNewCollectionBtn = document.getElementById('addNewCollectionBtn');
// Popup Elements
const instructionsPopup = document.getElementById('instructionsPopup');
const showInstructionsBtn = document.getElementById('showInstructionsBtn');
const popupCloseBtn = instructionsPopup ? instructionsPopup.querySelector('.popup-close-btn') : null;

// --- Configuration & State ---
const TABS_TO_SHOW_INITIALLY = 5;
let allCollections = [];
let currentFilter = '';
let currentWindowId = null;
let draggedCollectionId = null;

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initializeNewTabPage);

if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
} else {
    console.error('[Error] Search input #searchInput NOT FOUND.');
}
if (saveOpenTabsBtn) {
    saveOpenTabsBtn.addEventListener('click', handleSaveOpenTabs);
} else {
     console.error('[Error] Sidebar Save button #saveOpenTabsBtn not found.');
}
if (addNewCollectionBtn) {
    addNewCollectionBtn.addEventListener('click', handleAddNewCollection);
} else {
    console.error('[Error] Add New Collection button #addNewCollectionBtn not found.');
}
if (showInstructionsBtn && instructionsPopup) {
    showInstructionsBtn.addEventListener('click', () => instructionsPopup.classList.remove('hidden'));
}
if (popupCloseBtn && instructionsPopup) {
    popupCloseBtn.addEventListener('click', () => instructionsPopup.classList.add('hidden'));
}
if (instructionsPopup) {
    instructionsPopup.addEventListener('click', (event) => {
        if (event.target === instructionsPopup) instructionsPopup.classList.add('hidden');
    });
}
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && instructionsPopup && !instructionsPopup.classList.contains('hidden')) {
        instructionsPopup.classList.add('hidden');
    }
});

// --- Initialization ---
async function initializeNewTabPage() {
    console.log('[Debug] Initializing New Tab Page...');
    try {
        const window = await chrome.windows.getCurrent({ populate: false });
        currentWindowId = window.id;
    } catch (error) {
         console.error('[Error] Could not get current window:', error);
         if (openTabsList) openTabsList.innerHTML = '<li class="state-message error">Could not get window info.</li>';
    }
    await loadInitialCollections();
    if(currentWindowId && openTabsList) {
       await displayOpenTabs();
    } else if (openTabsList) {
        openTabsList.innerHTML = '<li class="state-message error">Could not load open tabs.</li>';
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
        allCollections = data.tabCollections || [];
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
    if (!searchInput) return;
    currentFilter = searchInput.value.toLowerCase().trim();
    const filteredCollections = filterCollections(allCollections, currentFilter);
    displayCollections(filteredCollections);
    if (openTabsList) { filterOpenTabsList(currentFilter); }
}

function filterCollections(collections, filterText) {
    if (!filterText) { return collections; }
    const lowerCaseFilterText = filterText.toLowerCase();
    return collections.filter(collection =>
        (collection.name && collection.name.toLowerCase().includes(lowerCaseFilterText)) ||
        (collection.tabs || []).some(tab =>
            (tab.title && tab.title.toLowerCase().includes(lowerCaseFilterText)) ||
            (tab.url && tab.url.toLowerCase().includes(lowerCaseFilterText))
        )
    );
}

function displayCollections(collectionsToDisplay) {
    const scrollY = window.scrollY;
    Array.from(collectionsContainer.querySelectorAll('.collection-card')).forEach(card => card.remove());

    // Ensure message elements exist and are positioned correctly
    if (!document.getElementById('loadingMessage')) collectionsContainer.prepend(loadingMessage);
    if (!document.getElementById('emptyStateMessage')) collectionsContainer.appendChild(emptyStateMessage);
    if (!document.getElementById('noResultsMessage')) collectionsContainer.appendChild(noResultsMessage);

    emptyStateMessage.style.display = 'none';
    noResultsMessage.style.display = 'none';
    loadingMessage.style.display = 'none';

    if (allCollections.length === 0 && !currentFilter) {
        emptyStateMessage.style.display = 'block';
    } else if (collectionsToDisplay.length === 0 && currentFilter) {
        noResultsMessage.style.display = 'block';
    } else if (collectionsToDisplay.length > 0) {
        collectionsToDisplay.forEach(collection => {
            if (collection && collection.id && collection.name) {
                 const card = createCollectionCard(collection);
                 collectionsContainer.insertBefore(card, emptyStateMessage);
            } else {
                 console.warn('[Warn] Skipping invalid collection object:', collection);
            }
        });
    } else {
         if (allCollections.length === 0) {
            emptyStateMessage.style.display = 'block';
         }
    }
    window.scrollTo(0, scrollY);
}

// --- Open Tabs Display Logic ---
async function displayOpenTabs() {
    if (!openTabsList || !currentWindowId) return;
    openTabsList.innerHTML = '<li class="state-message">Loading...</li>';
    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        openTabsList.innerHTML = '';
        if (!tabs || tabs.length === 0) {
            openTabsList.innerHTML = '<li class="state-message">No open tabs found.</li>'; return;
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
             openTabsList.innerHTML = '<li class="state-message">No relevant tabs.</li>';
        }
    } catch (error) {
        console.error('[Error] Failed to display open tabs:', error);
        openTabsList.innerHTML = '<li class="state-message error">Error loading tabs.</li>';
    }
}

function createOpenTabListItem(tab) {
    const li = document.createElement('li');
    li.className = 'open-tab-item';
    li.dataset.url = tab.url || '#';
    li.dataset.title = tab.title || tab.url || 'Untitled Tab';
    li.dataset.favIconUrl = tab.favIconUrl || 'icons/icon16.png';
    li.draggable = true;
    li.addEventListener('dragstart', handleOpenTabDragStart);
    li.addEventListener('dragend', handleOpenTabDragEnd);

    const img = document.createElement('img');
    img.className = 'favicon';
    img.src = li.dataset.favIconUrl;
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function() { this.src = 'icons/icon16.png'; this.classList.add('favicon-fallback'); };
    li.appendChild(img);

    const span = document.createElement('span');
    span.className = 'open-tab-title';
    span.textContent = li.dataset.title;
    span.title = `${li.dataset.title}\n${li.dataset.url}`;
    li.appendChild(span);
    return li;
}

// --- Drag Handlers for Open Tabs ---
function handleOpenTabDragStart(event) {
    const li = event.currentTarget;
    const tabData = { url: li.dataset.url, title: li.dataset.title, favIconUrl: li.dataset.favIconUrl };
    event.dataTransfer.setData('application/vnd.tabmanager.tab+json', JSON.stringify(tabData));
    event.dataTransfer.effectAllowed = 'copy';
    setTimeout(() => li.classList.add('dragging-tab'), 0);
}
function handleOpenTabDragEnd(event) {
    event.currentTarget.classList.remove('dragging-tab');
}

// --- Filtering for Open Tabs List ---
function filterOpenTabsList(filterText) {
    if (!openTabsList) return;
    const lowerCaseFilterText = filterText.toLowerCase();
    const items = openTabsList.querySelectorAll('.open-tab-item');
    let hasVisibleItems = false;
    items.forEach(item => {
        const title = (item.dataset.title || '').toLowerCase();
        const url = (item.dataset.url || '').toLowerCase();
        if (title.includes(lowerCaseFilterText) || url.includes(lowerCaseFilterText)) {
            item.style.display = ''; hasVisibleItems = true;
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

// --- Collection Card Creation & Actions ---
function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'collection-card';
    card.dataset.collectionId = collection.id;
    card.draggable = true;
    card.addEventListener('dragstart', handleCollectionDragStart);
    card.addEventListener('dragend', handleCollectionDragEnd);
    card.addEventListener('dragover', handleCardDragOver);
    card.addEventListener('dragleave', handleCardDragLeave);
    card.addEventListener('drop', handleCardDrop);

    const title = document.createElement('h2');
    title.textContent = collection.name;
    // **** ADD DBLCLICK LISTENER FOR EDITING ****
    title.addEventListener('dblclick', handleEditCollectionNameStart);
    card.appendChild(title);

    const timestamp = document.createElement('p');
    timestamp.className = 'timestamp';
    const savedDate = collection.createdAt ? new Date(collection.createdAt).toLocaleString() : 'Date unknown';
    timestamp.textContent = `Saved: ${savedDate}`;
    card.appendChild(timestamp);

    const tabList = document.createElement('ul');
    tabList.className = 'tab-list';
    card.appendChild(tabList);
    let showHideToggle = null;

    const renderTabs = (showAll = false) => {
        const currentCollectionData = allCollections.find(c => c.id === card.dataset.collectionId);
        const latestTabsToShow = currentCollectionData ? (currentCollectionData.tabs || []) : [];
        tabList.innerHTML = '';
        const limit = showAll ? latestTabsToShow.length : TABS_TO_SHOW_INITIALLY;
        const visibleTabs = latestTabsToShow.slice(0, limit);
        if (latestTabsToShow.length === 0) {
            tabList.innerHTML = '<li class="empty-collection-msg">This collection is empty.</li>';
        } else {
            visibleTabs.forEach(tab => {
                 if (tab && typeof tab === 'object' && tab.url) {
                    const li = createSavedTabListItem(tab, card.dataset.collectionId);
                    tabList.appendChild(li);
                 } else { console.warn('[Warn] Skipping invalid tab data:', card.dataset.collectionId, tab); }
            });
        }
        if (showHideToggle && showHideToggle.parentNode) { showHideToggle.remove(); showHideToggle = null; }
        if (latestTabsToShow.length > TABS_TO_SHOW_INITIALLY) {
            showHideToggle = document.createElement('button');
            showHideToggle.className = 'toggle-tabs-btn';
            showHideToggle.textContent = showAll ? `Show Less` : `Show All (${latestTabsToShow.length})`;
            showHideToggle.setAttribute('aria-expanded', showAll.toString());
            const nextShowAllState = !showAll;
            showHideToggle.onclick = (e) => { e.stopPropagation(); renderTabs(nextShowAllState); };
            tabList.insertAdjacentElement('afterend', showHideToggle);
        }
        updateCardActionCounts(card, latestTabsToShow.length);
    };
    card.__renderTabsFunc = renderTabs;
    renderTabs(false);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'card-actions';
    const openAllButton = document.createElement('button');
    openAllButton.className = 'button open-all-btn';
    openAllButton.addEventListener('click', (e) => { e.stopPropagation(); openCollection(collection); });
    buttonGroup.appendChild(openAllButton);
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete Collection';
    deleteButton.className = 'button delete-btn';
    deleteButton.addEventListener('click', (e) => { e.stopPropagation(); deleteCollection(card.dataset.collectionId, collection.name); });
    buttonGroup.appendChild(deleteButton);
    card.appendChild(buttonGroup);
    updateCardActionCounts(card, (collection.tabs || []).length);

    return card;
}

// --- Helper to create LI for saved tabs ---
function createSavedTabListItem(tab, collectionId) {
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
     a.addEventListener('dblclick', handleEditTabStart); // Tab title edit
     linkContainer.appendChild(a);
     li.appendChild(linkContainer);
     const deleteBtn = document.createElement('button');
     deleteBtn.className = 'delete-tab-btn';
     deleteBtn.textContent = 'x';
     deleteBtn.title = 'Delete this tab';
     deleteBtn.setAttribute('aria-label', 'Delete this tab');
     deleteBtn.addEventListener('click', handleDeleteTab);
     li.appendChild(deleteBtn);
     return li;
}

// --- Helper to update counts in buttons ---
function updateCardActionCounts(cardElement, count) {
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
    if (event.dataTransfer.types.includes('application/vnd.tabmanager.tab+json')) {
        event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
        targetCard.classList.add('drag-over-target');
        targetCard.classList.remove('collection-drag-over');
    } else if (draggedCollectionId && targetId !== draggedCollectionId) {
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        targetCard.classList.add('collection-drag-over');
        targetCard.classList.remove('drag-over-target');
    } else {
        event.dataTransfer.dropEffect = 'none';
        targetCard.classList.remove('drag-over-target', 'collection-drag-over');
    }
}
function handleCardDragLeave(event) {
    event.currentTarget.classList.remove('drag-over-target', 'collection-drag-over');
}
async function handleCardDrop(event) {
    const targetCard = event.currentTarget;
    const targetId = targetCard.dataset.collectionId;
    targetCard.classList.remove('drag-over-target', 'collection-drag-over');

    // CASE 1: Drop Tab
    if (event.dataTransfer.types.includes('application/vnd.tabmanager.tab+json')) {
        event.preventDefault(); event.stopPropagation();
        const jsonData = event.dataTransfer.getData('application/vnd.tabmanager.tab+json');
        if (!jsonData) return;
        let droppedTabData;
        try { droppedTabData = JSON.parse(jsonData); if (!droppedTabData?.url) throw "err"; }
        catch (error) { console.error('[Error] Parsing dropped tab data:', error); return; }

        try {
            const collectionIndex = allCollections.findIndex(c => c.id === targetId);
            if (collectionIndex === -1) throw new Error("Target collection not found.");
            const targetCollection = allCollections[collectionIndex];
            if (!Array.isArray(targetCollection.tabs)) targetCollection.tabs = [];
            const alreadyExists = targetCollection.tabs.some(tab => tab?.url === droppedTabData.url);
            if (alreadyExists) {
                targetCard.classList.add('drop-duplicate');
                setTimeout(() => targetCard.classList.remove('drop-duplicate'), 1000); return;
            }
            const newTab = { url: droppedTabData.url, title: droppedTabData.title, favIconUrl: droppedTabData.favIconUrl };
            targetCollection.tabs.push(newTab);
            await chrome.storage.local.set({ tabCollections: allCollections });
            const renderFunc = targetCard.__renderTabsFunc;
            if (renderFunc) renderFunc(targetCard.querySelector('.toggle-tabs-btn')?.getAttribute('aria-expanded') === 'true');
            else console.error("Render function not found on card!");
            targetCard.classList.add('drop-success');
            setTimeout(() => targetCard.classList.remove('drop-success'), 600);
        } catch (error) { console.error('[Error] Handling tab drop:', error); alert("Error adding tab."); }
    }
    // CASE 2: Drop Collection for Reorder
    else if (draggedCollectionId && draggedCollectionId !== targetId) {
        event.preventDefault(); event.stopPropagation();
        const draggedIndex = allCollections.findIndex(c => c.id === draggedCollectionId);
        const targetIndexOriginal = allCollections.findIndex(c => c.id === targetId);
        if (draggedIndex === -1 || targetIndexOriginal === -1) { console.error('Drag/target error'); return; }
        const [draggedItem] = allCollections.splice(draggedIndex, 1);
        const newTargetIndex = allCollections.findIndex(c => c.id === targetId);
        if (newTargetIndex === -1) { console.error("Target index invalid post-splice"); allCollections.splice(draggedIndex, 0, draggedItem); return; }
        allCollections.splice(newTargetIndex, 0, draggedItem);
        try {
            await chrome.storage.local.set({ tabCollections: allCollections });
            displayCollections(filterCollections(allCollections, currentFilter));
        } catch (error) {
            console.error('[Error] Saving reordered collections:', error); alert("Error saving order.");
            const itemToRevert = allCollections.splice(newTargetIndex, 1)[0];
            allCollections.splice(draggedIndex, 0, itemToRevert); // Attempt revert
            await loadInitialCollections(); // Recover
        }
    }
}

// --- Handlers for Collection Drag Start/End ---
function handleCollectionDragStart(event) {
    const interactiveElement = event.target.closest('a, button, input, .tab-list, .toggle-tabs-btn, h2'); // Add h2
    // Allow drag *only* if the target is NOT interactive OR if it's the h2 and NOT currently being edited
    if (interactiveElement && (interactiveElement.tagName !== 'H2' || interactiveElement.parentElement.querySelector('.edit-collection-name-input'))) {
        console.log('[Drag Reorder] Drag start ignored on interactive/editing element:', interactiveElement);
        event.preventDefault(); return;
    }
    const card = event.currentTarget;
    draggedCollectionId = card.dataset.collectionId;
    event.dataTransfer.setData('text/plain', draggedCollectionId);
    event.dataTransfer.effectAllowed = 'move';
    setTimeout(() => card.classList.add('dragging-collection'), 0);
    console.log(`[Drag Reorder] Starting drag for collection ID: ${draggedCollectionId}`);
}
function handleCollectionDragEnd(event) {
    const card = event.currentTarget;
    console.log(`[Drag Reorder] Ending drag for collection ID: ${draggedCollectionId}`);
    card.classList.remove('dragging-collection');
    document.querySelectorAll('.collection-drag-over, .drag-over-target').forEach(el => {
        el.classList.remove('collection-drag-over', 'drag-over-target');
    });
    draggedCollectionId = null;
}

// --- Handler for Deleting Individual Tab ---
async function handleDeleteTab(event) {
    event.stopPropagation();
    const li = event.currentTarget.closest('.saved-tab-item'); if (!li) return;
    const tabUrlToDelete = li.dataset.tabUrl;
    const collectionId = li.dataset.collectionId;
    const cardElement = li.closest('.collection-card');
    if (!tabUrlToDelete || !collectionId || !cardElement) return;
    try {
        const collectionIndex = allCollections.findIndex(c => c.id === collectionId);
        if (collectionIndex === -1) throw new Error("Collection not found");
        const targetCollection = allCollections[collectionIndex];
        if (!Array.isArray(targetCollection.tabs)) targetCollection.tabs = [];
        const initialTabCount = targetCollection.tabs.length;
        targetCollection.tabs = targetCollection.tabs.filter(t => !(t?.url === tabUrlToDelete));
        if (targetCollection.tabs.length < initialTabCount) {
             await chrome.storage.local.set({ tabCollections: allCollections });
             const renderFunc = cardElement.__renderTabsFunc;
             if(renderFunc) renderFunc(cardElement.querySelector('.toggle-tabs-btn')?.getAttribute('aria-expanded') === 'true');
             else { console.error("Render func not found"); li.remove(); updateCardActionCounts(cardElement, targetCollection.tabs.length); }
        } else {
             console.warn(`Tab URL ${tabUrlToDelete} not found in ${collectionId}`);
             li.remove(); updateCardActionCounts(cardElement, targetCollection.tabs.length);
        }
    } catch (error) { console.error("[Error] deleting tab:", error); alert("Error deleting tab."); }
}

// --- Handlers for Editing Individual Tab Title ---
function handleEditTabStart(event) {
    event.preventDefault(); event.stopPropagation();
    const linkElement = event.currentTarget;
    const linkContainer = linkElement.parentElement;
    const liElement = linkElement.closest('.saved-tab-item');
    if (!linkContainer || !liElement || linkContainer.querySelector('.edit-tab-input')) return; // Already editing?
    const currentTitle = linkElement.textContent;
    const tabUrl = liElement.dataset.tabUrl;
    const collectionId = liElement.dataset.collectionId;
    linkElement.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'edit-tab-input'; // Reuse class
    input.value = currentTitle;
    input.dataset.originalTitle = currentTitle;
    input.dataset.tabUrl = tabUrl;
    input.dataset.collectionId = collectionId;
    input.addEventListener('blur', handleEditTabEnd);
    input.addEventListener('keydown', handleEditTabKeydown);
    linkContainer.appendChild(input);
    input.focus(); input.select();
}
function handleEditTabKeydown(event) {
    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
    else if (event.key === 'Escape') { event.currentTarget.removeEventListener('blur', handleEditTabEnd); cancelTabEdit(event.currentTarget); }
}
function handleEditTabEnd(event) { saveTabEdit(event.currentTarget); }
async function saveTabEdit(inputElement) {
    const newTitle = inputElement.value.trim();
    const originalTitle = inputElement.dataset.originalTitle;
    const tabUrl = inputElement.dataset.tabUrl;
    const collectionId = inputElement.dataset.collectionId;
    const linkContainer = inputElement.parentElement;
    const linkElement = linkContainer?.querySelector('a');
    if (newTitle === "" || newTitle === originalTitle) { cancelTabEdit(inputElement, linkElement); return; }
    try {
        const collectionIndex = allCollections.findIndex(c => c.id === collectionId);
        if (collectionIndex === -1) throw new Error("Collection not found");
        const targetCollection = allCollections[collectionIndex];
        if (!Array.isArray(targetCollection.tabs)) throw new Error("Tabs array missing");
        const tab = targetCollection.tabs.find(t => t?.url === tabUrl);
        if (!tab) throw new Error(`Tab URL ${tabUrl} not found`);
        tab.title = newTitle;
        await chrome.storage.local.set({ tabCollections: allCollections });
        if (linkElement) {
            linkElement.textContent = newTitle;
            linkElement.title = `${newTitle}\n${tabUrl || 'No URL'}`;
            linkElement.style.display = '';
        }
        inputElement.remove();
    } catch (error) { console.error("[Error] saving tab title:", error); alert("Error saving tab title."); cancelTabEdit(inputElement, linkElement); }
}
function cancelTabEdit(inputElement, linkElement = null) {
    if (!linkElement && inputElement.parentElement) linkElement = inputElement.parentElement.querySelector('a');
    if (linkElement) linkElement.style.display = '';
    try { inputElement.remove(); } catch(e) { /* ignore */ }
}

// --- **** NEW Handlers for Editing Collection Name **** ---
function handleEditCollectionNameStart(event) {
    event.stopPropagation(); // Prevent card drag/actions
    const titleElement = event.currentTarget; // The H2 element
    const cardElement = titleElement.closest('.collection-card');
    if (!cardElement || cardElement.querySelector('.edit-collection-name-input')) return; // Already editing?

    const collectionId = cardElement.dataset.collectionId;
    const currentName = titleElement.textContent;
    console.log(`[Edit Collection] Start: "${currentName}" for Coll ${collectionId}`);

    titleElement.style.display = 'none'; // Hide H2

    const input = document.createElement('input');
    input.type = 'text';
    // Add a specific class for potential styling, but reuse base styles
    input.className = 'edit-tab-input edit-collection-name-input';
    input.value = currentName;
    input.dataset.originalName = currentName;
    input.dataset.collectionId = collectionId;

    input.addEventListener('blur', handleEditCollectionNameEnd); // Save on blur
    input.addEventListener('keydown', handleEditCollectionNameKeydown); // Handle Enter/Escape

    // Insert the input *after* the H2 element in the DOM
    titleElement.insertAdjacentElement('afterend', input);
    input.focus();
    input.select();
}

function handleEditCollectionNameKeydown(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.currentTarget.blur(); // Trigger save/cancel via blur
    } else if (event.key === 'Escape') {
        // Important: remove blur listener *before* calling cancel to prevent saving
        event.currentTarget.removeEventListener('blur', handleEditCollectionNameEnd);
        cancelCollectionNameEdit(event.currentTarget);
    }
}

function handleEditCollectionNameEnd(event) {
    // Simply triggers the save function when the input loses focus
    saveCollectionNameEdit(event.currentTarget);
}

async function saveCollectionNameEdit(inputElement) {
    const newName = inputElement.value.trim();
    const originalName = inputElement.dataset.originalName;
    const collectionId = inputElement.dataset.collectionId;
    const cardElement = inputElement.closest('.collection-card');
    const titleElement = cardElement ? cardElement.querySelector('h2') : null;

    console.log(`[Edit Collection] Save attempt. New: "${newName}", Orig: "${originalName}"`);

    // Validate: Cancel if empty or unchanged
    if (newName === "" || newName === originalName) {
        console.log('[Edit Collection] Name empty or unchanged, cancelling.');
        cancelCollectionNameEdit(inputElement, titleElement);
        return;
    }

    try {
        // Find the collection in the master list
        const collectionIndex = allCollections.findIndex(c => c.id === collectionId);
        if (collectionIndex === -1) {
            throw new Error(`Collection with ID ${collectionId} not found in allCollections.`);
        }

        // Update the name in the master list
        allCollections[collectionIndex].name = newName;
        console.log(`[Edit Collection] Name updated in memory for ID: ${collectionId}`);

        // Save the entire updated list back to storage
        await chrome.storage.local.set({ tabCollections: allCollections });
        console.log('[Edit Collection] Storage updated.');

        // Update the UI
        if (titleElement) {
            titleElement.textContent = newName; // Update the H2 text
        }
        // Clean up UI (show H2, remove input) handled in cancel implicitly
        cancelCollectionNameEdit(inputElement, titleElement); // Reuse cancel to clean up UI

    } catch (error) {
        console.error("[Error] Failed to save edited collection name:", error);
        alert("Error saving collection name. Check console.");
        // Revert UI on error by calling cancel
        cancelCollectionNameEdit(inputElement, titleElement);
    }
}

function cancelCollectionNameEdit(inputElement, titleElement = null) {
    console.log('[Edit Collection] Cleaning up edit UI.');
    const cardElement = inputElement.closest('.collection-card');
    // If titleElement wasn't passed, try to find it
    if (!titleElement && cardElement) {
        titleElement = cardElement.querySelector('h2');
    }

    // Show the H2 element again
    if (titleElement) {
        titleElement.style.display = '';
    }

    // Remove the input field safely
    try {
        inputElement.remove();
    } catch(e) {
        // Ignore if already removed, e.g., during rapid clicks/blurs
    }
}
// --- **** END Handlers for Editing Collection Name **** ---


// --- Sidebar Actions ---
async function handleSaveOpenTabs() {
    if (!currentWindowId) { setSidebarStatus("Error: No window ID.", 'error', 4000); return; }
    const collectionName = prompt("Enter name for the new collection:", `Collection ${new Date().toLocaleDateString()}`);
    if (collectionName === null || collectionName.trim() === "") { setSidebarStatus("Save cancelled.", 'info', 3000); return; }
    const finalName = collectionName.trim();
    setSidebarStatus('Saving...', 'info');
    if(saveOpenTabsBtn) saveOpenTabsBtn.disabled = true;
    try {
        const tabs = await chrome.tabs.query({ windowId: currentWindowId });
        const tabsToSave = tabs
            .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:') && !t.pinned)
            .map(t => ({ title: t.title||t.url.split('/')[2]||'Untitled', url: t.url, favIconUrl: t.favIconUrl||null }));
        if (tabsToSave.length === 0) { setSidebarStatus('No relevant tabs to save.', 'warning', 4000); throw new Error("No tabs"); }
        const newCollection = { id: Date.now().toString(), name: finalName, createdAt: new Date().toISOString(), tabs: tabsToSave };
        allCollections.unshift(newCollection);
        await chrome.storage.local.set({ tabCollections: allCollections });
        displayCollections(filterCollections(allCollections, currentFilter));
        let closedTabs = false;
        if (closeOpenTabsCheckbox?.checked) {
            const savedUrls = new Set(tabsToSave.map(t => t.url));
            const tabIdsToClose = tabs.filter(t => t.id && t.url && savedUrls.has(t.url)).map(t => t.id);
            if (tabIdsToClose.length > 0) { await chrome.tabs.remove(tabIdsToClose); closedTabs = true; }
        }
        setSidebarStatus(`Saved "${finalName}"!`, 'success', 3000);
        if (closedTabs) await displayOpenTabs();
    } catch (error) { if (error.message !== "No tabs") { console.error("[Error] saving open tabs:", error); setSidebarStatus("Error saving.", 'error', 5000); } }
    finally { if(saveOpenTabsBtn) saveOpenTabsBtn.disabled = false; }
}
async function handleAddNewCollection() {
    const collectionName = prompt("Enter name for the new empty collection:", "");
    if (collectionName === null) { setSidebarStatus("Create cancelled.", 'info', 3000); return; }
    const finalName = collectionName.trim();
    if (finalName === "") { setSidebarStatus("Name cannot be empty.", 'warning', 3000); return; }
    if (addNewCollectionBtn) addNewCollectionBtn.disabled = true;
    setSidebarStatus('Creating...', 'info');
    let newCollection; // Define here for potential revert in error
    try {
        newCollection = { id: Date.now().toString(), name: finalName, createdAt: new Date().toISOString(), tabs: [] };
        allCollections.unshift(newCollection);
        await chrome.storage.local.set({ tabCollections: allCollections });
        displayCollections(filterCollections(allCollections, currentFilter));
        setSidebarStatus(`Created "${finalName}"!`, 'success', 3000);
        setTimeout(() => {
            const newCard = collectionsContainer.querySelector(`.collection-card[data-collection-id="${newCollection.id}"]`);
            if (newCard) newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } catch (error) {
        console.error("[Error] creating empty collection:", error);
        setSidebarStatus("Error creating.", 'error', 5000);
        if (newCollection && allCollections[0]?.id === newCollection.id) allCollections.shift(); // Revert add
    } finally {
        if (addNewCollectionBtn) addNewCollectionBtn.disabled = false;
    }
}
function setSidebarStatus(message, type = 'info', duration = 0) {
    if (!sidebarStatusDiv) return;
    if (sidebarStatusDiv.timerId) clearTimeout(sidebarStatusDiv.timerId);
    sidebarStatusDiv.textContent = message;
    sidebarStatusDiv.className = `status-message status-${type}`;
    if (duration > 0) {
        sidebarStatusDiv.timerId = setTimeout(() => {
            if (sidebarStatusDiv.textContent === message) {
                 sidebarStatusDiv.textContent = ''; sidebarStatusDiv.className = 'status-message'; sidebarStatusDiv.timerId = null;
            }
        }, duration);
    }
}

// --- Collection Actions (Open/Delete) ---
async function openCollection(collection) {
   const tabsToOpen = collection.tabs || [];
   if (tabsToOpen.length === 0) { alert(`Collection "${collection.name}" is empty.`); return; }
   for (const tab of tabsToOpen) {
       if (tab?.url) {
          try { await chrome.tabs.create({ url: tab.url, active: false }); }
          catch (error) { console.error(`Error opening tab: ${tab.url}`, error); alert(`Error opening: ${tab.title||tab.url}`); }
       } else { console.warn('Skipping tab missing URL:', tab); }
   }
   try {
      const window = await chrome.windows.getCurrent({ populate: false });
      if (window?.id) await chrome.windows.update(window.id, { focused: true });
   } catch(e) { console.warn('Could not focus window.', e) }
}
async function deleteCollection(collectionId, collectionName) {
    if (!confirm(`Delete collection "${collectionName}"?\nThis cannot be undone.`)) return;
    try {
        const initialLength = allCollections.length;
        allCollections = allCollections.filter(c => c?.id !== collectionId);
        if (allCollections.length < initialLength) {
            await chrome.storage.local.set({ tabCollections: allCollections });
            displayCollections(filterCollections(allCollections, currentFilter));
            setSidebarStatus(`Deleted "${collectionName}"`, 'info', 4000);
        } else {
            console.warn('Collection ID', collectionId, 'not found for deletion.');
            setSidebarStatus(`Could not find "${collectionName}"`, 'error', 4000);
        }
    } catch (error) {
        console.error("[Error] deleting collection:", error);
        setSidebarStatus(`Error deleting "${collectionName}"`, 'error', 5000);
         await loadInitialCollections(); // Recover
    }
}