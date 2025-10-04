import express from 'express';
import { body } from 'express-validator';

// Controllers
import {
  adminLogin,
  getMe,
  logout,
  refreshToken
} from '../controller/loginController.js';

import {
  getProfile,
  updateProfile,
  changePassword,
  getAllAdmins,
  createAdmin,
  updateAdminStatus,
  deleteAdmin
} from '../controller/adminController.js';

// Middleware
import {
  adminAuth,
  superAdminAuth,
  verifyToken
} from '../middleware/accessLimiter.js';

import {
  authLimiter,
  apiLimiter,
  generalLimiter,
  strictLimiter
} from '../middleware/rateLimiter.js';

const router = express.Router();

// =============================================================================
// AUTHENTICATION ROUTES (Admin Only)
// =============================================================================

// Validation for login
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

// Admin authentication routes
router.post('/auth/admin/login', authLimiter, loginValidation, adminLogin);

// General authentication routes
router.get('/auth/me', verifyToken, getMe);
router.post('/auth/logout', verifyToken, logout);
router.post('/auth/refresh', verifyToken, refreshToken);

// =============================================================================
// ADMIN MANAGEMENT ROUTES
// =============================================================================

// Validation for admin profile update
const adminProfileValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
];

// Validation for password change
const passwordChangeValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your new password')
];

// Validation for creating admin
const createAdminValidation = [
  body('name')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'superadmin'])
    .withMessage('Role must be either admin or superadmin')
];

// Admin profile routes
router.get('/admin/profile', adminAuth, getProfile);
router.put('/admin/profile', apiLimiter, adminAuth, adminProfileValidation, updateProfile);
router.put('/admin/change-password', strictLimiter, adminAuth, passwordChangeValidation, changePassword);

// Super admin routes for managing other admins
router.get('/admin/all', adminAuth, superAdminAuth, getAllAdmins);
router.post('/admin/create', strictLimiter, superAdminAuth, createAdminValidation, createAdmin);
router.put('/admin/:id/status', apiLimiter, superAdminAuth, updateAdminStatus);
router.delete('/admin/:id', strictLimiter, superAdminAuth, deleteAdmin);

// =============================================================================
// HEALTH CHECK & API INFO
// =============================================================================

// API Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running smoothly',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Information
router.get('/info', generalLimiter, (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Admin Template MERN API',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      endpoints: {
        authentication: [
          'POST /api/auth/admin/login',
          'GET /api/auth/me',
          'POST /api/auth/logout',
          'POST /api/auth/refresh'
        ],
        admin: [
          'GET /api/admin/profile',
          'PUT /api/admin/profile',
          'PUT /api/admin/change-password',
          'GET /api/admin/all',
          'POST /api/admin/create',
          'PUT /api/admin/:id/status',
          'DELETE /api/admin/:id'
        ]
      }
    }
  });
});

// 404 handler for undefined routes
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

export default router;