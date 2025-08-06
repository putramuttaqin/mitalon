// === Element References ===
const $ = id => document.getElementById(id);
const [namaInput, suggestionsBox, video, canvas, fileInput] = 
  ['nama', 'suggestions', 'video', 'canvas', 'fileInput'].map($);
const [ambilBtn, ulangBtn, uploadBtn, fotoActions, galeriBtn] = 
  ['ambilFoto', 'fotoUlang', 'uploadFoto', 'fotoActions', 'galeriBtn'].map($);
const [alamatSpan, koordinatSpan] = ['alamat', 'koordinat'].map($);

let lat = '', long = '', address = '', pegawaiList = [], capturedBlob = null;

// === Suggestions ===
fetch('/static/pegawai.json')
  .then(res => res.json())
  .then(data => {
    pegawaiList = data;
    namaInput.addEventListener('input', handleNameInput);
  });

function handleNameInput() {
  const keyword = namaInput.value.toLowerCase();
  const matches = pegawaiList.filter(p => p.toLowerCase().includes(keyword));
  renderSuggestions(matches);
}

function renderSuggestions(list) {
  suggestionsBox.innerHTML = '';
  if (!list.length) return suggestionsBox.classList.add('hidden');
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = p;
    div.onclick = () => {
      namaInput.value = p;
      suggestionsBox.classList.add('hidden');
    };
    suggestionsBox.appendChild(div);
  });
  suggestionsBox.classList.remove('hidden');
}

// === Geolocation ===
navigator.geolocation.getCurrentPosition(async pos => {
  lat = pos.coords.latitude;
  long = pos.coords.longitude;
  koordinatSpan.textContent = `${lat}, ${long}`;
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`);
  const data = await res.json();
  address = data.display_name || '-';
  alamatSpan.textContent = address;
});

// === Camera ===
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(err => alert('Gagal mengakses kamera: ' + err));

// === Take Photo ===
ambilBtn.onclick = () => {
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  canvas.classList.remove('hidden');
  video.classList.add('hidden');
  ambilBtn.classList.add('hidden');
  galeriBtn.classList.add('hidden');
  fotoActions.classList.remove('hidden');

  canvas.toBlob(blob => {
    capturedBlob = blob;
  }, 'image/jpeg', 0.7);
};

// === Upload from Gallery ===
galeriBtn.onclick = () => fileInput.click();

fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  capturedBlob = file;
  const img = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      canvas.classList.remove('hidden');
      video.classList.add('hidden');
      ambilBtn.classList.add('hidden');
      galeriBtn.classList.add('hidden');
      fotoActions.classList.remove('hidden');
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// === Foto Ulang ===
ulangBtn.onclick = () => {
  capturedBlob = null;
  canvas.classList.add('hidden');
  video.classList.remove('hidden');
  ambilBtn.classList.remove('hidden');
  galeriBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');
};

// === Upload Foto ===
uploadBtn.onclick = async () => {
  if (!validateInputs()) return;
  try {
    showPopup('loading');
    const base64Data = await blobToBase64(capturedBlob);
    await uploadToServer(base64Data);
    showPopup('success');
    setTimeout(() => window.location.href = "/", 2000);
  } catch (err) {
    showPopup('error', err.message || "Terjadi kesalahan saat upload.");
    console.error(err);
  }
};

function validateInputs() {
  if (!namaInput.value.trim()) return alert("Nama wajib diisi.") || false;
  if (!lat || !long || address === '-') return alert("Lokasi belum tersedia.") || false;
  if (!capturedBlob) return alert("Foto belum diambil.") || false;
  return true;
}

function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function uploadToServer(base64Data) {
  const payload = {
    image: base64Data,
    nama: namaInput.value.trim(),
    alamat: address,
    koordinat: `${lat}, ${long}`
  };
  const res = await fetch("/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  if (!res.ok || result.status !== "ok") throw new Error(result.message || "Gagal upload.");
}

// === Popup Handling ===
function showPopup(type, message = "") {
  document.querySelectorAll('.popup-overlay').forEach(p => p.classList.add('hidden'));
  const popup = document.getElementById(`${type}Popup`);
  if (message && type === 'error') {
    document.getElementById('errorMessage').textContent = message;
  }
  popup.classList.remove('hidden');
  if (['success', 'error', 'duplicate'].includes(type)) {
    setTimeout(() => popup.classList.add('hidden'), 3000);
  }
}

// === Suggestions Auto-disable Upload ===
namaInput.addEventListener('blur', async () => {
  const name = namaInput.value.trim();
  if (!name) return;
  const res = await fetch(`/uploaded?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  uploadBtn.disabled = data.uploaded;
  uploadBtn.textContent = data.uploaded ? "Sudah Upload" : "Upload Foto";
});

// === Initial UI State ===
window.addEventListener('DOMContentLoaded', () => {
  ambilBtn.classList.remove('hidden');
  galeriBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');
});
