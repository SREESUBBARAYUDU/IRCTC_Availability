const apiKey = 'b79e151115msh35e7a10d1d59bffp14a78ejsnf8fde02a6245';
const apiHost = 'irctc1.p.rapidapi.com';

document.getElementById('searchForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const source = document.getElementById('source').value.trim().toUpperCase();
    const destination = document.getElementById('destination').value.trim().toUpperCase();
    const date = document.getElementById('date').value;
    const travelClass = document.getElementById('class').value;
    const quota = document.getElementById('quota').value;

    document.getElementById('results').innerHTML = 'Loading...';

    // 1. Get trains between stations
    const trains = await fetchTrainsBetweenStations(source, destination, date);
    if (!trains || trains.length === 0) {
        document.getElementById('results').innerHTML = '<div class="error">No trains found for the selected route and date.</div>';
        return;
    }

    // 2. For each train, get seat availability
    let html = '';
    for (const train of trains) {
        html += `
        <div class="train-card">
            <strong>${train.train_name} (${train.train_number})</strong><br>
            From: ${train.from_station_name} (${train.from_station_code})<br>
            To: ${train.to_station_name} (${train.to_station_code})<br>
            Departure: ${train.from_std} | Arrival: ${train.to_sta}<br>
            <div class="seat-availability" id="seat-${train.train_number}">Checking seat availability...</div>
        </div>
        `;
    }
    document.getElementById('results').innerHTML = html;

    // Fetch seat availability for each train
    for (const train of trains) {
        fetchSeatAvailability(train.train_number, source, destination, date, travelClass, quota);
    }
});

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

async function fetchSeatAvailability(trainNo, source, destination, date, travelClass, quota) {
    try {
        const url = `https://${apiHost}/api/v3/seatAvailability?trainNo=${trainNo}&fromStationCode=${source}&toStationCode=${destination}&dateOfJourney=${date}&classCode=${travelClass}&quota=${quota}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-key': apiKey,
                'x-rapidapi-host': apiHost
            }
        });
        const data = await response.json();
        let seatHtml = '';
        if (data && data.data && data.data.length > 0) {
            seatHtml = data.data.map(item => 
                `<div>${item.date}: <b>${item.status}</b> (${item.availableSeats} seats)</div>`
            ).join('');
        } else {
            seatHtml = '<div class="error">No seat availability data found.</div>';
        }
        document.getElementById(`seat-${trainNo}`).innerHTML = seatHtml;
    } catch (err) {
        document.getElementById(`seat-${trainNo}`).innerHTML = '<div class="error">Error fetching seat availability.</div>';
    }
}
