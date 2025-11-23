import express from 'express';
import { addListing, getListings, searchListings, getListingById } from '../controllers/listingController.js';
import { validate, createListingSchema, searchSchema } from '../utils/validation.js';

const router = express.Router();

router.post('/', validate(createListingSchema), addListing);
router.get('/', getListings);
router.get('/:id', getListingById);
router.post('/search', validate(searchSchema), searchListings);

export default router;
