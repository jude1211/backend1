const express = require('express');
const { query, body } = require('express-validator');
const { optionalAuth, authenticateUser } = require('../middleware/auth');
const { authenticateTheatreOwner } = require('../middleware/theatreOwnerAuth');
const Movie = require('../models/Movie');

const router = express.Router();

// Mock movie data - in a real app, this would come from a database or external API
const mockMovies = [
  {
    id: '1',
    title: 'Avengers: Endgame',
    poster: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
    genre: ['Action', 'Adventure', 'Drama'],
    duration: 181,
    rating: 'PG-13',
    language: 'English',
    releaseDate: '2019-04-26',
    description: 'After the devastating events of Avengers: Infinity War, the universe is in ruins...',
    director: 'Anthony Russo, Joe Russo',
    cast: ['Robert Downey Jr.', 'Chris Evans', 'Mark Ruffalo', 'Chris Hemsworth'],
    imdbRating: 8.4,
    userRating: 4.5,
    status: 'now_playing',
    trailerUrl: 'https://www.youtube.com/watch?v=TcMBFSGVi1c'
  },
  {
    id: '2',
    title: 'Spider-Man: No Way Home',
    poster: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg',
    genre: ['Action', 'Adventure', 'Sci-Fi'],
    duration: 148,
    rating: 'PG-13',
    language: 'English',
    releaseDate: '2021-12-17',
    description: 'Peter Parker seeks help from Doctor Strange when his identity is revealed...',
    director: 'Jon Watts',
    cast: ['Tom Holland', 'Zendaya', 'Benedict Cumberbatch', 'Jacob Batalon'],
    imdbRating: 8.2,
    userRating: 4.6,
    status: 'now_playing',
    trailerUrl: 'https://www.youtube.com/watch?v=JfVOs4VSpmA'
  },
  {
    id: '3',
    title: 'The Batman',
    poster: 'https://image.tmdb.org/t/p/w500/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg',
    genre: ['Action', 'Crime', 'Drama'],
    duration: 176,
    rating: 'PG-13',
    language: 'English',
    releaseDate: '2022-03-04',
    description: 'Batman ventures into Gotham City\'s underworld when a sadistic killer leaves behind a trail of cryptic clues...',
    director: 'Matt Reeves',
    cast: ['Robert Pattinson', 'Zoë Kravitz', 'Paul Dano', 'Jeffrey Wright'],
    imdbRating: 7.8,
    userRating: 4.2,
    status: 'now_playing',
    trailerUrl: 'https://www.youtube.com/watch?v=mqqft2x_Aa4'
  },
  {
    id: '4',
    title: 'Top Gun: Maverick',
    poster: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/odJ4hx6g6vBt4lBWKFD1tI8WS4x.jpg',
    genre: ['Action', 'Drama'],
    duration: 130,
    rating: 'PG-13',
    language: 'English',
    releaseDate: '2022-05-27',
    description: 'After thirty years, Maverick is still pushing the envelope as a top naval aviator...',
    director: 'Joseph Kosinski',
    cast: ['Tom Cruise', 'Miles Teller', 'Jennifer Connelly', 'Jon Hamm'],
    imdbRating: 8.3,
    userRating: 4.7,
    status: 'now_playing',
    trailerUrl: 'https://www.youtube.com/watch?v=qSqVVswa420'
  },
  {
    id: '5',
    title: 'Black Panther: Wakanda Forever',
    poster: 'https://image.tmdb.org/t/p/w500/sv1xJUazXeYqALzczSZ3O6nkH75.jpg',
    backdrop: 'https://image.tmdb.org/t/p/w1280/xDMIl84Qo5Tsu62c9DGWhmPI67A.jpg',
    genre: ['Action', 'Adventure', 'Drama'],
    duration: 161,
    rating: 'PG-13',
    language: 'English',
    releaseDate: '2022-11-11',
    description: 'The people of Wakanda fight to protect their home from intervening world powers...',
    director: 'Ryan Coogler',
    cast: ['Letitia Wright', 'Lupita Nyong\'o', 'Danai Gurira', 'Winston Duke'],
    imdbRating: 6.7,
    userRating: 4.1,
    status: 'coming_soon',
    trailerUrl: 'https://www.youtube.com/watch?v=_Z3QKkl1WyM'
  }
];

