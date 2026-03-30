# 🐕 DogDetector AI: Edge-to-Web Implementation

This project utilizes a custom-trained **MobileNetV1** machine learning model to detect dogs via a web interface. The system transitions from a resource-constrained microcontroller environment (Arduino Nano 33 BLE Sense) to a robust, scalable local deployment using Docker and Node.js.

---

## 🏗️ System Architecture

The application operates through three distinct layers:

1. **The Eyes (Frontend):** A custom `index.html` interface that captures webcam frames via `getUserMedia` and manages the UI state with live auto-scanning every 1.5 seconds.
2. **The Bridge (Proxy Server):** A `server.js` Node.js/Express server that bypasses browser security (CORS) and routes traffic between the frontend and the inference container.
3. **The Brain (Inference):** An Edge Impulse Docker container performing real-time classification on $96 \times 96$ grayscale images.

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────────┐
│  Browser UI  │ POST  │  Express Proxy   │ POST  │  Edge Impulse Docker │
│  index.html  │──────▶│  server.js:3000  │──────▶│  Container:1337      │
│  (webcam)    │◀──────│  /proxy-scan     │◀──────│  /api/image          │
└──────────────┘ JSON  └──────────────────┘ JSON  └──────────────────────┘
```

---

## 🚀 Technical Setup

### Prerequisites

| Tool | Purpose |
| :--- | :--- |
| **Docker Desktop** | Runs the Edge Impulse inference container |
| **Node.js ≥ 18** | Runs the Express proxy server |
| **npm** | Installs server dependencies |
| **Ngrok** *(optional)* | Secure tunnel for mobile camera access |

### 1. Starting the Inference Engine

Deploy the Edge Impulse container using your project's API key. This opens port **1337** for incoming image requests.

```bash
docker run --rm -it -p 1337:1337 \
  public.ecr.aws/g7a8t7v6/inference-container:v1.92.3 \
  --api-key YOUR_EI_API_KEY \
  --run-http-server 1337
```

Verify it's running:

```bash
curl http://localhost:1337/api/info
```

### 2. Installing Dependencies & Launching the Server

```bash
npm install
node server.js
```

The server starts on **http://localhost:3000**, serves the frontend, and proxies scan requests to the Docker container.

### 3. Enabling Mobile Access (Optional)

Mobile browsers require HTTPS to grant camera access. Use Ngrok to create a secure tunnel:

```bash
ngrok http 3000
```

Open the generated `https://` URL on your phone.

---

## 🛠️ Roadblocks & Solutions

During development, several critical issues were addressed:

| Issue | Technical Root Cause | Resolution |
| :--- | :--- | :--- |
| **CORS / Connection Error** | Browser security blocks local files (`file:///`) from making requests to `localhost:1337`. The inference container returns no `Access-Control-Allow-Origin` headers. | Created `server.js` to serve the HTML via `http://localhost:3000` and proxy `/proxy-scan` requests to the container. |
| **"Unexpected field" 400 Error** | The Edge Impulse `/api/image` endpoint expects the multipart field name `file`, not `image`. The container uses `multer` internally and rejects unknown field names. | Changed the form field from `image` to `file` in both the frontend (`FormData.append`) and the proxy (`multer.single("file")`). Discovered via the container's built-in docs at `http://localhost:1337/`. |
| **Silent Inference (0ms)** | Microcontroller RAM overflow during TFLite tensor allocation on Arduino Nano 33 BLE Sense. | Switched to **EON™ Compiler** and **MobileNetV1 0.2** to fit within **256KB RAM**. |
| **Docker Connection Failure** | Terminal commands failed because the Docker Desktop engine was closed. | Ensured the Docker daemon was active before running container commands. |
| **Mobile Camera Block** | Mobile browsers (iOS/Android) disable `getUserMedia` on non-secure (`http://`) origins. | Used **Ngrok** to provide a secure `https://` endpoint for mobile testing. |
| **172.17.0.2 Unreachable** | Attempted to ping the internal Docker bridge IP, which is isolated from the host Mac network. | Used port mapping (`-p 1337:1337`) to access the container via `localhost`. |
| **Notification Sound 404** | The original sound URL (`soundjay.com/buttons/sounds/button-09.mp3`) returned HTTP 404. Audio element loaded silently with no error in the UI. | Replaced with a working audio source. |

---

## ⚙️ Configuration Reference

| Parameter | Value | Location |
| :--- | :--- | :--- |
| Proxy server port | `3000` | `server.js` line 9 |
| Inference container port | `1337` | `server.js` line 10 |
| Scan interval | `1500ms` | `index.html` `SCAN_INTERVAL` |
| Detection threshold | `> 0.6` (60%) | `index.html` `isDog` check |
| Canvas capture size | `400 × 400` | `index.html` `captureCanvas` |
| JPEG quality | `0.9` | `index.html` `toBlob` call |
| Model input | `96 × 96 Grayscale` | Edge Impulse impulse config |

---

## 📂 Repository Contents

| File | Description |
| :--- | :--- |
| `index.html` | Dark-themed UI with webcam integration, auto-scan loop, confidence bars, and audio alerts |
| `server.js` | Express proxy server with request logging and visual confidence bar output in terminal |
| `package.json` | Node.js dependencies: `express`, `cors`, `multer`, `axios`, `form-data` |
| `dog_test.jpg` | Sample test image for verifying the inference pipeline via `curl` |
| `README.md` | This documentation |

---

## 🧪 Testing Without a Camera

You can verify the full pipeline from the command line:

```bash
curl -s -X POST -F 'file=@dog_test.jpg' http://localhost:3000/proxy-scan | python3 -m json.tool
```

Expected output:

```json
{
    "result": {
        "classification": {
            "dog": 0.98,
            "not-dog": 0.02
        }
    }
}
```

---

## 📝 Browser Compatibility Notes

- **Camera access** requires a secure context: `localhost` or `https://`. Opening `index.html` via `file:///` will not work.
- **Audio autoplay policy:** Browsers require at least one user interaction before `audio.play()` succeeds. The "Start Scanning" button click satisfies this requirement.
- **`getUserMedia` constraints:** The frontend requests `facingMode: 'environment'` to prefer the rear camera on mobile devices. Desktop browsers will use the default webcam.
