const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const protobuf = require('protobufjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Load the GTFS-realtime proto file
const protoFile = 'gtfs-realtime.proto';
const root = protobuf.loadSync(protoFile);
const FeedMessage = root.lookupType('transit_realtime.FeedMessage');

// API endpoint
const url = 'https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key=7pnJf5w6MCh0JWrdisnafk0YhnKfUqxx';

let busData = []; // Store the latest bus data

// Fetch and parse vehicle position data
const fetchBusData = async () => {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = response.data;
        const message = FeedMessage.decode(new Uint8Array(buffer));
        const data = FeedMessage.toObject(message, {
            longs: String,
            enums: String,
            bytes: String,
        });

        // Extract relevant bus data
        busData = data.entity
            .filter(entity => entity.vehicle && entity.vehicle.position)
            .map(entity => ({
                busNo: entity.vehicle.vehicle.id || 'Unknown',
                routeNo: entity.vehicle.trip?.routeId || 'Unknown',
                latitude: entity.vehicle.position.latitude,
                longitude: entity.vehicle.position.longitude,
            }));

        console.log(`Fetched ${busData.length} buses`);

        // Emit the updated bus data to all connected clients
        io.emit('busUpdate', busData);
    } catch (error) {
        console.error('Error fetching bus data:', error.message);
    }
};

// Fetch data every 1 second (1000ms)
setInterval(fetchBusData, 1000);

// Serve the webpage
app.get('/', (req, res) => {
    res.render('index', { buses: busData });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    fetchBusData(); // Initial fetch when server starts
});