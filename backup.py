import os
import sys
import json
import time
import base64
import requests
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from tqdm import tqdm

# ================= CONFIG =================

load_dotenv()

DATA_FOLDER = "data"
UPLOAD_FOLDER = "uploads"
SUBMISSION_JSON = os.path.join(DATA_FOLDER, "submissions.json")

GAS_URL = os.getenv("GAS_URL", "")

if not GAS_URL:
    raise ValueError("GAS_URL not found in .env")

MAX_RETRIES = 3       # first try + 2 retries
RETRY_DELAY = 2       # seconds


# ================= JSON =================

def load_submissions():
    try:
        with open(SUBMISSION_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_submissions(data):
    with open(SUBMISSION_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ================= BACKUP =================

def backup(date_key):
    submissions = load_submissions()

    if date_key not in submissions:
        print(f"No submissions found for {date_key}")
        return

    day_data = submissions[date_key]

    unsynced = {
        k: v
        for k, v in day_data.items()
        if not v.get("synced", False)
    }

    if not unsynced:
        print(f"All submissions for {date_key} are already synced.")
        return

    success = 0
    failed = 0

    failures = []

    with tqdm(
        total=len(unsynced),
        desc=f"Uploading {date_key}",
        unit="entry",
        dynamic_ncols=True
    ) as pbar:

        for name, details in unsynced.items():

            pbar.set_postfix_str(name)

            entry_errors = []

            image_filename = details.get("image")

            image_path = (
                os.path.join(UPLOAD_FOLDER, image_filename)
                if image_filename else None
            )

            # ---------------- image exists ----------------

            if not image_path or not os.path.exists(image_path):

                failures.append({
                    "name": name,
                    "date": date_key,
                    "reasons": [
                        f"Image file missing: {image_path}"
                    ]
                })

                failed += 1
                pbar.update(1)
                continue

            # ---------------- encode once ----------------

            with open(image_path, "rb") as img_f:
                img_b64 = base64.b64encode(
                    img_f.read()
                ).decode("utf-8")

            payload = {
                "nama": name,
                "alamat": details.get("alamat", ""),
                "koordinat": details.get("koordinat", ""),
                "timestamp": details.get("timestamp", ""),
                "image": img_b64
            }

            uploaded = False

            # ---------------- retry ----------------

            for attempt in range(1, MAX_RETRIES + 1):

                try:

                    response = requests.post(
                        GAS_URL,
                        json=payload,
                        timeout=30
                    )

                    if response.status_code != 200:

                        entry_errors.append(
                            f"Attempt {attempt} - HTTP {response.status_code}: {response.text}"
                        )

                    else:

                        result = response.json()

                        if result.get("status") == "success":

                            details["synced"] = True

                            save_submissions(submissions)

                            uploaded = True
                            success += 1
                            break

                        else:

                            entry_errors.append(
                                f"Attempt {attempt} - {result.get('message', 'Unknown GAS error')}"
                            )

                except Exception as e:

                    entry_errors.append(
                        f"Attempt {attempt} - {str(e)}"
                    )

                if attempt < MAX_RETRIES:
                    time.sleep(RETRY_DELAY)

            if not uploaded:

                failed += 1

                failures.append({
                    "name": name,
                    "date": date_key,
                    "reasons": entry_errors
                })

            pbar.update(1)

    print("\n" + "=" * 60)
    print(
        f"Finished at "
        f"{datetime.now(ZoneInfo('Asia/Jakarta')).strftime('%Y-%m-%d %H:%M:%S')}"
    )
    print("=" * 60)

    print(f"Date      : {date_key}")
    print(f"Uploaded  : {success}")
    print(f"Failed    : {failed}")

    if failures:

        print("\nFailed Entries")
        print("-" * 60)

        for fail in failures:

            print(f"[{fail['date']}] {fail['name']}")

            for reason in fail["reasons"]:
                print(f"Reason : {reason}")

            print()


# ================= MAIN =================

if __name__ == "__main__":

    if len(sys.argv) != 2:
        print("Usage:")
        print("    python backup.py DDMMYYYY")
        print("")
        print("Example:")
        print("    python backup.py 31072026")
        sys.exit(1)

    date_key = sys.argv[1]

    try:
        datetime.strptime(date_key, "%d%m%Y")
    except ValueError:
        print("Invalid date format. Use DDMMYYYY.")
        sys.exit(1)

    backup(date_key)