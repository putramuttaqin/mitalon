const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ambilBtn = document.getElementById('ambilFoto');
const ulangBtn = document.getElementById('fotoUlang');
const fotoActions = document.getElementById('fotoActions');

let capturedBlob = null;

// Start webcam
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(err => alert('Gagal mengakses kamera: ' + err));

ambilBtn.onclick = () => {
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  canvas.classList.remove('hidden');
  video.classList.add('hidden');
  galeriBtn.classList.add('hidden');

  canvas.toBlob(blob => capturedBlob = blob, 'image/jpeg', 0.7);
  ambilBtn.classList.add('hidden');
  fotoActions.classList.remove('hidden');
};

ulangBtn.onclick = () => {
  video.classList.remove('hidden');
  canvas.classList.add('hidden');
  ambilBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');
  galeriBtn.classList.remove('hidden');
  capturedBlob = null;
};
