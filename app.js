/**
 * StegaCrypt - Main Application Controller (app.js)
 * 
 * Ties together crypto.js and steganography.js to execute the encryption,
 * LSB pixel encoding, stego extraction, and AES decryption operations.
 */

import { encryptMessage, decryptMessage } from './crypto.js';
import { hideDataInImage, extractDataFromImage } from './steganography.js';
import {
    imageCapacityCalculator,
    lsbPlaneVisualizer,
    pixelDifferenceHeatmap,
    histogramAnalysis
} from './analyzer.js';

// DOM Element References
const tabBtnHide = document.getElementById('tab-btn-hide');
const tabBtnReveal = document.getElementById('tab-btn-reveal');
const tabBtnAnalyze = document.getElementById('tab-btn-analyze');
const tabHide = document.getElementById('tab-hide');
const tabReveal = document.getElementById('tab-reveal');
const tabAnalyze = document.getElementById('tab-analyze');

// HIDE MESSAGE TAB SELECTORS
const carrierInput = document.getElementById('carrier-input');
const carrierPreviewWrapper = document.getElementById('carrier-preview-wrapper');
const carrierPreview = document.getElementById('carrier-preview');
const removeCarrierBtn = document.getElementById('remove-carrier-btn');

const secretMessageEl = document.getElementById('secret-message');
const hidePasswordEl = document.getElementById('hide-password');
const btnHideProcess = document.getElementById('btn-hide-process');

const hideProgressSteps = document.getElementById('hide-progress-steps');
const progressStatusText = document.getElementById('progress-status-text');
const stepEncrypt = document.getElementById('step-encrypt');
const stepEmbed = document.getElementById('step-embed');
const stepDone = document.getElementById('step-done');

const hideResults = document.getElementById('hide-results');
const btnDownloadStego = document.getElementById('btn-download-stego');

// REVEAL MESSAGE TAB SELECTORS
const stegoInput = document.getElementById('stego-input');
const stegoPreviewWrapper = document.getElementById('stego-preview-wrapper');
const stegoPreview = document.getElementById('stego-preview');
const removeStegoBtn = document.getElementById('remove-stego-btn');

const revealPasswordEl = document.getElementById('reveal-password');
const btnRevealProcess = document.getElementById('btn-reveal-process');

const revealErrorBox = document.getElementById('reveal-error-box');
const revealResults = document.getElementById('reveal-results');
const decryptedMessageEl = document.getElementById('decrypted-message');
const btnCopyMessage = document.getElementById('btn-copy-message');

// State Variables
let carrierImageFile = null;
let carrierImageLoaded = false;
let stegoImageFile = null;
let stegoImageLoaded = false;

// State Variables for Analyze Tab
let capacityFile = null;
let lsbFile = null;
let diffOrigFile = null;
let diffStegoFile = null;
let histFile = null;

/* ==========================================================================
   Tab Switching Logic
   ========================================================================== */
function setupTabs() {
    tabBtnHide.addEventListener('click', () => {
        tabBtnHide.classList.add('active');
        tabBtnReveal.classList.remove('active');
        tabBtnAnalyze.classList.remove('active');
        tabHide.classList.add('active');
        tabReveal.classList.remove('active');
        tabAnalyze.classList.remove('active');
        tabReveal.style.display = 'none';
        tabAnalyze.style.display = 'none';
        tabHide.style.display = 'flex';
    });

    tabBtnReveal.addEventListener('click', () => {
        tabBtnReveal.classList.add('active');
        tabBtnHide.classList.remove('active');
        tabBtnAnalyze.classList.remove('active');
        tabReveal.classList.add('active');
        tabHide.classList.remove('active');
        tabAnalyze.classList.remove('active');
        tabHide.style.display = 'none';
        tabAnalyze.style.display = 'none';
        tabReveal.style.display = 'flex';
        
        // Auto-load stego-image from localStorage if available (testing convenience)
        const stegoData = localStorage.getItem('stego_image');
        if (stegoData && !stegoImageLoaded) {
            fetch(stegoData)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], "stego_image.png", { type: "image/png" });
                    handleStegoFile(file);
                }).catch(err => console.error("Error auto-loading stego image:", err));
        }
    });

    tabBtnAnalyze.addEventListener('click', () => {
        tabBtnAnalyze.classList.add('active');
        tabBtnHide.classList.remove('active');
        tabBtnReveal.classList.remove('active');
        tabAnalyze.classList.add('active');
        tabHide.classList.remove('active');
        tabReveal.classList.remove('active');
        tabHide.style.display = 'none';
        tabReveal.style.display = 'none';
        tabAnalyze.style.display = 'flex';
    });
}

