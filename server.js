const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const protobuf = require('protobufjs');

const server = http.createServer();
const io = socketIo(server, {
    cors: {
      origin: "https://dtcr.vercel.app", // Allow only your frontend domain
      methods: ["GET", "POST"],
    },
  });
  

// Load GTFS proto
const protoFile = 'gtfs-realtime.proto';
const root = protobuf.loadSync(protoFile);
const FeedMessage = root.lookupType('transit_realtime.FeedMessage');

const url = 'https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key=7pnJf5w6MCh0JWrdisnafk0YhnKfUqxx';

const fetchBusData = async () => {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = response.data;
        const message = FeedMessage.decode(new Uint8Array(buffer));
        const data = FeedMessage.toObject(message, { longs: String, enums: String, bytes: String });

        const busData = data.entity
            .filter(entity => entity.vehicle && entity.vehicle.position)
            .map(entity => ({
                busNo: entity.vehicle.vehicle.id || 'Unknown',
                routeNo: entity.vehicle.trip?.routeId || 'Unknown',
                latitude: entity.vehicle.position.latitude,
                longitude: entity.vehicle.position.longitude,
            }));

        io.emit('busUpdate', { buses: busData });
    } catch (error) {
        console.error('Error fetching bus data:', error.message);
    }
};

setInterval(fetchBusData, 1000);

server.listen(3000, () => {
    console.log('Socket.IO server running on port 3000');
});


