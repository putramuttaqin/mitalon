import os
import json
import base64
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

# === CONFIG ===
load_dotenv()
DATA_FOLDER = 'data'
UPLOAD_FOLDER = 'uploads'
SUBMISSION_JSON = os.path.join(DATA_FOLDER, 'submissions.json')
GAS_URL = os.getenv('GAS_URL', '')

if not GAS_URL:
    raise ValueError("GAS_URL not found in environment variables (.env)")

# === LOAD / SAVE JSON ===
def load_submissions():
    try:
        with open(SUBMISSION_JSON, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_submissions(data):
    with open(SUBMISSION_JSON, 'w') as f:
        json.dump(data, f, indent=2)

# === BACKUP LOGIC ===
def backup_unsynced():
    submissions = load_submissions()
    success_count = 0
    failed_count = 0
    failures = []

    for date_key, day_data in submissions.items():
        for name, details in day_data.items():
            if details.get("synced") is True:
                continue  # already synced

            image_filename = details.get("image")
            image_path = os.path.join(UPLOAD_FOLDER, image_filename) if image_filename else None

            # Check image file
            if not image_path or not os.path.exists(image_path):
                failed_count += 1
                failures.append({
                    "name": name,
                    "date": date_key,
                    "reason": f"Image file missing: {image_path}"
                })
                continue

            try:
                # Encode image
                with open(image_path, "rb") as img_f:
                    img_b64 = base64.b64encode(img_f.read()).decode("utf-8")

                payload = {
                    "nama": name,
                    "alamat": details.get("alamat", ""),
                    "koordinat": details.get("koordinat", ""),
                    "image": img_b64
                }

                # Send to GAS
                res = requests.post(GAS_URL, json=payload, timeout=15)

                if res.status_code == 200:
                    details["synced"] = True
                    success_count += 1
                else:
                    failed_count += 1
                    failures.append({
                        "name": name,
                        "date": date_key,
                        "reason": f"GAS response {res.status_code}: {res.text}"
                    })

            except Exception as e:
                failed_count += 1
                failures.append({
                    "name": name,
                    "date": date_key,
                    "reason": str(e)
                })

    save_submissions(submissions)

    # === SUMMARY ===
    print(f"\nBackup finished at {datetime.now(ZoneInfo('Asia/Jakarta')).strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"✅ Success: {success_count}")
    print(f"❌ Failed: {failed_count}")

    if failures:
        print("\n--- Failed Entries ---")
        for fail in failures:
            print(f"- {fail['date']} | {fail['name']} | {fail['reason']}")

if __name__ == "__main__":
    backup_unsynced()