/* ==========================================================================
   Self-Contained Toast Notifications Utility
   ========================================================================== */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.position = 'fixed';
        container.style.bottom = '24px';
        container.style.right = '24px';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '0.75rem';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.background = 'rgba(26, 26, 46, 0.95)';
    toast.style.borderLeft = `4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#7c3aed'}`;
    toast.style.color = '#ffffff';
    toast.style.padding = '0.85rem 1.25rem';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.75rem';
    toast.style.minWidth = '280px';
    toast.style.maxWidth = '400px';
    toast.style.fontSize = '0.88rem';
    toast.style.fontWeight = '500';
    toast.style.fontFamily = 'inherit';
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    
    toast.innerHTML = `
        <span>${icon}</span>
        <div style="flex: 1; line-height: 1.4;">${message}</div>
        <button class="toast-close-btn" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:1.1rem; line-height:1;">×</button>
    `;
    
    container.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close-btn');
    const dismiss = () => {
        toast.style.opacity = '1';
        toast.style.transition = 'opacity 0.2s ease-out';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
    };
    closeBtn.addEventListener('click', dismiss);
    setTimeout(() => { if (toast.parentNode) dismiss(); }, 4000);
}

/* ==========================================================================
   Input Form Validations
   ========================================================================== */
function validateHideInputs() {
    const text = secretMessageEl.value.trim();
    const pass = hidePasswordEl.value.trim();
    btnHideProcess.disabled = !carrierImageLoaded || text === '' || pass === '';
}

function validateRevealInputs() {
    const pass = revealPasswordEl.value.trim();
    btnRevealProcess.disabled = !stegoImageLoaded || pass === '';
}

/* ==========================================================================
   Tab 1: Hide Message Implementation
   ========================================================================== */

/**
 * Handles selection of the carrier image file.
 * Creates a live preview using FileReader.
 */
function handleCarrierFile(file) {
    if (!file) return;
    
    carrierImageFile = file;
    const isPng = file.type === 'image/png';
    if (!isPng) {
        showToast("Choose Carrier Image (PNG) requirement: Please use PNG images.", "info");
    }

    // Step 2: Show a live preview using FileReader and an <img> tag
    const reader = new FileReader();
    reader.onload = (event) => {
        carrierPreview.src = event.target.result;
        carrierPreviewWrapper.style.display = 'flex';
        carrierImageLoaded = true;
        
        // Enable form fields
        secretMessageEl.disabled = false;
        hidePasswordEl.disabled = false;
        validateHideInputs();
        
        showToast("Carrier image loaded successfully.", "success");
    };
    reader.onerror = () => {
        showToast("Failed to read carrier image file.", "error");
    };
    reader.readAsDataURL(file);
}

function resetHideTab() {
    if (btnDownloadStego.href && btnDownloadStego.href.startsWith('blob:')) {
        URL.revokeObjectURL(btnDownloadStego.href);
    }
    carrierImageFile = null;
    carrierImageLoaded = false;
    carrierInput.value = '';
    carrierPreview.src = '';
    carrierPreviewWrapper.style.display = 'none';
    
    secretMessageEl.value = '';
    secretMessageEl.disabled = true;
    hidePasswordEl.value = '';
    hidePasswordEl.disabled = true;
    btnHideProcess.disabled = true;
    
    hideProgressSteps.style.display = 'none';
    hideResults.style.display = 'none';
}

