const RASPBERRY_PI_IP = '10.1.157.237'; // GANTI IP INI
const SIGNALK_WEBSOCKET_URL = `ws://${RASPBERRY_PI_IP}:3000/signalk/v1/stream`;

const map = L.map('map').setView([-2.5489, 118.0149], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
// --- DATA ZONA KAWASAN ---
const mapZones = [
    {
        name: 'Kawasan Konservasi Laut',
        type: 'Conservation',
        // Contoh koordinat di sekitar Kepulauan Karimunjawa
        coordinates: [
            [-5.75, 110.4],
            [-5.75, 110.55],
            [-5.9, 110.55],
            [-5.9, 110.4],
        ],
        style: {
            color: '#28a745', // Warna garis (hijau)
            fillColor: '#28a745', // Warna isi
            fillOpacity: 0.2, // Transparansi isi
            weight: 2 // Ketebalan garis
        }
    },
    {
        name: 'Area Rawan Perompakan',
        type: 'Dangerous',
        // Contoh koordinat di Selat Malaka
        coordinates: [
            [2.5, 102.0],
            [3.0, 101.5],
            [3.5, 102.5],
            [3.0, 103.0]
        ],
        style: {
            color: '#dc3545', // Warna garis (merah)
            fillColor: '#dc3545', // Warna isi
            fillOpacity: 0.2,
            weight: 2
        }
    },
        {
            name: 'Jalur Pipa Bawah Laut',
        type: 'Dangerous',
        // Koridor dari P. Pabelokan (Kep. Seribu) ke Bojonegara (Serang)
        coordinates: [
            [-5.480019762443676, 106.3920470238064], // Sisi utara Pabelokan
            [-5.92553248477132, 106.10504438804263], // Sisi utara Bojonegara
            [-5.929214870657796, 106.10923209875143], // Sisi selatan Bojonegara
            [-5.480388076672904, 106.39319531649218]  // Sisi selatan Pabelokan
        ],
        style: {
            color: '#ffc107', // Warna garis (kuning-warning)
            fillColor: '#ffc107', // Warna isi
            fillOpacity: 0.25,
            weight: 2,
            dashArray: '5, 10' // Membuat garis putus-putus
        }
    }
];
const vessels = {};
let vesselTypeChart = null; // Variabel untuk menyimpan instance grafik

// --- FUNGSI-FUNGSI GRAFIK ---
function initVesselTypeChart() {
    const ctx = document.getElementById('vesselTypeChart').getContext('2d');
    vesselTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [],
                borderColor: '#f4f4f4',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12 } },
                title: { display: true, text: 'Vessel Types Distribution' }
            }
        }
    });
}

function updateChartData() {
    if (!vesselTypeChart) return;

    const typeCounts = {};
    const typeColors = {};
    const colorMap = {
        'Cargo': '#0077b6', 'Tanker': '#d00000', 'Fishing': '#2b9348',
        'Sailing': '#f7b801', 'Passenger': '#9d4edd', 'Unknown': '#6c757d'
    };

    for (const mmsi in vessels) {
        const type = vessels[mmsi].shipType || 'Unknown';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
        if (!typeColors[type]) {
            for (const key in colorMap) {
                if (type.toLowerCase().includes(key.toLowerCase())) {
                    typeColors[type] = colorMap[key];
                    break;
                }
            }
            if (!typeColors[type]) typeColors[type] = colorMap['Unknown'];
        }
    }

    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);
    const backgroundColors = labels.map(label => typeColors[label]);

    vesselTypeChart.data.labels = labels;
    vesselTypeChart.data.datasets[0].data = data;
    vesselTypeChart.data.datasets[0].backgroundColor = backgroundColors;
    vesselTypeChart.update();
}

// --- FUNGSI-FUNGSI LAINNYA (TETAP SAMA ATAU SEDIKIT DIMODIFIKASI) ---
function createVesselIcon(shipType) {
    const iconSize = [6, 6];
    let shipClass = 'icon-default';
    if (shipType) {
        const type = shipType.toLowerCase();
        if (type.includes('cargo')) shipClass = 'icon-cargo';
        else if (type.includes('tanker')) shipClass = 'icon-tanker';
        else if (type.includes('fishing')) shipClass = 'icon-fishing';
        else if (type.includes('sailing')) shipClass = 'icon-sailing';
        else if (type.includes('passenger')) shipClass = 'icon-passenger';
    }
    const iconHtml = `<svg width="${iconSize[0]}" height="${iconSize[1]}" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M 10,0 L 20,13 L 10,11 L 0,13 Z" /></svg>`;
    return L.divIcon({ className: `vessel-icon ${shipClass}`, html: iconHtml, iconSize: iconSize, iconAnchor: [iconSize[0] / 2, iconSize[1] / 2] });
}

function connectWebSocket() {
    const ws = new WebSocket(SIGNALK_WEBSOCKET_URL);
    ws.onopen = () => {
        const subscriptionMessage = {
            "context": "vessels.*",
            "subscribe": [
                { "path": "navigation.position", "period": 10000 },
                { "path": "design.aisShipType", "period": 300000 },
                { "path": "navigation.courseOverGroundTrue", "period": 10000 },
                { "path": "navigation.speedOverGround", "period": 10000 }
            ]
        };
        ws.send(JSON.stringify(subscriptionMessage));
    };
    ws.onmessage = (event) => { if (data = JSON.parse(event.data), data.updates) handleSignalKUpdate(data); };
    ws.onerror = (error) => console.error("❌ WebSocket Error:", error);
    ws.onclose = () => setTimeout(connectWebSocket, 5000);
}

