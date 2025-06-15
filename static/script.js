const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const downloadBtn = document.getElementById('downloadBtn');
const formLink = document.getElementById('formLink');
const retakeBtn = document.getElementById('retakeBtn');
const namaInput = document.getElementById('nama');
const nipInput = document.getElementById('nip');
const suggestions = document.getElementById('suggestions');
const addressSpan = document.getElementById('address');
const coordSpan = document.getElementById('coordinates');

let latitude = "";
let longitude = "";
let pegawai = [];

navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    video.srcObject = stream;
  });

navigator.geolocation.getCurrentPosition(async (position) => {
  latitude = position.coords.latitude;
  longitude = position.coords.longitude;
  coordSpan.innerText = `${latitude}, ${longitude}`;
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
  const data = await res.json();
  addressSpan.innerText = data.display_name || "Gagal mendapatkan alamat";
});

fetch('/static/pegawai.json')
  .then(res => res.json())
  .then(data => {
    pegawai = data;
  });

namaInput.addEventListener('input', () => {
  const value = namaInput.value.toLowerCase();
  suggestions.innerHTML = '';
  if (value) {
    pegawai
      .filter(p => p.nama.toLowerCase().includes(value))
      .forEach(p => {
        const item = document.createElement('button');
        item.className = 'list-group-item list-group-item-action';
        item.textContent = `${p.nama} - ${p.nip}`;
        item.onclick = () => {
          namaInput.value = p.nama;
          nipInput.value = p.nip;
          suggestions.innerHTML = '';
        };
        suggestions.appendChild(item);
      });
  }
});

captureBtn.addEventListener('click', () => {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (blob.size > 1000000) {
      alert("Ukuran gambar terlalu besar. Silakan ulangi.");
      return;
    }
    const url = URL.createObjectURL(blob);
    downloadBtn.href = url;
    downloadBtn.download = "foto.jpg";
    downloadBtn.style.display = "inline-block";
    formLink.href = `https://docs.google.com/forms/d/e/1FAIpQLSfbQOMAbmcPsEj-SsVx_MoxFV_0MFRyCUphD2DEJhsb-dQyGw/viewform?usp=pp_url&entry.123456789=${namaInput.value}&entry.987654321=${nipInput.value}&entry.135791113=${addressSpan.innerText}&entry.2468101214=${latitude},${longitude}`;
    formLink.style.display = "inline-block";
    retakeBtn.style.display = "inline-block";
    captureBtn.style.display = "none";
  }, 'image/jpeg', 0.9);
});

retakeBtn.addEventListener('click', () => {
  downloadBtn.style.display = "none";
  formLink.style.display = "none";
  retakeBtn.style.display = "none";
  captureBtn.style.display = "inline-block";
});
