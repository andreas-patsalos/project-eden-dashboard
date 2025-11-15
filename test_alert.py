import requests
import time  # We need this to add a delay
import random

# --- Config ---
API_URL = "http://127.0.0.1:8000/api/alert"

# Valid small red square test image (to confirm the system works)
IMAGE_DATA = "/static/smoke-sample.jpg"

# --- Fire Frontline Simulation 1 (Adding) ---
print("Simulating fire frontline 1... (8 alerts)")

# 1. Starting coordinates
base_lat_1 = 34.71689
base_lon_1 = 32.93278

# 2. Increments for the frontline (Positive numbers for adding)
lat_increment_1 = 0.00011
lon_increment_1 = 0.00025

# 3. Loop 8 times
for i in range(8):
    # Logic: base + (0 * inc), base + (1 * inc), base + (2 * inc), ...
    current_lat = base_lat_1 + (i * lat_increment_1)
    current_lon = base_lon_1 + (i * lon_increment_1)

    # Create the alert payload A
    alert_payload = {
        "node_id": f"Fire-Front-A-{i + 1}",
        "location": {
            "lat": current_lat,
            "lon": current_lon
        },
        "confidence": round(random.uniform(0.82, 0.97), 2),
        "evidence_image": IMAGE_DATA
    }

    # --- Send the Alert ---
    try:
        print(f"Sending alert A{i+1}/8: ({current_lat:.5f}, {current_lon:.5f})...")
        response = requests.post(API_URL, json=alert_payload)

        if response.status_code == 200:
            print("...Success.")
        else:
            print(f"...Error: Server returned {response.status_code}")

    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to the server at {API_URL}.")
        print("Is the 'main.py' server running?")
        break

    time.sleep(1)

print("\n--- Simulating fire frontline 2... (6 alerts) ---\n")

# --- Fire Frontline Simulation 2 (CORRECTED) ---

# 1. Starting coordinates (Fire 1)
base_lat_2 = 34.72117
base_lon_2 = 32.94393

# 2. Increments calculated from your new coordinates
#    (Fire 2 lat) 34.72093 - (Fire 1 lat) 34.72117 = -0.00024
#    (Fire 2 lon) 32.94434 - (Fire 1 lon) 32.94393 = +0.00041
lat_increment_2 = -0.00024  # Subtracts 0.00024 each time
lon_increment_2 = 0.00041   # Adds 0.00041 each time

# 3. Loop 6 times
for i in range(6):
    # Logic: base + (0 * inc), base + (1 * inc), base + (2 * inc), ...
    # This will correctly subtract from lat and add to lon
    current_lat = base_lat_2 + (i * lat_increment_2)
    current_lon = base_lon_2 + (i * lon_increment_2)

    # Create the alert payload B
    alert_payload = {
        "node_id": f"Fire-Front-B-{i + 1}",
        "location": {
            "lat": current_lat,
            "lon": current_lon
        },
        "confidence": 0.74 if i == 5 else round(random.uniform(0.85, 0.99), 2),
        "evidence_image": IMAGE_DATA
    }

    # --- Send the Alert ---
    try:
        print(f"Sending alert B{i+1}/6: ({current_lat:.5f}, {current_lon:.5f})...")
        response = requests.post(API_URL, json=alert_payload)

        if response.status_code == 200:
            print("...Success.")
        else:
            print(f"...Error: Server returned {response.status_code}")

    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to the server at {API_URL}.")
        print("Is the 'main.py' server running?")
        break

    time.sleep(1)


print("\nFire frontline simulation complete.")