const express = require('express');
const router = express.Router();
const Snack = require('../models/Snack');
const { authenticateTheatreOwner } = require('../middleware/theatreOwnerAuth');

// GET /api/v1/snacks/stats -> return { totalItems, available, outOfStock, lowStock, totalValue }
router.get('/stats', async (req, res) => {
  try {
    const snacks = await Snack.find({ isActive: true });
    
    let totalItems = 0;
    let available = 0;
    let outOfStock = 0;
    let lowStock = 0;
    let totalValue = 0;

    snacks.forEach(snack => {
      totalItems++;
      if (snack.status === 'available') available++;
      if (snack.status === 'out_of_stock') outOfStock++;
      if (snack.status === 'low_stock') lowStock++;
      totalValue += (snack.price * snack.stock);
    });

    res.json({
      success: true,
      data: {
        totalItems,
        available,
        outOfStock,
        lowStock,
        totalValue
      }
    });
  } catch (error) {
    console.error('Error fetching snack stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/v1/snacks -> list all snacks
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = { isActive: true };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const snacks = await Snack.find(query).sort({ createdAt: -1 });
    const result = snacks.map(s => {
      const obj = s.toObject();
      const availableStock = Math.max(0, s.stock - s.reservedStock);
      
      let computedStatus = 'out_of_stock';
      if (availableStock > 10) computedStatus = 'available';
      else if (availableStock > 0) computedStatus = 'low_stock';

      return {
        ...obj,
        availableStock,
        status: computedStatus
      };
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching snacks:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/v1/snacks/:id -> get one snack
router.get('/:id', async (req, res) => {
  try {
    const snack = await Snack.findById(req.params.id);
    if (!snack || !snack.isActive) {
      return res.status(404).json({ success: false, message: 'Snack not found' });
    }
    res.json({ success: true, data: snack });
  } catch (error) {
    console.error('Error fetching snack:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/v1/snacks -> create snack (admin only)
router.post('/', authenticateTheatreOwner, async (req, res) => {
  try {
    const newSnack = new Snack(req.body);
    // pre-save hook will handle the status based on stock
    const savedSnack = await newSnack.save();
    res.status(201).json({ success: true, data: savedSnack });
  } catch (error) {
    console.error('Error creating snack:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/v1/snacks/:id -> update snack (admin only)
router.put('/:id', authenticateTheatreOwner, async (req, res) => {
  try {
    const snack = await Snack.findById(req.params.id);
    if (!snack) {
      return res.status(404).json({ success: false, message: 'Snack not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      snack[key] = req.body[key];
    });

    // Save to trigger pre-save hook for status calculation
    const updatedSnack = await snack.save();
    
    res.json({ success: true, data: updatedSnack });
  } catch (error) {
    console.error('Error updating snack:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/v1/snacks/:id -> delete snack (admin only)
// Soft delete to keep existing orders intact
router.delete('/:id', authenticateTheatreOwner, async (req, res) => {
  try {
    const snack = await Snack.findById(req.params.id);
    if (!snack) {
      return res.status(404).json({ success: false, message: 'Snack not found' });
    }

    snack.isActive = false;
    await snack.save();
    
    res.json({ success: true, message: 'Snack deleted successfully' });
  } catch (error) {
    console.error('Error deleting snack:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
