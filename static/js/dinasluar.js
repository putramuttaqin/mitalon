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
let useFrontCamera = false; // default rear camera
let capturedBlob = null;
let lat = '', long = '', address = '-';

// === CAMERA FUNCTIONS ===
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
  } catch (err) {
    alert("Gagal mengakses kamera: " + err);
  }
}

// Start camera on load
startCamera();

// Toggle camera
toggleBtn.onclick = () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
};

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
  } catch (e) {
    console.error("Failed reverse geocode:", e);
  }
});

// === CAPTURE PHOTO WITH WATERMARK ===
ambilBtn.onclick = async () => {
  const tempCanvas = document.createElement('canvas');
  const ctxTemp = tempCanvas.getContext('2d');
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  ctxTemp.drawImage(video, 0, 0);

  const watermarkedBlob = await addWatermarkOnCanvas(tempCanvas, address);

  // show on main canvas
  const mainCtx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    mainCtx.drawImage(img, 0, 0);

    canvas.classList.remove('hidden');
    video.classList.add('hidden');
    ambilBtn.classList.add('hidden');
    toggleBtn.classList.add('hidden');
    dummyBtn.classList.add('hidden');
    fotoActions.classList.remove('hidden');
  };
  img.src = URL.createObjectURL(watermarkedBlob);
  capturedBlob = watermarkedBlob;
};

// Retake photo
ulangBtn.onclick = () => {
  canvas.classList.add('hidden');
  video.classList.remove('hidden');

  ambilBtn.classList.remove('hidden');
  toggleBtn.classList.remove('hidden');
  dummyBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');

  capturedBlob = null;
};

// Download photo
downloadBtn.onclick = async () => {
  if (!capturedBlob) return alert("Belum ada foto yang diambil!");

  const today = new Date();
  const url = URL.createObjectURL(capturedBlob);

  // Trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = `travel_${today.getTime()}.jpg`;
  a.click();
  URL.revokeObjectURL(a.href);

  // Upload to server as backup
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
    const rightTextLines = ["Mitalon", "Kanwil Kemenkum Aceh", formattedDate];

    ctx.font = "20px Arial";
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
    const padding = 10;

    const leftLines = wrapText(ctx, leftText, canvasW.width * 0.45);

    // Draw left bottom
    leftLines.forEach((line, i) => {
      const y = canvasW.height - (leftLines.length - i) * 26 - padding;
      ctx.strokeText(line, padding, y);
      ctx.fillText(line, padding, y);
    });

    // Load and draw watermark logo + right bottom text
    const logo = new Image();
    logo.src = "/static/images/watermark.png"; // path logo pengayoman
    logo.onload = () => {
      const logoSize = 60; // atur ukuran logo
      const textLineHeight = 26;

      // Hitung total tinggi blok teks + logo
      const totalHeight = logoSize + rightTextLines.length * textLineHeight + padding * 2;

      // Posisi Y awal (logo paling atas)
      let startY = canvasW.height - totalHeight;

      // Posisi logo (kanan bawah di atas teks)
      ctx.drawImage(logo, canvasW.width - logoSize - padding, startY, logoSize, logoSize);

      // Posisi teks (di bawah logo)
      rightTextLines.forEach((line, i) => {
        const metrics = ctx.measureText(line);
        const y = startY + logoSize + (i + 1) * textLineHeight;
        ctx.strokeText(line, canvasW.width - metrics.width - padding, y);
        ctx.fillText(line, canvasW.width - metrics.width - padding, y);
      });

      canvasW.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
    };

    logo.onerror = () => {
      console.error("Gagal load logo watermark");
      // fallback: tetap render teks tanpa logo
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


// Helper for wrapping long text
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + ' ' + word).width;
    if (width < maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}