// Get all movies with filtering and pagination
// Get all movies (public endpoint with filters)
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('genre').optional().trim(),
  query('language').optional().trim(),
  query('status').optional().isIn(['active', 'inactive', 'coming_soon']),
  query('search').optional().trim(),
  query('sortBy').optional().isIn(['title', 'releaseDate', 'createdAt']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      genre,
      language,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = { isActive: true };
    
    if (genre) {
      query.genre = { $regex: genre, $options: 'i' };
    }
    
    if (language) {
      query.language = { $regex: language, $options: 'i' };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { director: { $regex: search, $options: 'i' } },
        { cast: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const movies = await Movie.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('theatreOwner', 'theatreName ownerName')
      .lean();

    const totalMovies = await Movie.countDocuments(query);

    res.json({
      success: true,
      data: movies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMovies / parseInt(limit)),
        totalItems: totalMovies,
        hasNext: skip + parseInt(limit) < totalMovies,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch movies'
    });
  }
});

// Get movies for specific theatre owner (admin dashboard)
router.get('/theatre-owner/:theatreOwnerId', authenticateTheatreOwner, async (req, res) => {
  try {
    const { theatreOwnerId } = req.params;
    
    // Verify the user is accessing their own movies or is admin
    if (req.theatreOwner._id.toString() !== theatreOwnerId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access these movies'
      });
    }

    const movies = await Movie.find({ 
      theatreOwner: theatreOwnerId,
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .populate('theatreOwner', 'theatreName ownerName')
    .lean();

    res.json({
      success: true,
      data: movies,
      count: movies.length
    });
  } catch (error) {
    console.error('Get theatre owner movies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch theatre owner movies'
    });
  }
});

// Get movie by ID
router.get('/:movieId', optionalAuth, async (req, res) => {
  try {
    const movie = mockMovies.find(m => m.id === req.params.movieId);

    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    // Add user-specific data if authenticated
    let movieData = { ...movie };
    if (req.user) {
      const isFavorite = req.user.favoriteMovies.some(fav => fav.movieId === movie.id);
      movieData.isFavorite = isFavorite;
    }

    res.json({
      success: true,
      data: movieData
    });
  } catch (error) {
    console.error('Get movie error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch movie'
    });
  }
});

// Get movie showtimes
router.get('/:movieId/showtimes', [
  query('city').optional().trim(),
  query('date').optional().isISO8601(),
  query('theatreId').optional().isMongoId()
], async (req, res) => {
  try {
    const { city = 'Mumbai', date, theatreId } = req.query;
    const movieId = req.params.movieId;

    const movie = mockMovies.find(m => m.id === movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    // Mock showtimes data
    const mockShowtimes = [
      {
        id: 'show1',
        theatreId: '507f1f77bcf86cd799439011',
        theatreName: 'PVR Cinemas - Phoenix Mall',
        location: {
          address: 'Phoenix Mall, Kurla West',
          city: 'Mumbai',
          area: 'Kurla'
        },
        screen: {
          screenNumber: 1,
          screenType: '2D'
        },
        times: ['10:30 AM', '1:45 PM', '5:00 PM', '8:15 PM', '11:30 PM'],
        availableSeats: 120,
        totalSeats: 150,
        pricing: {
          regular: 200,
          premium: 350,
          recliner: 500
        }
      },
      {
        id: 'show2',
        theatreId: '507f1f77bcf86cd799439012',
        theatreName: 'INOX - R City Mall',
        location: {
          address: 'R City Mall, Ghatkopar West',
          city: 'Mumbai',
          area: 'Ghatkopar'
        },
        screen: {
          screenNumber: 3,
          screenType: 'IMAX'
        },
        times: ['11:00 AM', '2:30 PM', '6:00 PM', '9:30 PM'],
        availableSeats: 85,
        totalSeats: 100,
        pricing: {
          regular: 300,
          premium: 450,
          recliner: 650
        }
      },
      {
        id: 'show3',
        theatreId: '507f1f77bcf86cd799439013',
        theatreName: 'Cinepolis - Fun Republic',
        location: {
          address: 'Fun Republic Mall, Andheri West',
          city: 'Mumbai',
          area: 'Andheri'
        },
        screen: {
          screenNumber: 2,
          screenType: '3D'
        },
        times: ['12:15 PM', '3:45 PM', '7:15 PM', '10:45 PM'],
        availableSeats: 95,
        totalSeats: 120,
        pricing: {
          regular: 250,
          premium: 400,
          recliner: 550
        }
      }
    ];

    let filteredShowtimes = mockShowtimes;

    // Filter by theatre if specified
    if (theatreId) {
      filteredShowtimes = filteredShowtimes.filter(show => show.theatreId === theatreId);
    }

    // Filter by city
    filteredShowtimes = filteredShowtimes.filter(show => 
      show.location.city.toLowerCase() === city.toLowerCase()
    );

    res.json({
      success: true,
      data: {
        movie: {
          id: movie.id,
          title: movie.title,
          poster: movie.poster,
          duration: movie.duration,
          genre: movie.genre,
          rating: movie.rating,
          language: movie.language
        },
        showtimes: filteredShowtimes,
        date: date || new Date().toISOString().split('T')[0],
        city
      }
    });
  } catch (error) {
    console.error('Get showtimes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch showtimes'
    });
  }
});