function handleSignalKUpdate(updateData) {
    let mmsi = null;
    if (updateData.context && updateData.context.includes('mmsi')) mmsi = updateData.context.split(':').pop();
    if (!mmsi) return;

    const isNew = !vessels[mmsi];
    if (isNew) {
        vessels[mmsi] = { mmsi: mmsi, name: `MMSI: ${mmsi}`, marker: null, listItem: null, shipType: 'Unknown', course: 0, speed: null, timestamp: null };
    }
    vessels[mmsi].timestamp = updateData.updates[0].timestamp;
    let typeUpdated = false;

    updateData.updates[0].values.forEach(valueUpdate => {
        const path = valueUpdate.path;
        const value = valueUpdate.value;
        if (path === 'navigation.position') {
            vessels[mmsi].position = value;
            if (!vessels[mmsi].marker) {
                vessels[mmsi].marker = L.marker([value.latitude, value.longitude], { icon: createVesselIcon(vessels[mmsi].shipType) }).addTo(map);
            } else {
                vessels[mmsi].marker.setLatLng([value.latitude, value.longitude]);
            }
            applyRotation(mmsi);
        }
        if (path === 'design.aisShipType' && vessels[mmsi].shipType !== value.name) {
            vessels[mmsi].shipType = value.name;
            typeUpdated = true;
            if (vessels[mmsi].marker) vessels[mmsi].marker.setIcon(createVesselIcon(vessels[mmsi].shipType));
        }
        if (path === 'navigation.courseOverGroundTrue') {
            vessels[mmsi].course = value * (180 / Math.PI);
            applyRotation(mmsi);
        }
        if (path === 'navigation.speedOverGround') {
            vessels[mmsi].speed = (value * 1.94384).toFixed(1);
        }
    });

    updateVesselDisplay(mmsi);
    if (isNew || typeUpdated) updateChartData();
}

function applyRotation(mmsi) {
    const vessel = vessels[mmsi];
    if (vessel && vessel.marker && vessel.marker.getElement()) {
        const iconElement = vessel.marker.getElement().querySelector('svg');
        if(iconElement) iconElement.style.transform = `rotate(${vessel.course}deg)`;
    }
}

function updateVesselDisplay(mmsi) {
    const vessel = vessels[mmsi];
    if (!vessel) return;
    const name = vessel.name || `MMSI: ${vessel.mmsi}`;
    const type = vessel.shipType || 'Unknown';
    const speed = vessel.speed ? `${vessel.speed} kn` : 'N/A';
    
    // Update daftar samping (list)
    if (!vessel.listItem) {
        vessel.listItem = document.createElement('li');
        vessel.listItem.className = 'vessel-list-item';
        document.getElementById('vessel-list').appendChild(vessel.listItem);
    }
    let iconBgClass = 'icon-bg-default';
    const typeLower = type.toLowerCase();
    if (typeLower.includes('cargo')) iconBgClass = 'icon-bg-cargo';
    else if (typeLower.includes('tanker')) iconBgClass = 'icon-bg-tanker';
    else if (typeLower.includes('fishing')) iconBgClass = 'icon-bg-fishing';
    else if (typeLower.includes('sailing')) iconBgClass = 'icon-bg-sailing';
    else if (typeLower.includes('passenger')) iconBgClass = 'icon-bg-passenger';

    vessel.listItem.innerHTML = `
        <div class="list-item-icon ${iconBgClass}"></div>
        <div class="list-item-details">
            <span class="name">${name}</span>
            <span class="speed">${type} | ${speed}</span>
        </div>
    `;

    // Update popup di peta
    if (vessel.marker) {
        const received = vessel.timestamp ? timeAgo(vessel.timestamp) : "N/A";
        const course = vessel.course ? `${Math.round(vessel.course)}°` : 'N/A';
        const popupContent = `
            <div class="popup-header"><b>${name}</b><span>${type}</span></div>
            <div class="popup-details">
                <strong>Speed/Course:</strong><span>${speed} / ${course}</span>
                <strong>Received:</strong><span>${received}</span>
            </div>
        `;
        vessel.marker.bindPopup(popupContent);
    }
}

function timeAgo(isoString) { // Fungsi ini dipindahkan ke bawah agar lebih rapi
    if (!isoString) return "N/A"; const date = new Date(isoString), seconds = Math.floor((new Date() - date) / 1000); let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago"; interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago"; interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago"; interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago"; interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago"; return "Just now";
}

// --- MULAI APLIKASI ---
initVesselTypeChart();
connectWebSocket();
// --- FUNGSI UNTUK MENGGAMBAR ZONA DI PETA ---
function drawZones(zones) {
    zones.forEach(zone => {
        const polygon = L.polygon(zone.coordinates, zone.style).addTo(map);
        
        // Menambahkan popup saat zona di-klik
        polygon.bindPopup(`
            <div class="popup-header" style="border: none;">
                <b>${zone.name}</b>
                <span>Kawasan ${zone.type}</span>
            </div>
        `);
    });
}

// Panggil fungsi untuk menggambar zona saat aplikasi dimuat
drawZones(mapZones);