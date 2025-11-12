/**
 * ad-delete.js
 * * Handles rendering the advertisement list and managing the delete process for the admin.
 */

import { getAds, deleteAd } from './ad-manager.js';

const container = document.getElementById('ad-list-container');
const statusMessage = document.getElementById('delete-status-message');

/**
 * Renders the list of advertisements with delete buttons.
 */
function renderDeleteList() {
    const ads = getAds() || [];
    container.innerHTML = '';
    statusMessage.textContent = '';
    statusMessage.style.color = ''; // Reset color

    if (!Array.isArray(ads) || ads.length === 0) {
        container.innerHTML = '<p class="no-ads-message">No advertisements currently running.</p>';
        return;
    }

    const listHtml = ads.map(ad => `
        <div class="ad-item-manage" data-id="${ad.id}">
            <div class="ad-info">
                <strong>${ad.title || 'Untitled'}</strong>
                <p>${(ad.text || '').substring(0, 100)}${(ad.text && ad.text.length > 100) ? '...' : ''}</p>
                <small>Image: ${ad.image ? (ad.image.startsWith('data:') ? 'Base64 Image Data' : ad.image) : 'N/A'}</small>
            </div>
            <button class="delete-ad-btn primary-btn" data-id="${ad.id}">
                <i class="fas fa-times-circle"></i> Delete Ad
            </button>
        </div>
    `).join('');

    container.innerHTML = listHtml;
    
    // Attach event listeners to all new delete buttons
    document.querySelectorAll('.delete-ad-btn').forEach(button => {
        button.addEventListener('click', function() {
            const adId = parseInt(this.getAttribute('data-id'), 10);
            if (isNaN(adId)) return;
            
            const adObj = ads.find(a => a.id === adId);
            const title = adObj ? adObj.title : 'this ad';

            // Confirmation dialogue before deletion
            if (confirm(`Are you sure you want to delete the ad: "${title}"?`)) {
                const deleted = deleteAd(adId);
                
                if (deleted) {
                    statusMessage.textContent = '✅ Ad deleted successfully!';
                    statusMessage.style.color = '#3d9970'; // Green for success
                } else {
                    statusMessage.textContent = '⚠️ Could not delete the ad.';
                    statusMessage.style.color = '#cc0000'; // Red for error
                }
                renderDeleteList(); // Re-render the list after deletion
            }
        });
    });
}

// Initial render when the script loads
document.addEventListener('DOMContentLoaded', renderDeleteList);