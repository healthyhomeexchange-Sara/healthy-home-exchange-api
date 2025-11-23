// server.js - Healthy Home Exchange API (Combined Version)
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cron from 'node-cron';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import listingsRouter from './routes/listings.js';
import { initializeSendGrid, isReady as isEmailReady } from './utils/email.js';

const app = express();

// Limit JSON body size to help prevent accidental large uploads
app.use(express.json({ limit: '50kb' }));

// CORS: allow explicit origins (use `ALLOWED_ORIGINS` env as comma-separated list)
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
  origin: (origin, callback) => {
    // allow non-browser requests (Postman, server-to-server) with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: Origin not allowed'), false);
  },
  optionsSuccessStatus: 200
}));

// Security middleware
app.use(helmet());

// Basic rate limiting to slow brute-force / DoS attempts
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120, // limit each IP to 120 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

const PORT = Number(process.env.PORT) || 5000;

// --------------------
// Environment checks
// --------------------
if (!process.env.MONGO_URI) {
  console.error('❌ Missing required environment variable: MONGO_URI');
  process.exit(1);
}

if (!process.env.SENDGRID_API_KEY) {
  console.warn('⚠️ SENDGRID_API_KEY not set — email features will be disabled');
}

// --------------------
// MongoDB Connection (with basic options)
// --------------------
async function connectMongo() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      // use unified topology, new url parser by default in modern drivers
      serverSelectionTimeoutMS: 5000
    });
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    // if DB isn't available, it's safer to exit so the app doesn't run in degraded mode
    process.exit(1);
  }
}
connectMongo();

// --------------------
// Mongoose Schema (kept simple; consider moving to models/ folder)
// --------------------
const listingSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  price: { type: Number },
  location: { type: String },
  size: { type: String },
  lotArea: { type: String },
  bedrooms: { type: Number },
  bathrooms: { type: Number },
  yearBuilt: { type: String },
  taxes: { type: Number },
  floodZone: { type: String },
  otherFees: { type: String },
  mlsLink: { type: String },
  locationDesign: { type: String },
  foundation: { type: String },
  roof: { type: String },
  envelope: { type: String },
  interiorMaterials: { type: String },
  mechanicals: { type: String },
  finishes: { type: String },
  greenFeatures: { type: String },
  notes: { type: String },
  healthyCriteria: [{ type: String }],
  keywords: [{ type: String }],
  comment: { type: String },
  createdAt: { type: Date, default: Date.now },
  expirationDate: { type: Date, default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }
});

const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);

// --------------------
// Email setup - Initialize SendGrid
// --------------------
initializeSendGrid();

// --------------------
// Routes
// --------------------
app.get('/', (req, res) => res.json({
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
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      email: isEmailReady() ? 'ready' : 'not configured'
    }
  });
});

// Mount listings router
app.use('/listings', listingsRouter);

// Renew listing
app.post('/renew/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    listing.expirationDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await listing.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error renewing listing' });
  }
});

// Delete expired listings
async function deleteExpired() {
  try {
    const result = await Listing.deleteMany({ expirationDate: { $lt: new Date() } });
    if (result.deletedCount > 0) console.log(`🗑️ Deleted ${result.deletedCount} expired listings`);
  } catch (err) {
    console.error('❌ Error deleting expired listings:', err);
  }
}

// Schedule deleteExpired to run daily at 00:00
cron.schedule('0 0 * * *', () => {
  console.log('🕘 Running scheduled job: deleteExpired');
  deleteExpired();
});

// Notify expiring listings
async function notifyExpiringListings() {
  try {
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const listings = await Listing.find({
      expirationDate: { $gte: sevenDaysLater, $lt: new Date(sevenDaysLater.getTime() + 24 * 60 * 60 * 1000) }
    }).lean();
    
    const { sendExpiryEmail } = await import('./utils/email.js');
    for (const listing of listings) await sendExpiryEmail(listing);
  } catch (err) {
    console.error('❌ Error notifying expiring listings:', err);
  }
}

// Run once at startup (non-blocking)
notifyExpiringListings().catch(err => console.warn('notifyExpiringListings startup error:', err));
// Schedule daily at 01:00
cron.schedule('0 1 * * *', () => {
  console.log('🕘 Running scheduled job: notifyExpiringListings');
  notifyExpiringListings();
});

// --------------------
// Centralized error handler and graceful shutdown
// --------------------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = app.listen(PORT, () => console.log(`🚀 Healthy Home Exchange API running on port ${PORT}`));

async function shutdown(signal) {
  console.log(`⚠️ Received ${signal}. Shutting down gracefully...`);
  server.close(async (err) => {
    if (err) {
      console.error('Error closing server:', err);
      process.exit(1);
    }
    try {
      await mongoose.disconnect();
      console.log('✅ MongoDB disconnected');
    } catch (e) {
      console.warn('Error during Mongo disconnect:', e);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unexpected errors more gracefully
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at Promise', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // It's recommended to perform a graceful shutdown here.
  try {
    shutdown('uncaughtException');
  } catch (e) {
    console.error('Error during shutdown after uncaughtException:', e);
    process.exit(1);
  }
});
