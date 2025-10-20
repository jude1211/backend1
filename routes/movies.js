const express = require('express');
const { query, body } = require('express-validator');
const { optionalAuth, authenticateUser } = require('../middleware/auth');
const { authenticateTheatreOwner } = require('../middleware/theatreOwnerAuth');
const Movie = require('../models/Movie');
const Theatre = require('../models/Theatre');
const ScreenShow = require('../models/ScreenShow');
const ScreenLayout = require('../models/ScreenLayout');

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
      .populate('theatreOwner', 'theatreName ownerName location.city')
      .lean();

    // Enhance each movie with status, runtimeDays, and advance booking info
    const today = new Date();
    const enhancedMovies = movies.map(m => {
      let status = 'Coming Soon';
      let runtimeDays = 0;
      let releaseDate = m.releaseDate;
      let advanceBookingEnabled = m.advanceBookingEnabled || false;
      if (m.releaseDate) {
        const release = new Date(m.releaseDate);
        if (release <= today) {
          status = 'Now Showing';
          if (m.firstShowDate) {
            const firstShow = new Date(m.firstShowDate);
            runtimeDays = Math.max(1, Math.ceil((today - firstShow) / (1000 * 60 * 60 * 24)));
          } else {
            runtimeDays = Math.max(1, Math.ceil((today - release) / (1000 * 60 * 60 * 24)));
          }
        }
      }
      return {
        ...m,
        status,
        runtimeDays,
        releaseDate,
        advanceBookingEnabled
      };
    });

    const totalMovies = await Movie.countDocuments(query);

    res.json({
      success: true,
      data: enhancedMovies,
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

// Now Showing: status active OR releaseDate <= today
router.get('/now-showing', async (req, res) => {
  try {
    const today = new Date();
    const movies = await Movie.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('theatreOwner', 'theatreName location.city')
      .lean();

    // Show ONLY active movies in Now Showing, per requirement
    const normalized = movies.filter(m => m.status === 'active');

    res.json({ success: true, data: normalized });
  } catch (error) {
    console.error('Now showing error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch now showing movies' });
  }
});

// Coming Soon: status coming_soon OR releaseDate > today, but exclude active
router.get('/coming-soon', async (req, res) => {
  try {
    const today = new Date();
    const movies = await Movie.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate('theatreOwner', 'theatreName location.city')
      .lean();

    const filtered = movies.filter(m => {
      if (m.status === 'active') return false;
      const statusComing = m.status === 'coming_soon';
      const d = m.releaseDate ? new Date(m.releaseDate) : null;
      const inFuture = d && !isNaN(d.getTime()) ? d > today : false;
      return statusComing || inFuture;
    });

    res.json({ success: true, data: filtered });
  } catch (error) {
    console.error('Coming soon error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch coming soon movies' });
  }
});

// Public: Movies with theatres filtered by location (city/town)
router.get('/by-location', async (req, res) => {
  try {
    const { city, limit = 50 } = req.query;

    // Always start from all active movies
    const movies = await Movie.find({ isActive: true })
      .populate({ path: 'theatreOwner', select: 'theatreName location.city isActive' })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // If no city provided, just return movies unchanged (global default)
    if (!city || !String(city).trim()) {
      return res.json({ success: true, data: movies });
    }

    // Build regex for city match (case-insensitive)
    const cityRegex = new RegExp(String(city), 'i');

    // Annotate each movie: inCity if theatre owner's city matches the selected city
    const annotated = movies.map(m => {
      const ownerCity = (m.theatreOwner?.location?.city || '');
      const inCity = cityRegex.test(ownerCity);
      return { ...m, _inCity: inCity };
    });

    res.json({ success: true, data: annotated });
  } catch (error) {
    console.error('Movies by location error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch movies by location' });
  }
});

  // Active movies with assigned screens/shows (for landing page)
