import Listing from '../models/listing.js';
import mongoose from 'mongoose';

export async function addListing(req, res) {
  try {
    // Validation happens in middleware, req.body is already sanitized
    const listing = await Listing.create(req.body);
    res.status(201).json(listing);
  } catch (err) {
    console.error('addListing error:', err.message, { requestId: req.id });
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: Object.values(err.errors).map(e => e.message),
        requestId: req.id
      });
    }
    
    res.status(500).json({ 
      error: 'Error creating listing',
      requestId: req.id
    });
  }
}

export async function getListings(req, res) {
  try {
    // Pagination support
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      Listing.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Listing.countDocuments()
    ]);

    res.json({
      listings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('getListings error:', err.message, { requestId: req.id });
    res.status(500).json({ 
      error: 'Error fetching listings',
      requestId: req.id
    });
  }
}

export async function searchListings(req, res) {
  try {
    const { q } = req.body;
    if (!q) return res.json({ listings: [], query: q });
    
    // Escape special regex characters
    const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');
    
    const results = await Listing.find({ 
      $or: [
        { name: regex }, 
        { address: regex },
        { location: regex },
        { keywords: regex }
      ] 
    })
    .limit(100)
    .lean();
    
    res.json({ listings: results, query: q, count: results.length });
  } catch (err) {
    console.error('searchListings error:', err.message, { requestId: req.id });
    res.status(500).json({ 
      error: 'Error searching listings',
      requestId: req.id
    });
  }
}

export async function getListingById(req, res) {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        error: 'Invalid listing ID',
        requestId: req.id
      });
    }

    const listing = await Listing.findById(id).lean();
    
    if (!listing) {
      return res.status(404).json({ 
        error: 'Listing not found',
        requestId: req.id
      });
    }

    res.json(listing);
  } catch (err) {
    console.error('getListingById error:', err.message, { requestId: req.id });
    res.status(500).json({ 
      error: 'Error fetching listing',
      requestId: req.id
    });
  }
}
