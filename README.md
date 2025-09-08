# BookNView Backend API

A comprehensive Node.js/Express/MongoDB backend for the BookNView movie booking application with Firebase Authentication integration.

## 🚀 Features

### 🔐 Authentication & Authorization
- **Firebase Authentication Integration**: Seamless integration with Firebase Auth
- **JWT Token Verification**: Secure API endpoints with Firebase ID tokens
- **User Management**: Automatic user creation and synchronization
- **Role-based Access Control**: Admin and user role management

### 👤 User Management
- **Profile Management**: Complete user profile CRUD operations
- **Preferences**: Language, notification, and city preferences
- **Address Management**: Multiple address support with default selection
- **Favorite Management**: Favorite movies and theatres
- **Loyalty Program**: Points and membership tier system

### 🎬 Movie & Theatre System
- **Movie Catalog**: Comprehensive movie information with filtering
- **Theatre Management**: Complete theatre data with screens and amenities
- **Showtime Management**: Movie showtimes with seat availability
- **Location-based Search**: Find nearby theatres using coordinates

### 🎫 Booking System
- **Complete Booking Flow**: From seat selection to payment confirmation
- **Seat Management**: Real-time seat availability and pricing
- **Snacks & Concessions**: Add-on items with pricing
- **Booking History**: Complete booking tracking and management
- **Cancellation System**: Booking cancellation with refund calculation

### 📊 Analytics & Reporting
- **User Statistics**: Booking history and spending analytics
- **Theatre Analytics**: Popular movies and revenue tracking
- **Review System**: Movie and theatre ratings and reviews

## 🛠️ Technology Stack

- **Runtime**: Node.js 16+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting
- **Development**: Nodemon, Morgan logging

## 📁 Project Structure

```
backend/
├── config/
│   └── firebase.js          # Firebase Admin SDK configuration
├── middleware/
│   ├── auth.js              # Authentication middleware
│   └── errorHandler.js      # Global error handling
├── models/
│   ├── User.js              # User data model
│   ├── Booking.js           # Booking data model
│   └── Theatre.js           # Theatre data model
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management routes
│   ├── bookings.js          # Booking management routes
│   ├── movies.js            # Movie catalog routes
│   └── theatres.js          # Theatre management routes
├── scripts/
│   └── seedData.js          # Database seeding script
├── .env                     # Environment variables
├── .env.example             # Environment template
├── server.js                # Main server file
└── package.json             # Dependencies and scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16 or higher
- MongoDB (local or MongoDB Atlas)
- Firebase project with Admin SDK credentials

### Installation

1. **Clone and navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB
   MONGODB_URI=mongodb://localhost:27017/booknview
   
   # Firebase Admin SDK
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
   
   # JWT & Security
   JWT_SECRET=your_super_secret_key
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Start MongoDB** (if running locally):
   ```bash
   mongod
   ```

5. **Seed the database** (optional):
   ```bash
   npm run seed
   ```

6. **Start the server**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:5000`

## 🔧 Firebase Setup

### 1. Get Firebase Admin SDK Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

### 2. Configure Environment Variables

Extract the following from your Firebase service account JSON:
- `project_id` → `FIREBASE_PROJECT_ID`
- `private_key` → `FIREBASE_PRIVATE_KEY`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key_id` → `FIREBASE_PRIVATE_KEY_ID`
- `client_id` → `FIREBASE_CLIENT_ID`

## 📡 API Endpoints

### Authentication
- `POST /api/v1/auth/verify` - Verify Firebase token and sync user
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/refresh` - Refresh user session
- `POST /api/v1/auth/logout` - Logout user

### User Management
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `POST /api/v1/users/addresses` - Add user address
- `PUT /api/v1/users/addresses/:id` - Update address
- `DELETE /api/v1/users/addresses/:id` - Delete address
- `GET /api/v1/users/bookings` - Get user bookings
- `POST /api/v1/users/favorites/theatres/:id` - Add favorite theatre
- `DELETE /api/v1/users/favorites/theatres/:id` - Remove favorite theatre

### Bookings
- `POST /api/v1/bookings` - Create new booking
- `GET /api/v1/bookings` - Get user bookings with filters
- `GET /api/v1/bookings/:id` - Get specific booking
- `PATCH /api/v1/bookings/:id/cancel` - Cancel booking
- `POST /api/v1/bookings/:id/review` - Add booking review
- `GET /api/v1/bookings/stats/summary` - Get booking statistics

### Movies
- `GET /api/v1/movies` - Get movies with filtering and pagination
- `GET /api/v1/movies/:id` - Get movie details
- `GET /api/v1/movies/:id/showtimes` - Get movie showtimes
- `GET /api/v1/movies/trending/popular` - Get trending movies
- `GET /api/v1/movies/:id/recommendations` - Get movie recommendations

### Theatres
- `GET /api/v1/theatres` - Get theatres with filtering
- `GET /api/v1/theatres/:id` - Get theatre details
- `GET /api/v1/theatres/city/:city` - Get theatres by city
- `GET /api/v1/theatres/chains/list` - Get theatre chains
- `GET /api/v1/theatres/cities/list` - Get cities with theatres
- `GET /api/v1/theatres/:id/concessions` - Get theatre snacks/concessions

## 🔒 Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configurable origin whitelist
- **Helmet Security**: Security headers and protection
- **Input Validation**: Comprehensive request validation
- **Firebase Token Verification**: Secure authentication
- **Error Handling**: Sanitized error responses

## 📊 Database Models

### User Model
- Personal information and preferences
- Authentication provider details
- Loyalty program data
- Favorite movies and theatres
- Address and payment method management

### Booking Model
- Complete booking information
- Movie and theatre details
- Seat and pricing information
- Payment and cancellation tracking
- Review and rating system

### Theatre Model
- Theatre information and location
- Screen and seat configuration
- Amenities and operating hours
- Concessions and pricing
- Ratings and statistics

## 🧪 Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run seed` - Seed database with sample data
- `npm test` - Run tests (when implemented)

### Environment Modes
- **Development**: Enhanced logging, detailed errors
- **Production**: Optimized performance, minimal logging

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/booknview
FIREBASE_PROJECT_ID=your_production_project_id
# ... other Firebase credentials
JWT_SECRET=your_production_secret
CORS_ORIGIN=https://yourdomain.com
```

### MongoDB Atlas Setup
1. Create MongoDB Atlas cluster
2. Create database user
3. Whitelist IP addresses
4. Get connection string
5. Update `MONGODB_URI` in environment

## 🔍 Monitoring & Logging

- **Request Logging**: Morgan middleware for HTTP request logging
- **Error Tracking**: Comprehensive error logging with stack traces
- **Health Check**: `/health` endpoint for monitoring
- **Performance Metrics**: Request timing and response monitoring

## 🤝 Integration with Frontend

The backend is designed to work seamlessly with the React frontend:

1. **Authentication Flow**: Firebase tokens from frontend are verified
2. **User Synchronization**: User data is automatically synced between Firebase and MongoDB
3. **Real-time Updates**: User preferences and bookings are immediately available
4. **CORS Configuration**: Properly configured for frontend domain

## 📝 API Documentation

For detailed API documentation with request/response examples, visit:
`http://localhost:5000/api/docs` (when implemented)

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**:
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network connectivity

2. **Firebase Authentication Error**:
   - Verify Firebase credentials in `.env`
   - Check Firebase project configuration
   - Ensure service account has proper permissions

3. **CORS Errors**:
   - Update `CORS_ORIGIN` in `.env`
   - Check frontend URL configuration

## 📄 License

This project is licensed under the MIT License.
