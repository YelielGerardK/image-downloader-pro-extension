// Handle downloads
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadImages') {
        downloadImages(request.images);
    }
});

// Download images
async function downloadImages(imageUrls) {
    console.log(`Downloading ${imageUrls.length} images...`);
    
    for (let i = 0; i < imageUrls.length; i++) {
        const url = imageUrls[i];
        const filename = generateFilename(url, i);
        
        try {
            await chrome.downloads.download({
                url: url,
                filename: `ImageDownloader/${filename}`,
                saveAs: false,
                conflictAction: 'uniquify'
            });
            
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`Download error ${url}:`, error);
        }
    }
}

// Generate a filename
function generateFilename(url, index) {
    try {
        // Try to extract the name from the URL
        const urlObj = new URL(url);
        let filename = urlObj.pathname.split('/').pop();
        
        // If no valid name, use a default one
        if (!filename || !filename.includes('.')) {
            const extension = getExtensionFromUrl(url);
            filename = `image_${Date.now()}_${index}.${extension}`;
        }
        
        // Clean up the filename
        filename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        
        return filename;
    } catch (e) {
        return `image_${Date.now()}_${index}.jpg`;
    }
}

// Get extension from URL
function getExtensionFromUrl(url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match) {
        return match[1].toLowerCase();
    }
    
    // For data URLs
    if (url.startsWith('data:image/')) {
        const typeMatch = url.match(/data:image\/([a-zA-Z0-9]+);/);
        if (typeMatch) {
            return typeMatch[1] === 'jpeg' ? 'jpg' : typeMatch[1];
        }
    }
    
    return 'jpg';
}

// Handle installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Image Downloader Pro successfully installed!');
});