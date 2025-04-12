const saveButton = document.getElementById('saveButton');
const collectionNameInput = document.getElementById('collectionName');
const closeTabsCheckbox = document.getElementById('closeTabsCheckbox');
const statusDiv = document.getElementById('status');

// Helper to set status message
function setStatus(message, type = 'info', duration = 0) {
    statusDiv.textContent = message;
    statusDiv.className = `status-${type}`; // Use classes for styling

    if (duration > 0) {
        setTimeout(() => {
            if (statusDiv.textContent === message) { // Clear only if message hasn't changed
                 statusDiv.textContent = '';
                 statusDiv.className = '';
            }
        }, duration);
    }
}

saveButton.addEventListener('click', async () => {
    const collectionName = collectionNameInput.value.trim();
    if (!collectionName) {
        setStatus('Please enter a collection name.', 'error', 3000);
        collectionNameInput.focus();
        return;
    }

    setStatus('Saving...', 'info');
    saveButton.disabled = true; // Disable button while saving

    try {
        // 1. Get current window's tabs
        const tabs = await chrome.tabs.query({ currentWindow: true });

        // Filter out extension pages, internal pages, etc. and map data including favicon
        const tabsToSave = tabs
            .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:') && !tab.pinned)
            .map(tab => ({
                title: tab.title || tab.url.split('/')[2] || 'Untitled Tab', // Better fallback title
                url: tab.url,
                favIconUrl: tab.favIconUrl || null // Store the favicon URL
            }));

        if (tabsToSave.length === 0) {
             setStatus('No relevant tabs found to save.', 'error', 4000);
             saveButton.disabled = false;
             return;
        }

        // 2. Create new collection object
        const newCollection = {
            id: Date.now().toString(),
            name: collectionName,
            createdAt: new Date().toISOString(),
            tabs: tabsToSave
        };

        // 3. Load existing collections, add the new one, save back
        const data = await chrome.storage.local.get('tabCollections');
        const collections = data.tabCollections || [];
        collections.push(newCollection);
        await chrome.storage.local.set({ tabCollections: collections });

        // 4. Optionally close the saved tabs
        let closedTabs = false;
        if (closeTabsCheckbox.checked) {
            const tabIdsToClose = tabs
                .filter(tab => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:') && !tab.pinned)
                .map(tab => tab.id);

            if (tabIdsToClose.length > 0) {
                 await chrome.tabs.remove(tabIdsToClose);
                 closedTabs = true;
            }
        }

        setStatus(`Saved "${collectionName}"!`, 'success', 2500);
        collectionNameInput.value = ''; // Clear input on success

        // Optional: Close popup slightly faster, maybe open new tab if tabs were closed
        setTimeout(() => {
            // if (closedTabs) {
            //     chrome.tabs.create({ url: 'newtab.html' }); // Optional: Focus new tab page
            // }
            window.close();
        }, closedTabs ? 800 : 1500);


    } catch (error) {
        console.error("Error saving collection:", error);
        setStatus('Error saving collection. Check console.', 'error', 5000);
        saveButton.disabled = false; // Re-enable button on error
    }
    // No need for finally block if we re-enable button only on error path for this logic
});

// Suggest a name based on active tab (optional enhancement)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].title && !collectionNameInput.value) {
        // Simple suggestion - could be made smarter
        // collectionNameInput.value = tabs[0].title.substring(0, 50);
    }
});