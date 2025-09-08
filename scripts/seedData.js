const mongoose = require('mongoose');
const Theatre = require('../models/Theatre');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const sampleTheatres = [
  {
    name: 'PVR Cinemas - Phoenix Mall',
    chain: 'PVR',
    location: {
      address: 'Phoenix Mall, Kurla West, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400070',
      area: 'Kurla',
      coordinates: {
        latitude: 19.0822,
        longitude: 72.8811
      }
    },
    contact: {
      phone: '+91-22-6671-2345',
      email: 'phoenix@pvrcinemas.com',
      website: 'https://www.pvrcinemas.com'
    },
    screens: [
      {
        screenNumber: 1,
        name: 'Screen 1',
        type: '2D',
        totalSeats: 150,
        seatLayout: {
          rows: 15,
          seatsPerRow: 10
        },
        seatTypes: [
          { type: 'regular', count: 100, basePrice: 200 },
          { type: 'premium', count: 50, basePrice: 350 }
        ]
      },
      {
        screenNumber: 2,
        name: 'Screen 2 - IMAX',
        type: 'IMAX',
        totalSeats: 200,
        seatLayout: {
          rows: 20,
          seatsPerRow: 10
        },
        seatTypes: [
          { type: 'regular', count: 120, basePrice: 400 },
          { type: 'premium', count: 80, basePrice: 600 }
        ]
      }
    ],
    amenities: {
      parking: { available: true, capacity: 500, fee: 50 },
      foodCourt: { available: true, vendors: ['McDonald\'s', 'KFC', 'Subway'] },
      restrooms: true,
      wheelchairAccessible: true,
      airConditioning: true,
      wifi: true,
      atm: true,
      elevator: true
    },
    operatingHours: {
      monday: { open: '09:00', close: '23:30' },
      tuesday: { open: '09:00', close: '23:30' },
      wednesday: { open: '09:00', close: '23:30' },
      thursday: { open: '09:00', close: '23:30' },
      friday: { open: '09:00', close: '00:30' },
      saturday: { open: '09:00', close: '00:30' },
      sunday: { open: '09:00', close: '23:30' }
    },
    pricing: {
      basePrice: 200,
      weekendSurcharge: 50,
      holidaySurcharge: 100,
      convenienceFee: 20
    },
    concessions: [
      {
        category: 'popcorn',
        name: 'Classic Salted Popcorn',
        description: 'Freshly popped corn with salt',
        price: 150,
        sizes: [
          { size: 'small', price: 150 },
          { size: 'medium', price: 200 },
          { size: 'large', price: 250 }
        ],
        available: true
      },
      {
        category: 'beverage',
        name: 'Coca Cola',
        description: 'Chilled soft drink',
        price: 100,
        sizes: [
          { size: 'small', price: 100 },
          { size: 'medium', price: 130 },
          { size: 'large', price: 160 }
        ],
        available: true
      },
      {
        category: 'combo',
        name: 'Movie Combo',
        description: 'Large popcorn + 2 drinks',
        price: 350,
        available: true
      }
    ],
    ratings: {
      overall: 4.2,
      cleanliness: 4.5,
      soundQuality: 4.8,
      seatingComfort: 4.0,
      staff: 4.1,
      totalReviews: 1250
    },
    status: 'active',
    verified: true
  },
  {
    name: 'INOX - R City Mall',
    chain: 'INOX',
    location: {
      address: 'R City Mall, Ghatkopar West, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400086',
      area: 'Ghatkopar',
      coordinates: {
        latitude: 19.0896,
        longitude: 72.9081
      }
    },
    contact: {
      phone: '+91-22-6671-3456',
      email: 'rcity@inoxmovies.com',
      website: 'https://www.inoxmovies.com'
    },
    screens: [
      {
        screenNumber: 1,
        name: 'Screen 1',
        type: '2D',
        totalSeats: 120,
        seatLayout: {
          rows: 12,
          seatsPerRow: 10
        },
        seatTypes: [
          { type: 'regular', count: 80, basePrice: 180 },
          { type: 'premium', count: 40, basePrice: 320 }
        ]
      },
      {
        screenNumber: 2,
        name: 'Screen 2 - 3D',
        type: '3D',
        totalSeats: 100,
        seatLayout: {
          rows: 10,
          seatsPerRow: 10
        },
        seatTypes: [
          { type: 'regular', count: 60, basePrice: 250 },
          { type: 'recliner', count: 40, basePrice: 500 }
        ]
      }
    ],
    amenities: {
      parking: { available: true, capacity: 800, fee: 30 },
      foodCourt: { available: true, vendors: ['Pizza Hut', 'Domino\'s', 'Starbucks'] },
      restrooms: true,
      wheelchairAccessible: true,
      airConditioning: true,
      wifi: false,
      atm: true,
      elevator: true
    },
    operatingHours: {
      monday: { open: '10:00', close: '23:00' },
      tuesday: { open: '10:00', close: '23:00' },
      wednesday: { open: '10:00', close: '23:00' },
      thursday: { open: '10:00', close: '23:00' },
      friday: { open: '10:00', close: '00:00' },
      saturday: { open: '10:00', close: '00:00' },
      sunday: { open: '10:00', close: '23:00' }
    },
    pricing: {
      basePrice: 180,
      weekendSurcharge: 40,
      holidaySurcharge: 80,
      convenienceFee: 25
    },
    concessions: [
      {
        category: 'popcorn',
        name: 'Cheese Popcorn',
        description: 'Popcorn with cheese flavor',
        price: 180,
        sizes: [
          { size: 'medium', price: 180 },
          { size: 'large', price: 230 }
        ],
        available: true
      },
      {
        category: 'beverage',
        name: 'Fresh Lime Soda',
        description: 'Refreshing lime drink',
        price: 120,
        available: true
      }
    ],
    ratings: {
      overall: 4.0,
      cleanliness: 4.2,
      soundQuality: 4.5,
      seatingComfort: 3.8,
      staff: 4.0,
      totalReviews: 890
    },
    status: 'active',
    verified: true
  },
  {
    name: 'Cinepolis - Fun Republic',
    chain: 'Cinepolis',
    location: {
      address: 'Fun Republic Mall, Andheri West, Mumbai',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400053',
      area: 'Andheri',
      coordinates: {
        latitude: 19.1368,
        longitude: 72.8261
      }
    },
    contact: {
      phone: '+91-22-6671-4567',
      email: 'funrepublic@cinepolis.com',
      website: 'https://www.cinepolis.com'
    },
    screens: [
      {
        screenNumber: 1,
        name: 'Screen 1',
        type: '2D',
        totalSeats: 180,
        seatLayout: {
          rows: 18,
          seatsPerRow: 10
        },
        seatTypes: [
          { type: 'regular', count: 120, basePrice: 220 },
          { type: 'premium', count: 60, basePrice: 380 }
        ]
      }
    ],
    amenities: {
      parking: { available: true, capacity: 600, fee: 40 },
      foodCourt: { available: true, vendors: ['Burger King', 'Taco Bell'] },
      restrooms: true,
      wheelchairAccessible: false,
      airConditioning: true,
      wifi: true,
      atm: false,
      elevator: true
    },
    operatingHours: {
      monday: { open: '09:30', close: '23:30' },
      tuesday: { open: '09:30', close: '23:30' },
      wednesday: { open: '09:30', close: '23:30' },
      thursday: { open: '09:30', close: '23:30' },
      friday: { open: '09:30', close: '00:30' },
      saturday: { open: '09:30', close: '00:30' },
      sunday: { open: '09:30', close: '23:30' }
    },
    pricing: {
      basePrice: 220,
      weekendSurcharge: 60,
      holidaySurcharge: 120,
      convenienceFee: 30
    },
    concessions: [
      {
        category: 'popcorn',
        name: 'Caramel Popcorn',
        description: 'Sweet caramel flavored popcorn',
        price: 200,
        available: true
      },
      {
        category: 'food',
        name: 'Nachos with Cheese',
        description: 'Crispy nachos with cheese dip',
        price: 180,
        available: true
      }
    ],
    ratings: {
      overall: 4.3,
      cleanliness: 4.4,
      soundQuality: 4.6,
      seatingComfort: 4.2,
      staff: 4.1,
      totalReviews: 756
    },
    status: 'active',
    verified: true
  }
];

const seedTheatres = async () => {
  try {
    // Clear existing theatres
    await Theatre.deleteMany({});
    console.log('Cleared existing theatres');

    // Insert sample theatres
    const insertedTheatres = await Theatre.insertMany(sampleTheatres);
    console.log(`✅ Inserted ${insertedTheatres.length} theatres`);

    // Display inserted theatres
    insertedTheatres.forEach(theatre => {
      console.log(`- ${theatre.name} (${theatre.chain}) - ${theatre.location.city}`);
    });

  } catch (error) {
    console.error('Error seeding theatres:', error);
  }
};

const seedDatabase = async () => {
  console.log('🌱 Starting database seeding...');
  
  await connectDB();
  await seedTheatres();
  
  console.log('✅ Database seeding completed!');
  process.exit(0);
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, sampleTheatres };
