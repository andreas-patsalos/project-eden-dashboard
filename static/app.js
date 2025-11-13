// We wrap our main logic in an Alpine.js init listener
document.addEventListener('alpine:init', () => {
    Alpine.data('dashboard', () => ({
        status: 'Connecting...',
        alerts: [],
        map: null,
        audio: null,
        markers: {}, // To store map markers by alert_id
        isModalOpen: false,
        modalImage: '',
        modalNodeId: '',

        // This function is called when the component is initialized
        init() {
            console.log('Dashboard init');
            this.initMap();
            this.initWebSocket();
            this.audio = new Audio('/static/alert.mp3');
        },

        // --- Map Initialization ---
        initMap() {
            // Coordinates for Limassol, Cyprus
            this.map = L.map('map').setView([34.685, 33.041], 12);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);
        },

        // --- WebSocket Initialization ---
        initWebSocket() {
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.host;
            const wsURL = `${wsProtocol}//${wsHost}/ws`;

            const socket = new WebSocket(wsURL);

            socket.onopen = () => {
                console.log('WebSocket connected!');
                this.status = 'Connected (All Clear)';
            };

            socket.onmessage = (event) => {
                console.log('New alert received:', event.data);
                this.handleNewAlert(JSON.parse(event.data));
            };

            socket.onclose = () => {
                console.log('WebSocket disconnected. Attempting to reconnect...');
                this.status = 'Disconnected. Retrying...';
                // Simple reconnect logic
                setTimeout(() => this.initWebSocket(), 3000);
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.status = 'Connection Error';
            };
        },

        // --- Alert Handling ---
        handleNewAlert(alert) {
            // Play sound
            this.audio.play();

            // Add to top of the list
            this.alerts.unshift(alert);

            // Add marker to map
            const latLon = [alert.location.lat, alert.location.lon];
            const marker = L.marker(latLon, {
                // We can create a custom red icon later
            }).addTo(this.map)
              .bindPopup(`<b>${alert.node_id}</b><br>Confidence: ${(alert.confidence * 100).toFixed(0)}%`);

            // Store marker to interact with it later
            this.markers[alert.alert_id] = marker;

            // Pan map to new alert
            this.map.flyTo(latLon, 15); // Zoom in
            marker.openPopup();

            this.status = `ALERT: ${alert.node_id}`;
        },

        // --- UI Interactions ---
        focusOnAlert(alert) {
            const latLon = [alert.location.lat, alert.location.lon];
            this.map.flyTo(latLon, 15);
            this.markers[alert.alert_id].openPopup();
        },

        acknowledgeAlert(alertId) {
            const alert = this.alerts.find(a => a.alert_id === alertId);
            if (alert) {
                alert.status = 'Acknowledged';
                // Here you could also send this status back to the server
            }
            this.status = 'Connected (All Clear)';
        },

        showEvidence(alert) {
            this.modalImage = alert.evidence_image; // The Base64 string
            this.modalNodeId = alert.node_id;
            this.isModalOpen = true;
        }
    }));
});