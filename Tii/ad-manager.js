/**
 * ad-manager.js
 * * Handles local storage CRUD operations for ads and controls the carousel logic.
 */

// --- AD DATA MANAGEMENT ---

const AD_STORAGE_KEY = 'advertisements';
// Placeholder image used when an ad is created without a file upload (or for image loading errors)
const PLACEHOLDER_IMAGE_BASE64 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

// Carousel State and Configuration
let currentSlideIndex = 0;
const intervalDuration = 5000;
let autoSlideInterval = null;
const MOBILE_BREAKPOINT = 900; 


// --- ADMIN UTILITIES (Exported for ad-upload.html and ad-delete.html) ---

/**
 * Retrieves all ads from localStorage. Returns an empty array if none exist.
 */
export function getAds() {
    let ads;
    try {
        ads = JSON.parse(localStorage.getItem(AD_STORAGE_KEY));
    } catch (e) {
        console.error("Error reading ads from localStorage:", e);
        ads = [];
    }
    if (!ads || !Array.isArray(ads)) {
        ads = [];
        localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(ads));
    }
    return ads;
}

/**
 * Saves the current list of advertisements back to localStorage.
 * @param {Array<Object>} ads - The array of ad objects to save.
 */
function saveAds(ads) {
    try {
        localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(ads));
    } catch (e) {
        console.error("Error writing ads to localStorage:", e);
    }
}


/**
 * Adds a new ad to storage.
 * @param {Object} newAd - The ad object containing title, text, link, cta, and image (Base64 string or URL).
 */
export function addAd(newAd) {
    const ads = getAds();
    // Generate the next sequential ID
    const newId = ads.length > 0 ? Math.max(...ads.map(ad => ad.id)) + 1 : 1;
    newAd.id = newId;

    // Ensure the image field exists (will be Base64 or URL)
    if (!newAd.image) {
        newAd.image = PLACEHOLDER_IMAGE_BASE64;
    }

    ads.push(newAd);
    saveAds(ads);
    // If we're on index.html (the carousel), re-render it immediately
    if (document.getElementById('ad-slides-container')) {
        renderAdsToBanner();
    }
}

/**
 * Deletes an ad by its ID.
 * @param {number} adId - The ID of the ad to delete.
 * @returns {boolean} True if the ad was deleted, false otherwise.
 */
export function deleteAd(adId) {
    let ads = getAds();
    const initialLength = ads.length;
    ads = ads.filter(ad => ad.id !== adId);
    
    if (ads.length < initialLength) {
        saveAds(ads);
        // If we're on index.html (the carousel), re-render it immediately
        if (document.getElementById('ad-slides-container')) {
             renderAdsToBanner();
        }
        return true;
    }
    return false;
}


// --- CAROUSEL LOGIC ---

/**
 * Resets the auto-slide timer.
 */
function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    const ads = getAds();
    if (ads.length > 1) {
        autoSlideInterval = setInterval(nextSlide, intervalDuration);
    }
}

/**
 * Advances to the next slide.
 */
function nextSlide() {
    const slides = document.querySelectorAll('#ad-slides-container .ad-slide');
    if (slides.length === 0) return;
    currentSlideIndex = (currentSlideIndex + 1) % slides.length;
    updateDisplay();
}

/**
 * Goes to the previous slide.
 */
function prevSlide() {
    const slides = document.querySelectorAll('#ad-slides-container .ad-slide');
    if (slides.length === 0) return;
    currentSlideIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
    updateDisplay();
}

/**
 * Updates the carousel's visual state (mobile stacking, desktop fading).
 */
