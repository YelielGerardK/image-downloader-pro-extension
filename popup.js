// Application state
let state = {
    images: [],
    selectedImages: new Set(),
    isScanning: false
};

// DOM elements
const elements = {
    totalImages: document.getElementById('totalImages'),
    selectedImages: document.getElementById('selectedImages'),
    downloadCount: document.getElementById('downloadCount'),
    scanBtn: document.getElementById('scanBtn'),
    viewBtn: document.getElementById('viewBtn'),
    selectAllBtn: document.getElementById('selectAllBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    status: document.getElementById('status'),
    includeBackground: document.getElementById('includeBackground'),
    autoDetect: document.getElementById('autoDetect'),
    minWidth: document.getElementById('minWidth'),
    minHeight: document.getElementById('minHeight'),
    imageTypes: document.getElementById('imageTypes')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateUI();
    
    // If auto-detect is enabled, scan automatically
    if (elements.autoDetect.checked) {
        scanImages();
    }
});

// Load saved state
async function loadState() {
    // Check if we are still on the same tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tab?.url || '';
    const lastUrl = (await chrome.storage.local.get('lastUrl')).lastUrl;
    
    // Reset state if URL has changed
    if (currentUrl && currentUrl !== lastUrl) {
        state.images = [];
        state.selectedImages = new Set();
        await chrome.storage.local.set({ lastUrl: currentUrl });
        return;  // Do not load previous state
    }
    
    // Load existing state
    const result = await chrome.storage.local.get(['images', 'selectedImages', 'options']);
    if (result.images) {
        state.images = result.images;
    }
    if (result.selectedImages) {
        state.selectedImages = new Set(result.selectedImages);
    }
    if (result.options) {
        elements.includeBackground.checked = result.options.includeBackground ?? true;
        elements.autoDetect.checked = result.options.autoDetect ?? true;
        elements.minWidth.value = result.options.minWidth ?? 100;
        elements.minHeight.value = result.options.minHeight ?? 100;
    }
}

// Save state
async function saveState() {
    await chrome.storage.local.set({
        images: state.images,
        selectedImages: Array.from(state.selectedImages),
        options: {
            includeBackground: elements.includeBackground.checked,
            autoDetect: elements.autoDetect.checked,
            minWidth: parseInt(elements.minWidth.value),
            minHeight: parseInt(elements.minHeight.value)
        }
    });
}

// Update the interface
function updateUI() {
    elements.totalImages.textContent = state.images.length;
    elements.selectedImages.textContent = state.selectedImages.size;
    elements.downloadCount.textContent = state.selectedImages.size;
    
    elements.downloadBtn.disabled = state.selectedImages.size === 0;
    elements.viewBtn.disabled = state.images.length === 0;
    elements.selectAllBtn.disabled = state.images.length === 0;
}

// Scan images
async function scanImages() {
    if (state.isScanning) return;
    
    state.isScanning = true;
    elements.scanBtn.disabled = true;
    showStatus('Scan in progress...', 'info');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check if we can inject on this page
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            showStatus('Cannot scan this page', 'error');
            return;
        }
        
        // Try to send a message to check if the content script is present
        try {
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'ping'
            });
        } catch (e) {
            // If the content script is not present, inject it
            console.log('Injecting content script...');
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            
            // Wait a bit for the script to load
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Now send the real command
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'scanImages',
            options: {
                includeBackground: elements.includeBackground.checked,
                minWidth: parseInt(elements.minWidth.value),
                minHeight: parseInt(elements.minHeight.value),
                imageTypes: Array.from(elements.imageTypes.selectedOptions).map(o => o.value)
            }
        });
        
        if (response && response.images) {
            state.images = response.images;
            await saveState();
            updateUI();
            showStatus(`${response.images.length} images found`, 'success');
        }
    } catch (error) {
        showStatus('Error during scan', 'error');
        console.error(error);
    } finally {
        state.isScanning = false;
        elements.scanBtn.disabled = false;
    }
}

// View images
async function viewImages() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check if the content script is present
        try {
            await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
        } catch (e) {
            // Inject the content script if needed
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        chrome.tabs.sendMessage(tab.id, {
            action: 'showImageGrid',
            images: state.images,
            selectedImages: Array.from(state.selectedImages)
        });
        
        window.close();
    } catch (error) {
        showStatus('Error displaying images', 'error');
        console.error(error);
    }
}

// View images
async function viewImages() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, {
        action: 'showImageGrid',
        images: state.images,
        selectedImages: Array.from(state.selectedImages)
    });
    
    window.close();
}

// Select/deselect all
function toggleSelectAll() {
    if (state.selectedImages.size === state.images.length) {
        state.selectedImages.clear();
    } else {
        state.images.forEach(img => state.selectedImages.add(img.src));
    }
    
    saveState();
    updateUI();
}

// Download selected images
async function downloadSelected() {
    if (state.selectedImages.size === 0) return;
    
    elements.downloadBtn.disabled = true;
    showStatus('Downloading...', 'info');
    
    const selectedArray = Array.from(state.selectedImages);
    let downloaded = 0;
    
    for (let i = 0; i < selectedArray.length; i++) {
        const url = selectedArray[i];
        const filename = `image_${Date.now()}_${i}.jpg`;
        
        try {
            await chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: false
            });
            downloaded++;
        } catch (error) {
            console.error(`Download error ${url}:`, error);
        }
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    showStatus(`${downloaded} images downloaded`, 'success');
    elements.downloadBtn.disabled = false;
}

// Show status message
function showStatus(message, type = 'info') {
    elements.status.textContent = message;
    elements.status.className = 'status ' + type;
    
    setTimeout(() => {
        elements.status.textContent = '';
        elements.status.className = 'status';
    }, 3000);
}

// Event handlers
elements.scanBtn.addEventListener('click', scanImages);
elements.viewBtn.addEventListener('click', viewImages);
elements.selectAllBtn.addEventListener('click', toggleSelectAll);
elements.downloadBtn.addEventListener('click', downloadSelected);

// Save options when they change
elements.includeBackground.addEventListener('change', saveState);
elements.autoDetect.addEventListener('change', saveState);
elements.minWidth.addEventListener('change', saveState);
elements.minHeight.addEventListener('change', saveState);

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateSelection') {
        state.selectedImages = new Set(request.selectedImages);
        saveState();
        updateUI();
    }
});