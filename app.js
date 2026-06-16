/**
 * StegaCrypt - Main Application Controller (app.js)
 * 
 * Manages UI events, tabs, image previews, error handling, and orchestrates calls
 * to the cryptographic, steganographic, and steganalysis modules.
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
const tabBtnHide = document.getElementById('tabBtnHide');
const tabBtnReveal = document.getElementById('tabBtnReveal');
const tabBtnAnalyze = document.getElementById('tabBtnAnalyze');

const tabHide = document.getElementById('tabHide');
const tabReveal = document.getElementById('tabReveal');
const tabAnalyze = document.getElementById('tabAnalyze');

// ==========================================
// TAB SWITCHING
// ==========================================
const tabs = [
    { btn: tabBtnHide, panel: tabHide },
    { btn: tabBtnReveal, panel: tabReveal },
    { btn: tabBtnAnalyze, panel: tabAnalyze }
];

tabs.forEach(tab => {
    tab.btn.addEventListener('click', () => {
        // Remove active class from all buttons and panels, and hide panels
        tabs.forEach(t => {
            t.btn.classList.remove('active');
            t.panel.classList.remove('active');
            t.panel.style.display = 'none';
        });
        // Add active class and display the clicked panel
        tab.btn.classList.add('active');
        tab.panel.classList.add('active');
        tab.panel.style.display = 'block';
    });
});

// ==========================================
// IMAGE PREVIEWS (using FileReader)
// ==========================================
function setupImagePreview(fileInputId, imgPreviewId) {
    const fileInput = document.getElementById(fileInputId);
    const imgPreview = document.getElementById(imgPreviewId);

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imgPreview.src = event.target.result;
                imgPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imgPreview.src = '';
            imgPreview.style.display = 'none';
        }
    });
}

setupImagePreview('carrierImageInput', 'carrierPreview');
setupImagePreview('stegoImageInput', 'stegoPreview');

// ==========================================
// MODULE 1: HIDE FLOW
// ==========================================
const hideBtn = document.getElementById('hideBtn');
const carrierImageInput = document.getElementById('carrierImageInput');
const messageInput = document.getElementById('messageInput');
const hidePassphrase = document.getElementById('hidePassphrase');
const hideStatus = document.getElementById('hideStatus');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const downloadBtn = document.getElementById('downloadBtn');
const hideError = document.getElementById('hideError');

hideBtn.addEventListener('click', async () => {
    // 1. Validate inputs
    const file = carrierImageInput.files[0];
    const message = messageInput.value.trim();
    const passphrase = hidePassphrase.value.trim();

    // Reset previous states
    hideError.style.display = 'none';
    hideError.textContent = '';
    downloadBtn.style.display = 'none';
    hideStatus.style.display = 'none';
    step1.classList.remove('active', 'completed');
    step2.classList.remove('active', 'completed');
    step3.classList.remove('active', 'completed');

    if (!file) {
        showHideError("Please upload a carrier PNG image.");
        return;
    }
    if (!message) {
        showHideError("Please enter a secret message.");
        return;
    }
    if (!passphrase) {
        showHideError("Please enter an encryption passphrase.");
        return;
    }

    // 2. Disable button, show status steps
    hideBtn.disabled = true;
    hideStatus.style.display = 'block';

    try {
        // Step 1: Encrypting
        step1.classList.add('active');
        step1.textContent = "Step 1/3: Encrypting message with AES-256-GCM...";
        // Small pause for visual flow
        await new Promise(r => setTimeout(r, 400));
        const encryptedPayload = await encryptMessage(message, passphrase);
        step1.classList.remove('active');
        step1.classList.add('completed');
        step1.textContent = "Step 1/3: Encrypted ✔";

        // Step 2: Embedding
        step2.classList.add('active');
        step2.textContent = "Step 2/3: Embedding ciphertext into image pixels (LSB)...";
        await new Promise(r => setTimeout(r, 400));
        const stegoBlob = await hideDataInImage(file, encryptedPayload);
        step2.classList.remove('active');
        step2.classList.add('completed');
        step2.textContent = "Step 2/3: Embedded ✔";

        // Step 3: Done
        step3.classList.add('active', 'completed');
        step3.textContent = "Step 3/3: Complete! Download your stego image below.";

        // 7. Create Object URL, set as download link href
        const downloadUrl = URL.createObjectURL(stegoBlob);
        downloadBtn.href = downloadUrl;
        downloadBtn.download = "stegacrypt_output.png";
        downloadBtn.style.display = 'block';
    } catch (err) {
        // 9. Show error on failure
        showHideError(err.message || "An unexpected error occurred during encoding.");
        hideStatus.style.display = 'none';
    } finally {
        // 8. Re-enable button
        hideBtn.disabled = false;
    }
});

function showHideError(msg) {
    hideError.textContent = msg;
    hideError.style.display = 'block';
    hideError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==========================================
// MODULE 2: REVEAL FLOW
// ==========================================
const revealBtn = document.getElementById('revealBtn');
const stegoImageInput = document.getElementById('stegoImageInput');
const revealPassphrase = document.getElementById('revealPassphrase');
const revealResult = document.getElementById('revealResult');
const revealError = document.getElementById('revealError');

revealBtn.addEventListener('click', async () => {
    const file = stegoImageInput.files[0];
    const passphrase = revealPassphrase.value.trim();

    // Reset previous states
    revealError.style.display = 'none';
    revealError.textContent = '';
    revealResult.style.display = 'none';
    revealResult.textContent = '';

    // 1. Validate inputs
    if (!file) {
        showRevealError("Please upload a stego PNG image.");
        return;
    }
    if (!passphrase) {
        showRevealError("Please enter the decryption passphrase.");
        return;
    }

    // 2. Disable button, show loading feedback
    revealBtn.disabled = true;
    revealBtn.textContent = "Decrypting...";

    try {
        // 3. Extract hidden payload
        const extractedPayload = await extractDataFromImage(file);

        // 4. Decrypt payload
        const decryptedMessage = await decryptMessage(extractedPayload, passphrase);

        // 5. Show plaintext in result box
        revealResult.textContent = decryptedMessage;
        revealResult.style.display = 'block';
        
        // Smooth scroll
        revealResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        // 7. Handle failure - show friendly error message
        showRevealError("Decryption failed. Check your passphrase and stego image.");
    } finally {
        // 6. Re-enable button
        revealBtn.disabled = false;
        revealBtn.textContent = "Extract & Decrypt Message";
    }
});

function showRevealError(msg) {
    revealError.textContent = msg;
    revealError.style.display = 'block';
    revealError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ==========================================
// MODULE 3: ANALYZE TOOLS
// ==========================================

// --- Capacity Calculator ---
const capacityBtn = document.getElementById('capacityBtn');
const capacityInput = document.getElementById('capacityInput');
const capacityResult = document.getElementById('capacityResult');

capacityBtn.addEventListener('click', async () => {
    const file = capacityInput.files[0];
    capacityResult.style.display = 'none';
    capacityResult.textContent = '';

    if (!file) {
        alert("Please upload a PNG file to calculate capacity.");
        return;
    }

    capacityBtn.disabled = true;
    try {
        const stats = await imageCapacityCalculator(file);
        const kb = (stats.maxBytes / 1024).toFixed(2);
        capacityResult.innerHTML = `This image can hide up to <strong>${stats.maxCharacters.toLocaleString()}</strong> characters (<strong>${kb} KB</strong>) of data.<br><br>
        <span style="font-size: 0.85rem; color: var(--subtext);">Dimensions: ${stats.width}x${stats.height}px | Total Pixels: ${stats.totalPixels.toLocaleString()}</span>`;
        capacityResult.style.display = 'block';
        
        // Scroll
        capacityResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        alert(err.message || "Failed to calculate capacity.");
    } finally {
        capacityBtn.disabled = false;
    }
});

// --- LSB Visualizer ---
const lsbBtn = document.getElementById('lsbBtn');
const lsbInput = document.getElementById('lsbInput');
const lsbStatus = document.getElementById('lsbStatus');
const lsbCanvasContainer = document.getElementById('lsbCanvasContainer');

lsbBtn.addEventListener('click', async () => {
    const file = lsbInput.files[0];
    lsbStatus.style.display = 'none';
    lsbStatus.textContent = '';
    lsbCanvasContainer.innerHTML = '';

    if (!file) {
        alert("Please upload a PNG file for LSB visualization.");
        return;
    }

    lsbBtn.disabled = true;
    lsbStatus.textContent = "Generating LSB plane...";
    lsbStatus.style.display = 'block';

    try {
        const outputCanvas = await lsbPlaneVisualizer(file);
        // Style output canvas
        outputCanvas.style.width = '100%';
        outputCanvas.style.borderRadius = '8px';
        
        lsbCanvasContainer.appendChild(outputCanvas);
        lsbStatus.textContent = "LSB Plane visualization complete:";
        
        // Scroll
        lsbCanvasContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        lsbStatus.textContent = "Error: " + err.message;
    } finally {
        lsbBtn.disabled = false;
    }
});

// --- Pixel Difference Heatmap ---
const generateHeatmapBtn = document.getElementById('generateHeatmapBtn');
const heatmapOriginalInput = document.getElementById('heatmapOriginalInput');
const heatmapStegoInput = document.getElementById('heatmapStegoInput');
const heatmapStatus = document.getElementById('heatmapStatus');
const heatmapStats = document.getElementById('heatmapStats');
const heatmapCanvasContainer = document.getElementById('heatmapCanvasContainer');
const heatmapError = document.getElementById('heatmapError');

generateHeatmapBtn.addEventListener('click', async () => {
    const originalFile = heatmapOriginalInput.files[0];
    const stegoFile = heatmapStegoInput.files[0];

    // Reset previous states
    heatmapError.style.display = 'none';
    heatmapError.textContent = '';
    heatmapStatus.style.display = 'none';
    heatmapStatus.textContent = '';
    heatmapStats.style.display = 'none';
    heatmapStats.textContent = '';
    heatmapCanvasContainer.innerHTML = '';

    // Validate BOTH files selected
    if (!originalFile || !stegoFile) {
        heatmapError.textContent = "Please upload both the original cover image and the stego-image.";
        heatmapError.style.display = 'block';
        return;
    }

    // Check if identical file uploaded twice
    if (originalFile.name === stegoFile.name &&
        originalFile.size === stegoFile.size &&
        originalFile.lastModified === stegoFile.lastModified) {
        heatmapError.textContent = "Both files are identical. Upload original left, stego right.";
        heatmapError.style.display = 'block';
        return;
    }

    generateHeatmapBtn.disabled = true;
    heatmapStatus.textContent = "Comparing pixels...";
    heatmapStatus.style.display = 'block';

    try {
        const result = await pixelDifferenceHeatmap(originalFile, stegoFile);
        
        // Style output canvas
        result.canvas.style.width = '100%';
        result.canvas.style.borderRadius = '8px';
        
        heatmapCanvasContainer.appendChild(result.canvas);
        
        heatmapStats.innerHTML = `<strong>Modified Pixels:</strong> ${result.modifiedPixels.toLocaleString()} out of ${result.totalPixels.toLocaleString()} total pixels (${result.percentage}%)`;
        heatmapStats.style.display = 'block';
        heatmapStatus.textContent = "Heatmap generated successfully:";
        
        // Scroll
        heatmapStats.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        heatmapError.textContent = err.message || "Failed to generate heatmap.";
        heatmapError.style.display = 'block';
        heatmapStatus.style.display = 'none';
    } finally {
        generateHeatmapBtn.disabled = false;
    }
});

// --- Histogram Analysis ---
const histogramBtn = document.getElementById('histogramBtn');
const histogramInput = document.getElementById('histogramInput');
const histogramStatus = document.getElementById('histogramStatus');
const histogramCanvasContainer = document.getElementById('histogramCanvasContainer');

histogramBtn.addEventListener('click', async () => {
    const file = histogramInput.files[0];
    histogramStatus.style.display = 'none';
    histogramStatus.textContent = '';
    histogramCanvasContainer.innerHTML = '';

    if (!file) {
        alert("Please upload a PNG file for histogram analysis.");
        return;
    }

    histogramBtn.disabled = true;
    histogramStatus.textContent = "Analyzing pixel distribution...";
    histogramStatus.style.display = 'block';

    try {
        const outputCanvas = await histogramAnalysis(file);
        // Style output canvas
        outputCanvas.style.width = '100%';
        outputCanvas.style.borderRadius = '8px';
        
        histogramCanvasContainer.appendChild(outputCanvas);
        histogramStatus.textContent = "Histogram analysis complete:";
        
        // Scroll
        histogramCanvasContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
        histogramStatus.textContent = "Error: " + err.message;
    } finally {
        histogramBtn.disabled = false;
    }
});
