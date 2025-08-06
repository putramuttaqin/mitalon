import os
import json
import base64
import queue
import threading
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, send_from_directory

# === CONFIG ===
load_dotenv()
app = Flask(__name__)

UPLOAD_FOLDER = 'static/uploads'
DATA_FOLDER = 'data'
SUBMISSION_JSON = os.path.join(DATA_FOLDER, 'submissions.json')
GAS_URL = os.getenv('GAS_URL', "https://script.google.com/macros/s/YOUR_GAS_URL/exec")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DATA_FOLDER, exist_ok=True)

task_queue = queue.Queue()

# === UTILITIES ===
def normalize_name(name):
    return name.strip().lower()

def load_submissions():
    try:
        with open(SUBMISSION_JSON, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_submissions(data):
    with open(SUBMISSION_JSON, 'w') as f:
        json.dump(data, f, indent=2)

def save_submission(name, alamat, koordinat, image_b64):
    # Decode and save image
    img_bytes = base64.b64decode(image_b64)
    timestamp_raw = datetime.now()
    timestamp_str = timestamp_raw.strftime('%Y%m%d_%H%M%S')
    date_key = timestamp_raw.strftime('%d%m%Y')
    safe_name = normalize_name(name).replace(' ', '_')
    image_filename = f"{timestamp_str}_{safe_name}.jpg"
    image_path = os.path.join(UPLOAD_FOLDER, image_filename)

    with open(image_path, 'wb') as f:
        f.write(img_bytes)

    # Update JSON
    submissions = load_submissions()
    submissions[date_key][name] = {
        'alamat': alamat,
        'koordinat': koordinat,
        'image': image_filename,
        'timestamp': timestamp_str
    }
    save_submissions(submissions)

    return image_filename

def background_worker():
    import requests
    while True:
        payload = task_queue.get()
        try:
            requests.post(GAS_URL, json=payload, timeout=10)
        except Exception as e:
            print(f"[GAS Upload Failed] {e}")
        task_queue.task_done()

def forward_to_gas_async(payload):
    task_queue.put(payload)

# Start background worker
threading.Thread(target=background_worker, daemon=True).start()

# === ROUTES ===
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/form')
def form():
    return render_template('form.html')

@app.route('/attendance')
def show_details():
    raw_data = load_submissions()
    attendees = []

    for name, details in raw_data.items():
        try:
            dt = datetime.strptime(details["timestamp"], "%Y%m%d_%H%M%S")
            formatted_time = dt.strftime("%d/%m/%Y - %H:%M:%S")
        except ValueError:
            formatted_time = details["timestamp"]

        attendees.append({
            "name": name,
            "alamat": details.get("alamat", ""),
            "image": details.get("image", ""),
            "timestamp": formatted_time,
        })

    return render_template("attendance.html", attendees=attendees)

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

# Optional: serve uploads from static/uploads if needed via custom route
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# === MAIN ===
if __name__ == '__main__':
    if not os.path.exists(SUBMISSION_JSON):
        save_submissions({})
    app.run(debug=True)
