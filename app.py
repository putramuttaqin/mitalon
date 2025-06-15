from flask import Flask, render_template, request, url_for
import base64
import os
from datetime import datetime

app = Flask(__name__)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def form():
    return render_template('form.html')

@app.route('/submit', methods=['POST'])
def submit():
    nama = request.form['nama']
    nik = request.form['nik']
    lat = request.form['latitude']
    lon = request.form['longitude']
    
    # Handle image
    image_data = request.form['photo'].split(',')[1]  # Remove the data:image/... part
    image_bytes = base64.b64decode(image_data)
    filename = f"{nik}_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    with open(filepath, 'wb') as f:
        f.write(image_bytes)

    return f"Data received:<br>Nama: {nama}<br>NIK: {nik}<br>Latitude: {lat}<br>Longitude: {lon}<br>Photo saved as: {filename}"

if __name__ == '__main__':
    app.run(debug=True)
