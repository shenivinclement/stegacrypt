/**
 * StegaCrypt - Steganalysis & Visual Analysis Module (analyzer.js)
 * 
 * Implements various tools for detecting, estimating, and analyzing LSB steganography payload:
 * 1. Image Capacity Calculator
 * 2. LSB Plane Visualizer
 * 3. Pixel Difference Heatmap
 * 4. Brightness Histogram Analysis
 */

/**
 * Helper: Loads a File object (Image) and returns an HTMLImageElement.
 * @param {File} file - The file uploaded by the user.
 * @returns {Promise<HTMLImageElement>} - Resolved when the image is fully loaded.
 */
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to parse image file."));
            img.src = event.target.result;
        };
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
    });
}

/**
 * TOOL 1: Calculates the steganography capacity of a PNG file.
 * @param {File} imageFile - The carrier PNG image File.
 * @returns {Promise<Object>} - Capacity metrics { width, height, totalPixels, maxCharacters, maxBytes }.
 */
export async function imageCapacityCalculator(imageFile) {
    const img = await loadImage(imageFile);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    const totalPixels = width * height;
    const usableBits = totalPixels * 3; // R, G, B channels only
    
    // Formula: floor(usable bits / 8) - 4 bytes for 32-bit header
    const maxCharacters = Math.max(0, Math.floor(usableBits / 8) - 4);
    const maxBytes = maxCharacters;
    
    return {
        width,
        height,
        totalPixels,
        maxCharacters,
        maxBytes
    };
}

/**
 * TOOL 2: Visualizes the LSB plane of the input image.
 * @param {File} imageFile - The PNG file to visualize.
 * @param {HTMLCanvasElement} visibleCanvas - The canvas where the visualized LSB output will be written.
 * @returns {Promise<void>}
 */
export async function lsbPlaneVisualizer(imageFile, visibleCanvas) {
    const img = await loadImage(imageFile);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    // Set visible canvas dimensions
    visibleCanvas.width = width;
    visibleCanvas.height = height;
    const visibleCtx = visibleCanvas.getContext('2d');
    
    // Offscreen canvas to read original RGBA pixel data
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.drawImage(img, 0, 0);
    
    const imageData = offscreenCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // For each pixel, scale LSB to 255 (0 -> black, 1 -> white)
    for (let i = 0; i < data.length; i += 4) {
        const rLsb = data[i] & 1;
        const gLsb = data[i + 1] & 1;
        const bLsb = data[i + 2] & 1;
        
        data[i] = rLsb * 255;     // Red
        data[i + 1] = gLsb * 255; // Green
        data[i + 2] = bLsb * 255; // Blue
        data[i + 3] = 255;        // Alpha (full opacity)
    }
    
    // Write new pixel data to visible canvas
    visibleCtx.putImageData(imageData, 0, 0);
}

/**
 * TOOL 3: Computes pixel-by-pixel color differences and renders a heatmap.
 * @param {File} originalFile - The original carrier PNG file.
 * @param {File} stegoFile - The stego PNG file.
 * @param {HTMLCanvasElement} visibleCanvas - The target UI canvas for the heatmap.
 * @returns {Promise<Object>} - Stats: { modifiedPixels, totalPixels, percentage }
 */
export async function pixelDifferenceHeatmap(originalFile, stegoFile, visibleCanvas) {
    const [origImg, stegoImg] = await Promise.all([
        loadImage(originalFile),
        loadImage(stegoFile)
    ]);
    
    const width = origImg.naturalWidth || origImg.width;
    const height = origImg.naturalHeight || origImg.height;
    
    const stegoWidth = stegoImg.naturalWidth || stegoImg.width;
    const stegoHeight = stegoImg.naturalHeight || stegoImg.height;
    
    if (width !== stegoWidth || height !== stegoHeight) {
        throw new Error("Original and stego images must have identical dimensions.");
    }
    
    visibleCanvas.width = width;
    visibleCanvas.height = height;
    const visibleCtx = visibleCanvas.getContext('2d');
    
    // Read original pixel data
    const origCanvas = document.createElement('canvas');
    origCanvas.width = width;
    origCanvas.height = height;
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(origImg, 0, 0);
    const origData = origCtx.getImageData(0, 0, width, height).data;
    
    // Read stego pixel data
    const stegoCanvas = document.createElement('canvas');
    stegoCanvas.width = width;
    stegoCanvas.height = height;
    const stegoCtx = stegoCanvas.getContext('2d');
    stegoCtx.drawImage(stegoImg, 0, 0);
    const stegoData = stegoCtx.getImageData(0, 0, width, height).data;
    
    const outputImageData = visibleCtx.createImageData(width, height);
    const outData = outputImageData.data;
    
    let modifiedPixels = 0;
    const totalPixels = width * height;
    
    for (let i = 0; i < origData.length; i += 4) {
        const origR = origData[i];
        const origG = origData[i + 1];
        const origB = origData[i + 2];
        const origA = origData[i + 3];
        
        const stegoR = stegoData[i];
        const stegoG = stegoData[i + 1];
        const stegoB = stegoData[i + 2];
        
        const delta = Math.abs(origR - stegoR) + Math.abs(origG - stegoG) + Math.abs(origB - stegoB);
        
        if (delta > 0) {
            // Modified pixel: highlight in pure RED
            outData[i] = 255;
            outData[i + 1] = 0;
            outData[i + 2] = 0;
            outData[i + 3] = 255;
            modifiedPixels++;
        } else {
            // Unchanged pixel: keep original color dimmed at 30% opacity
            outData[i] = origR;
            outData[i + 1] = origG;
            outData[i + 2] = origB;
            outData[i + 3] = Math.round(origA * 0.3);
        }
    }
    
    visibleCtx.putImageData(outputImageData, 0, 0);
    
    const percentage = ((modifiedPixels / totalPixels) * 100).toFixed(4);
    return {
        modifiedPixels,
        totalPixels,
        percentage
    };
}

