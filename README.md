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

## 🔬 Module 3: Steganalysis & Visual Analysis

Steganalysis is the practice of detecting hidden data within carrier files (such as images, audio, or network packets). This module implements four steganalysis and visual analysis tools designed to examine PNG files for traces of Least Significant Bit (LSB) embedding.

### 1. Capacity Estimation (📐 Capacity Calculator)
- **Concept**: Before attempting to embed or search for hidden data, understanding the carrying limits of an image is crucial.
- **Statistical Mechanics**: A standard 24-bit color PNG uses 3 channels (Red, Green, Blue) per pixel, with each channel containing 8 bits of color depth. Since LSB steganography modifies only the least significant bit (LSB) of each channel, the carrying capacity is exactly 3 bits per pixel.
- **Formula**:
  $$\text{Usable Bits} = \text{Width} \times \text{Height} \times 3$$
  $$\text{Max Characters} = \left\lfloor \frac{\text{Usable Bits}}{8} \right\rfloor - 4$$
  The subtraction of 4 bytes (32 bits) accounts for the length header containing the character count of the embedded payload.

### 2. LSB Plane Visualization (🔬 LSB Plane Visualizer)
- **Concept**: Visual steganalysis isolates specific bit layers of color channels to expose non-random visual patterns (artifacts) left behind by steganographic tools.
- **How It Works**: The visualizer extracts the LSB of the Red, Green, and Blue channels for each pixel and scales them to maximum intensity ($0 \to 0$ black, $1 \to 255$ white).
- **Statistical Signature**: In natural images, LSB values typically resemble uniform random noise due to camera sensor fluctuations, lighting transitions, and JPEG compression remnants. However, LSB embedding overwrites this random noise with structured binary data (such as headers and encrypted text). This creates visible, highly structured patterns—such as distinct horizontal lines or rectangular blocks of contrasting density—typically concentrated in the top-left area of the image (where the embedding process begins).

### 3. Pixel Difference Heatmapping (🌡️ Pixel Difference Heatmap)
- **Concept**: Active comparison steganalysis checks for pixel modifications by performing a direct differential overlay between the original cover image and the suspected stego-image.
- **How It Works**: The tool reads the pixel matrices of both images and computes the color delta:
  $$\Delta = |R_{\text{orig}} - R_{\text{stego}}| + |G_{\text{orig}} - G_{\text{stego}}| + |B_{\text{orig}} - B_{\text{stego}}|$$
- **Detection Details**:
  - Any pixel with $\Delta > 0$ is colored solid red ($255, 0, 0, 255$).
  - Unmodified pixels are kept but dimmed to $30\%$ opacity for structural context.
  - This immediately maps the exact spatial distribution of the steganographic payload, showing the embedding path (usually sequential row-by-row scanning).

### 4. Brightness Histogram Shift Analysis (📊 Histogram Analysis)
- **Concept**: Embedding data changes the statistical frequency distribution of pixel intensities.
- **Pair of Values (PoV) Phenomenon**: LSB steganography acts as a value-mapping function:
  - If the target bit is 0: even color values remain unchanged, and odd color values are decremented by 1 (becoming even).
  - If the target bit is 1: odd color values remain unchanged, and even color values are incremented by 1 (becoming odd).
  - Statistically, this maps color values to adjacent pairs (e.g., $2i \leftrightarrow 2i+1$). As more payload is embedded, the frequency count of even values and their adjacent odd counterparts tends to equalize.
- **Histogram Visualization**: The custom bar chart visualizes pixel brightness frequencies, colored by value ranges:
  - $0 - 85$ (Shadows / Blue)
  - $86 - 170$ (Midtones / Green)
  - $171 - 255$ (Highlights / Red)
  Under heavy embedding, the histogram shows a tell-tale flattening or "equalization" between adjacent even and odd bins (the statistical fingerprint of LSB embedding).

### 5. Limitations against Modern Steganalysis
While Least Significant Bit steganography is highly effective at hiding messages from casual human inspectors, it is extremely vulnerable to software-based steganalysis:
- **Spatial Signature**: Sequential LSB embedding modifies contiguous pixels starting from $(0,0)$, creating a sharp transition boundary in statistical properties that is easily picked up by visualizers and difference maps.
- **Chi-Square ($\chi^2$) Attack**: Since the PoV phenomenon equalizes adjacent frequencies, a Chi-Square test can mathematically compare the actual pixel distributions against expected natural distributions. If the correlation between adjacent even/odd bins is abnormally high, the presence of hidden data can be proven with near-100% statistical certainty.
- **Alternative Abstractions**: To defeat steganalysis, modern steganography uses **pseudo-random embedding paths** (determined by a cryptographic seed/key) so modifications are scattered across the image, or **content-adaptive embedding** (e.g., HUGO or S-UNIWARD) which embeds data only in complex textures or edges where statistical anomalies are harder to isolate.

---

## 🔒 Security & Limitations Notes

- **AEAD Choice**: AES-GCM was selected because it guarantees both **confidentiality** (hiding the content) and **authenticity** (detecting if the stego-image pixels were compressed, cropped, or edited).
- **LSB Limitations**: Steganography is not robust against image transformations. Hiding capacity is directly limited by pixel count (3 bits per pixel). Resizing, cropping, or converting the output stego-image to a lossy format (like JPEG or WebP) will destroy the hidden message.
- **Brute Force Defense**: The use of 200,000 PBKDF2 iterations makes computational dictionary attacks extremely costly for adversaries.
