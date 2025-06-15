const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const preview = document.getElementById("captured-image");
const captureBtn = document.getElementById("capture-btn");
const retakeBtn = document.getElementById("retake-btn");
const downloadBtn = document.getElementById("download-btn");
const formLink = document.getElementById("form-link");

navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => { video.srcObject = stream; })
  .catch(err => { alert("Kamera tidak tersedia: " + err); });

function resizeImage(dataUrl, maxSizeKB, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const scale = Math.sqrt((maxSizeKB * 1024) / (img.width * img.height * 0.7));
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", 0.7));
  };
  img.src = dataUrl;
}

function capture() {
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL("image/jpeg", 0.9);

  resizeImage(dataURL, 1000, resized => {
    preview.src = resized;
    preview.style.display = "block";
    video.style.display = "none";

    downloadBtn.href = resized;
    downloadBtn.style.display = "inline-block";
    retakeBtn.style.display = "inline-block";

    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      document.getElementById("coord-text").textContent = `${lat}, ${lon}`;
      document.getElementById("coordinates").value = `${lat}, ${lon}`;

      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
        .then(res => res.json())
        .then(data => {
          const address = data.display_name || "Alamat tidak ditemukan";
          document.getElementById("address-text").textContent = address;
          document.getElementById("address").value = address;
          document.getElementById("location-info").style.display = "block";

          // Compose prefilled Google Form link
          const nama = encodeURIComponent(document.getElementById("nama").value);
          const nip = encodeURIComponent(document.getElementById("nip").value);
          const alamat = encodeURIComponent(address);
          const koordinat = encodeURIComponent(`${lat}, ${lon}`);

          const formURL = `https://docs.google.com/forms/d/e/1FAIpQLSfbQOMAbmcPsEj-SsVx_MoxFV_0MFRyCUphD2DEJhsb-dQyGw/viewform?entry.905667977=${nama}&entry.682464978=${nip}&entry.659034556=${alamat}&entry.635143087=${koordinat}`;
          formLink.href = formURL;
          formLink.style.display = "inline-block";
        });
    }, err => alert("Gagal mendapatkan lokasi: " + err.message));
  });
}

captureBtn.onclick = capture;

retakeBtn.onclick = () => {
  video.style.display = "block";
  preview.style.display = "none";
  retakeBtn.style.display = "none";
  downloadBtn.style.display = "none";
  formLink.style.display = "none";
  document.getElementById("location-info").style.display = "none";
};