/**
 * TOOL 4: Builds a brightness histogram and draws a bar chart to canvas.
 * @param {File} imageFile - The PNG file to analyze.
 * @param {HTMLCanvasElement} targetCanvas - The canvas where the histogram chart will be drawn.
 * @returns {Promise<void>}
 */
export async function histogramAnalysis(imageFile, targetCanvas) {
    const img = await loadImage(imageFile);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    // Read pixel data
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, width, height).data;
    
    // Initialize histogram frequency bins (0-255)
    const histogram = new Array(256).fill(0);
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Brightness = Math.round((R + G + B) / 3)
        const brightness = Math.round((r + g + b) / 3);
        histogram[brightness]++;
    }
    
    // Render the histogram bar chart
    // Determine canvas visual size
    const canvasWidth = targetCanvas.width;
    const canvasHeight = targetCanvas.height;
    const renderCtx = targetCanvas.getContext('2d');
    
    // Colors and margins
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 45;
    
    const chartWidth = canvasWidth - paddingLeft - paddingRight;
    const chartHeight = canvasHeight - paddingTop - paddingBottom;
    
    // Clear canvas and draw background
    renderCtx.fillStyle = '#0b0b13';
    renderCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Find maximum bin count for scaling Y axis
    const maxCount = Math.max(...histogram);
    
    // Draw horizontal grid lines
    renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    renderCtx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
        const y = paddingTop + chartHeight - (chartHeight * (i / 4));
        renderCtx.beginPath();
        renderCtx.moveTo(paddingLeft, y);
        renderCtx.lineTo(paddingLeft + chartWidth, y);
        renderCtx.stroke();
        
        // Y-axis label text
        renderCtx.fillStyle = '#94a3b8';
        renderCtx.font = '9px Outfit, sans-serif';
        renderCtx.textAlign = 'right';
        renderCtx.textBaseline = 'middle';
        const val = Math.round(maxCount * (i / 4));
        renderCtx.fillText(val.toLocaleString(), paddingLeft - 8, y);
    }
    // Draw '0' label
    renderCtx.fillText('0', paddingLeft - 8, paddingTop + chartHeight);
    
    // Draw bars
    const barWidth = chartWidth / 256;
    for (let i = 0; i < 256; i++) {
        const count = histogram[i];
        const barHeight = maxCount > 0 ? (count / maxCount) * chartHeight : 0;
        const x = paddingLeft + i * barWidth;
        const y = paddingTop + chartHeight - barHeight;
        
        // Bar coloring rule:
        // values 0-85 in blue, 86-170 in green, 171-255 in red.
        if (i <= 85) {
            renderCtx.fillStyle = '#3b82f6'; // Blue
        } else if (i <= 170) {
            renderCtx.fillStyle = '#10b981'; // Green
        } else {
            renderCtx.fillStyle = '#ef4444'; // Red
        }
        
        // Add 0.2 to avoid sub-pixel gaps between thin bars
        renderCtx.fillRect(x, y, barWidth + 0.2, barHeight);
    }
    
    // Draw X and Y Axes lines
    renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    renderCtx.lineWidth = 1;
    renderCtx.beginPath();
    renderCtx.moveTo(paddingLeft, paddingTop);
    renderCtx.lineTo(paddingLeft, paddingTop + chartHeight); // Y line
    renderCtx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight); // X line
    renderCtx.stroke();
    
    // Draw X-axis ticks and labels at specific points (0, 64, 128, 192, 255)
    const xTicks = [0, 64, 128, 192, 255];
    renderCtx.fillStyle = '#94a3b8';
    renderCtx.font = '10px Outfit, sans-serif';
    renderCtx.textAlign = 'center';
    renderCtx.textBaseline = 'top';
    renderCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    
    xTicks.forEach(tick => {
        const x = paddingLeft + (tick / 255) * chartWidth;
        const y = paddingTop + chartHeight;
        
        // Tick tick line
        renderCtx.beginPath();
        renderCtx.moveTo(x, y);
        renderCtx.lineTo(x, y + 4);
        renderCtx.stroke();
        
        // Label
        renderCtx.fillText(tick, x, y + 6);
    });
    
    // Draw labels for axes
    renderCtx.fillStyle = '#ffffff';
    renderCtx.font = '11px Outfit, sans-serif';
    renderCtx.textAlign = 'center';
    renderCtx.fillText('Pixel Brightness Value (0–255)', paddingLeft + chartWidth / 2, paddingTop + chartHeight + 25);
    
    renderCtx.save();
    renderCtx.translate(15, paddingTop + chartHeight / 2);
    renderCtx.rotate(-Math.PI / 2);
    renderCtx.textAlign = 'center';
    renderCtx.fillText('Pixel Count', 0, 0);
    renderCtx.restore();
}
