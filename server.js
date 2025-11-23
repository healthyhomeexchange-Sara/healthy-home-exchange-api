import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import cron from 'node-cron';
import listingsRouter from './routes/listings.js';
import { getTransporter, isReady as isEmailReady, sendExpiryEmail } from './utils/email.js';
import { requestId, requestLogger, sanitizeError } from './utils/middleware.js';
import Listing from './models/listing.js';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Request ID and logging
app.use(requestId);
app.use(requestLogger);

// Middleware
app.use(express.json({ limit: '50kb' }));

const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:5000',
  'https://www.wix.com',
  'https://editor.wix.com',
  'https://www.wixsite.com'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
  : defaultOrigins;

app.use(cors({ 
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed'));
  },
  optionsSuccessStatus: 200 
}));

app.use(helmet());
app.use(rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  max: 120,
  message: 'Too many requests from this IP'
}));

// MongoDB connection
if (!process.env.MONGO_URI) {
  console.error('❌ Missing required environment variable: MONGO_URI');
  process.exit(1);
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  EMAIL_USER/EMAIL_PASS not set - email features disabled');
}

async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { 
      serverSelectionTimeoutMS: 5000 
    });
    console.log('✓ Connected to MongoDB');
  } catch (err) {
    console.error('✗ MongoDB connection failed:', err?.message || err);
    process.exit(1);
  }
}

connectMongo();

// Initialize email transporter (async, non-blocking)
getTransporter();

// Routes
app.get('/', (req, res) => {
  res.json({ 
    ok: true, 
    service: 'healthy-home-exchange-api',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      listings: '/listings',
      listingById: '/listings/:id',
      search: '/listings/search',
      renew: '/renew/:id'
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      mongodb: 'unknown',
      email: isEmailReady() ? 'ready' : 'not configured'
    }
  };

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      health.services.mongodb = 'connected';
    } else {
      health.services.mongodb = 'disconnected';
      health.status = 'degraded';
    }
  } catch (err) {
    health.services.mongodb = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use('/listings', listingsRouter);

// Renew listing endpoint
app.post('/renew/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        error: 'Invalid listing ID',
        requestId: req.id
      });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ 
        error: 'Listing not found',
        requestId: req.id
      });
    }

    listing.expirationDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
    await listing.save();
    res.json({ 
      ok: true, 
      message: 'Listing renewed', 
      expirationDate: listing.expirationDate,
      requestId: req.id
    });
  } catch (err) {
    console.error('Renew error:', err.message, { requestId: req.id });
    res.status(500).json({ 
      error: 'Error renewing listing',
      requestId: req.id
    });
  }
});

// Cron job: Delete expired listings daily at 00:00
async function deleteExpiredListings() {
  try {
    const result = await Listing.deleteMany({ expirationDate: { $lt: new Date() } });
    if (result.deletedCount > 0) {
      console.log(`🗑️  Deleted ${result.deletedCount} expired listing(s)`);
    }
  } catch (err) {
    console.error('✗ Error deleting expired listings:', err.message);
  }
}

cron.schedule('0 0 * * *', () => {
  console.log('🕐 Running scheduled job: deleteExpiredListings');
  deleteExpiredListings();
});

// Cron job: Notify expiring listings daily at 01:00
async function notifyExpiringListings() {
  if (!isEmailReady()) {
    console.warn('⚠️  Email not ready, skipping notification job');
    return;
  }

  try {
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const eightDaysFromNow = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    
    const listings = await Listing.find({
      expirationDate: { $gte: sevenDaysFromNow, $lt: eightDaysFromNow }
    }).lean();

    for (const listing of listings) {
      await sendExpiryEmail(listing);
    }
    
    if (listings.length > 0) {
      console.log(`📧 Sent expiry notifications to ${listings.length} listing(s)`);
    }
  } catch (err) {
    console.error('✗ Error notifying expiring listings:', err.message);
  }
}

// Run notification check at startup (non-blocking)
notifyExpiringListings().catch(err => console.warn('Startup notification error:', err.message));

cron.schedule('0 1 * * *', () => {
  console.log('🕐 Running scheduled job: notifyExpiringListings');
  notifyExpiringListings();
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err?.message || err, { requestId: req.id, stack: err?.stack });
  if (!res.headersSent) {
    const sanitized = sanitizeError({ ...err, requestId: req.id });
    res.status(err.status || 500).json(sanitized);
  }
});

// Process-level error handlers
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  MongoDB: ${process.env.MONGO_URI ? '✓ connected' : '✗ not configured'}`);
  console.log(`  Email: ${process.env.EMAIL_USER ? '✓ configured' : '✗ not configured'}`);
});

async function shutdown(signal) {
  console.log(`⚠️  Received ${signal}. Shutting down gracefully...`);
  server.close(async (err) => {
    if (err) {
      console.error('Error closing server:', err);
      process.exit(1);
    }
    try {
      await mongoose.disconnect();
      console.log('✓ MongoDB disconnected');
    } catch (e) {
      console.warn('Error during Mongo disconnect:', e);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
