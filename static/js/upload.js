const $ = id => document.getElementById(id);
const namaInput = $('nama');
const suggestionsBox = $('suggestions');
const uploadBtn = $('uploadFoto');
const alamatSpan = $('alamat');
const koordinatSpan = $('koordinat');

let lat = '', long = '', address = '', pegawaiList = [];

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

// Suggestions hide on click elsewhere
document.addEventListener('click', e => {
  if (!suggestionsBox.contains(e.target) && e.target !== namaInput) {
    suggestionsBox.classList.add('hidden');
  }
});

// Reload suggestions on focus
namaInput.addEventListener('focus', () => {
  namaInput.value = '';
  renderSuggestions(pegawaiList);
});

// Disable upload button if already uploaded
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

// Get location
navigator.geolocation.getCurrentPosition(async pos => {
  lat = pos.coords.latitude;
  long = pos.coords.longitude;
  koordinatSpan.textContent = `${lat}, ${long}`;

  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${long}&format=json`);
  const data = await res.json();

  const addr = data.address || {};

  // Prioritized address fields to include
  const parts = [
    addr.attraction,
    addr.building,
    addr.office,
    addr.shop,
    addr.amenity,
    addr.road,
    addr.house_number,
    addr.neighbourhood,
    addr.block,
    addr.residential,
    addr.village || addr.hamlet || addr.town,
    addr.city_district,
    addr.suburb || addr.district || addr.city,
    addr.county
    // purposely exclude: addr.state, addr.postcode, addr.country
  ];

  // Filter out duplicates and empty values
  const seen = new Set();
  const cleanedParts = parts
    .filter(part => part && !seen.has(part) && seen.add(part));

  const lokasi_str = cleanedParts.join(', ');
  address = lokasi_str || '-';
  alamatSpan.textContent = address;
});

// Upload button click
uploadBtn.onclick = async () => {
  const name = namaInput.value.trim();
  if (!validateInputs()) return;

  try {
    showPopup('loading');
    const resized = await resizeImage(capturedBlob, 800, 0.7); // Resize to 800px max, 70% quality
    const base64Data = await blobToBase64(resized);
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
  if (!capturedBlob) return alert("Foto belum dipilih.");
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

// Resize image using hidden canvas
function resizeImage(blob, maxSize = 800, quality = 0.7) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height *= maxSize / width;
          width = maxSize;
        } else {
          width *= maxSize / height;
          height = maxSize;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resized => resolve(resized), 'image/jpeg', quality);
    };
    img.src = URL.createObjectURL(blob);
  });
}
