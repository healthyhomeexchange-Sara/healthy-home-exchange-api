import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Listing from '../models/listing.js';

async function main(){
  if (!process.env.MONGO_URI) { console.error('MONGO_URI missing'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  const res = await Listing.deleteMany({ name: /smoke/i });
  console.log('deleted', res.deletedCount);
  await mongoose.disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
