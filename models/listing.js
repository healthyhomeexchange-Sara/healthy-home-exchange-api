import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  name: String,
  email: String,
  address: String,
  price: Number,
  location: String,
  size: String,
  lotArea: String,
  bedrooms: Number,
  bathrooms: Number,
  yearBuilt: String,
  taxes: Number,
  floodZone: String,
  otherFees: String,
  mlsLink: String,
  locationDesign: String,
  foundation: String,
  roof: String,
  envelope: String,
  interiorMaterials: String,
  mechanicals: String,
  finishes: String,
  greenFeatures: String,
  notes: String,
  healthyCriteria: [String],
  keywords: [String],
  comment: String,
  createdAt: { type: Date, default: Date.now },
  expirationDate: { type: Date, default: () => new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }
});

export default mongoose.models.Listing || mongoose.model('Listing', listingSchema);
