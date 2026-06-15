# StegaCrypt 🔒

StegaCrypt is a client-side **Steganography-Based Encrypted Data Transmission and Decryption System** built as a college project for cryptography. 

It allows users to encrypt a secret message using robust **AES-256-GCM** encryption and hide the resulting ciphertext inside the pixel data of a carrier PNG image using **LSB (Least Significant Bit)** steganography. The recipient can then upload the stego-image, extract the hidden ciphertext, and decrypt it using the correct password.

---

## 🛠️ Technologies Used

- **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom dark cyberpunk design system), Vanilla JavaScript (ES Modules).
- **Cryptography**: Native Web Crypto API (supported directly in modern web browsers).
- **Steganography**: HTML5 Canvas API and `ImageData` pixel array bit-masking.

---

## ⚙️ How to Run

Because the application is built entirely client-side, there are no databases or backend servers to set up.

1. **Local Server (Recommended)**: To ensure all Web Crypto API modules load securely without CORS/origin errors in Chrome/Firefox, run a simple local web server in the project folder:
   ```bash
   # Using Python
   python -m http.server 8080
   
   # Or using Node.js (npx)
   npx http-server -p 8080
   ```
   Then navigate to `http://localhost:8080` in your web browser.
2. **Direct Browser**: Alternatively, you can double-click and open the [index.html](index.html) file directly in modern browsers (e.g., Firefox or Safari) that allow Web Crypto operations on local file paths.

---

## 💡 How It Works (For Evaluators)

### 1. Symmetric Encryption & Key Derivation (AES-256-GCM + PBKDF2)
- **Password to Cryptographic Key**: The user types a simple passphrase. We use **PBKDF2** (Password-Based Key Derivation Function 2) with **200,000 iterations** of **HMAC-SHA-256** and a cryptographically secure 16-byte random salt to derive a 256-bit AES key. This prevents dictionary and GPU-assisted brute-force attacks.
- **Galois/Counter Mode (GCM)**: We encrypt the plaintext message using **AES-256-GCM**. AES-GCM is an *Authenticated Encryption with Associated Data (AEAD)* mode. It generates a 12-byte random Initialization Vector (IV) for each encryption and appends a 16-byte authentication tag to the ciphertext. If any pixel holding the ciphertext is modified, the authentication tag validation fails, preventing tampering.
- **Serialization**: The salt, IV, and GCM-ciphertext are serialized into a single colon-separated transmission payload: `salt(hex) + ":" + iv(hex) + ":" + ciphertext(base64)`.

### 2. Least Significant Bit (LSB) Steganography
- **Binary Stream Conversion**: The serialized payload string is converted into a binary bit-stream (8 bits per character).
- **Header Insertion**: We prefix a **32-bit big-endian length integer header** (expressing the character count of the payload) to the bit-stream. The decoder reads this header first so it knows exactly when the message ends, avoiding extraction of garbage pixel noise.
- **LSB Embedding**: We draw the carrier PNG onto an offscreen canvas to obtain raw RGBA pixel data. We sequentially modify the least significant bit (LSB) of the Red, Green, and Blue channels for each pixel (Alpha transparency is untouched to avoid visible patterns). Modifying the LSB changes a color value (0-255) by at most 1 unit, which is invisible to the human eye.
- **Lossless PNG requirement**: Lossy formats (like JPEG) alter pixel values during compression. We enforce lossless **PNG** encoding to preserve the LSB bit values perfectly during download and transmission.

---

## 📊 Processing Pipelines

### Hiding Pipeline (Encoding)

```
Secret Message (Text) + Passphrase
      │
      ▼ (PBKDF2 HMAC-SHA-256, 200,000 iterations)
Derived 256-bit AES Key
      │
      ▼ (AES-256-GCM Encryption)
Ciphertext + Auth Tag
      │
      ▼ (Serialization)
Formatted Payload String (salt_hex : iv_hex : ciphertext_base64)
      │
      ▼ (TextEncoder / Binary Conversion)
Bit-Stream (32-bit Length Header + Payload Bits)
      │
      ▼ (LSB Pixel Embedding into R, G, B channels)
Carrier PNG Image ────────► Stego PNG Image (Output File)
```

### Revealing Pipeline (Decoding)

```
Stego PNG Image (Uploaded File)
      │
      ▼ (Extract LSB bits of R, G, B channels)
Raw Bit-Stream
      │
      ▼ (Parse first 32 bits)
Payload Length (N characters)
      │
      ▼ (Read remaining N * 8 bits)
Ciphertext Payload String (salt_hex : iv_hex : ciphertext_base64)
      │
      ▼ (String Splitting & Base64/Hex decoding)
Salt, IV, Ciphertext (Bytes)
      │
      ▼ (Derive AES Key using Salt + Passphrase via PBKDF2)
Derived 256-bit AES Key
      │
      ▼ (AES-256-GCM Decryption & Tag verification)
Secret Message (Original Text)
```

---

## 🔒 Security & Limitations Notes

- **AEAD Choice**: AES-GCM was selected because it guarantees both **confidentiality** (hiding the content) and **authenticity** (detecting if the stego-image pixels were compressed, cropped, or edited).
- **LSB Limitations**: Steganography is not robust against image transformations. Hiding capacity is directly limited by pixel count (3 bits per pixel). Resizing, cropping, or converting the output stego-image to a lossy format (like JPEG or WebP) will destroy the hidden message.
- **Brute Force Defense**: The use of 200,000 PBKDF2 iterations makes computational dictionary attacks extremely costly for adversaries.
