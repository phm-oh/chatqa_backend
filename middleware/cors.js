const cors = require('cors');

// Define allowed origins based on environment
const getAllowedOrigins = () => {
  const origins = [];
  
  // Development origins
  if (process.env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:3000',    // React dev server
      'http://localhost:5173',    // Vite dev server
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    );
  }
  
  // Production origins
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Additional allowed origins from environment
  if (process.env.ALLOWED_ORIGINS) {
    const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',');
    origins.push(...additionalOrigins);
  }
  
  return origins;
};

// CORS options configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  
  // Allowed headers
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Access-Token',
    'X-API-Key'
  ],
  
  // Expose these headers to the client
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Current-Page',
    'X-Per-Page'
  ],
  
  // Allow credentials (cookies, authorization headers)
  credentials: true,
  
  // Preflight cache duration (in seconds)
  maxAge: 86400, // 24 hours
  
  // Success status for preflight requests
  optionsSuccessStatus: 200,
  
  // For legacy browser support
  preflightContinue: false
};

// Development-specific CORS (more permissive)
const devCorsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['*'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Create CORS middleware based on environment
const createCorsMiddleware = () => {
  if (process.env.NODE_ENV === 'development' && process.env.CORS_DEV_MODE === 'permissive') {
    console.log('🔓 CORS: Development mode - allowing all origins');
    return cors(devCorsOptions);
  }
  
  console.log('🔒 CORS: Production mode - restricted origins');
  console.log('🌐 Allowed origins:', getAllowedOrigins());
  return cors(corsOptions);
};

// Error handler for CORS
const handleCorsError = (err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      message: 'This origin is not allowed to access this resource',
      origin: req.get('Origin') || 'Unknown'
    });
  } else {
    next(err);
  }
};

// Manual CORS headers (for specific routes if needed)
const setManualCorsHeaders = (req, res, next) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.get('Origin');
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
};

module.exports = {
  corsMiddleware: createCorsMiddleware(),
  corsOptions,
  devCorsOptions,
  handleCorsError,
  setManualCorsHeaders,
  getAllowedOrigins
};