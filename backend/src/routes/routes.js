import express from 'express';
import { body } from 'express-validator';

// Models
import User from '../models/User.js';

// Controllers
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  getUserStats
} from '../controller/accountController.js';

import {
  adminLogin,
  userLogin,
  userSignup,
  checkAvailability,
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
  userAuth,
  superAdminAuth,
  ownerOrAdminAuth,
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
// AUTHENTICATION ROUTES
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

// User authentication routes  
router.post('/auth/user/login', authLimiter, loginValidation, userLogin);

// General authentication routes (for both admin and user)
router.get('/auth/me', verifyToken, getMe);
router.post('/auth/logout', verifyToken, logout);
router.post('/auth/refresh', verifyToken, refreshToken);

// Validation for user signup
const userSignupValidation = [
  body('name')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

// User signup route
router.post('/auth/user/signup', authLimiter, userSignupValidation, userSignup);

// Check availability endpoints
router.post('/auth/check-availability', generalLimiter, checkAvailability);

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
// USER MANAGEMENT ROUTES
// =============================================================================

// Validation for user creation
const createUserValidation = [
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
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

// Validation for user update
const updateUserValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value')
];

// User CRUD routes (Admin only)
router.get('/users', adminAuth, getAllUsers);
router.get('/users/stats', adminAuth, getUserStats);
router.post('/users', apiLimiter, adminAuth, createUserValidation, createUser);
router.get('/users/:id', adminAuth, getUserById);
router.put('/users/:id', apiLimiter, adminAuth, updateUserValidation, updateUser);
router.put('/users/:id/status', apiLimiter, adminAuth, updateUserStatus);
router.delete('/users/:id', strictLimiter, adminAuth, deleteUser);

// User profile routes (for authenticated users to manage their own profile)
router.get('/user/profile', userAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.authenticatedUser
    }
  });
});

router.put('/user/profile', apiLimiter, userAuth, updateUserValidation, async (req, res) => {
  try {
    const { name, email } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();

    const updatedUser = await User.findByIdAndUpdate(
      req.authenticatedUser._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
});

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
          'POST /api/auth/user/login',
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
        ],
        users: [
          'GET /api/users',
          'GET /api/users/stats',
          'POST /api/users',
          'GET /api/users/:id',
          'PUT /api/users/:id',
          'PUT /api/users/:id/status',
          'DELETE /api/users/:id'
        ],
        userProfile: [
          'GET /api/user/profile',
          'PUT /api/user/profile'
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
