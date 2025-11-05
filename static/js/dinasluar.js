let video = document.getElementById("video");
let canvas = document.getElementById("canvas");
let currentStream = null;
let currentZoom = 1;
let track = null;
let capabilities = null;

const cameraInfo = document.createElement("div");
cameraInfo.style.textAlign = "center";
cameraInfo.style.fontSize = "0.8rem";
cameraInfo.style.color = "#aaa";
cameraInfo.style.marginTop = "6px";
video.insertAdjacentElement("afterend", cameraInfo);

async function listAndChooseCamera(preferBack = true) {
  try {
    // Request permission first so labels become available
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === "videoinput");

    cameraInfo.innerHTML = "<b>Detected cameras:</b><br>";
    videoDevices.forEach((cam, i) => {
      cameraInfo.innerHTML += `${i}: ${cam.label || "Unnamed"}<br>`;
    });

    // --- Pick the most suitable one ---
    let chosenDevice = null;

    // Prefer "ultrawide" in label if exists
    chosenDevice = videoDevices.find((d) =>
      d.label.toLowerCase().includes("wide")
    );

    // Otherwise, prefer back camera
    if (!chosenDevice && preferBack) {
      chosenDevice = videoDevices.find((d) =>
        d.label.toLowerCase().includes("back")
      );
    }

    // Fallback: first camera
    if (!chosenDevice) chosenDevice = videoDevices[0];

    cameraInfo.innerHTML += `<br><b>Using:</b> ${chosenDevice.label || "Unknown Camera"}<br>`;
    await startCamera(chosenDevice.deviceId);
  } catch (e) {
    console.error("Camera detection failed:", e);
    cameraInfo.innerText = "Gagal mendeteksi kamera.";
  }
}

async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: { facingMode: useFrontCamera ? "user" : "environment" }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
    video.onloadedmetadata = () => video.play();

    // === Detect capabilities ===
    const [track] = currentStream.getVideoTracks();
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    const settings = track.getSettings ? track.getSettings() : {};
    const zoomInfo = document.createElement("div");
    zoomInfo.id = "zoomInfo";
    zoomInfo.style.color = "#aaa";
    zoomInfo.style.fontSize = "0.9rem";
    zoomInfo.style.textAlign = "center";
    zoomInfo.style.marginTop = "4px";

    const container = document.querySelector(".dl-camera");
    let text = "";

    if (capabilities.zoom) {
      const { min, max, step } = capabilities.zoom;
      text = `Zoom range: ${min}× to ${max}× (step ${step || 0.1}), current: ${settings.zoom || 1}×`;
      // Set default zoom to minimum (acts as “ultrawide”)
      const defaultZoom = min || 1;
      applyZoom(defaultZoom, track, capabilities);
    } else {
      text = "Zoom not supported on this camera.";
    }

    zoomInfo.textContent = text;

    // Replace or append below video
    const existingInfo = document.getElementById("zoomInfo");
    if (existingInfo) existingInfo.remove();
    container.insertAdjacentElement("afterend", zoomInfo);

  } catch (err) {
    alert("Gagal mengakses kamera: " + err);
  }
}

function applyZoom(level, track, capabilities) {
  currentZoom = level;
  if (track && capabilities && capabilities.zoom) {
    const settings = { advanced: [{ zoom: currentZoom }] };
    track.applyConstraints(settings).catch(e => console.error("Zoom apply failed:", e));
  } else {
    video.style.transform = `scale(${currentZoom})`;
    video.style.transformOrigin = "center center";
    video.style.transition = "transform 0.25s ease";
  }

  // Update zoom text if visible
  const zoomInfo = document.getElementById("zoomInfo");
  if (zoomInfo) zoomInfo.textContent = `Current zoom: ${currentZoom}×`;
}


document.querySelectorAll(".zoom-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const level = parseFloat(btn.dataset.zoom);
    applyZoom(level);
  });
});

// --- Capture photo with watermark preview ---
document.getElementById("ambilFoto").addEventListener("click", () => {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Add watermark text
  const text = "MITALON - Dinas Luar";
  ctx.font = "24px Arial";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(text, 20, canvas.height - 30);

  // Show preview
  const imgPreview = document.createElement("img");
  imgPreview.src = canvas.toDataURL("image/png");
  imgPreview.style.width = "100%";
  imgPreview.style.borderTop = "1px solid #333";
  cameraInfo.insertAdjacentElement("afterend", imgPreview);
});

// Initialize
listAndChooseCamera();
