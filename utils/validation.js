import Joi from 'joi';

// Listing validation schema
export const createListingSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  email: Joi.string().email().required(),
  address: Joi.string().trim().max(500).optional(),
  price: Joi.number().min(0).max(100000000).optional(),
  location: Joi.string().trim().max(500).optional(),
  size: Joi.string().trim().max(100).optional(),
  lotArea: Joi.string().trim().max(100).optional(),
  bedrooms: Joi.number().integer().min(0).max(50).optional(),
  bathrooms: Joi.number().min(0).max(50).optional(),
  yearBuilt: Joi.string().trim().max(4).optional(),
  taxes: Joi.number().min(0).optional(),
  floodZone: Joi.string().trim().max(100).optional(),
  otherFees: Joi.string().trim().max(500).optional(),
  mlsLink: Joi.string().uri().max(2000).optional(),
  locationDesign: Joi.string().trim().max(1000).optional(),
  foundation: Joi.string().trim().max(500).optional(),
  roof: Joi.string().trim().max(500).optional(),
  envelope: Joi.string().trim().max(500).optional(),
  interiorMaterials: Joi.string().trim().max(1000).optional(),
  mechanicals: Joi.string().trim().max(1000).optional(),
  finishes: Joi.string().trim().max(1000).optional(),
  greenFeatures: Joi.string().trim().max(1000).optional(),
  notes: Joi.string().trim().max(2000).optional(),
  healthyCriteria: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
  keywords: Joi.array().items(Joi.string().trim().max(100)).max(20).optional(),
  comment: Joi.string().trim().max(2000).optional()
});

// Search validation schema
export const searchSchema = Joi.object({
  q: Joi.string().trim().min(1).max(200).required()
});

// Validation middleware
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
}