async function processHideMessage() {
    // 3a. Validate fields are filled
    if (!carrierImageLoaded || !carrierImageFile) {
        showToast("Please upload a carrier PNG image.", "error");
        return;
    }
    
    const message = secretMessageEl.value;
    const password = hidePasswordEl.value;
    
    if (!message || !password) {
        showToast("Please fill in all encryption fields.", "error");
        return;
    }
    
    btnHideProcess.disabled = true;
    hideResults.style.display = 'none';
    
    // Show progress steps area
    hideProgressSteps.style.display = 'flex';
    stepEncrypt.className = 'step-badge active';
    stepEmbed.className = 'step-badge';
    stepDone.className = 'step-badge';
    
    try {
        // 3b. Show status Step 1/3
        progressStatusText.textContent = "Step 1/3: Encrypting message with AES-256-GCM...";
        
        // Slow down slightly for visual progress feedback
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 3c. Call encryptMessage
        const encryptedPayload = await encryptMessage(message, password);
        
        // Update Step badges
        stepEncrypt.className = 'step-badge complete';
        stepEmbed.className = 'step-badge active';
        
        // 3d. Show status Step 2/3
        progressStatusText.textContent = "Step 2/3: Embedding ciphertext into image pixels (LSB)...";
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 3e. Call hideDataInImage
        const stegoBlob = await hideDataInImage(carrierImageFile, encryptedPayload);
        
        // Update Step badges
        stepEmbed.className = 'step-badge complete';
        stepDone.className = 'step-badge complete active';
        
        // 3f. Show status Step 3/3
        progressStatusText.textContent = "Step 3/3: Complete! Download your stego image below.";
        
        // 3g. Create an object URL from Blob, bind to download button, and show
        const stegoDataUrl = URL.createObjectURL(stegoBlob);
        btnDownloadStego.href = stegoDataUrl;
        btnDownloadStego.setAttribute("download", "stegacrypt_output.png");
        hideResults.style.display = 'flex';
        
        // Save stego-image to localStorage for testing convenience
        const fileReader = new FileReader();
        fileReader.onloadend = () => {
            try {
                localStorage.setItem('stego_image', fileReader.result);
            } catch (err) {
                console.warn("localStorage quota exceeded.", err);
            }
        };
        fileReader.readAsDataURL(stegoBlob);
        
        showToast("Payload embedded successfully!", "success");
    } catch (err) {
        console.error(err);
        hideProgressSteps.style.display = 'none';
        showToast(err.message || "An error occurred during encoding.", "error");
        validateHideInputs();
    }
}

/* ==========================================================================
   Tab 2: Reveal Message Implementation
   ========================================================================== */

/**
 * Handles selection of the stego image file.
 * Creates a live preview using FileReader.
 */
function handleStegoFile(file) {
    if (!file) return;
    
    stegoImageFile = file;
    
    // Step 2: Show a live preview using FileReader and an <img> tag
    const reader = new FileReader();
    reader.onload = (event) => {
        stegoPreview.src = event.target.result;
        stegoPreviewWrapper.style.display = 'flex';
        stegoImageLoaded = true;
        
        // Enable decryption fields
        revealPasswordEl.disabled = false;
        validateRevealInputs();
        
        showToast("Stego image loaded successfully.", "success");
    };
    reader.onerror = () => {
        showToast("Failed to read stego image file.", "error");
    };
    reader.readAsDataURL(file);
}

function resetRevealTab() {
    stegoImageFile = null;
    stegoImageLoaded = false;
    stegoInput.value = '';
    stegoPreview.src = '';
    stegoPreviewWrapper.style.display = 'none';
    
    revealPasswordEl.value = '';
    revealPasswordEl.disabled = true;
    btnRevealProcess.disabled = true;
    
    revealErrorBox.style.display = 'none';
    revealResults.style.display = 'none';
    decryptedMessageEl.value = '';
}

async function processRevealMessage() {
    revealErrorBox.style.display = 'none';
    revealResults.style.display = 'none';
    
    // 4a. Validate fields are filled
    if (!stegoImageLoaded || !stegoImageFile) {
        revealErrorBox.textContent = "Please select a stego PNG image.";
        revealErrorBox.style.display = 'block';
        return;
    }
    
    const password = revealPasswordEl.value;
    if (!password) {
        revealErrorBox.textContent = "Please enter your decryption passphrase.";
        revealErrorBox.style.display = 'block';
        return;
    }
    
    btnRevealProcess.disabled = true;
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
        // 4b. Call extractDataFromImage
        const encryptedPayload = await extractDataFromImage(stegoImageFile);
        
        // 4c. Call decryptMessage
        const decryptedMessage = await decryptMessage(encryptedPayload, password);
        
        // 4d. Display message in the result box
        decryptedMessageEl.value = decryptedMessage;
        revealResults.style.display = 'flex';
        showToast("Decryption successful!", "success");
        
        // Smooth scroll to results
        revealResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        console.error(err);
        
        // 4e. If error, show the error box with the required friendly message
        revealErrorBox.textContent = "Decryption failed. Please check your passphrase and ensure you are using the correct stego image.";
        revealErrorBox.style.display = 'block';
        showToast("Decryption failed.", "error");
        validateRevealInputs();
    }
}

