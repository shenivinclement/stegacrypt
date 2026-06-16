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
 * This helper uses the safe URL.createObjectURL pattern to avoid race conditions.
 * @param {File} file - The file uploaded by the user.
 * @returns {Promise<HTMLImageElement>} - Resolved when the image is fully loaded.
 */
const loadImage = (file) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image."));
    };
    img.src = url; // src MUST be set AFTER onload is defined
});

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
 * Extracts the LSB of Red, Green, and Blue channels and scales them to 255 (full brightness).
 * @param {File} imageFile - The PNG file to visualize.
 * @returns {Promise<HTMLCanvasElement>} - Resolved with the output canvas element.
 */
export async function lsbPlaneVisualizer(imageFile) {
    const img = await loadImage(imageFile);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    // Create new offscreen canvas for the output
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Draw original image to read its RGBA pixel data
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Process each pixel: isolate LSB of R, G, B channels and map to 0 or 255
    for (let i = 0; i < data.length; i += 4) {
        const rLsb = data[i] & 1;
        const gLsb = data[i + 1] & 1;
        const bLsb = data[i + 2] & 1;
        
        data[i] = rLsb * 255;     // Red
        data[i + 1] = gLsb * 255; // Green
        data[i + 2] = bLsb * 255; // Blue
        data[i + 3] = 255;        // Alpha (full opacity)
    }
    
    // Write processed pixels back to the output canvas
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

/**
 * TOOL 3: Computes pixel-by-pixel color differences and renders a heatmap.
 * @param {File} originalFile - The original carrier PNG file.
 * @param {File} stegoFile - The stego PNG file.
 * @returns {Promise<Object>} - Stats and output canvas: { canvas, modifiedPixels, totalPixels, percentage }
 */
export async function pixelDifferenceHeatmap(originalFile, stegoFile) {
    // Check if both files are identical (same name + size + lastModified)
    if (originalFile.name === stegoFile.name &&
        originalFile.size === stegoFile.size &&
        originalFile.lastModified === stegoFile.lastModified) {
        throw new Error("Both files are the same. Upload original on left, stego image on right.");
    }

    // Load both images asynchronously
    const [origImg, stegoImg] = await Promise.all([
        loadImage(originalFile),
        loadImage(stegoFile)
    ]);
    
    const width = origImg.naturalWidth || origImg.width;
    const height = origImg.naturalHeight || origImg.height;
    
    const stegoWidth = stegoImg.naturalWidth || stegoImg.width;
    const stegoHeight = stegoImg.naturalHeight || stegoImg.height;
    
    // Validate dimensions match
    if (width !== stegoWidth || height !== stegoHeight) {
        throw new Error("Image dimensions don't match. Use the original and its stego version.");
    }
    
    // Create output canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    // Read original pixel data using offscreen canvas
    const origCanvas = document.createElement('canvas');
    origCanvas.width = width;
    origCanvas.height = height;
    const origCtx = origCanvas.getContext('2d');
    origCtx.drawImage(origImg, 0, 0);
    const origData = origCtx.getImageData(0, 0, width, height).data;
    
    // Read stego pixel data using offscreen canvas
    const stegoCanvas = document.createElement('canvas');
    stegoCanvas.width = width;
    stegoCanvas.height = height;
    const stegoCtx = stegoCanvas.getContext('2d');
    stegoCtx.drawImage(stegoImg, 0, 0);
    const stegoData = stegoCtx.getImageData(0, 0, width, height).data;
    
    const outputImageData = ctx.createImageData(width, height);
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
        
        // Compute brightness difference
        const delta = Math.abs(origR - stegoR) + Math.abs(origG - stegoG) + Math.abs(origB - stegoB);
        
        if (delta > 0) {
            // Modified pixel: highlight in pure RED
            outData[i] = 255;
            outData[i + 1] = 0;
            outData[i + 2] = 0;
            outData[i + 3] = 255;
            modifiedPixels++;
        } else {
            // Unchanged pixel: keep original color dimmed at 30% brightness
            outData[i] = origR;
            outData[i + 1] = origG;
            outData[i + 2] = origB;
            outData[i + 3] = Math.round(origA * 0.3);
        }
    }
    
    ctx.putImageData(outputImageData, 0, 0);
    
    const percentage = ((modifiedPixels / totalPixels) * 100).toFixed(4);
    return {
        canvas,
        modifiedPixels,
        totalPixels,
        percentage
    };
}

/**
 * TOOL 4: Builds a brightness histogram and draws a bar chart to canvas.
 * @param {File} imageFile - The PNG file to analyze.
 * @returns {Promise<HTMLCanvasElement>} - Resolved with the output canvas element.
 */
export async function histogramAnalysis(imageFile) {
    const img = await loadImage(imageFile);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    
    // Read pixel data using offscreen canvas
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
    
    // Create new target canvas for the bar chart
    const targetCanvas = document.createElement('canvas');
    targetCanvas.width = 600;
    targetCanvas.height = 300;
    const renderCtx = targetCanvas.getContext('2d');
    
    const canvasWidth = targetCanvas.width;
    const canvasHeight = targetCanvas.height;
    
    // Colors and margins
    const paddingLeft = 65;
    const paddingRight = 20;
    const paddingTop = 25;
    const paddingBottom = 45;
    
    const chartWidth = canvasWidth - paddingLeft - paddingRight;
    const chartHeight = canvasHeight - paddingTop - paddingBottom;
    
    // Clear canvas and draw background
    renderCtx.fillStyle = '#0f0f1a';
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
        renderCtx.fillStyle = '#9ca3af';
        renderCtx.font = '10px "Segoe UI", sans-serif';
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
        // 0-85 = blue, 86-170 = green, 171-255 = red.
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
    renderCtx.fillStyle = '#9ca3af';
    renderCtx.font = '10px "Segoe UI", sans-serif';
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
    renderCtx.fillStyle = '#f1f1f1';
    renderCtx.font = '11px "Segoe UI", sans-serif';
    renderCtx.textAlign = 'center';
    renderCtx.fillText('Pixel Brightness Value (0–255)', paddingLeft + chartWidth / 2, paddingTop + chartHeight + 25);
    
    renderCtx.save();
    renderCtx.translate(18, paddingTop + chartHeight / 2);
    renderCtx.rotate(-Math.PI / 2);
    renderCtx.textAlign = 'center';
    renderCtx.fillText('Pixel Count', 0, 0);
    renderCtx.restore();

    return targetCanvas;
}
