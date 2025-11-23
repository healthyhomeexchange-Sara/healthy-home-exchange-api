# Healthy Home Exchange API (New)

Clean, production-ready Express API for the Healthy Home Exchange platform.

## Features

- ✅ Express 5 with ESM modules
- ✅ MongoDB (Mongoose) for data persistence
- ✅ Security hardening (Helmet, CORS, rate limiting)
- ✅ Email notifications (Nodemailer + Gmail)
- ✅ Input validation ready (Joi)
- ✅ PM2 ecosystem config included

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run locally
```bash
npm start
```

### 4. Run with PM2
```bash
pm2 start ecosystem.config.cjs
pm2 logs hhex-new
```

## API Endpoints

### Health Check
```bash
GET /
```

### Listings
```bash
# Create listing
POST /listings
Content-Type: application/json
{
  "name": "Beautiful Home",
  "email": "owner@example.com",
  "address": "123 Main St",
  "price": 1500,
  "keywords": ["beach", "garden"]
}

# Get all listings
GET /listings

# Search listings
POST /listings/search
Content-Type: application/json
{
  "q": "beach"
}
```

## Testing

### Smoke test all endpoints
```bash
# Health check
curl http://localhost:5000/

# Create listing
curl -X POST http://localhost:5000/listings \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","address":"123 Test St","price":1000}'

# Get listings
curl http://localhost:5000/listings

# Search
curl -X POST http://localhost:5000/listings/search \
  -H "Content-Type: application/json" \
  -d '{"q":"Test"}'
```

### Test email
```bash
node scripts/send_test_email.js
```

### Clean up test data
```bash
node scripts/delete_test_listings.js
```

## Project Structure

```
healthy-home-exchange-api-new/
├── server.js              # Main server entry point
├── package.json           # Dependencies
├── ecosystem.config.cjs   # PM2 configuration
├── .env.example           # Environment template
├── models/
│   └── listing.js         # Mongoose schema
├── controllers/
│   └── listingController.js  # Business logic
├── routes/
│   └── listings.js        # Route definitions
├── utils/
│   └── email.js           # Email utilities
└── scripts/
    ├── send_test_email.js
    └── delete_test_listings.js
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `EMAIL_USER` | No | Gmail address for sending emails |
| `EMAIL_PASS` | No | Gmail app password |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `NODE_ENV` | No | Environment (development/production) |

## Security Notes

- Body size limited to 50kb
- Rate limiting: 120 requests per 15 minutes per IP
- Helmet.js security headers enabled
- CORS restricted to allowed origins
- Use Gmail App Passwords (not regular passwords)

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong MongoDB credentials
3. Rotate email app passwords regularly
4. Configure reverse proxy (nginx/Apache)
5. Enable SSL/TLS
6. Monitor PM2 logs: `pm2 logs hhex-new`
