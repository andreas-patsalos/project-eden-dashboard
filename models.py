from pydantic import BaseModel, Field
from datetime import datetime

# This sub-model is for the location data
class Location(BaseModel):
    lat: float = Field(..., example=34.67890)
    lon: float = Field(..., example=33.04567)

# This is the main alert payload we expect from the Anchor Node
class AlertPayload(BaseModel):
    node_id: str = Field(..., example="Camera-Node-005")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    location: Location
    confidence: float = Field(..., gt=0, le=1, example=0.92)
    evidence_image: str = Field(..., description="Base64 encoded JPEG image string")

# This is what we will broadcast to the frontend
# We add a unique ID and a human-readable time
class AlertBroadcast(BaseModel):
    alert_id: str
    node_id: str
    timestamp: str  # We'll send a simple string to the frontend
    location: Location
    confidence: float
    status: str = "Unconfirmed"
    evidence_image: str

# Model for a single device in the registry
class Device(BaseModel):
    node_id: str
    type: str  # e.g., "Camera" or "Anchor"
    location: Location
    status: str = "Monitoring" # Default static status