/**
 * StegaCrypt - Steganography Module (steganography.js)
 * 
 * Implements Least Significant Bit (LSB) steganography on PNG images using HTML5 Canvas.
 * It hides an encrypted payload string inside the pixel color data of a carrier image.
 */

/**
 * Helper: Loads a JavaScript File object (Image) and returns an HTMLImageElement.
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
 * Calculates the maximum storage capacity of an image in bytes.
 * @param {number} width - Width of the image.
 * @param {number} height - Height of the image.
 * @returns {number} - Maximum bytes.
 */
export function getMessageCapacity(width, height) {
    const totalPixels = width * height;
    const totalAvailableBits = totalPixels * 3; // 3 channels (R, G, B) per pixel
    const totalBytes = Math.floor(totalAvailableBits / 8);
    return Math.max(0, totalBytes - 4); // Subtract 4 bytes (32 bits) for the length header
}

/**
 * ENCODE: Hides a text payload inside a carrier PNG image.
 * @param {File} imageFile - The carrier PNG image File object.
 * @param {string} textToHide - The encrypted payload string.
 * @returns {Promise<Blob>} - Resolves to the stego PNG image as a Blob.
 */
export async function hideDataInImage(imageFile, textToHide) {
    // Step 1: Load the file into an image element
    const img = await loadImage(imageFile);
    
    // Step 2: Set up the canvas at native image dimensions to prevent scaling/corruption
    const canvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    canvas.width = width;
    canvas.height = height;
    
    // Step 3: Draw the image onto the canvas and extract raw RGBA pixel data
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data; // Uint8ClampedArray: [R1, G1, B1, A1, R2, G2, B2, A2...]
    
    // Step 4: Convert text to a binary string representation (8 bits per character)
    const encoder = new TextEncoder();
    const bytes = encoder.encode(textToHide);
    const charCount = bytes.length;
    
    // Convert character count (length) to a 32-bit binary string (big-endian)
    const lengthHeaderBinary = charCount.toString(2).padStart(32, '0');
    
    // Convert payload characters (bytes) to binary representations
    let payloadBinary = '';
    for (let i = 0; i < bytes.length; i++) {
        payloadBinary += bytes[i].toString(2).padStart(8, '0');
    }
    
    // Combine header and payload into a single bit string
    const fullBinaryString = lengthHeaderBinary + payloadBinary;
    const totalBitsRequired = fullBinaryString.length;
    
    // Step 5: Capacity verification
    const totalPixels = width * height;
    const availableBits = totalPixels * 3; // R, G, B only (skip Alpha to keep it opaque/standard)
    
    if (totalBitsRequired > availableBits) {
        throw new Error("Image too small to hide this message. Use a larger image.");
    }
    
    // Step 6: Encode bits into pixel LSBs
    // - Iterate through pixels (i increments by 4 because of RGBA)
    // - Overwrite the LSB (least significant bit) of R, G, and B. Leave A (A = index + 3) alone.
    let bitIndex = 0;
    for (let i = 0; i < data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
            if (bitIndex >= totalBitsRequired) {
                break;
            }
            
            // Get the current target bit ('0' or '1')
            const targetBit = parseInt(fullBinaryString[bitIndex], 10);
            
            // Clear the LSB of the color channel and set it to the target bit
            // E.g., if channel value is 157 (10011101) & 0xFE = 156 (10011100) | targetBit
            data[i + channel] = (data[i + channel] & 0xFE) | targetBit;
            bitIndex++;
        }
        if (bitIndex >= totalBitsRequired) {
            break;
        }
    }
    
    // Step 7: Write modified pixel data back to canvas and convert canvas to a PNG Blob
    ctx.putImageData(imageData, 0, 0);
    
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Failed to compile stego image Blob."));
            }
        }, 'image/png');
    });
}

/**
 * DECODE: Extracts hidden text data from a stego PNG image.
 * @param {File} imageFile - The stego PNG image File object.
 * @returns {Promise<string>} - Resolves to the extracted encrypted payload.
 */
export async function extractDataFromImage(imageFile) {
    // Step 1: Load stego file into image element
    const img = await loadImage(imageFile);
    
    // Step 2: Draw onto canvas to extract pixel color array
    const canvas = document.createElement('canvas');
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    const totalPixels = width * height;
    const availableBits = totalPixels * 3;
    
    if (availableBits < 32) {
        throw new Error("Invalid stego-image: image is too small to contain a header.");
    }
    
    // Step 3: Extract the 32-bit length header
    let headerBinary = '';
    let bitIndex = 0;
    
    for (let i = 0; i < data.length && bitIndex < 32; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
            if (bitIndex >= 32) break;
            
            // Read LSB by masking with 1
            const bit = data[i + channel] & 1;
            headerBinary += bit.toString();
            bitIndex++;
        }
    }
    
    const messageLength = parseInt(headerBinary, 2);
    
    // Sanity check: Ensure length makes sense for the image resolution
    const maxPossibleLength = Math.floor((availableBits - 32) / 8);
    if (messageLength <= 0 || messageLength > maxPossibleLength) {
        throw new Error("No hidden message found, or the stego-image is corrupted.");
    }
    
    // Step 4: Extract the message bit string
    const totalBitsToRead = 32 + messageLength * 8;
    let messageBinary = '';
    let currentBitIndex = 0;
    
    for (let i = 0; i < data.length && currentBitIndex < totalBitsToRead; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
            if (currentBitIndex >= totalBitsToRead) break;
            
            if (currentBitIndex >= 32) {
                const bit = data[i + channel] & 1;
                messageBinary += bit.toString();
            }
            currentBitIndex++;
        }
    }
    
    // Step 5: Convert the extracted binary string back to UTF-8 bytes
    const decodedBytes = new Uint8Array(messageLength);
    for (let i = 0; i < messageLength; i++) {
        const byteStr = messageBinary.substr(i * 8, 8);
        decodedBytes[i] = parseInt(byteStr, 2);
    }
    
    // Step 6: Decode bytes to text string and return
    const decoder = new TextDecoder();
    return decoder.decode(decodedBytes);
}
