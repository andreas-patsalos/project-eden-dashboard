import requests
import base64

# --- Config ---
API_URL = "http://127.0.0.1:8000/api/alert"

# A tiny 1x1 red pixel GIF to use as a placeholder
IMAGE_DATA = "data:image/gif;base64,R0lGODlhAQABAPAAAP8AACAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="

# This is the data your teammate's RPi will send
alert_payload = {
    "node_id": "RPi-Demo-Node",
    "location": {
        "lat": 34.71172,
        "lon": 32.93857
    },
    "confidence": 0.88,
    "evidence_image": IMAGE_DATA
    # In the real thing, they'll base64 encode their actual JPEG
}

# --- Send the Alert ---
try:
    print(f"Sending test alert to {API_URL}...")
    response = requests.post(API_URL, json=alert_payload)

    if response.status_code == 200:
        print("Alert sent successfully!")
        print("Server response:", response.json())
    else:
        print(f"Error: Server returned status code {response.status_code}")
        print("Response text:", response.text)

except requests.exceptions.ConnectionError:
    print(f"Error: Could not connect to the server at {API_URL}.")
    print("Is the 'main.py' server running?")