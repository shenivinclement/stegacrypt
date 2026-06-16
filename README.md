# StegaCrypt 🔒

StegaCrypt is a browser-only, client-side web application for a college cryptography project. It is a **Steganography-Based Encrypted Data Transmission and Decryption System**.

The application combines secure cryptographic encryption with pixel-level steganographic embedding to hide confidential messages within standard PNG carrier images.

## 🚀 How to Run

**Open index.html in any modern browser. No server needed.** 

You can double-click the `index.html` file to open it directly in your browser, or serve it locally using:
```bash
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

---

## 👥 Team Member Assignments

* **MODULE 1 — Hide Message (Member 1 presents)**
  * Key derivation via PBKDF2.
  * Encryption using AES-256-GCM.
  * Image canvas loading and LSB steganographic embedding.
* **MODULE 2 — Reveal Message (Member 2 presents)**
  * Stego-image pixel reading.
  * LSB extraction and length header decoding.
  * Decryption using AES-256-GCM and key recovery.
* **MODULE 3 — Analyze Image (Member 3 presents)**
  * Capacity Calculator.
  * LSB Plane Visualizer.
  * Pixel Difference Heatmap.
  * Brightness Histogram Analysis.

---

## 🛠️ Tech Stack

* **Pure HTML, CSS, JavaScript** — No frameworks, no bundlers, no build tools, no npm package requirements.
* **Web Crypto API** — Built-in native browser API for high-performance PBKDF2 key derivation and AES-256-GCM encryption/decryption.
* **HTML5 Canvas** — Pixel-level byte manipulation and visual processing using 2D rendering contexts.
* **ES Modules** — Modular Javascript design loaded using `<script type="module">`.

---

## 📊 Processing Pipelines

### Hiding Pipeline (Encode Flow)

```
[Secret Message] + [Passphrase]
       │
       ▼ (PBKDF2 HMAC-SHA-256, 200,000 iterations)
Derived 256-bit AES Key + Salt (16 bytes)
       │
       ▼ (AES-256-GCM Encryption + 12-byte IV)
Ciphertext + 16-byte Authentication Tag
       │
       ▼ (Base64 & Hex Serialization)
Serialized Payload (salt_hex : iv_hex : ciphertext_base64)
       │
       ▼ (Convert to binary stream - 8 bits per character)
Payload Bits
       │
       ▼ (Prepend 32-bit Length Header)
Full Bit-Stream
       │
       ▼ (LSB embedding into R, G, B channels)
Carrier PNG Image ────────► Stego PNG Image (Output File)
```

### Revealing Pipeline (Decode Flow)

```
Stego PNG Image (Uploaded)
       │
       ▼ (Extract LSB bits from R, G, B channels)
Raw Bit-Stream
       │
       ▼ (Parse first 32 bits)
Payload Byte Length (N)
       │
       ▼ (Read next N * 8 bits)
Serialized Payload (salt_hex : iv_hex : ciphertext_base64)
       │
       ▼ (Parse & Hex/Base64 decode)
Salt, IV, Ciphertext bytes
       │
       ▼ (Derive AES key using Salt + Passphrase via PBKDF2)
Derived 256-bit AES Key
       │
       ▼ (AES-256-GCM Decryption & Tag verification)
[Original Plaintext Secret Message]
```

---

## 🔒 Security Notes & Steganography Theory

### Cryptographic Security (AES-256-GCM & PBKDF2)
* **PBKDF2 (SHA-256, 200,000 iterations)**: Derives a cryptographically strong symmetric key from a user-supplied password. High iteration counts significantly increase the cost of offline dictionary and brute-force attacks.
* **AES-256-GCM**: Galois/Counter Mode is an Authenticated Encryption with Associated Data (AEAD) block cipher mode. It provides both data confidentiality and integrity authentication. If stego image pixels containing the payload bits are altered, GCM tag verification will fail, instantly alerting the system to data tampering.

### LSB Steganography Theory & Analysis
* **LSB (Least Significant Bit) Embedding**: Replaces the last bit of the Red, Green, and Blue channels (skip Alpha) with message bits. Modifying color values by $\pm 1$ produces changes imperceptible to the human eye.
* **LSB Plane Visualizer**: Extracts the lowest bit of each color channel and multiplies it by 255. In normal images, the LSB is random noise; if data is hidden, distinct structured patterns (like horizontal grids) appear in the top-left area.
* **Pixel Difference Heatmap**: Highlights modified pixels in red. This visually maps out the exact payload footprint and the sequential scanner traversal path.
* **Histogram Analysis**: Evaluates brightness value frequencies ($Shadows \to Blue$, $Midtones \to Green$, $Highlights \to Red$). Natural images have smooth variations. LSB embedding equalizes adjacent even/odd bins (Value Pairs), creating statistical spikes that steganalysis software can detect.
* **Limitations**: LSB steganography is highly vulnerable to lossy compression (JPEG, WebP), crop/resize operations, and Chi-Square statistical attacks.
