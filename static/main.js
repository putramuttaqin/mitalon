const video = document.getElementById('video');
const preview = document.getElementById('captured-image');
const canvas = document.getElementById('canvas');

// Start camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => { video.srcObject = stream; })
  .catch(err => { alert("Camera access denied: " + err); });

// Capture image and show location
function capture() {
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL('image/jpeg');
  document.getElementById('photo').value = dataURL;

  // Replace video with image preview
  video.style.display = 'none';
  preview.style.display = 'block';
  preview.src = dataURL;

  // Get geolocation
  navigator.geolocation.getCurrentPosition(position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lon;
    document.getElementById('address').value = address;
    document.getElementById('coord-text').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    console.log("Lat:", lat, "Lon:", lon);


    // Reverse geocode using Nominatim
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
      .then(response => response.json())
      .then(data => {
        const address = data.display_name || 'Address not found';
        document.getElementById('location-info').style.display = 'block';
        document.getElementById('address-text').textContent = address;
      })
      .catch(error => {
        document.getElementById('address-text').textContent = 'Error getting address.';
        console.error(error);
      });

  }, err => {
    alert("Failed to get geolocation: " + err.message);
  }, {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0
});

}