function updateDisplay() {
    const slides = Array.from(document.querySelectorAll('#ad-slides-container .ad-slide'));
    const prevBtn = document.getElementById('ad-prev-btn');
    const nextBtn = document.getElementById('ad-next-btn');

    if (!slides.length) return;

    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;

    slides.forEach((slide, index) => {
        slide.classList.remove('active-slide');
        const imageContainer = slide.querySelector('.ad-image-container');
        const textContent = slide.querySelector('.ad-text-content');

        // --- MOBILE STYLING ADJUSTMENTS (Stacking Effect) ---
        if (isMobile) {
            const offset = index - currentSlideIndex;
            // The logic below ensures only the current and the next two slides are visible and stacked
            if (offset === 0) {
                slide.style.zIndex = 3;
                slide.style.transform = 'translate(0, 0)';
                slide.style.opacity = 1;
            } else if (offset === 1) {
                slide.style.zIndex = 2;
                slide.style.transform = 'translate(5px, 5px) scale(0.98)';
                slide.style.opacity = 1;
            } else if (offset === 2) {
                slide.style.zIndex = 1;
                slide.style.transform = 'translate(10px, 10px) scale(0.96)';
                slide.style.opacity = 1;
            } else {
                slide.style.zIndex = 0;
                slide.style.transform = 'scale(0.9)'; 
                slide.style.opacity = 0; // Hide slides further away
            }
            if (imageContainer) imageContainer.style.display = '';
            if (textContent) textContent.style.width = '';

        } else {
            // --- DESKTOP STYLING ADJUSTMENTS (Fading Effect) ---
            slide.style.transform = '';
            slide.style.zIndex = '';
            slide.style.opacity = ''; // Reset opacity for desktop CSS control
            if (imageContainer) imageContainer.style.display = 'block';
            if (textContent) textContent.style.width = '50%';
        }
    });

    // Set the active slide
    slides[currentSlideIndex].classList.add('active-slide');

    // Button visibility is handled below in renderAdsToBanner for initial load
}

/**
 * Renders all current ads into the index.html banner from localStorage.
 */
function renderAdsToBanner() {
    const container = document.getElementById('ad-slides-container');
    if (!container) return;

    const ads = getAds();
    container.innerHTML = ''; 
    currentSlideIndex = 0; 
    
    const prevBtn = document.getElementById('ad-prev-btn');
    const nextBtn = document.getElementById('ad-next-btn');

    // Handle case where there are no ads
    if (ads.length === 0) {
        container.innerHTML = '<div class="no-ads-message">No active advertisements. (Admin: Add one in the Portal.)</div>';
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
        if (autoSlideInterval) clearInterval(autoSlideInterval);
        return;
    }
    
    // Generate HTML for each ad
    ads.forEach((ad, index) => {
        const adElement = document.createElement('div');
        // Add fade-in-out only for desktop display (CSS handles opacity transition)
        adElement.classList.add('ad-slide', 'fade-in-out'); 
        
        // Determine image source (Base64 data or file path)
        let imageSource = ad.image || PLACEHOLDER_IMAGE_BASE64;
        // Escape quotes if it's a direct URL to prevent CSS parsing issues
        if (imageSource && !imageSource.startsWith('data:')) {
            imageSource = `'${imageSource}'`;
        }

        // Apply bolding to ad text using the markdown ** notation
        const formattedText = (ad.text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        adElement.innerHTML = `
            <div class="ad-image-container" style="background-image: url(${imageSource});"></div>
            <div class="ad-text-content">
                <h3>${ad.title}</h3>
                <p>${formattedText}</p>
                <a href="${ad.link}" class="ad-cta-btn">${ad.cta}</a>
            </div>
        `;
        container.appendChild(adElement);
    });

    // Set up initial display and navigation listeners
    updateDisplay();
    
    if (ads.length > 1) {
        if (prevBtn) {
            prevBtn.onclick = () => { prevSlide(); resetAutoSlide(); };
            prevBtn.classList.remove('hidden');
        }
        if (nextBtn) {
            nextBtn.onclick = () => { nextSlide(); resetAutoSlide(); };
            nextBtn.classList.remove('hidden');
        }
        resetAutoSlide(); 
    } else {
        // Hide buttons if only one ad
        if (prevBtn) prevBtn.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
    }
}
// --- AUTORUN & WINDOW RESIZE ---

document.addEventListener('DOMContentLoaded', () => {
    
    // Check if the ad container element exists (i.e., we are on index.html) for carousel setup
    if (document.getElementById('ad-slides-container')) {
        // This function will now fetch the list (which is empty by default)
        // and display the placeholder message as intended if there are no ads.
        renderAdsToBanner();
        window.addEventListener('resize', updateDisplay);
    }
});
// --- LISTEN FOR CHANGES FROM OTHER TABS ---

/**
 * Listens for localStorage changes from other windows/tabs 
 * (like ad-upload.html or ad-delete.html) and re-renders the carousel.
 */
window.addEventListener('storage', (event) => {
    // AD_STORAGE_KEY is defined in ad-manager.js
    const AD_STORAGE_KEY = 'advertisements'; 
    
    // Check if the key that changed is the one we care about
    if (event.key === AD_STORAGE_KEY) {
        // Only re-render if we are on a page that actually displays the carousel
        if (document.getElementById('ad-slides-container')) {
            // renderAdsToBanner is defined earlier in this file
            renderAdsToBanner(); 
        }
    }
});