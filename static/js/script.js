const $ = id => document.getElementById(id);
const [namaInput, suggestionsBox, video, canvas] =
  ['nama', 'suggestions', 'video', 'canvas'].map($);
const [ambilBtn, ulangBtn, uploadBtn, fotoActions] =
  ['ambilFoto', 'fotoUlang', 'uploadFoto', 'fotoActions'].map($);
const [alamatSpan, koordinatSpan] = ['alamat', 'koordinat'].map($);

let lat = '', long = '', address = '', pegawaiList = [], capturedBlob = null;

// Load pegawai list
fetch('/static/pegawai.json')
  .then(res => res.json())
  .then(data => {
    pegawaiList = data;
    namaInput.addEventListener('input', () => {
      const keyword = namaInput.value.toLowerCase();
      const result = pegawaiList.filter(p => p.toLowerCase().includes(keyword));
      renderSuggestions(result);
    });
  });

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

async function hasAlreadyUploaded(name) {
  const res = await fetch(`/uploaded?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  return data.uploaded;
}

document.addEventListener('click', e => {
  if (!suggestionsBox.contains(e.target) && e.target !== namaInput) {
    suggestionsBox.classList.add('hidden');
  }
});

namaInput.addEventListener('focus', () => {
  namaInput.value = '';
  renderSuggestions(pegawaiList);
});

// Kamera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => video.srcObject = stream)
  .catch(err => alert('Gagal mengakses kamera: ' + err));

// Lokasi
navigator.geolocation.getCurrentPosition(async pos => {
  lat = pos.coords.latitude;
  long = pos.coords.longitude;
  koordinatSpan.textContent = `${lat}, ${long}`;
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`);
  const data = await res.json();
  address = data.display_name || '-';
  alamatSpan.textContent = address;
});

// Ambil Foto
ambilBtn.onclick = () => {
  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  canvas.classList.remove('hidden');
  video.classList.add('hidden');

  canvas.toBlob(blob => {
    capturedBlob = blob;
  }, 'image/jpeg', 0.7);

  ambilBtn.classList.add('hidden');
  fotoActions.classList.remove('hidden');
};

// Foto Ulang
ulangBtn.onclick = () => {
  video.classList.remove('hidden');
  canvas.classList.add('hidden');
  ambilBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');
  capturedBlob = null;
};

// Upload Button Click
uploadBtn.onclick = async () => {
  const name = namaInput.value.trim();
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

// Validation
function validateInputs() {
  if (!namaInput.value.trim()) {
    alert("Nama wajib diisi.");
    return false;
  }
  if (!lat || !long || address === '-') {
    alert("Lokasi belum tersedia.");
    return false;
  }
  if (!capturedBlob) {
    alert("Foto belum diambil.");
    return false;
  }
  return true;
}

// Convert Blob to Base64
function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

// Upload to local /upload route
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
  if (!res.ok || result.status !== "ok") {
    throw new Error(result.message || "Gagal upload.");
  }
}

// Popup controller
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

// Initial UI Setup
window.addEventListener('DOMContentLoaded', () => {
  ambilBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');

  namaInput.addEventListener('blur', async () => {
    const name = namaInput.value.trim();
    if (name) {
      const uploaded = await hasAlreadyUploaded(name);
      uploadBtn.disabled = uploaded;
      uploadBtn.textContent = uploaded ? "Sudah Upload" : "Upload Foto";
    }
  });
});
