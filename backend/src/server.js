import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import connectDB from "./config/db.js";
import { testRedisConnection } from "./config/upstash.js";
import apiRoutes from "./routes/routes.js";
import { generalLimiter } from "./middleware/rateLimiter.js";

dotenv.config();

const app = express();

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

// Helmet for security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback){
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins =[
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1){
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// =============================================================================
// GENERAL MIDDLEWARE
// =============================================================================

// trust proxy for rate limiting (if behind reverse proxy)
app.set('trust proxy', 1);

// body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) =>{
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        message: 'Invalid JSON format'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// HTTP request logger
if (process.env.NODE_ENV === 'development'){
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// apply general rate limiting to all routes
app.use(generalLimiter);

// =============================================================================
// DATABASE & REDIS CONNECTION
// =============================================================================

// connect to MongoDB
connectDB();

// test Redis connection
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN){
  testRedisConnection();
} else {
  console.warn('Upstash Redis credentials not found. Rate limiting may not work properly.');
}

// =============================================================================
// ROUTES
// =============================================================================

// API routes
app.use('/api', apiRoutes);

// root route
app.get('/', (req, res) =>{
  res.status(200).json({
    success: true,
    message: 'Admin Template MERN API is running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/info'
  });
});

// health check 
app.get('/health', (req, res) =>{
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

// 404 error
app.use((req, res) =>{
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// global error handler
app.use((error, req, res, next) =>{
  console.error('Global error handler:', error);
  // Mongoose validation error
  if (error.name === 'ValidationError'){
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  // Mongoose cast error (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  // duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  // CORS error
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation'
    });
  }
  // Default server error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () =>{
  console.log(`
Server is running successfully!
Environment: ${process.env.NODE_ENV || 'development'}
Port: ${PORT}
API Documentation: http://localhost:${PORT}/api/info
Health Check: http://localhost:${PORT}/health
  `);//optional lang tong health check
});

// Graceful shutdown handling
const gracefulShutdown = (signal) =>{
  console.log(`\n Received ${signal}. Shutting down`);
  
  server.close(() => {
    console.log('HTTP server closed');
    
    // Close database connection
    if (process.env.NODE_ENV !== 'test'){
      process.exit(0);
    }
  });

  setTimeout(() =>{
    console.log('Could not close connections in time. shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) =>{
  console.error('Unhandled Promise Rejection:', err);
  gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) =>{
  console.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

export default app;
