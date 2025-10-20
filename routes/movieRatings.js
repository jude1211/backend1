const express = require('express');
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const MovieRating = require('../models/MovieRating');
const Movie = require('../models/Movie');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Submit a movie rating
router.post('/', authenticateUser, [
  body('movieId').isMongoId().withMessage('Valid movie ID is required'),
  body('rating').isInt({ min: 1, max: 10 }).withMessage('Rating must be between 1 and 10'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review must be less than 500 characters'),
  body('bookingId').optional().notEmpty().withMessage('Booking ID cannot be empty if provided')
], async (req, res) => {
  try {
    console.log('Movie rating request body:', req.body);
    console.log('User from auth:', req.user);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { movieId, rating, review, bookingId } = req.body;
    const userId = req.user._id;

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        error: 'Movie not found'
      });
    }

    // Check if user already rated this movie
    const existingRating = await MovieRating.findOne({ movieId, userId });
    if (existingRating) {
      return res.status(400).json({
        success: false,
        error: 'You have already rated this movie'
      });
    }

    // Create new rating
    const movieRating = new MovieRating({
      movieId,
      userId,
      rating,
      review,
      bookingId
    });

    await movieRating.save();

    // Get updated average rating
    const ratingStats = await MovieRating.getAverageRating(movieId);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        rating: movieRating,
        averageRating: ratingStats.averageRating,
        totalRatings: ratingStats.totalRatings
      }
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

// Update a movie rating
router.put('/:ratingId', authenticateUser, [
  param('ratingId').isMongoId().withMessage('Valid rating ID is required'),
  body('rating').isInt({ min: 1, max: 10 }).withMessage('Rating must be between 1 and 10'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review must be less than 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { ratingId } = req.params;
    const { rating, review } = req.body;
    const userId = req.user._id;

    const movieRating = await MovieRating.findOneAndUpdate(
      { _id: ratingId, userId },
      { rating, review },
      { new: true }
    );

    if (!movieRating) {
      return res.status(404).json({
        success: false,
        error: 'Rating not found or you are not authorized to update it'
      });
    }

    // Get updated average rating
    const ratingStats = await MovieRating.getAverageRating(movieRating.movieId);

    res.json({
      success: true,
      message: 'Rating updated successfully',
      data: {
        rating: movieRating,
        averageRating: ratingStats.averageRating,
        totalRatings: ratingStats.totalRatings
      }
    });
  } catch (error) {
    console.error('Update rating error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rating'
    });
  }
});

// Get movie rating statistics
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(movieId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid movie ID'
      });
    }

    const ratingStats = await MovieRating.getAverageRating(movieId);
    const userRating = req.user ? await MovieRating.getUserRating(movieId, req.user._id) : null;

    res.json({
      success: true,
      data: {
        averageRating: ratingStats.averageRating,
        totalRatings: ratingStats.totalRatings,
        userRating: userRating ? {
          rating: userRating.rating,
          review: userRating.review,
          createdAt: userRating.createdAt
        } : null
      }
    });
  } catch (error) {
    console.error('Get movie rating error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get movie rating'
    });
  }
});

// Get user's ratings
router.get('/user', authenticateUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await MovieRating.find({ userId })
      .populate('movieId', 'title posterUrl genre duration')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MovieRating.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        ratings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRatings: total
        }
      }
    });
  } catch (error) {
    console.error('Get user ratings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user ratings'
    });
  }
});

// Delete a rating
router.delete('/:ratingId', authenticateUser, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.user._id;

    const movieRating = await MovieRating.findOneAndDelete({ _id: ratingId, userId });

    if (!movieRating) {
      return res.status(404).json({
        success: false,
        error: 'Rating not found or you are not authorized to delete it'
      });
    }

    // Get updated average rating
    const ratingStats = await MovieRating.getAverageRating(movieRating.movieId);

    res.json({
      success: true,
      message: 'Rating deleted successfully',
      data: {
        averageRating: ratingStats.averageRating,
        totalRatings: ratingStats.totalRatings
      }
    });
  } catch (error) {
    console.error('Delete rating error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete rating'
    });
  }
});

module.exports = router;
