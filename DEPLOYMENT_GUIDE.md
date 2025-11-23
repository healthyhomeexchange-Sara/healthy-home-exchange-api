# Security & Production Deployment Guide

## Pre-Deployment Security Checklist

### 1. Environment Variables ✓
- [x] `.env` file in `.gitignore`
- [x] No hardcoded secrets in code
- [ ] **ACTION REQUIRED**: Rotate all secrets before production
- [ ] **ACTION REQUIRED**: Use environment-specific .env files

### 2. MongoDB Security ✓
- [x] Connection string uses authentication
- [x] Database user has minimal required permissions
- [ ] **RECOMMENDED**: Enable MongoDB Atlas IP whitelist
- [ ] **RECOMMENDED**: Enable audit logging in MongoDB Atlas

### 3. API Security ✓
- [x] Input validation on all endpoints (Joi)
- [x] Rate limiting configured (120 req/15min)
- [x] CORS restricted to allowed origins
- [x] Helmet.js security headers enabled
- [x] Request size limit (50kb)
- [x] SQL injection prevention (Mongoose ORM)
- [x] XSS prevention (input sanitization)

### 4. Email Security ✓
- [x] Gmail App Password (not regular password)
- [x] Transporter verification before use
- [ ] **ACTION REQUIRED**: Rotate email app password
- [ ] **RECOMMENDED**: Use dedicated email service (SendGrid/AWS SES) for production

### 5. Error Handling ✓
- [x] No stack traces in production responses
- [x] Request ID tracking for debugging
- [x] Centralized error logging
- [ ] **RECOMMENDED**: Add error tracking service (Sentry/Datadog)

### 6. Monitoring & Logging
- [x] Request logging with duration
- [x] Error logging with request ID
- [x] Health check endpoint
- [ ] **RECOMMENDED**: Add APM tool (New Relic/DataDog)
- [ ] **RECOMMENDED**: Set up log aggregation (CloudWatch/Logstash)

---

## Wix Integration Setup

### 1. Update CORS Origins
Add your Wix site domains to `.env`:
```bash
ALLOWED_ORIGINS=https://your-site.wixsite.com,https://www.your-domain.com
```

### 2. API Endpoints for Wix

**Base URL**: `https://your-api-domain.com`

**Available Endpoints:**

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| GET | `/health` | Health check | - |
| GET | `/listings` | Get all listings (paginated) | Query: `?page=1&limit=50` |
| GET | `/listings/:id` | Get single listing | - |
| POST | `/listings` | Create listing | See schema below |
| POST | `/listings/search` | Search listings | `{"q": "search term"}` |
| POST | `/renew/:id` | Renew listing | - |

**Create Listing Schema:**
```json
{
  "name": "string (required, 1-200 chars)",
  "email": "string (required, valid email)",
  "location": "string (optional, max 500 chars)",
  "price": "number (optional, 0-100000000)",
  "bedrooms": "number (optional, 0-50)",
  "bathrooms": "number (optional, 0-50)",
  "keywords": ["array of strings (optional, max 20)"],
  "healthyCriteria": ["array of strings (optional, max 20)"]
}
```

**Response Format:**
All responses include:
- Success: `{ ...data, requestId: "uuid" }`
- Error: `{ error: "message", requestId: "uuid", details: [...] }`

### 3. Wix Velo Code Example

```javascript
// In Wix Velo (Code Panel)
import wixFetch from 'wix-fetch';

const API_BASE = 'https://your-api-domain.com';

export async function createListing(listingData) {
  try {
    const response = await wixFetch.fetch(`${API_BASE}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(listingData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create listing');
    }
    
    return await response.json();
  } catch (err) {
    console.error('Create listing error:', err);
    throw err;
  }
}