router.get('/active-with-shows', async (req, res) => {
  try {
    // Find all shows and populate minimal movie fields
    const shows = await ScreenShow.find({ status: 'Active' })
      .populate('movieId', 'title posterUrl genre movieLanguage duration status isActive')
      .lean();

    // Filter shows to those with non-past dates and at least one non-empty showtime
    const today = new Date().toISOString().split('T')[0];
    const activeShows = shows.filter(s => {
      const hasMovie = !!s.movieId; // don't strictly require movie.status === 'active'
      const notPastDate = typeof s.bookingDate === 'string' && s.bookingDate >= today;
      const validTimes = Array.isArray(s.showtimes) && s.showtimes.some(t => typeof t === 'string' && t.trim().length > 0);
      return hasMovie && notPastDate && validTimes;
    });

    // Group by movie
    const movieIdToData = new Map();
    for (const sh of activeShows) {
      const key = String(sh.movieId._id);
      if (!movieIdToData.has(key)) {
        movieIdToData.set(key, {
          movie: {
            _id: sh.movieId._id,
            title: sh.movieId.title,
            posterUrl: sh.movieId.posterUrl,
            genre: sh.movieId.genre,
            language: sh.movieId.movieLanguage || 'English',
            duration: sh.movieId.duration
          },
          screens: {}
        });
      }
      const bucket = movieIdToData.get(key);
      const screenKey = String(sh.screenId);
      if (!bucket.screens[screenKey]) {
        bucket.screens[screenKey] = {
          screenId: sh.screenId,
          showGroups: []
        };
      }
      // Deduplicate normalized times per (screen,date)
      const normalizedTimes = Array.from(new Set((sh.showtimes || []).map(t => String(t).trim()).filter(Boolean)));
      if (normalizedTimes.length > 0) {
        bucket.screens[screenKey].showGroups.push({
          bookingDate: sh.bookingDate,
          showtimes: normalizedTimes
        });
      }
    }

    // Remove screens without showGroups and movies without any screens
    const result = Array.from(movieIdToData.values())
      .map(entry => {
        const screens = Object.values(entry.screens)
          .map(scr => ({ ...scr, showGroups: (scr.showGroups || []).filter(g => Array.isArray(g.showtimes) && g.showtimes.length > 0) }))
          .filter(scr => (scr.showGroups || []).length > 0);
        return { movie: entry.movie, screens };
      })
      .filter(item => (item.screens || []).length > 0);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Active with shows error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch active movies with shows' });
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

// Enable/disable advance booking for a movie
router.patch('/:movieId/advance-booking', authenticateTheatreOwner, async (req, res) => {
  try {
    const { movieId } = req.params;
    const { enabled } = req.body;
    
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    // Check if the theatre owner owns this movie
    if (movie.theatreOwner && movie.theatreOwner.toString() !== req.theatreOwner._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this movie'
      });
    }

    movie.advanceBookingEnabled = Boolean(enabled);
    await movie.save();

    res.json({
      success: true,
      data: {
        movieId: movie._id,
        advanceBookingEnabled: movie.advanceBookingEnabled,
        releaseDate: movie.releaseDate
      }
    });
  } catch (error) {
    console.error('Update advance booking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update advance booking'
    });
  }
});

