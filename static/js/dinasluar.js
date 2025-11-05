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

async function startCamera(deviceId) {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
  }

  const constraints = {
    video: {
      deviceId: { exact: deviceId },
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  currentStream = stream;
  video.srcObject = stream;

  // Extract track and capabilities
  track = stream.getVideoTracks()[0];
  capabilities = track.getCapabilities ? track.getCapabilities() : null;

  if (capabilities && capabilities.zoom) {
    cameraInfo.innerHTML += `<br>Zoom range: ${capabilities.zoom.min} - ${capabilities.zoom.max}`;
  } else {
    cameraInfo.innerHTML += `<br>Zoom not supported by this device.`;
  }
}

function applyZoom(level) {
  currentZoom = level;
  if (track && capabilities && capabilities.zoom) {
    const settings = { advanced: [{ zoom: currentZoom }] };
    track.applyConstraints(settings).catch((e) => console.error("Zoom apply failed:", e));
  } else {
    video.style.transform = `scale(${currentZoom})`;
    video.style.transformOrigin = "center center";
  }
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
