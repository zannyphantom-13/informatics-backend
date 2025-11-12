/**
 * ad-upload.js
 * * Handles form logic, input toggling, and submission for adding new advertisements.
 */
import { addAd } from './ad-manager.js';

// Function to get elements from the DOM
const $ = (selector) => document.querySelector(selector);

// DOM Elements
const adUploadForm = $('#ad-upload-form');
const statusMessage = $('#status-message');
const toggleUploadBtn = $('#toggle-upload-btn');
const toggleUrlBtn = $('#toggle-url-btn');
const fileUploadFields = $('#file-upload-fields');
const urlUploadFields = $('#url-upload-fields');

// Input Fields
const adTitle = $('#ad-title');
const adText = $('#ad-text');
const adLink = $('#ad-link');
const adCta = $('#ad-cta');
const adImageFile = $('#ad-image-file');
const adImageUrl = $('#ad-image-url');

/**
 * Resets the state of the other image input field when one is toggled open.
 * @param {HTMLElement} activeFields - The field container currently being activated.
 */
function resetInactiveField(activeFields) {
    // Determine which field is inactive
    const inactiveFields = activeFields === fileUploadFields ? urlUploadFields : fileUploadFields;
    const inactiveInput = activeFields === fileUploadFields ? adImageUrl : adImageFile;
    const activeInput = activeFields === fileUploadFields ? adImageFile : adImageUrl;
    const inactiveBtn = activeFields === fileUploadFields ? toggleUrlBtn : toggleUploadBtn;
    const activeBtn = activeFields === fileUploadFields ? toggleUploadBtn : toggleUrlBtn;

    // Deactivate inactive field
    inactiveFields.classList.add('hidden');
    inactiveInput.value = ''; 
    inactiveInput.removeAttribute('required');
    inactiveBtn.style.backgroundColor = '#3f8f82'; // Reset to default color

    // Activate active field
    activeFields.classList.remove('hidden');
    activeInput.removeAttribute('required'); // Ensure no 'required' attribute blocks submission
    activeBtn.style.backgroundColor = '#2a6e62'; // Set active color
}

// -----------------------------------------------------------
// --- EVENT LISTENERS ---
// -----------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 1. Image Upload Toggle Listeners (Ensures the buttons work)
    if (toggleUploadBtn) {
        toggleUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetInactiveField(fileUploadFields);
        });
    }

    if (toggleUrlBtn) {
        toggleUrlBtn.addEventListener('click', (e) => {
            e.preventDefault();
            resetInactiveField(urlUploadFields);
        });
    }
});


// 2. Form Submission Handler (New Flexible Validation)
adUploadForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    statusMessage.textContent = '';
    statusMessage.classList.remove('error-message', 'success-message');

    // --- 1. FLEXIBLE VALIDATION CHECK (Allow submission if any one field is filled) ---
    const title = adTitle.value.trim();
    const text = adText.value.trim();
    const link = adLink.value.trim();
    const cta = adCta.value.trim();
    
    const isFileUploadActive = !fileUploadFields.classList.contains('hidden');
    const isUrlUploadActive = !urlUploadFields.classList.contains('hidden');
    
    let imageSource = ''; // Will hold Base64, URL, or empty string

    // Check if at least one text field is filled
    const hasTextContent = title || text || link || cta;
    
    // Check for image input and populate imageSource
    if (isFileUploadActive && adImageFile.files.length > 0) {
        try {
            // Read the file as Base64 for local storage
            const file = adImageFile.files[0];
            imageSource = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        } catch (error) {
            console.error("Error reading file:", error);
            statusMessage.textContent = '❌ Error: Could not read the image file.';
            statusMessage.classList.add('error-message');
            return;
        }
    } else if (isUrlUploadActive && adImageUrl.value.trim()) {
        // If URL is provided
        imageSource = adImageUrl.value.trim();
    }
    
    // Final check: If no text content AND no image/URL was provided, block submission.
    if (!hasTextContent && !imageSource) {
        statusMessage.textContent = '❌ Error: Please fill in at least one field (Title, Text, Link, CTA, or Image/URL) to create an advertisement.';
        statusMessage.classList.add('error-message');
        return; // Stop submission
    }
    
    // --- 2. Final data assembly ---
    const adData = {
        title: title,
        text: text,
        link: link,
        cta: cta,
        image: imageSource // This holds the Base64, URL, or ''
    };
    
    // --- 3. Submission to ad-manager.js ---
    addAd(adData);

    console.log('Advertisement Data Submitted:', adData);
    
    // Use the title or a snippet of the text for the success message
    const adName = adData.title || (adData.text ? adData.text.substring(0, 15) + '...' : 'Untitled Ad');

    statusMessage.textContent = `✅ Success! Advertisement "${adName}" uploaded successfully.`;
    statusMessage.classList.add('success-message');
    
    // Clear the form after a successful submission
    adUploadForm.reset();
    
    // Also reset the toggle state and clear active colors
    fileUploadFields.classList.add('hidden');
    urlUploadFields.classList.add('hidden');
    toggleUploadBtn.style.backgroundColor = '#3f8f82'; // Reset color
    toggleUrlBtn.style.backgroundColor = '#3f8f82'; // Reset color
});