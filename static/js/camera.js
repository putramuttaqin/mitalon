const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ambilBtn = document.getElementById('ambilFoto');
const toggleBtn = document.getElementById('toggleCamera');
const ulangBtn = document.getElementById('fotoUlang');
const galeriBtn = document.getElementById('galeriBtn');
const fotoActions = document.getElementById('fotoActions');

let capturedBlob = null;
let currentStream = null;
let useFrontCamera = true; // default selfie

// Start camera
async function startCamera() {
  if (currentStream) {
    // stop all tracks sebelum switch kamera
    currentStream.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: {
      facingMode: useFrontCamera ? "user" : "environment"
    }
  };

  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;
  } catch (err) {
    alert('Gagal mengakses kamera: ' + err);
  }
}

// Start pertama kali
startCamera();

// Capture foto
ambilBtn.onclick = () => {
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  canvas.classList.remove('hidden');
  video.classList.add('hidden');
  galeriBtn.classList.add('hidden');
  toggleBtn.classList.add('hidden');

  canvas.toBlob(blob => capturedBlob = blob, 'image/jpeg', 0.7);
  ambilBtn.classList.add('hidden');
  fotoActions.classList.remove('hidden');
};

// Ulang foto
ulangBtn.onclick = () => {
  video.classList.remove('hidden');
  canvas.classList.add('hidden');
  ambilBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');
  galeriBtn.classList.remove('hidden');
  toggleBtn.classList.remove('hidden');
  capturedBlob = null;
};

// Toggle kamera
toggleBtn.onclick = () => {
  useFrontCamera = !useFrontCamera;
  startCamera();
};