function copyToClipboard() {
    const text = decryptedMessageEl.value;
    if (!text) return;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast("Message copied to clipboard!", "success");
            btnCopyMessage.textContent = "Copied!";
            setTimeout(() => { btnCopyMessage.textContent = "Copy Message"; }, 2000);
        })
        .catch(() => {
            showToast("Failed to copy message.", "error");
        });
}

/* ==========================================================================
   Tab 3: Steganalysis & Visual Analysis Implementation
   ========================================================================== */

// DOM Selectors for Tab 3
const analyzeLoading = document.getElementById('analyze-loading');
const analyzeLoadingText = document.getElementById('analyze-loading-text');

// Card 1 Selectors
const capacityInput = document.getElementById('analyze-capacity-input');
const btnAnalyzeCapacity = document.getElementById('btn-analyze-capacity');
const capacityResult = document.getElementById('analyze-capacity-result');
const capacityText = document.getElementById('analyze-capacity-text');

// Card 2 Selectors
const lsbInput = document.getElementById('analyze-lsb-input');
const btnAnalyzeLsb = document.getElementById('btn-analyze-lsb');
const lsbResult = document.getElementById('analyze-lsb-result');
const lsbCanvas = document.getElementById('analyze-lsb-canvas');

// Card 3 Selectors
const diffOrigInput = document.getElementById('analyze-diff-orig-input');
const diffStegoInput = document.getElementById('analyze-diff-stego-input');
const btnAnalyzeDiff = document.getElementById('btn-analyze-diff');
const diffResult = document.getElementById('analyze-diff-result');
const diffCanvas = document.getElementById('analyze-diff-canvas');
const diffStats = document.getElementById('analyze-diff-stats');

// Card 4 Selectors
const histInput = document.getElementById('analyze-hist-input');
const btnAnalyzeHist = document.getElementById('btn-analyze-hist');
const histResult = document.getElementById('analyze-hist-result');
const histCanvas = document.getElementById('analyze-hist-canvas');

function showAnalyzeLoading(message) {
    if (analyzeLoadingText && analyzeLoading) {
        analyzeLoadingText.textContent = message;
        analyzeLoading.style.display = 'flex';
    }
}

function hideAnalyzeLoading() {
    if (analyzeLoading) {
        analyzeLoading.style.display = 'none';
    }
}

async function runCapacityCalculator() {
    if (!capacityFile) return;
    
    showAnalyzeLoading("Calculating capacity...");
    capacityResult.style.display = 'none';
    btnAnalyzeCapacity.disabled = true;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const stats = await imageCapacityCalculator(capacityFile);
        const kbSize = (stats.maxBytes / 1024).toFixed(2);
        
        capacityText.innerHTML = `
            <strong>Dimensions:</strong> ${stats.width} × ${stats.height} px<br>
            <strong>Total Pixels:</strong> ${stats.totalPixels.toLocaleString()}<br>
            <strong>Max Payload:</strong> This image can hide up to <strong>${stats.maxCharacters.toLocaleString()}</strong> characters (<strong>${kbSize} KB</strong>) of encrypted data.
        `;
        capacityResult.style.display = 'flex';
        showToast("Capacity calculated successfully.", "success");
        
        capacityResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to calculate capacity.", "error");
    } finally {
        hideAnalyzeLoading();
        btnAnalyzeCapacity.disabled = false;
    }
}

async function runLsbVisualizer() {
    if (!lsbFile) return;
    
    showAnalyzeLoading("Analyzing LSB plane (may take a moment for large images)...");
    lsbResult.style.display = 'none';
    btnAnalyzeLsb.disabled = true;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        await lsbPlaneVisualizer(lsbFile, lsbCanvas);
        
        lsbResult.style.display = 'flex';
        showToast("LSB plane visualized successfully.", "success");
        
        lsbResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to visualize LSB plane.", "error");
    } finally {
        hideAnalyzeLoading();
        btnAnalyzeLsb.disabled = false;
    }
}

