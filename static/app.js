// We wrap our main logic in an Alpine.js init listener
document.addEventListener('alpine:init', () => {
    Alpine.data('dashboard', () => ({
        // --- State Properties ---
        status: 'Connecting...',
        alerts: [],
        map: null,
        audio: null,
        alertMarkers: {},
        deviceMarkers: {},
        isModalOpen: false,

        // --- (MODIFIED) Modal State ---
        currentAlert: null, // Holds the full alert object
        modalMap: null,     // Holds the Leaflet instance for the modal map

        // --- Leaflet Icon Definitions ---
        cameraIcon: L.icon({
            iconUrl: '/static/camera_icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        }),

        anchorIcon: L.icon({
            iconUrl: '/static/anchor_icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        }),
        fireIcon: L.icon({
            iconUrl: '/static/fire_icon.png',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        }),

        // --- Initialization Function ---
        init() {
            console.log('Dashboard init');
            this.initMap();
            this.initWebSocket();
            this.loadDevices();
            this.audio = new Audio('/static/alert.mp3');
        },

        // --- Computed Statistics ---
        get stats() {
            const total = this.alerts.length;
            const highPriority = this.alerts.filter(a => a.confidence >= 0.90).length;
            const avgConfidence = total > 0
                ? (this.alerts.reduce((sum, a) => sum + a.confidence, 0) / total * 100).toFixed(0)
                : 0;
            const latestAlert = total > 0 ? this.alerts[0].timestamp : 'N/A';

            return { total, highPriority, avgConfidence, latestAlert };
        },

        // --- Get Alert Color Class ---
        getAlertColorClass(confidence) {
            if (confidence >= 0.90) return 'bg-red-800 border-red-600'; // High priority
            if (confidence >= 0.80) return 'bg-orange-700 border-orange-500'; // Medium priority
            return 'bg-yellow-700 border-yellow-500'; // Low priority - needs verification
        },

        // --- Map Initialization ---
        initMap() {
            // ... (this function is unchanged) ...
            this.map = L.map('map').setView([34.685, 33.041], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            const coords = L.control({ position: 'bottomleft' });
            coords.onAdd = function (map) {
                this._div = L.DomUtil.create('div', 'p-1 bg-white bg-opacity-75 rounded shadow text-xs');
                this.update();
                return this._div;
            };
            coords.update = function (latlng) {
                this._div.innerHTML = latlng ?
                    `<strong>Lat:</strong> ${latlng.lat.toFixed(5)}<br><strong>Lon:</strong> ${latlng.lng.toFixed(5)}` :
                    'Hover over the map';
            };
            coords.addTo(this.map);
            this.map.on('mousemove', (e) => { coords.update(e.latlng); });
            this.map.on('mouseout', () => { coords.update(); });
        },

        // --- WebSocket Initialization ---
        initWebSocket() {
            // ... (this function is unchanged) ...
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.host;
            const wsURL = `${wsProtocol}//${wsHost}/ws`;

            const socket = new WebSocket(wsURL);
            socket.onopen = () => { this.status = 'Connected (All Clear)'; };
            socket.onmessage = (event) => { this.handleNewAlert(JSON.parse(event.data)); };
            socket.onclose = () => {
                this.status = 'Disconnected. Retrying...';
                setTimeout(() => this.initWebSocket(), 3000);
            };
            socket.onerror = () => { this.status = 'Connection Error'; };
        },

        // --- Device Loading ---
        async loadDevices() {
            // ... (this function is unchanged) ...
            try {
                const response = await fetch('/api/devices');
                const devices = await response.json();
                devices.forEach(device => { this.drawDevice(device); });
            } catch (error) {
                console.error('Error loading devices:', error);
            }
        },

        // --- Device Drawing ---
        drawDevice(device) {
            // ... (this function is unchanged) ...
            const latLon = [device.location.lat, device.location.lon];
            const icon = device.type === 'Camera' ? this.cameraIcon : this.anchorIcon;
            const popupContent = `
                <div class="font-sans">
                    <strong class="text-base">${device.node_id}</strong><hr class="my-1">
                    <p class="m-0"><strong>Type:</strong> ${device.type}</p>
                    <p class="m-0"><strong>Status:</strong> ${device.status}</p>
                    <p class="m-0"><strong>Coords:</strong> ${device.location.lat.toFixed(5)}, ${device.location.lon.toFixed(5)}</p>
                </div>
            `;
            const marker = L.marker(latLon, { icon: icon, opacity: 0.8 })
                .addTo(this.map)
                .bindPopup(popupContent);
            this.deviceMarkers[device.node_id] = marker;
        },

        // --- Alert Handling ---
        handleNewAlert(alert) {
            // ... (this function is unchanged) ...
            this.audio.play();
            this.alerts.unshift(alert);
            const latLon = [alert.location.lat, alert.location.lon];
            const marker = L.marker(latLon, {
                icon: this.fireIcon
            }).addTo(this.map)
              .bindPopup(`<b>${alert.node_id}</b><br>Confidence: ${(alert.confidence * 100).toFixed(0)}%`);

            this.alertMarkers[alert.alert_id] = marker;
            this.map.flyTo(latLon, 15);
            marker.openPopup();
            this.status = `ALERT: ${alert.node_id}`;
        },

        // --- UI Interactions ---
        focusOnAlert(alert) {
            // ... (this function is unchanged) ...
            const latLon = [alert.location.lat, alert.location.lon];
            this.map.flyTo(latLon, 15);
            if (this.alertMarkers[alert.alert_id]) {
                this.alertMarkers[alert.alert_id].openPopup();
            }
        },

        // --- (MODIFIED) Acknowledge Function ---
        acknowledgeAlert(alertId) {
            const alert = this.alerts.find(a => a.alert_id === alertId);
            if (alert) {
                alert.status = 'Acknowledged';
                // In a real app, you'd POST this status update to the backend
            }
            this.status = 'Connected (All Clear)';
        },

        // --- (MODIFIED) Show Evidence Modal Function ---
        showEvidence(alert) {
            this.currentAlert = alert;
            this.isModalOpen = true;

            // This is crucial: Leaflet maps fail if initialized in a hidden div.
            // We use $nextTick to wait for Alpine to make the modal visible
            // *before* we try to create the map.
            this.$nextTick(() => {
                this.initModalMap();
            });
        },

        // --- (NEW) Modal Map Initializer ---
        initModalMap() {
            // Safety check: remove old map if it exists
            if (this.modalMap) {
                this.modalMap.remove();
                this.modalMap = null;
            }

            if (!this.currentAlert) return;

            const latLon = [this.currentAlert.location.lat, this.currentAlert.location.lon];

            this.modalMap = L.map('modal-map').setView(latLon, 14); // Zoom in

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.modalMap);

            // Add the fire icon for this alert
            L.marker(latLon, { icon: this.fireIcon }).addTo(this.modalMap);

            // Add nearby device markers for context
            Object.values(this.deviceMarkers).forEach(marker => {
                L.marker(marker.getLatLng(), { icon: marker.options.icon, opacity: 0.6 })
                    .addTo(this.modalMap);
            });

            // This fixes map rendering issues inside a modal
            this.modalMap.invalidateSize();
        },

        // --- (NEW) Modal Action: Close ---
        closeModal() {
            this.isModalOpen = false;
            // Destroy the map to prevent memory issues
            if (this.modalMap) {
                this.modalMap.remove();
                this.modalMap = null;
            }
            this.currentAlert = null;
        },

        // --- (NEW) Modal Action: Acknowledge ---
        modalAcknowledge() {
            if (!this.currentAlert) return;
            this.acknowledgeAlert(this.currentAlert.alert_id);
            this.closeModal();
        },

        // --- (NEW) Modal Action: Dismiss ---
        modalDismiss() {
            if (!this.currentAlert) return;

            // This is just for the demo.
            // 1. Find the alert and remove it from the list
            this.alerts = this.alerts.filter(a => a.alert_id !== this.currentAlert.alert_id);

            // 2. Remove the marker from the main map
            if (this.alertMarkers[this.currentAlert.alert_id]) {
                this.alertMarkers[this.currentAlert.alert_id].remove();
                delete this.alertMarkers[this.currentAlert.alert_id];
            }

            // 3. Close the modal
            this.closeModal();

            // In a real app, you'd POST this "false alarm" to the backend
            // to update the camera's trust score.
            console.log(`Dismissed alert: ${this.currentAlert.alert_id}`);
        }

    }));
});