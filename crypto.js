/**
 * StegaCrypt - Cryptography Module (crypto.js)
 * 
 * Handles key derivation, encryption, and decryption using the Web Crypto API.
 * This module derives a 256-bit AES-GCM key from a passphrase using PBKDF2,
 * encrypts secret text, and serializes the result into a portable string format.
 */

// ==========================================================================
// Utility Helper Functions for Encoding Conversions
// ==========================================================================

/**
 * Converts a Uint8Array buffer to a hexadecimal string.
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data.
 * @returns {string} - The hex string representation.
 */
function bufToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Converts a hexadecimal string back to a Uint8Array.
 * @param {string} hexString - The hex string.
 * @returns {Uint8Array} - The decoded binary data.
 */
function hexToBuf(hexString) {
    if (hexString.length % 2 !== 0) {
        throw new Error("Invalid hex string length.");
    }
    const length = hexString.length / 2;
    const buffer = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        buffer[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return buffer;
}

/**
 * Converts a Uint8Array buffer to a Base64 string.
 * Uses window.btoa (binary-to-ASCII) utility.
 * @param {ArrayBuffer|Uint8Array} buffer - The binary data.
 * @returns {string} - The Base64 encoded string.
 */
function bufToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Converts a Base64 string back to a Uint8Array.
 * Uses window.atob (ASCII-to-binary) utility.
 * @param {string} base64String - The Base64 string.
 * @returns {Uint8Array} - The decoded binary data.
 */
function base64ToBuf(base64String) {
    const binary = window.atob(base64String);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// ==========================================================================
// Cryptographic Functions
// ==========================================================================

/**
 * Derives a 256-bit AES-GCM key from a user password using PBKDF2.
 * @param {string} password - The user-supplied passphrase.
 * @param {Uint8Array} salt - A cryptographically secure random 16-byte salt.
 * @returns {Promise<CryptoKey>} - Derived AES key.
 */
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    // Step 1: Convert the string password into a raw byte representation.
    const passwordBytes = encoder.encode(password);
    
    // Step 2: Import the raw password bytes as a base keying material.
    // This base key is not directly used for encryption, but serves as the input
    // to the Key Derivation Function (KDF).
    const baseKey = await window.crypto.subtle.importKey(
        "raw",
        passwordBytes,
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    
    // Step 3: Deriving the cryptographic key using PBKDF2 (Password-Based Key Derivation Function 2).
    // - salt: Prevents pre-computed dictionary/rainbow table attacks.
    // - iterations: 200,000 rounds of HMAC-SHA-256 slows down brute-force attempts.
    // - AES-GCM: We derive a 256-bit key ready for Galois/Counter Mode encryption.
    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 200000,
            hash: "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param {string} plaintext - The message to encrypt.
 * @param {string} passphrase - The key-derivation password.
 * @returns {Promise<string>} - Format: salt(hex) + ":" + iv(hex) + ":" + ciphertext(base64)
 */
export async function encryptMessage(plaintext, passphrase) {
    if (!plaintext || !passphrase) {
        throw new Error("Plaintext and passphrase are required for encryption.");
    }
    
    // Step 1: Convert plaintext string into UTF-8 bytes.
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);
    
    // Step 2: Generate random parameters.
    // - salt: 16 cryptographically secure random bytes for PBKDF2 key derivation.
    // - IV (Initialization Vector): 12 random bytes required by AES-GCM for uniqueness.
    //   Using the same IV with the same key destroys the security of GCM mode.
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Step 3: Derive the AES-256 key from the passphrase and salt.
    const key = await deriveKey(passphrase, salt);
    
    // Step 4: Encrypt the message bytes using AES-GCM.
    // The browser's Web Crypto implementation automatically appends a 16-byte (128-bit)
    // authentication tag to the ciphertext buffer to provide integrity validation.
    const ciphertextBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        plaintextBytes
    );
    
    const ciphertextBytes = new Uint8Array(ciphertextBuffer);
    
    // Step 5: Convert parameters and ciphertext to hex/base64 representations.
    const saltHex = bufToHex(salt);
    const ivHex = bufToHex(iv);
    const ciphertextBase64 = bufToBase64(ciphertextBytes);
    
    // Step 6: Construct and return the serialized colon-separated payload.
    return `${saltHex}:${ivHex}:${ciphertextBase64}`;
}

/**
 * Decrypts a serialized payload using AES-256-GCM.
 * @param {string} encryptedPayload - Format: salt(hex) + ":" + iv(hex) + ":" + ciphertext(base64)
 * @param {string} passphrase - The decryption password.
 * @returns {Promise<string>} - The decrypted plaintext string.
 */
export async function decryptMessage(encryptedPayload, passphrase) {
    if (!encryptedPayload || !passphrase) {
        throw new Error("Encrypted payload and passphrase are required for decryption.");
    }
    
    try {
        // Step 1: Parse the string payload back into its components.
        const parts = encryptedPayload.split(':');
        if (parts.length !== 3) {
            throw new Error("Invalid payload format. Expected three colon-separated parts.");
        }
        
        const saltHex = parts[0];
        const ivHex = parts[1];
        const ciphertextBase64 = parts[2];
        
        // Step 2: Decode strings back into binary byte buffers.
        const salt = hexToBuf(saltHex);
        const iv = hexToBuf(ivHex);
        const ciphertextBytes = base64ToBuf(ciphertextBase64);
        
        // Step 3: Re-derive the AES-256 decryption key using the extracted salt.
        // The iterations and hash type must match the encryption steps exactly.
        const key = await deriveKey(passphrase, salt);
        
        // Step 4: Decrypt the ciphertext using AES-GCM.
        // The Web Crypto API automatically splits the authentication tag off the end
        // of the ciphertext, decrypts the bytes, and checks the tag integrity.
        // If the tag doesn't match (indicating modified data or wrong key), it throws an error.
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            ciphertextBytes
        );
        
        // Step 5: Decode the plaintext bytes back to a UTF-8 string and return.
        const decoder = new TextDecoder();
        return decoder.decode(decryptedBuffer);
        
    } catch (error) {
        // Wrap any failure in a user-friendly error message.
        // In cryptography, we avoid specifying whether the password was wrong
        // or the data was corrupted to prevent side-channel timing attacks.
        throw new Error("Decryption failed: wrong passphrase or corrupted data.");
    }
}
