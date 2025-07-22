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
    div.textContent = `${p}`;
    div.onclick = () => {
      namaInput.value = p;
      suggestionsBox.classList.add('hidden');
    };
    suggestionsBox.appendChild(div);
  });
  suggestionsBox.classList.remove('hidden');
}

document.addEventListener('click', e => {
  if (!suggestionsBox.contains(e.target) && e.target !== namaInput) {
    suggestionsBox.classList.add('hidden');
  }
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
  address = data.display_name;
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
    const reader = new FileReader();
    reader.onload = function () {
      const jpegData = reader.result;
      const zeroth = {}, exif = {}, gps = {};

      function toDMS(deg) {
        const d = Math.floor(deg);
        const m = Math.floor((deg - d) * 60);
        const s = ((deg - d - m / 60) * 3600);
        return [[d, 1], [m, 1], [Math.round(s * 100), 100]];
      }

      gps[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
      gps[piexif.GPSIFD.GPSLatitude] = toDMS(Math.abs(lat));
      gps[piexif.GPSIFD.GPSLongitudeRef] = long >= 0 ? "E" : "W";
      gps[piexif.GPSIFD.GPSLongitude] = toDMS(Math.abs(long));

      const exifObj = { "0th": zeroth, "Exif": exif, "GPS": gps };
      const exifBytes = piexif.dump(exifObj);
      const newData = piexif.insert(exifBytes, jpegData);

      const updatedBlob = new Blob([Uint8Array.from(atob(newData.split(',')[1]), c => c.charCodeAt(0))], { type: "image/jpeg" });
      capturedBlob = updatedBlob;
    };
    reader.readAsDataURL(blob);
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

// Updated upload function
uploadBtn.onclick = async () => {
  if (!validateInputs()) return;

  try {
    showPopup('loading');
    const base64Data = await blobToBase64(capturedBlob);
    await uploadData(base64Data);
    showPopup('success');
    setTimeout(() => {
      window.location.href = "/"; // Redirect to home after popup
    }, 2000); // Matches popup display time
  } catch (err) {
    showPopup('error', err.message || "Terjadi kesalahan");
    console.error(err);
  }
};

// Helper functions
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

function blobToBase64(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

async function uploadData(base64Data) {
  const payload = {
    image: base64Data,
    nama: namaInput.value.trim(),
    alamat: address,
    koordinat: `${lat}, ${long}`
  };

  // First attempt with no-cors
  await fetch("https://script.google.com/macros/s/AKfycbx29AdQjmrN_jcmhryUJY0z6S36f-Tvld0FDU3BfydyJKh1xSSfNl5fTePvNlW5e_dtGQ/exec", {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  // Verification
  const check = await fetch(`https://script.google.com/macros/s/AKfycbx29AdQjmrN_jcmhryUJY0z6S36f-Tvld0FDU3BfydyJKh1xSSfNl5fTePvNlW5e_dtGQ/exec?check=${Date.now()}`, {
    method: "GET",
    mode: "no-cors"
  });
  const text = await check.text();
  if (text.includes("Error")) throw new Error(text);
}

// Unified popup controller
function showPopup(type, message = "") {
  // Hide all popups first
  document.querySelectorAll('.popup-overlay').forEach(popup => {
    popup.classList.add('hidden');
  });

  // Show requested popup
  const popup = document.getElementById(`${type}Popup`);
  if (message && type === 'error') {
    document.getElementById('errorMessage').textContent = message;
  }
  popup.classList.remove('hidden');

  // Auto-close rules
  if (type === 'success') {
    setTimeout(() => window.location.reload(), 2000);
  } else if (type === 'error') {
    setTimeout(() => popup.classList.add('hidden'), 3000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  ambilBtn.classList.remove('hidden');
  fotoActions.classList.add('hidden');
});
