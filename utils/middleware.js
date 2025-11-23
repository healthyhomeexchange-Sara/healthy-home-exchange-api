import { randomUUID } from 'crypto';

// Request ID middleware
export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
}

// Request logging middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    if (res.statusCode >= 400) {
      console.error('Request error:', JSON.stringify(log));
    } else {
      console.log('Request:', JSON.stringify(log));
    }
  });
  
  next();
}

// Sanitize error responses (don't leak stack traces in production)
export function sanitizeError(err) {
  if (process.env.NODE_ENV === 'production') {
    return {
      error: err.message || 'Internal Server Error',
      requestId: err.requestId
    };
  }
  return {
    error: err.message,
    stack: err.stack,
    requestId: err.requestId
  };
}
