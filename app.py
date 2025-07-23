import os
import json
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# === ROUTES ===
@app.route('/')
def home():
    return render_template('home.html')

@app.route('/form')
def form():
    return render_template('form.html')


# === UPLOAD LOGIC ===
UPLOAD_LOG_PATH = 'data/upload_log.json'

def normalize_name(name):
    return name.strip().lower()

def load_uploaded_names():
    if not os.path.exists(UPLOAD_LOG_PATH):
        return []
    try:
        with open(UPLOAD_LOG_PATH, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

def save_uploaded_name(name):
    name = normalize_name(name)
    names = load_uploaded_names()
    if name not in names:
        names.append(name)
        with open(UPLOAD_LOG_PATH, 'w') as f:
            json.dump(names, f)

@app.route('/uploaded')
def check_uploaded():
    name = request.args.get('name', '').strip()
    if not name:
        return jsonify({'uploaded': False})
    normalized = normalize_name(name)
    names = [normalize_name(n) for n in load_uploaded_names()]
    return jsonify({'uploaded': normalized in names})

@app.route('/log_uploaded')
def log_uploaded():
    name = request.args.get('name', '').strip()
    if name:
        save_uploaded_name(name)
        return jsonify({'status': 'ok'})
    return jsonify({'status': 'error'}), 400

@app.route('/daftar')
def daftar():
    log_path = os.path.join('data', 'upload_log.json')
    try:
        with open(log_path, 'r') as f:
            uploaded_names = json.load(f)
    except Exception:
        uploaded_names = []

    return render_template('daftar.html', uploaded_names=uploaded_names)

# === Your upload route here ===
# @app.route('/upload', methods=['POST'])
# def upload(): ...

if __name__ == '__main__':
    # Ensure log file exists at startup
    os.makedirs('data', exist_ok=True)
    if not os.path.exists(UPLOAD_LOG_PATH):
        with open(UPLOAD_LOG_PATH, 'w') as f:
            json.dump([], f)

    app.run(debug=True)