// Get trending/popular movies
router.get('/trending/popular', async (req, res) => {
  try {
    // Sort by user rating and return top movies
    const trendingMovies = mockMovies
      .filter(movie => movie.status === 'now_playing')
      .sort((a, b) => b.userRating - a.userRating)
      .slice(0, 6);

    res.json({
      success: true,
      data: trendingMovies
    });
  } catch (error) {
    console.error('Get trending movies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch trending movies'
    });
  }
});

// Get movie recommendations
router.get('/:movieId/recommendations', optionalAuth, async (req, res) => {
  try {
    const movie = mockMovies.find(m => m.id === req.params.movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    // Simple recommendation based on genre
    const recommendations = mockMovies
      .filter(m => 
        m.id !== movie.id && 
        m.genre.some(g => movie.genre.includes(g))
      )
      .slice(0, 4);

    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations'
    });
  }
});

// Add new movie (for theatre owners)
router.post('/', [
  authenticateTheatreOwner,
  body('title').trim().notEmpty(),
  body('genre').trim().notEmpty(),
  body('duration').trim().notEmpty(),
  body('status').optional().isIn(['active', 'inactive', 'coming_soon']),
  body('format').optional().isIn(['2D', '3D'])
], async (req, res) => {
  try {
    const moviePayload = {
      title: req.body.title,
      genre: req.body.genre,
      duration: req.body.duration,
      posterUrl: req.body.posterUrl,
      status: req.body.status || 'active',
      showtimes: Array.isArray(req.body.showtimes) ? req.body.showtimes : (req.body.showtimes || '').split(',').map(s => s.trim()),
      description: req.body.description || '',
      director: req.body.director || '',
      cast: Array.isArray(req.body.cast) ? req.body.cast : (req.body.cast ? req.body.cast.split(',').map(c => c.trim()) : []),
      movieLanguage: req.body.language || 'English',
      language: 'english',
      releaseDate: req.body.releaseDate || '',
      format: req.body.format || '2D',
      createdBy: req.theatreOwner._id,
      theatreOwner: req.theatreOwner._id,
      addedBy: 'theatre_owner'
    };

    const saved = await Movie.create(moviePayload);

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    console.error('Add movie error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add movie'
    });
  }
});

// Update movie (for theatre owners)
router.put('/:movieId', authenticateTheatreOwner, async (req, res) => {
  try {
    const movieId = req.params.movieId;
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ success: false, error: 'Movie not found' });
    }

    // Only theatre owner who created it can edit
    if (movie.theatreOwner?.toString() !== req.theatreOwner._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this movie' });
    }

    Object.assign(movie, {
      title: req.body.title ?? movie.title,
      genre: req.body.genre ?? movie.genre,
      duration: req.body.duration ?? movie.duration,
      posterUrl: req.body.posterUrl ?? movie.posterUrl,
      status: req.body.status ?? movie.status,
      showtimes: req.body.showtimes ? (Array.isArray(req.body.showtimes) ? req.body.showtimes : req.body.showtimes.split(',').map(s => s.trim())) : movie.showtimes,
      description: req.body.description ?? movie.description,
      director: req.body.director ?? movie.director,
      cast: req.body.cast ? (Array.isArray(req.body.cast) ? req.body.cast : req.body.cast.split(',').map(c => c.trim())) : movie.cast,
      movieLanguage: req.body.language ?? movie.movieLanguage,
      releaseDate: req.body.releaseDate ?? movie.releaseDate,
      format: req.body.format ?? movie.format
    });

    const saved = await movie.save();
    res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Update movie error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update movie'
    });
  }
});

// Delete movie (for theatre owners)
router.delete('/:movieId', authenticateTheatreOwner, async (req, res) => {
  try {
    const movieId = req.params.movieId;
    const movie = await Movie.findById(movieId);
    if (!movie) return res.status(404).json({ success: false, error: 'Movie not found' });

    if (movie.theatreOwner?.toString() !== req.theatreOwner._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this movie' });
    }

    await movie.deleteOne();
    res.json({ success: true, message: 'Movie deleted successfully' });
  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete movie'
    });
  }
});

module.exports = router;