// Get movie by ID
router.get('/:movieId', optionalAuth, async (req, res) => {
  try {
    const movieId = req.params.movieId;
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }
    let movieData = movie.toObject();
    // Enhance with status, runtimeDays, and advance booking info
    const today = new Date();
    let status = 'Coming Soon';
    let runtimeDays = 0;
    let releaseDate = movie.releaseDate;
    let advanceBookingEnabled = movie.advanceBookingEnabled || false;
    if (movie.releaseDate) {
      const release = new Date(movie.releaseDate);
      if (release <= today) {
        status = 'Now Showing';
        if (movie.firstShowDate) {
          const firstShow = new Date(movie.firstShowDate);
          runtimeDays = Math.max(1, Math.ceil((today - firstShow) / (1000 * 60 * 60 * 24)));
        } else {
          runtimeDays = Math.max(1, Math.ceil((today - release) / (1000 * 60 * 60 * 24)));
        }
      }
    }
    movieData.status = status;
    movieData.runtimeDays = runtimeDays;
    movieData.releaseDate = releaseDate;
    movieData.advanceBookingEnabled = advanceBookingEnabled;
    if (req.user && req.user.favoriteMovies) {
      const isFavorite = req.user.favoriteMovies.some(fav => fav.movieId === movieId);
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

    // Get today's date for filtering
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Find all active shows for this movie
    const shows = await ScreenShow.find({ movieId, status: 'Active' })
      .populate('theatreId', 'name location')
      .populate('screenId', 'screenNumber screenType')
      .lean();

    // Group by screen and date, filtering out past dates and times
    const screens = {};
    for (const show of shows) {
      // Use runningDates if available, otherwise fall back to bookingDate
      const datesToProcess = show.runningDates && show.runningDates.length > 0 
        ? show.runningDates 
        : [show.bookingDate];
      
      for (const date of datesToProcess) {
        // Skip past dates
        if (date < today) {
          continue;
        }
        
        // For today's shows, filter out past showtimes
        let validShowtimes = show.showtimes || [];
        if (date === today) {
          const now = new Date();
          validShowtimes = validShowtimes.filter(showtime => {
            try {
              // Parse showtime (e.g., "2:30 PM")
              const timeMatch = showtime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
              if (!timeMatch) return false;
              
              let hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              const period = timeMatch[3].toUpperCase();
              
              // Convert to 24-hour format
              if (period === 'PM' && hours !== 12) {
                hours += 12;
              } else if (period === 'AM' && hours === 12) {
                hours = 0;
              }
              
              // Create show datetime
              const [year, month, day] = date.split('-').map(Number);
              const showDateTime = new Date(year, month - 1, day, hours, minutes);
              
              // Check if showtime is at least 30 minutes in the future
              const timeUntilShow = Math.floor((showDateTime.getTime() - now.getTime()) / (1000 * 60));
              return timeUntilShow > 30;
            } catch (error) {
              console.error('Error parsing showtime:', showtime, error);
              return false;
            }
          });
        }
        
        // Skip shows with no valid showtimes
        if (validShowtimes.length === 0) {
          continue;
        }
        
        const screenKey = String(show.screenId?._id || show.screenId);
        if (!screens[screenKey]) {
          screens[screenKey] = {
            screenId: show.screenId?._id || show.screenId,
            screenNumber: show.screenId?.screenNumber,
            screenType: show.screenId?.screenType,
            showGroups: []
          };
        }
        screens[screenKey].showGroups.push({
          bookingDate: date,
          showtimes: validShowtimes,
          theatre: show.theatreId?.name || '',
          theatreId: show.theatreId?._id || show.theatreId,
          availableSeats: show.availableSeats || 0
        });
      }
    }

    res.json({
      success: true,
      data: Object.values(screens)
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
    const fetchTrailerUrl = async (tmdbId) => {
      if (!tmdbId) return '';
      const apiKey = process.env.TMDB_API_KEY;
      if (!apiKey) return '';
      const url = `https://api.themoviedb.org/3/movie/${tmdbId}/videos?api_key=${apiKey}`;
      try {
        const resp = await fetch(url);
        const data = await resp.json();
        if (Array.isArray(data.results)) {
          const trailer = data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) {
            return `https://www.youtube.com/watch?v=${trailer.key}`;
          }
        }
      } catch (e) { /* ignore */ }
      return '';
    };

    const tmdbId = req.body.tmdbId;
    let trailerUrl = req.body.trailerUrl || '';
    
    // If no trailer URL provided but we have TMDB ID, try to fetch from TMDB
    if (!trailerUrl && tmdbId) {
      trailerUrl = await fetchTrailerUrl(tmdbId);
    }

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
      addedBy: 'theatre_owner',
      trailerUrl,
      tmdbId: tmdbId || null
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
