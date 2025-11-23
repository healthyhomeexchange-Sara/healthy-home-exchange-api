import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Listing from '../models/listing.js';

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('❌ Missing MONGO_URI in environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const result = await Listing.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    console.log(`🗑️  Deleted ${result.deletedCount} listing(s) older than 60 days`);
    console.log(`   Cutoff date: ${cutoffDate.toISOString()}`);
    
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
