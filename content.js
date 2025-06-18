// Global variables
let imageGrid = null;
let observer = null;


// Listen to messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({ status: 'ok' });
    } else if (request.action === 'scanImages') {
        const images = scanAllImages(request.options);
        sendResponse({ images: images });
    } else if (request.action === 'showImageGrid') {
        showImageGrid(request.images, request.selectedImages);
    }
    return true;
});


// Scan all images on the page
function scanAllImages(options) {
    const images = [];
    const processedUrls = new Set();
    
    // Scan <img> tags
    document.querySelectorAll('img').forEach(img => {
        if (img.src && !processedUrls.has(img.src) && isValidImage(img, options)) {
            processedUrls.add(img.src);
            images.push({
                src: img.src,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                alt: img.alt || '',
                type: getImageType(img.src)
            });
        }
    });
    
    // Scan background images if requested
    if (options.includeBackground) {
        document.querySelectorAll('*').forEach(element => {
            const bgImage = window.getComputedStyle(element).backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const matches = bgImage.match(/url\(["']?(.+?)["']?\)/g);
                if (matches) {
                    matches.forEach(match => {
                        const url = match.replace(/url\(["']?(.+?)["']?\)/, '$1');
                        if (url && !processedUrls.has(url) && isValidImageUrl(url, options)) {
                            processedUrls.add(url);
                            images.push({
                                src: url,
                                width: 0,
                                height: 0,
                                alt: 'Background image',
                                type: getImageType(url)
                            });
                        }
                    });
                }
            }
        });
    }
    
    // Scan images in canvas
    document.querySelectorAll('canvas').forEach((canvas, index) => {
        try {
            const dataUrl = canvas.toDataURL('image/png');
            if (!processedUrls.has(dataUrl)) {
                processedUrls.add(dataUrl);
                images.push({
                    src: dataUrl,
                    width: canvas.width,
                    height: canvas.height,
                    alt: `Canvas ${index}`,
                    type: 'png'
                });
            }
        } catch (e) {
            // Ignore security errors
        }
    });
    
    return images;
}

// Check if an image is valid based on filters
function isValidImage(img, options) {
    // Check URL
    if (!img.src || !img.src.startsWith('http') && !img.src.startsWith('data:')) {
        return false;
    }
    
    // Check dimensions
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    if (width < options.minWidth || height < options.minHeight) {
        return false;
    }
    
    // Check type
    const type = getImageType(img.src);
    if (!options.imageTypes.includes(type)) {
        return false;
    }
    
    return true;
}

// Check if a URL is valid
function isValidImageUrl(url, options) {
    if (!url || !url.startsWith('http') && !url.startsWith('data:')) {
        return false;
    }
    
    const type = getImageType(url);
    return options.imageTypes.includes(type);
}

// Get image type from URL
function getImageType(url) {
    const extension = url.split('.').pop().toLowerCase().split('?')[0];
    
    if (['jpg', 'jpeg'].includes(extension)) return 'jpg';
    if (extension === 'png') return 'png';
    if (extension === 'gif') return 'gif';
    if (extension === 'webp') return 'webp';
    if (extension === 'svg') return 'svg';
    if (url.startsWith('data:image/')) {
        const match = url.match(/data:image\/(\w+);/);
        if (match) return match[1];
    }
    
    return 'jpg'; // Default
}

// Display image grid
function showImageGrid(images, selectedImages) {
    // Remove existing grid if it exists
    if (imageGrid) {
        imageGrid.remove();
    }
    
    // Create new grid
    imageGrid = document.createElement('div');
    imageGrid.id = 'image-downloader-grid';
    imageGrid.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        z-index: 999999;
        overflow: auto;
        padding: 20px;
    `;
    
    // Create grid container
    const container = document.createElement('div');
    container.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
        max-width: 1400px;
        margin: 0 auto;
        padding-bottom: 80px;
    `;
    
    // Create control bar
    const controlBar = document.createElement('div');
    controlBar.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0, 0, 0, 0.9);
        padding: 15px;
        display: flex;
        justify-content: center;
        gap: 10px;
        z-index: 1000000;
    `;
    
    const selectedCount = document.createElement('span');
    selectedCount.style.cssText = `
        color: white;
        padding: 10px;
        font-size: 16px;
    `;
    
    const selectAllBtn = createButton('Select All', '#2196F3');
    const downloadBtn = createButton('Download', '#4CAF50');
    const closeBtn = createButton('Close', '#f44336');
    
    controlBar.appendChild(selectedCount);
    controlBar.appendChild(selectAllBtn);
    controlBar.appendChild(downloadBtn);
    controlBar.appendChild(closeBtn);
    
    // Create image elements
    const selectedSet = new Set(selectedImages);
    
    images.forEach((imgData, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = `
            background: white;
            border: 3px solid ${selectedSet.has(imgData.src) ? '#4CAF50' : 'transparent'};
            cursor: pointer;
            padding: 5px;
            position: relative;
            transition: all 0.2s;
        `;
        
        const img = document.createElement('img');
        img.src = imgData.src;
        img.style.cssText = `
            width: 100%;
            height: 200px;
            object-fit: contain;
        `;
        
        const info = document.createElement('div');
        info.style.cssText = `
            position: absolute;
            bottom: 5px;
            left: 5px;
            right: 5px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px;
            font-size: 11px;
            display: none;
        `;
        info.textContent = `${imgData.width}x${imgData.height} - ${imgData.type.toUpperCase()}`;
        
        wrapper.appendChild(img);
        wrapper.appendChild(info);
        container.appendChild(wrapper);
        
        // Events
        wrapper.addEventListener('mouseenter', () => {
            info.style.display = 'block';
        });
        
        wrapper.addEventListener('mouseleave', () => {
            info.style.display = 'none';
        });
        
        wrapper.addEventListener('click', () => {
            if (selectedSet.has(imgData.src)) {
                selectedSet.delete(imgData.src);
                wrapper.style.borderColor = 'transparent';
            } else {
                selectedSet.add(imgData.src);
                wrapper.style.borderColor = '#4CAF50';
            }
            updateSelectedCount();
        });
    });
    
    // Update functions
    function updateSelectedCount() {
        selectedCount.textContent = `${selectedSet.size} selected`;
        
        // Send update to popup
        chrome.runtime.sendMessage({
            action: 'updateSelection',
            selectedImages: Array.from(selectedSet)
        });
    }
    
    // Event handlers
    selectAllBtn.addEventListener('click', () => {
        const allWrappers = container.querySelectorAll('div');
        
        if (selectedSet.size === images.length) {
            selectedSet.clear();
            allWrappers.forEach(w => w.style.borderColor = 'transparent');
        } else {
            images.forEach(img => selectedSet.add(img.src));
            allWrappers.forEach(w => w.style.borderColor = '#4CAF50');
        }
        updateSelectedCount();
    });
    
    downloadBtn.addEventListener('click', () => {
        if (selectedSet.size === 0) {
            alert('No images selected');
            return;
        }
        
        // Send images to download to background script
        chrome.runtime.sendMessage({
            action: 'downloadImages',
            images: Array.from(selectedSet)
        });
    });
    
    closeBtn.addEventListener('click', () => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        imageGrid.remove();
        imageGrid = null;
    });
    
    // Ajouter au DOM
    imageGrid.appendChild(container);
    imageGrid.appendChild(controlBar);
    document.body.appendChild(imageGrid);
    
    updateSelectedCount();
    
    // Observe for new images
    if (!observer) {
        observer = new MutationObserver((mutations) => {
            // Rescan the page after changes
            setTimeout(() => {
                const newImages = scanAllImages({ 
                    includeBackground: true, 
                    minWidth: 0, 
                    minHeight: 0,
                    imageTypes: ['jpg', 'png', 'gif', 'webp', 'svg']
                });
                
                // Add only new images
                const existingUrls = new Set(images.map(img => img.src));
                const addedImages = newImages.filter(img => !existingUrls.has(img.src));
                
                if (addedImages.length > 0) {
                    console.log(`${addedImages.length} new images detected`);
                    // You can add logic here to add these images to the grid
                }
            }, 500);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'style']
        });
    }
}

// Create a button
function createButton(text, color) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
        padding: 10px 20px;
        background: ${color};
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s;
    `;
    
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
    });
    
    return button;
}