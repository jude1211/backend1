const mongoose = require('mongoose');
const ScreenShow = require('./models/ScreenShow');
const TheatreOwner = require('./models/TheatreOwner');
require('dotenv').config();

async function checkShows() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const ownerId = '690a2e204ee06a0ab360223f'; // rdcinemas
        const count = await ScreenShow.countDocuments({ theatreOwnerId: ownerId });
        console.log(`Total ScreenShows for rdcinemas: ${count}`);

        const activeCount = await ScreenShow.countDocuments({ theatreOwnerId: ownerId, status: 'Active' });
        console.log(`Active ScreenShows for rdcinemas: ${activeCount}`);

        if (count > 0 && activeCount === 0) {
            console.log('Shows exist but are not Active.');
        } else if (count === 0) {
            console.log('No shows exist for this owner.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkShows();
