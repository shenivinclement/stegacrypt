import { encryptMessage, decryptMessage } from './crypto.js';
import { hideDataInImage, extractDataFromImage } from './steganography.js';
import {
    imageCapacityCalculator,
    lsbPlaneVisualizer,
    pixelDifferenceHeatmap,
    histogramAnalysis
} from './analyzer.js';

async function runAllTests() {
    console.log("Starting StegaCrypt automated test suite...");
    const results = [];
    const logResult = (name, passed, detail) => {
        results.push({ name, passed, detail });
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${name}: ${detail}`);
    };

    try {
        // 1. Fetch carrier_sample.png and create File object
        const response = await fetch('/carrier_sample.png');
        if (!response.ok) {
            throw new Error("Could not fetch carrier_sample.png. Make sure the server is serving files from the workspace directory.");
        }
        const carrierBlob = await response.blob();
        const carrierFile = new File([carrierBlob], "carrier_sample.png", { type: "image/png" });
        
        // 2. Cryptography Test
        const secretText = "Hello StegaCrypt! This is a secret.";
        const pass = "college123";
        const encrypted = await encryptMessage(secretText, pass);
        logResult("Crypto Encrypt", true, "Message encrypted: " + encrypted.substring(0, 30) + "...");

        const decrypted = await decryptMessage(encrypted, pass);
        if (decrypted === secretText) {
            logResult("Crypto Decrypt", true, "Decrypted message matches original.");
        } else {
            logResult("Crypto Decrypt", false, `Decrypted mismatch. Expected: "${secretText}", got "${decrypted}"`);
        }

        // 3. Cryptography Wrong Passphrase Test
        try {
            await decryptMessage(encrypted, "wrongpassword");
            logResult("Crypto Wrong Passphrase", false, "Did not throw error on wrong passphrase.");
        } catch (err) {
            if (err.message === "Decryption failed: wrong passphrase or corrupted data.") {
                logResult("Crypto Wrong Passphrase", true, "Threw expected error: " + err.message);
            } else {
                logResult("Crypto Wrong Passphrase", false, "Threw wrong error: " + err.message);
            }
        }

        // 4. Steganography Hide Test
        let stegoBlob;
        try {
            stegoBlob = await hideDataInImage(carrierFile, encrypted);
            logResult("Steganography Hide", true, "Data successfully hidden. Stego PNG Blob size: " + stegoBlob.size);
        } catch (err) {
            logResult("Steganography Hide", false, err.message);
        }

        // 5. Steganography Reveal Test
        if (stegoBlob) {
            try {
                const stegoFile = new File([stegoBlob], "stego_image.png", { type: "image/png" });
                const extracted = await extractDataFromImage(stegoFile);
                if (extracted === encrypted) {
                    logResult("Steganography Reveal", true, "Extracted payload matches embedded payload.");
                } else {
                    logResult("Steganography Reveal", false, "Payload mismatch.");
                }

                const decryptedSecret = await decryptMessage(extracted, pass);
                if (decryptedSecret === secretText) {
                    logResult("Round-trip Hide & Reveal", true, "Original message recovered successfully!");
                } else {
                    logResult("Round-trip Hide & Reveal", false, "Recovered message mismatch.");
                }
            } catch (err) {
                logResult("Steganography Reveal", false, err.message);
            }
        } else {
            logResult("Steganography Reveal", false, "Skipped because hide failed.");
        }

        // 6. Capacity Calculator Test
        try {
            const stats = await imageCapacityCalculator(carrierFile);
            if (stats.maxCharacters > 0 && stats.width > 0 && stats.height > 0) {
                logResult("Capacity Calculator", true, `Max Characters: ${stats.maxCharacters}, Size: ${stats.width}x${stats.height}`);
            } else {
                logResult("Capacity Calculator", false, "Invalid stats returned.");
            }
        } catch (err) {
            logResult("Capacity Calculator", false, err.message);
        }

        // 7. LSB Plane Visualizer Test
        try {
            const canvas = await lsbPlaneVisualizer(carrierFile);
            if (canvas instanceof HTMLCanvasElement) {
                logResult("LSB Visualizer", true, "LSB plane canvas rendered successfully.");
            } else {
                logResult("LSB Visualizer", false, "Did not return an HTMLCanvasElement.");
            }
        } catch (err) {
            logResult("LSB Visualizer", false, err.message);
        }

        // 8. Pixel Difference Heatmap Test
        if (stegoBlob) {
            try {
                const stegoFile = new File([stegoBlob], "stego_image.png", { type: "image/png" });
                const heatmap = await pixelDifferenceHeatmap(carrierFile, stegoFile);
                if (heatmap.canvas instanceof HTMLCanvasElement && heatmap.modifiedPixels > 0) {
                    logResult("Pixel Heatmap", true, `Modified Pixels: ${heatmap.modifiedPixels} (${heatmap.percentage}%)`);
                } else {
                    logResult("Pixel Heatmap", false, "No modified pixels found or canvas invalid.");
                }
            } catch (err) {
                logResult("Pixel Heatmap", false, err.message);
            }
        } else {
            logResult("Pixel Heatmap", false, "Skipped because stego image was not generated.");
        }

        // 9. Pixel Heatmap Identical Files Test
        try {
            await pixelDifferenceHeatmap(carrierFile, carrierFile);
            logResult("Pixel Heatmap Identical", false, "Did not throw error for identical files.");
        } catch (err) {
            if (err.message === "Both files are the same. Upload original on left, stego image on right.") {
                logResult("Pixel Heatmap Identical", true, "Threw expected error: " + err.message);
            } else {
                logResult("Pixel Heatmap Identical", false, "Threw wrong error: " + err.message);
            }
        }

        // 10. Histogram Analysis Test
        try {
            const canvas = await histogramAnalysis(carrierFile);
            if (canvas instanceof HTMLCanvasElement) {
                logResult("Histogram Analysis", true, "Histogram canvas rendered successfully.");
            } else {
                logResult("Histogram Analysis", false, "Did not return an HTMLCanvasElement.");
            }
        } catch (err) {
            logResult("Histogram Analysis", false, err.message);
        }

    } catch (err) {
        logResult("Test Suite Setup", false, err.message);
    }

    // Display results in the UI if container exists
    const container = document.getElementById('testResultUI');
    if (container) {
        container.innerHTML = `
            <div style="background: #1a1a2e; border: 1px solid #2d2d4e; border-radius: 12px; padding: 24px; margin-top: 24px; color: #f1f1f1;">
                <h2 style="margin-bottom: 16px; border-bottom: 1px solid #2d2d4e; padding-bottom: 8px;">Automated Test Suite Results</h2>
                <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px; padding: 0;">
                    ${results.map(r => `
                        <li style="display: flex; align-items: flex-start; gap: 12px; font-size: 0.95rem;">
                            <span style="color: ${r.passed ? '#22c55e' : '#ef4444'}; font-weight: bold;">[${r.passed ? 'PASS' : 'FAIL'}]</span>
                            <div>
                                <strong>${r.name}</strong> - ${r.detail}
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
}

// Run tests automatically if "?runTests=true" is in query parameters
if (window.location.search.includes('runTests=true')) {
    const startTests = () => {
        // Create UI container dynamically if not exists
        let uiContainer = document.getElementById('testResultUI');
        if (!uiContainer) {
            uiContainer = document.createElement('div');
            uiContainer.id = 'testResultUI';
            // Insert after the main content wrapper
            document.querySelector('.app-container').appendChild(uiContainer);
        }
        runAllTests();
    };

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', startTests);
    } else {
        startTests();
    }
}

// Workflow UI Automation for headless testing
if (window.location.search.includes('workflow=true')) {
    const runWorkflow = async () => {
        console.log("Starting workflow UI automation...");
        try {
            // 1. Fetch carrier_sample.png
            const response = await fetch('/carrier_sample.png');
            const carrierBlob = await response.blob();
            const carrierFile = new File([carrierBlob], "carrier_sample.png", { type: "image/png" });

            // 2. Set secret message and passphrase
            document.getElementById('messageInput').value = "Test secret message!";
            document.getElementById('hidePassphrase').value = "testpass123";

            // 3. Populate carrier image file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(carrierFile);
            document.getElementById('carrierImageInput').files = dataTransfer.files;
            document.getElementById('carrierImageInput').dispatchEvent(new Event('change', { bubbles: true }));

            // Wait a moment for UI to register
            await new Promise(r => setTimeout(r, 500));

            // 4. Click hideBtn
            console.log("Clicking Hide Button");
            document.getElementById('hideBtn').click();

            // 5. Wait for downloadBtn to become visible
            let downloadBtn = document.getElementById('downloadBtn');
            while (downloadBtn.style.display !== 'inline-block' && downloadBtn.style.display !== 'block') {
                await new Promise(r => setTimeout(r, 200));
            }
            console.log("Download button is visible!");

            // 6. Get the generated stego blob by fetching the download link URL
            const stegoUrl = downloadBtn.href;
            const stegoResponse = await fetch(stegoUrl);
            const stegoBlob = await stegoResponse.blob();
            const stegoFile = new File([stegoBlob], "stegacrypt_output.png", { type: "image/png" });

            // 7. Go to Analyze Image tab
            document.getElementById('tabBtnAnalyze').click();

            // 8. Open Heatmap card
            const cardHeatmap = document.getElementById('cardHeatmap');
            if (!cardHeatmap.hasAttribute('open')) {
                cardHeatmap.setAttribute('open', '');
            }

            // 9. Populate Heatmap inputs
            const dtOriginal = new DataTransfer();
            dtOriginal.items.add(carrierFile);
            document.getElementById('heatmapOriginalInput').files = dtOriginal.files;
            document.getElementById('heatmapOriginalInput').dispatchEvent(new Event('change', { bubbles: true }));

            const dtStego = new DataTransfer();
            dtStego.items.add(stegoFile);
            document.getElementById('heatmapStegoInput').files = dtStego.files;
            document.getElementById('heatmapStegoInput').dispatchEvent(new Event('change', { bubbles: true }));

            // Wait a moment
            await new Promise(r => setTimeout(r, 500));

            // 10. Click Generate Heatmap button
            console.log("Clicking Generate Heatmap Button");
            document.getElementById('generateHeatmapBtn').click();

            console.log("Workflow automation completed successfully!");
        } catch (err) {
            console.error("Workflow automation error:", err);
        }
    };

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', runWorkflow);
    } else {
        runWorkflow();
    }
}
