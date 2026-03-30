const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = 3000;
const INFERENCE_URL = "http://localhost:1337/api/image";

app.use(cors());

app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] --> ${req.method} ${req.url}`);
  if (req.method !== "GET") {
    console.log(`    Content-Type: ${req.headers["content-type"] || "n/a"}`);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const ms = Date.now() - start;
    console.log(`[${timestamp}] <-- ${res.statusCode} (${ms}ms)`);
    if (body?.result?.classification) {
      const c = body.result.classification;
      Object.entries(c).forEach(([label, score]) => {
        const bar = "\u2588".repeat(Math.round(score * 20));
        console.log(`    ${label.padEnd(10)} ${(score * 100).toFixed(1).padStart(5)}%  ${bar}`);
      });
    }
    if (body?.error) {
      console.log(`    ERROR: ${body.error}`);
    }
    return originalJson(body);
  };

  next();
});

app.use(express.static(__dirname));

app.post("/proxy-scan", upload.single("file"), async (req, res) => {
  if (!req.file) {
    console.log(`    No file attached to request`);
    return res.status(400).json({ error: "No image file provided" });
  }

  console.log(`    File: ${req.file.originalname || "frame.jpg"} (${(req.file.size / 1024).toFixed(1)} KB, ${req.file.mimetype})`);

  try {
    const form = new FormData();
    form.append("file", req.file.buffer, {
      filename: req.file.originalname || "frame.jpg",
      contentType: req.file.mimetype,
    });

    console.log(`    Forwarding to ${INFERENCE_URL}...`);

    const response = await axios.post(INFERENCE_URL, form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 502;
    const message =
      err.code === "ECONNREFUSED"
        ? "Inference server is not running on localhost:1337"
        : err.message;
    console.log(`    PROXY FAILED: ${message}`);
    res.status(status).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`DogDetector server running at http://localhost:${PORT}`);
  console.log(`Proxying /proxy-scan -> ${INFERENCE_URL}`);
});
