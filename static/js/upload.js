const namaInput = document.getElementById('nama');
const suggestionsBox = document.getElementById('suggestions');
const uploadBtn = document.getElementById('uploadFoto');
const alamatSpan = document.getElementById('alamat');
const koordinatSpan = document.getElementById('koordinat');

let lat = '', long = '', address = '', pegawaiList = [];

// Load pegawai list for autocomplete
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

// Dismiss suggestions
document.addEventListener('click', e => {
  if (!suggestionsBox.contains(e.target) && e.target !== namaInput) {
    suggestionsBox.classList.add('hidden');
  }
});

namaInput.addEventListener('focus', () => {
  namaInput.value = '';
  renderSuggestions(pegawaiList);
});

namaInput.addEventListener('blur', async () => {
  const name = namaInput.value.trim();
  if (name) {
    const uploaded = await hasAlreadyUploaded(name);
    uploadBtn.disabled = uploaded;
    uploadBtn.textContent = uploaded ? "Sudah Upload" : "Upload Foto";
  }
});

async function hasAlreadyUploaded(name) {
  const res = await fetch(`/uploaded?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  return data.uploaded;
}

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

// Upload
uploadBtn.onclick = async () => {
  const name = namaInput.value.trim();
  if (!validateInputs()) return;

  try {
    showPopup('loading');
    const base64Data = await blobToBase64(capturedBlob);
    await uploadToServer(base64Data, name);
    showPopup('success');
    setTimeout(() => window.location.href = "/", 2000);
  } catch (err) {
    showPopup('error', err.message || "Terjadi kesalahan saat upload.");
    console.error(err);
  }
};

function validateInputs() {
  if (!namaInput.value.trim()) return alert("Nama wajib diisi.");
  if (!lat || !long || address === '-') return alert("Lokasi belum tersedia.");
  if (!capturedBlob) return alert("Foto belum diambil.");
  return true;
}

function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function uploadToServer(base64Data, name) {
  const payload = {
    image: base64Data,
    nama: name,
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
