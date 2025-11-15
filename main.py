import uvicorn
import uuid
from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from typing import List

from models import AlertPayload, AlertBroadcast, Location, Device

# --- App Setup ---
app = FastAPI(
    title="Project E.D.E.N. Dashboard API",
    description="Handles smoke detection alerts and broadcasts to a live dashboard.",
    version="1.0.0"
)

# --- In-Memory Device Registry ---
# This is your "database" of all deployed devices
DEVICE_REGISTRY = [
    Device(
        node_id="Camera-Node-001",
        type="Camera",
        location={"lat": 34.711, "lon": 32.941},
        status="Monitoring"
    ),
    Device(
        node_id="Camera-Node-002",
        type="Camera",
        location={"lat": 34.71236, "lon": 32.93920},
        status="Monitoring"
    ),
    Device(
        node_id="Camera-Node-003",
        type="Camera",
        location={"lat": 34.70999, "lon": 32.93877},
        status="Monitoring"
    ),
Device(
        node_id="Camera-Node-003",
        type="Camera",
        location={"lat": 34.71196, "lon": 32.93752},
        status="Monitoring"
    ),
Device(
        node_id="Camera-Node-003",
        type="Camera",
        location={"lat": 34.71092, "lon": 32.93788},
        status="Monitoring"
    ),
Device(
        node_id="Camera-Node-003",
        type="Camera",
        location={"lat": 34.71191, "lon": 32.94040},
        status="Monitoring"
    ),
Device(
        node_id="Camera-Node-003",
        type="Camera",
        location={"lat": 34.71037, "lon": 32.94022},
        status="Monitoring"
    ),
    Device(
        node_id="Anchor-Node-A",
        type="Anchor",
        location={"lat": 34.71133, "lon": 32.93925},
        status="Online"
    ),
]

# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()


# --- API Endpoint for listing all devices ---
@app.get("/api/devices", response_model=List[Device])
async def get_devices():
    """
    Returns a list of all devices in the registry.
    The frontend calls this once on page load.
    """
    return DEVICE_REGISTRY


# --- API Endpoint for the Anchor Node (RPi/Radxa) ---
@app.post("/api/alert")
async def post_alert(payload: AlertPayload):
    """
    Receives a new smoke alert from an anchor node,
    formats it, and broadcasts it to all connected frontend clients.
    """
    print(f"Received alert from: {payload.node_id}")

    # Format the data for the frontend
    alert_data = AlertBroadcast(
        alert_id=f"eden-alert-{uuid.uuid4()}",
        node_id=payload.node_id,
        timestamp=payload.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
        location=payload.location,
        confidence=payload.confidence,
        evidence_image=payload.evidence_image
    )

    # Broadcast the JSON of the alert to all connected dashboards
    await manager.broadcast(alert_data.model_dump_json())

    return {"status": "success", "message": "Alert received and broadcasted."}


# --- WebSocket Endpoint for the Frontend ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Client disconnected")


# --- Static File Serving (for HTML/CSS/JS) ---

# Mount the 'static' directory
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve the main index.html
@app.get("/")
async def get_dashboard(request: Request):
    return FileResponse('static/index.html')


# --- Run the App ---
if __name__ == "__main__":
    print("Starting Project E.D.E.N. server at http://127.0.0.1:8000")
    uvicorn.run(app, host="127.0.0.1", port=8000)