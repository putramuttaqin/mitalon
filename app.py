import os
import json
import threading
import base64
import queue
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify

# === CONFIG ===
app = Flask(__name__)
task_queue = queue.Queue()
load_dotenv()

UPLOAD_FOLDER = 'uploads'
DATA_FOLDER = 'data'
SUBMISSION_JSON = os.path.join(DATA_FOLDER, 'submissions.json')
GAS_URL = "https://script.google.com/macros/s/YOUR_GAS_URL/exec"  # Replace with your actual URL

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

# === UTILITIES ===
def background_worker():
    import requests
    while True:
        payload = task_queue.get()
        try:
            requests.post(GAS_URL, json=payload, timeout=10)
        except Exception as e:
            print(f"[GAS Upload Failed] {e}")
        task_queue.task_done()
        
# Start one background thread when the app starts
threading.Thread(target=background_worker, daemon=True).start()

def normalize_name(name):
    return name.strip().lower()

def load_uploaded_names():
    try:
        with open(SUBMISSION_JSON, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_uploaded_name(name):
    name = normalize_name(name)
    names = load_uploaded_names()
    if name not in names:
        names.append(name)
        with open(SUBMISSION_JSON, 'w') as f:
            json.dump(names, f)

def save_submission(name, alamat, koordinat, image_b64):
    # Save image
    img_bytes = base64.b64decode(image_b64)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_name = normalize_name(name).replace(' ', '_')
    image_filename = f"{safe_name}_{timestamp}.jpg"
    image_path = os.path.join(UPLOAD_FOLDER, image_filename)
    with open(image_path, 'wb') as f:
        f.write(img_bytes)

    # Save JSON data
    try:
        with open(SUBMISSION_JSON, 'r') as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        data = {}

    data[name] = {
        'alamat': alamat,
        'koordinat': koordinat,
        'image': image_filename,
        'timestamp': timestamp
    }

    with open(SUBMISSION_JSON, 'w') as f:
        json.dump(data, f, indent=2)

    return image_filename

def forward_to_gas_async(payload):
    task_queue.put(payload)

# === ROUTES ===
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/form')
def form():
    return render_template('form.html')

@app.route('/daftar')
def daftar():
    try:
        with open(SUBMISSION_JSON, 'r') as f:
            uploaded_names = json.load(f)
    except Exception:
        uploaded_names = []
    return render_template('daftar.html', uploaded_names=uploaded_names)

@app.route('/upload', methods=['POST'])
def upload():
    try:
        data = request.get_json()
        name = data.get('nama', '').strip()
        alamat = data.get('alamat', '')
        koordinat = data.get('koordinat', '')
        image_b64 = data.get('image', '')

        if not name or not image_b64:
            return jsonify({'status': 'error', 'message': 'Invalid data'}), 400

        image_filename = save_submission(name, alamat, koordinat, image_b64)

        forward_to_gas_async({
            'nama': name,
            'alamat': alamat,
            'koordinat': koordinat,
            'image': image_b64
        })

        return jsonify({'status': 'ok', 'filename': image_filename})

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

# === MAIN ===
if __name__ == '__main__':
    if not os.path.exists(SUBMISSION_JSON):
        with open(SUBMISSION_JSON, 'w') as f:
            json.dump([], f)
    app.run(debug=True)
