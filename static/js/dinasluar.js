let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let ambilFoto = document.getElementById("ambilFoto");
let fotoUlang = document.getElementById("fotoUlang");
let downloadFoto = document.getElementById("downloadFoto");
let fotoActions = document.getElementById("fotoActions");
let zoomButtons = document.querySelectorAll(".zoom-btn");

let stream = null;
let track = null;
let capabilities = null;
let currentZoom = 1;

// === DEBUG AREA for mobile testing ===
const deviceInfoDiv = document.createElement("div");
deviceInfoDiv.className = "dl-device-info";
document.querySelector(".dl-camera").appendChild(deviceInfoDiv);
// =====================================

// Start default camera
async function startCamera(deviceId = null) {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    audio: false,
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  if (deviceId) constraints.video.deviceId = { exact: deviceId };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    track = stream.getVideoTracks()[0];
    capabilities = track.getCapabilities ? track.getCapabilities() : {};

    showAvailableDevices(); // refresh device list
  } catch (err) {
    console.error("Camera start failed:", err);
    deviceInfoDiv.innerHTML = `<p style="color:red">Gagal membuka kamera: ${err.message}</p>`;
  }
}

async function showAvailableDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter(d => d.kind === "videoinput");

  deviceInfoDiv.innerHTML = "<h5>Pilih Kamera:</h5>";

  cameras.forEach(cam => {
    const btn = document.createElement("button");
    btn.textContent = cam.label || `Kamera ${cam.deviceId.slice(0, 5)}...`;
    btn.className = "dl-btn dl-btn-secondary d-block w-100 mb-2";
    btn.onclick = () => startCamera(cam.deviceId);
    deviceInfoDiv.appendChild(btn);
  });

  if (cameras.length === 0) {
    deviceInfoDiv.innerHTML += "<p>Tidak ada kamera terdeteksi.</p>";
  }
}

// === ZOOM FUNCTION ===
function applyZoom(level) {
  currentZoom = level;
  if (track && capabilities && capabilities.zoom) {
    const settings = { advanced: [{ zoom: currentZoom }] };
    track.applyConstraints(settings).catch(e => {
      console.error("Zoom apply failed:", e);
    });
  } else {
    video.style.transform = `scale(${currentZoom})`;
    video.style.transformOrigin = "center center";
    video.style.transition = "transform 0.25s ease";
  }
}

zoomButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const zoomLevel = parseFloat(btn.dataset.zoom);
    applyZoom(zoomLevel);
  });
});

// === PHOTO CAPTURE ===
ambilFoto.addEventListener("click", () => {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Add watermark
  ctx.font = "24px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("MITALON", 20, canvas.height - 40);

  // Show preview
  const img = new Image();
  img.src = canvas.toDataURL("image/png");
  img.className = "dl-preview";
  fotoActions.classList.remove("hidden");

  // Replace video with preview
  video.classList.add("hidden");
  canvas.classList.remove("hidden");
  canvas.replaceWith(img);
  img.id = "capturedImage";
});

fotoUlang.addEventListener("click", () => {
  document.getElementById("capturedImage")?.remove();
  canvas.classList.add("hidden");
  video.classList.remove("hidden");
  fotoActions.classList.add("hidden");
});

downloadFoto.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = document.getElementById("capturedImage").src;
  link.download = "foto_dinas.png";
  link.click();
});

navigator.mediaDevices.getUserMedia({ video: true })
  .then(() => showAvailableDevices())
  .then(() => startCamera())
  .catch(err => {
    console.error("Permission denied or no camera:", err);
    deviceInfoDiv.innerHTML = `<p style="color:red">Tidak bisa mengakses kamera: ${err.message}</p>`;
  });
