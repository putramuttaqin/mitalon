// === DOM ELEMENTS ===
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ambilBtn = document.getElementById('ambilFoto');
const toggleBtn = document.getElementById('toggleCamera');
const ulangBtn = document.getElementById('fotoUlang');
const downloadBtn = document.getElementById('downloadFoto');
const dummyBtn = document.getElementById('dummyButton');
const fotoActions = document.getElementById('fotoActions');

let currentStream = null;
let useFrontCamera = false;
let capturedBlob = null;
let lat = '', long = '', address = '-';
let track = null;
let capabilities = null;

// === CAMERA FUNCTIONS ===
async function startCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }

  try {
    // Step 1: Enumerate devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === "videoinput");

    let selectedDevice = null;

    // Cari kamera ultra wide / wide
    for (const device of videoDevices) {
      const label = device.label.toLowerCase();
      if (label.includes("ultra") || label.includes("wide")) {
        selectedDevice = device;
        break;
      }
    }

    // fallback ke kamera belakang jika ada
    if (!selectedDevice) {
      selectedDevice =
        videoDevices.find(d => d.label.toLowerCase().includes("back")) ||
        null;
    }

    // Step 2: Constraints (lebih fleksibel)
    const constraints = {
      video: {
        facingMode: useFrontCamera ? "user" : "environment",
        deviceId: selectedDevice ? { ideal: selectedDevice.deviceId } : undefined
      }
    };

    // Step 3: Try getUserMedia with constraints
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.warn("Primary constraints failed:", err);

    // Step 4: Hard fallback
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
    } catch (err2) {
      alert("Gagal mengakses kamera: " + err2);
      return;
    }
  }

  // Step 5: Apply stream
  video.srcObject = currentStream;
  track = currentStream.getVideoTracks()[0];
  capabilities = track.getCapabilities();

  // Step 6: Zoom paling kecil
  if (capabilities.zoom) {
    const minZoom = capabilities.zoom.min || 1;
    track.applyConstraints({
      advanced: [{ zoom: minZoom }]
    }).catch(e => console.warn("Zoom apply failed:", e));
  }

  video.onloadedmetadata = () => video.play();
}

// === INITIALIZE CAMERA ===
startCamera();

toggleBtn.onclick = () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
};

// Disable ambil foto until location ready
ambilBtn.disabled = true;
ambilBtn.innerText = "Menunggu lokasi...";

// === GEOLOCATION ===
navigator.geolocation.getCurrentPosition(async pos => {
  lat = pos.coords.latitude;
  long = pos.coords.longitude;

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`);
    const data = await res.json();
    const addr = data.address || {};

    const parts = [
      addr.attraction, addr.building, addr.office, addr.shop, addr.amenity,
      addr.road, addr.house_number, addr.neighbourhood, addr.block,
      addr.residential, addr.village || addr.hamlet || addr.town,
      addr.city_district, addr.suburb || addr.district || addr.city,
      addr.county
    ];

    const seen = new Set();
    address = parts.filter(p => p && !seen.has(p) && seen.add(p)).join(', ') || '-';

    ambilBtn.disabled = false;
    ambilBtn.innerText = "";
  } catch (e) {
    console.error("Failed reverse geocode:", e);
    ambilBtn.disabled = false;
    ambilBtn.innerText = "";
  }
}, err => {
  console.error("Geolocation error:", err);
  ambilBtn.disabled = false;
  ambilBtn.innerText = "";
});

// === CAPTURE PHOTO WITH WATERMARK + PREVIEW ===
ambilBtn.onclick = async () => {
  const tempCanvas = document.createElement('canvas');
  const ctxTemp = tempCanvas.getContext('2d');
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;

  ctxTemp.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
  const watermarkedBlob = await addWatermarkOnCanvas(tempCanvas, address);

  // show on main canvas
  const mainCtx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    // match visible size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    mainCtx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // ensure it fills and shows correctly
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "auto";
    canvas.style.objectFit = "contain";
    canvas.style.background = "#000";

    // toggle visibility
    canvas.classList.remove('hidden');
    video.classList.add('hidden');
    ambilBtn.classList.add('hidden');
    toggleBtn.classList.add('hidden');
    dummyBtn.classList.add('hidden');
    fotoActions.classList.remove('hidden');

    console.log("Preview drawn:", canvas.width, canvas.height);
  };
  img.src = URL.createObjectURL(watermarkedBlob);
  capturedBlob = watermarkedBlob;
};

// === RETAKE PHOTO ===
ulangBtn.onclick = () => {
  canvas.classList.add('hidden');
  video.classList.remove('hidden');

  ambilBtn.classList.remove('hidden');
  toggleBtn.classList.remove('hidden');
  dummyBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');

  capturedBlob = null;
};

// === DOWNLOAD + BACKUP ===
downloadBtn.onclick = async () => {
  if (!capturedBlob) return alert("Belum ada foto yang diambil!");

  const today = new Date();
  const url = URL.createObjectURL(capturedBlob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `travel_${today.getTime()}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);

  // Backup upload
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64Data = reader.result.split(',')[1];
    try {
      const res = await fetch("/upload_dinasluar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data })
      });
      const result = await res.json();
      if (!res.ok || result.status !== "ok") {
        console.error("Backup failed:", result.message);
      } else {
        console.log("Backup saved:", result.filename);
      }
    } catch (err) {
      console.error("Backup error:", err);
    }
  };
  reader.readAsDataURL(capturedBlob);
};

// === WATERMARK FUNCTION ===
function addWatermarkOnCanvas(inputCanvas, addressText) {
  return new Promise(resolve => {
    const canvasW = document.createElement('canvas');
    const ctx = canvasW.getContext('2d');
    canvasW.width = inputCanvas.width;
    canvasW.height = inputCanvas.height;

    ctx.drawImage(inputCanvas, 0, 0);

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const today = new Date();
    const formattedDate = `${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

    const leftText = addressText || '-';
    const rightTextLines = ["Mitalon", "Kanwil Kemenkum RI Aceh", formattedDate];

    ctx.font = "20px Arial";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    const padding = 10;

    const leftLines = wrapText(ctx, leftText, canvasW.width * 0.45);

    leftLines.forEach((line, i) => {
      const y = canvasW.height - (leftLines.length - i) * 26 - padding;
      ctx.strokeText(line, padding, y);
      ctx.fillText(line, padding, y);
    });

    const logo = new Image();
    logo.src = "/static/images/watermark.png";
    logo.onload = () => {
      const logoSize = 60;
      const textLineHeight = 26;
      const totalHeight = logoSize + rightTextLines.length * textLineHeight + padding * 2;
      let startY = canvasW.height - totalHeight;
      ctx.drawImage(logo, canvasW.width - logoSize - padding, startY, logoSize, logoSize);

      rightTextLines.forEach((line, i) => {
        const metrics = ctx.measureText(line);
        const y = startY + logoSize + (i + 1) * textLineHeight;
        ctx.strokeText(line, canvasW.width - metrics.width - padding, y);
        ctx.fillText(line, canvasW.width - metrics.width - padding, y);
      });

      canvasW.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
    };

    logo.onerror = () => {
      rightTextLines.forEach((line, i) => {
        const metrics = ctx.measureText(line);
        const y = canvasW.height - (rightTextLines.length - i) * 26 - padding;
        ctx.strokeText(line, canvasW.width - metrics.width - padding, y);
        ctx.fillText(line, canvasW.width - metrics.width - padding, y);
      });
      canvasW.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
    };
  });
}

// === TEXT WRAP HELPER ===
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) currentLine += ' ' + word;
    else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