export async function searchListings(query) {
  const response = await wixFetch.fetch(`${API_BASE}/listings/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query })
  });
  
  const data = await response.json();
  return data.listings || [];
}

export async function getListings(page = 1, limit = 20) {
  const response = await wixFetch.fetch(
    `${API_BASE}/listings?page=${page}&limit=${limit}`
  );
  return await response.json();
}
```

---

## Production Deployment Steps

### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (use NVM for version management)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Install PM2
npm install -g pm2

# Clone repository
git clone <your-repo>
cd healthy-home-exchange-api-new

# Install dependencies
npm install --production
```

### 2. Environment Configuration
```bash
# Copy and edit .env
cp .env.example .env
nano .env

# Set production values:
NODE_ENV=production
PORT=5000
MONGO_URI=<your-production-mongo-uri>
EMAIL_USER=<your-email>
EMAIL_PASS=<your-app-password>
ALLOWED_ORIGINS=<your-wix-domains>
```

### 3. SSL/TLS Setup (Required for Wix)
```bash
# Install Certbot
sudo apt install certbot

# Get SSL certificate
sudo certbot certonly --standalone -d your-api-domain.com
```

### 4. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-api-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-api-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-api-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-api-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Start with PM2
```bash
# Start application
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the command output instructions

# Monitor
pm2 logs hhex-new
pm2 monit
```

### 6. Firewall Configuration
```bash
# UFW firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Security Hardening (Post-Deployment)

### 1. Update CORS for Production Only
In `.env`:
```bash
# Remove localhost from production
ALLOWED_ORIGINS=https://your-site.wixsite.com,https://www.your-domain.com
```

### 2. Rotate Secrets
```bash
# Generate new MongoDB password
# Generate new email app password
# Update .env and restart
pm2 restart hhex-new --update-env
```

### 3. Enable MongoDB Atlas Features
- IP Whitelist: Add your server IP only
- Network Peering (if using VPC)
- Database Auditing
- Backup snapshots

### 4. Monitor & Alerts
Set up alerts for:
- API response time > 2s
- Error rate > 5%
- CPU usage > 80%
- Memory usage > 80%
- Disk space < 10%

### 5. Regular Maintenance
```bash
# Weekly
pm2 flush                          # Clear logs
node scripts/delete_old_listings.js  # Clean old data

# Monthly
npm audit                          # Check vulnerabilities
npm update                         # Update dependencies
certbot renew                      # Renew SSL
```

---

## Testing Before Go-Live

### 1. Health Check
```bash
curl https://your-api-domain.com/health
# Should return: {"status":"ok",...}
```

### 2. API Tests
```bash
# Run from project directory
bash test_api.sh https://your-api-domain.com
```

### 3. Load Testing
```bash
# Install Apache Bench
sudo apt install apache2-utils

# Test with 1000 requests, 10 concurrent
ab -n 1000 -c 10 https://your-api-domain.com/
```

### 4. Security Scan
```bash
# Install OWASP ZAP or use online tools
# Scan: https://your-api-domain.com
```

---

## Rollback Plan

If issues occur in production:

1. **Quick rollback:**
   ```bash
   pm2 stop hhex-new
   git checkout <previous-stable-commit>
   npm install
   pm2 restart hhex-new
   ```

2. **Database rollback:**
   ```bash
   # Restore from MongoDB Atlas snapshot
   # Use Atlas UI or CLI
   ```

3. **Notify users:**
   - Update Wix site with maintenance message
   - Monitor error rates in logs

---

## Support & Monitoring

### Logs
```bash
# View logs
pm2 logs hhex-new

# Filter errors only
pm2 logs hhex-new --err

# Search logs
pm2 logs hhex-new | grep "ERROR"
```

### Metrics
```bash
# PM2 monitoring
pm2 monit

# System metrics
htop
df -h
free -h
```

### Debugging
```bash
# Check process status
pm2 show hhex-new

# Check MongoDB connectivity
node -e "require('mongoose').connect(process.env.MONGO_URI).then(() => console.log('OK'))"

# Test email
node scripts/send_test_email.js
```

---

## Additional Recommendations

### High Priority
1. **Use a dedicated email service** (SendGrid/AWS SES) instead of Gmail for production
2. **Add rate limiting per user** (if you have authentication)
3. **Implement request caching** for frequently accessed listings
4. **Add database indexes** for search performance
5. **Set up automated backups** for MongoDB

### Medium Priority
1. Add API versioning (`/v1/listings`)
2. Implement soft deletes for listings
3. Add image upload/storage (S3/Cloudinary)
4. Add webhook notifications for Wix
5. Implement API key authentication for server-to-server calls

### Low Priority
1. Add GraphQL endpoint (if Wix prefers it)
2. Implement full-text search (MongoDB Atlas Search)
3. Add analytics/usage tracking
4. Create admin dashboard
5. Add multi-language support

---

## Contact & Emergency

**Production Issues:**
- Check logs: `pm2 logs hhex-new --err`
- Check health: `curl https://your-api-domain.com/health`
- Restart: `pm2 restart hhex-new`

**Database Issues:**
- MongoDB Atlas Dashboard: https://cloud.mongodb.com
- Check connection: Test with MongoDB Compass

**Security Issues:**
- Rotate secrets immediately
- Check access logs for suspicious activity
- Update CORS origins if needed
