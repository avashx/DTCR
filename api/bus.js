const axios = require('axios');
const protobuf = require('protobufjs');
const fs = require('fs');
const xml2js = require('xml2js');

const protoFile = 'gtfs-realtime.proto';
const root = protobuf.loadSync(protoFile);
const FeedMessage = root.lookupType('transit_realtime.FeedMessage');

const url = 'https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb?key=7pnJf5w6MCh0JWrdisnafk0YhnKfUqxx';

const parseKML = (kmlString) => {
    return new Promise((resolve, reject) => {
        xml2js.parseString(kmlString, (err, result) => {
            if (err) return reject(err);
            const placemarks = result.kml.Document[0].Folder[0].Placemark;
            const stops = placemarks.map(placemark => {
                const coords = placemark.Point[0].coordinates[0].split(',').map(Number);
                const data = placemark.ExtendedData[0].SchemaData[0].SimpleData;
                const name = data.find(d => d.$.name === 'BS_NM_STND')?._;
                return { name: name || 'Unknown Stop', longitude: coords[0], latitude: coords[1] };
            });
            resolve(stops);
        });
    });
};

const kmlString = fs.readFileSync('data/delhi_bus_stops.kml', 'utf8');
let busStops = [];

parseKML(kmlString).then(stops => {
    busStops = stops;
}).catch(err => {
    console.error('Error parsing KML:', err);
});

module.exports = async (req, res) => {
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

        res.json({ buses: busData, busStops });
    } catch (error) {
        res.status(500).send('Error fetching bus data');
    }
};