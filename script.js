const apiKey = 'b79e151115msh35e7a10d1d59bffp14a78ejsnf8fde02a6245';
const apiHost = 'irctc1.p.rapidapi.com';

document.getElementById('searchForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const source = document.getElementById('source').value.trim().toUpperCase();
    const destination = document.getElementById('destination').value.trim().toUpperCase();
    const date = document.getElementById('date').value;
    const travelClass = document.getElementById('class').value;
    const quota = document.getElementById('quota').value;
    const minBuffer = parseInt(document.getElementById('minBuffer').value, 10);
    const maxBuffer = parseInt(document.getElementById('maxBuffer').value, 10);

    document.getElementById('results').innerHTML = 'Loading...';

    // 1. Fetch all trains for the date (from all stations)
    const allTrains = await fetchAllTrainsForDate(date, source);

    if (!allTrains || allTrains.length === 0) {
        document.getElementById('results').innerHTML = '<div class="error">No trains found for the selected date.</div>';
        return;
    }

    // 2. Build station graph
    const graph = buildStationGraph(allTrains);

    // 3. Find all routes with buffer constraints
    const routes = findRoutesWithBuffer(graph, source, destination, date, minBuffer, maxBuffer);

    if (!routes || routes.length === 0) {
        document.getElementById('results').innerHTML = '<div class="error">No valid routes found with the given buffer constraints.</div>';
        return;
    }

    // 4. Display routes
    let html = '';
    routes.forEach((route, idx) => {
        html += `<div class="route-card">
            <div class="route-header">Route ${idx + 1} (Total Waiting: ${route.totalBuffer} min, Changes: ${route.trains.length - 1})</div>`;
        route.trains.forEach((seg, i) => {
            html += `<div class="train-segment">
                <b>${seg.train_name} (${seg.train_number})</b><br>
                ${seg.from_station_name} (${seg.from_station_code}) → ${seg.to_station_name} (${seg.to_station_code})<br>
                Departure: ${seg.from_std} | Arrival: ${seg.to_sta}
            </div>`;
            if (i < route.waitingTimes.length) {
                html += `<div class="waiting-time">Wait at ${seg.to_station_name}: ${route.waitingTimes[i]} min</div>`;
            }
        });
        html += `</div>`;
    });
    document.getElementById('results').innerHTML = html;
});

// Fetch all trains departing from the source and all possible transfer stations
async function fetchAllTrainsForDate(date, source) {
    // For demo, fetch trains from the source to all major stations (could be improved with a list of all stations)
    const majorStations = ['NDLS', 'BCT', 'HWH', 'MAS', 'SBC', 'CSTM', 'LKO', 'CNB', 'PNBE', 'ADI', 'BBS', 'GKP', 'JAT', 'PUNE', 'YPR', 'ERS', 'GAYA', 'RNC', 'VSKP', 'KGP'];
    let allTrains = [];
    for (let toStation of majorStations) {
        if (toStation === source) continue;
        const trains = await fetchTrainsBetweenStations(source, toStation, date);
        if (trains && trains.length > 0) {
            allTrains = allTrains.concat(trains);
        }
    }
    return allTrains;
}

async function fetchTrainsBetweenStations(source, destination, date) {
    try {
        const url = `https://${apiHost}/api/v3/trainBetweenStations?fromStationCode=${source}&toStationCode=${destination}&dateOfJourney=${date}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': apiHost
            }
        });
        const data = await response.json();
        return data.data || [];
    } catch (err) {
        return [];
    }
}

// Build a graph: station code -> array of train segments departing from that station
function buildStationGraph(trains) {
    const graph = {};
    trains.forEach(train => {
        if (!graph[train.from_station_code]) {
            graph[train.from_station_code] = [];
        }
        graph[train.from_station_code].push(train);
    });
    return graph;
}

// Find all routes from source to destination with buffer constraints
function findRoutesWithBuffer(graph, source, destination, date, minBuffer, maxBuffer) {
    const routes = [];
    const queue = [{
        path: [source],
        trains: [],
        waitingTimes: [],
        totalBuffer: 0,
        lastArrival: null,
        lastArrivalTime: null
    }];

    while (queue.length > 0) {
        const current = queue.shift();
        const lastStation = current.path[current.path.length - 1];

        if (lastStation === destination && current.trains.length > 0) {
            routes.push({
                trains: current.trains,
                waitingTimes: current.waitingTimes,
                totalBuffer: current.totalBuffer
            });
            continue;
        }

        const nextTrains = graph[lastStation] || [];
        for (let train of nextTrains) {
            // Avoid cycles and repeated trains
            if (current.trains.some(t => t.train_number === train.train_number)) continue;

            // Calculate waiting time
            let waitTime = 0;
            if (current.lastArrivalTime) {
                waitTime = getMinutesBetween(current.lastArrivalTime, train.from_std);
                if (waitTime < minBuffer || current.totalBuffer + waitTime > maxBuffer) continue;
            }

            // Avoid impossible connections (departure before arrival)
            if (current.lastArrivalTime && !isValidConnection(current.lastArrivalTime, train.from_std)) continue;

            queue.push({
                path: [...current.path, train.to_station_code],
                trains: [...current.trains, train],
                waitingTimes: current.lastArrivalTime ? [...current.waitingTimes, waitTime] : current.waitingTimes,
                totalBuffer: current.totalBuffer + (current.lastArrivalTime ? waitTime : 0),
                lastArrival: train.to_sta,
                lastArrivalTime: train.to_sta
            });
        }
    }
    return routes;
}

// Helper: get minutes between two "HH:MM" times (assumes same day or next day)
function getMinutesBetween(time1, time2) {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    let t1 = h1 * 60 + m1;
    let t2 = h2 * 60 + m2;
    if (t2 < t1) t2 += 24 * 60; // next day
    return t2 - t1;
}

// Helper: check if connection is valid (departure after arrival)
function isValidConnection(arrival, departure) {
    const [h1, m1] = arrival.split(':').map(Number);
    const [h2, m2] = departure.split(':').map(Number);
    let t1 = h1 * 60 + m1;
    let t2 = h2 * 60 + m2;
    if (t2 < t1) t2 += 24 * 60;
    return t2 >= t1;
}
