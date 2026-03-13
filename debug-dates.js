const axios = require('axios');

async function debug() {
    try {
        console.log('Searching for "rd"...');
        const searchRes = await axios.get('http://localhost:5000/api/v1/theatres/owners/search?query=rd');
        console.log('Search Results:', JSON.stringify(searchRes.data, null, 2));

        if (searchRes.data.data && searchRes.data.data.length > 0) {
            const theatre = searchRes.data.data[0];
            console.log(`Found theatre: ${theatre.theatreName} (${theatre._id})`);

            console.log(`Fetching dates for ${theatre._id}...`);
            const datesRes = await axios.get(`http://localhost:5000/api/v1/theatres/owners/${theatre._id}/dates/public`);
            console.log('Dates:', JSON.stringify(datesRes.data, null, 2));
        } else {
            console.log('No theatre found for "rd"');
        }

        console.log('--------------------------------');
        console.log('Searching for "anchani"...');
        const searchRes2 = await axios.get('http://localhost:5000/api/v1/theatres/owners/search?query=anchani');
        if (searchRes2.data.data && searchRes2.data.data.length > 0) {
            const theatre = searchRes2.data.data[0];
            console.log(`Found theatre: ${theatre.theatreName} (${theatre._id})`);
            const datesRes2 = await axios.get(`http://localhost:5000/api/v1/theatres/owners/${theatre._id}/dates/public`);
            console.log('Dates:', JSON.stringify(datesRes2.data, null, 2));
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

debug();
