// We wrap our main logic in an Alpine.js init listener
document.addEventListener('alpine:init', () => {
    Alpine.data('dashboard', () => ({
        // --- State Properties ---
        status: 'Connecting...',
        alerts: [],
        map: null,
        audio: null,
        alertMarkers: {},   // To store RED alert markers by alert_id
        deviceMarkers: {},  // To store BLUE device markers by node_id
        isModalOpen: false,
        modalImage: '',
        modalNodeId: '',

        // --- Leaflet Icon Definitions ---
        // Make sure you have these images in your /static/ folder!
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
            iconSize: [32, 32],     // Adjust size to match your image
            iconAnchor: [16, 32],   // Point of the icon
            popupAnchor: [0, -32]  // Where the popup opens from
        }),

        // --- Initialization Function ---
        // This is called when the <body> tag is loaded
        init() {
            console.log('Dashboard init');
            this.initMap();
            this.initWebSocket();
            this.loadDevices(); // <-- Load the static device list
            this.audio = new Audio('/static/alert.mp3');
        },

        // --- Map Initialization ---
        initMap() {
            // Coordinates for Limassol, Cyprus
            this.map = L.map('map').setView([34.685, 33.041], 13); // Zoomed out a bit

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.map);

            // Create a new control
            const coords = L.control({ position: 'bottomleft' });

            // Define the HTML for the control
            coords.onAdd = function (map) {
                // Use Tailwind classes for styling
                this._div = L.DomUtil.create('div', 'p-1 bg-white bg-opacity-75 rounded shadow text-xs');
                this.update();
                return this._div;
            };

            // Define how to update the control's content
            coords.update = function (latlng) {
                this._div.innerHTML = latlng ?
                    `<strong>Lat:</strong> ${latlng.lat.toFixed(5)}<br><strong>Lon:</strong> ${latlng.lng.toFixed(5)}` :
                    'Hover over the map';
            };

            // Add the control to the map
            coords.addTo(this.map);

            // Update coordinates on mouse move
            this.map.on('mousemove', (e) => {
                coords.update(e.latlng);
            });

            // Clear coordinates when mouse leaves map
            this.map.on('mouseout', () => {
                coords.update();
            });

            // --- END: Add Lat/Lon Coordinate Display ---
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

        // --- Device Loading (NEW) ---
        async loadDevices() {
            try {
                const response = await fetch('/api/devices');
                if (!response.ok) {
                    throw new Error('Failed to load devices');
                }
                const devices = await response.json();

                console.log('Loading devices:', devices);
                devices.forEach(device => {
                    this.drawDevice(device);
                });

            } catch (error) {
                console.error('Error loading devices:', error);
                // You could show a small error on the UI
            }
        },

        // --- Device Drawing (NEW) ---
        drawDevice(device) {
            const latLon = [device.location.lat, device.location.lon];
            // Use a default icon if custom ones are missing
            const icon = device.type === 'Camera' ? (this.cameraIcon || new L.Icon.Default()) : (this.anchorIcon || new L.Icon.Default({ iconUrl: 'marker-icon-2x.png' }));

            // Create the popup content
            const popupContent = `
                <div class="font-sans">
                    <strong class="text-base">${device.node_id}</strong>
                    <hr class="my-1">
                    <p class="m-0"><strong>Type:</strong> ${device.type}</p>
                    <p class="m-0"><strong>Status:</strong> ${device.status}</p>
                    <p class="m-0"><strong>Coords:</strong> ${device.location.lat.toFixed(5)}, ${device.location.lon.toFixed(5)}</p>
                </div>
            `;

            const marker = L.marker(latLon, {
                icon: icon,
                opacity: 0.8 // Make them slightly transparent to differ from alerts
            })
                .addTo(this.map)
                .bindPopup(popupContent);

            // Store this marker so we can update it later
            this.deviceMarkers[device.node_id] = marker;
        },


        // --- Alert Handling (MODIFIED) ---
        handleNewAlert(alert) {
            // Play sound
            this.audio.play();

            // Add to top of the list
            this.alerts.unshift(alert);

            // Add RED marker to map
            const latLon = [alert.location.lat, alert.location.lon];
            // --- THIS IS THE NEW CODE ---
            const marker = L.marker(latLon, {
                // Use our new custom fire icon
                icon: this.fireIcon
            }).addTo(this.map)
              .bindPopup(`<b>${alert.node_id}</b><br>Confidence: ${(alert.confidence * 100).toFixed(0)}%`);

            // Store alert marker to interact with it later
            this.alertMarkers[alert.alert_id] = marker;

            // Pan map to new alert
            this.map.flyTo(latLon, 15); // Zoom in
            marker.openPopup();

            this.status = `ALERT: ${alert.node_id}`;
        },

        // --- UI Interactions ---
        focusOnAlert(alert) {
            const latLon = [alert.location.lat, alert.location.lon];
            this.map.flyTo(latLon, 15);
            // Check if alert marker exists before opening popup
            if (this.alertMarkers[alert.alert_id]) {
                this.alertMarkers[alert.alert_id].openPopup();
            }
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