async function runDiffHeatmap() {
    if (!diffOrigFile || !diffStegoFile) return;
    
    showAnalyzeLoading("Generating pixel difference heatmap...");
    diffResult.style.display = 'none';
    btnAnalyzeDiff.disabled = true;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const stats = await pixelDifferenceHeatmap(diffOrigFile, diffStegoFile, diffCanvas);
        
        diffStats.innerHTML = `
            <strong>Modified Pixels:</strong> ${stats.modifiedPixels.toLocaleString()} out of ${stats.totalPixels.toLocaleString()} total pixels (${stats.percentage}%)
        `;
        
        diffResult.style.display = 'flex';
        showToast("Difference heatmap generated successfully.", "success");
        
        diffResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to generate heatmap. Check image dimensions.", "error");
    } finally {
        hideAnalyzeLoading();
        btnAnalyzeDiff.disabled = false;
    }
}

async function runHistogram() {
    if (!histFile) return;
    
    showAnalyzeLoading("Analyzing brightness histogram...");
    histResult.style.display = 'none';
    btnAnalyzeHist.disabled = true;
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        await histogramAnalysis(histFile, histCanvas);
        
        histResult.style.display = 'flex';
        showToast("Histogram analysis completed.", "success");
        
        histResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        console.error(err);
        showToast(err.message || "Failed to analyze histogram.", "error");
    } finally {
        hideAnalyzeLoading();
        btnAnalyzeHist.disabled = false;
    }
}

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Tab Switching
    setupTabs();
    
    // 2. Tab 1 (Hide) Bindings
    carrierInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleCarrierFile(e.target.files[0]);
    });
    removeCarrierBtn.addEventListener('click', resetHideTab);
    secretMessageEl.addEventListener('input', validateHideInputs);
    hidePasswordEl.addEventListener('input', validateHideInputs);
    btnHideProcess.addEventListener('click', processHideMessage);
    
    // 3. Tab 2 (Reveal) Bindings
    stegoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleStegoFile(e.target.files[0]);
    });
    removeStegoBtn.addEventListener('click', resetRevealTab);
    revealPasswordEl.addEventListener('input', validateRevealInputs);
    btnRevealProcess.addEventListener('click', processRevealMessage);
    btnCopyMessage.addEventListener('click', copyToClipboard);

    // 4. Tab 3 (Analyze) Bindings
    capacityInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            capacityFile = e.target.files[0];
            btnAnalyzeCapacity.disabled = false;
        } else {
            capacityFile = null;
            btnAnalyzeCapacity.disabled = true;
        }
    });

    lsbInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            lsbFile = e.target.files[0];
            btnAnalyzeLsb.disabled = false;
        } else {
            lsbFile = null;
            btnAnalyzeLsb.disabled = true;
        }
    });

    const validateDiffInputs = () => {
        btnAnalyzeDiff.disabled = !diffOrigFile || !diffStegoFile;
    };
    
    diffOrigInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            diffOrigFile = e.target.files[0];
        } else {
            diffOrigFile = null;
        }
        validateDiffInputs();
    });
    
    diffStegoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            diffStegoFile = e.target.files[0];
        } else {
            diffStegoFile = null;
        }
        validateDiffInputs();
    });

    histInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            histFile = e.target.files[0];
            btnAnalyzeHist.disabled = false;
        } else {
            histFile = null;
            btnAnalyzeHist.disabled = true;
        }
    });

    btnAnalyzeCapacity.addEventListener('click', runCapacityCalculator);
    btnAnalyzeLsb.addEventListener('click', runLsbVisualizer);
    btnAnalyzeDiff.addEventListener('click', runDiffHeatmap);
    btnAnalyzeHist.addEventListener('click', runHistogram);

    // Auto-load sample carrier image for testing if running on web server
    setTimeout(() => {
        fetch('/carrier_sample.png')
            .then(res => {
                if (res.ok) return res.blob();
                throw new Error("Sample carrier not found");
            })
            .then(blob => {
                const file = new File([blob], "carrier_sample.png", { type: "image/png" });
                handleCarrierFile(file);
            })
            .catch(() => {
                // Ignore error if not running on local HTTP server with sample image
            });
    }, 500);
});
