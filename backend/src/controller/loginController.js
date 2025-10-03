import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import Login from '../models/Login.js';

const generateToken = (user, userType) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      userType: userType,
      role: user.role || 'user'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
};

// log login attempt
const logLoginAttempt = async (userId, userType, email, ipAddress, userAgent, status, failureReason = null) => {
  try {
    await Login.create({
      userId,
      userType,
      email,
      ipAddress,
      userAgent,
      loginStatus: status,
      failureReason
    });
  } catch (error) {
    console.error('Error logging login attempt:', error);
  }
};

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
export const adminLogin = async (req, res) => {
  try {
    // check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // find admin by email
    const admin = await Admin.findOne({ email }).select('+password');
    
    if (!admin) {
      await logLoginAttempt(null, 'Admin', email, ipAddress, userAgent, 'failed', 'Admin not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // check if admin is active
    if (!admin.isActive) {
      await logLoginAttempt(admin._id, 'Admin', email, ipAddress, userAgent, 'failed', 'Account deactivated');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // check password
    const isPasswordMatch = await admin.matchPassword(password);
    
    if (!isPasswordMatch) {
      await logLoginAttempt(admin._id, 'Admin', email, ipAddress, userAgent, 'failed', 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    await admin.updateLastLogin();

    // Log successful login
    await logLoginAttempt(admin._id, 'Admin', email, ipAddress, userAgent, 'success');

    const token = generateToken(admin, 'Admin');

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          lastLogin: admin.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    User login
// @route   POST /api/auth/user/login
// @access  Public
export const userLogin = async (req, res) => {
  try {
    // check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // find user by email
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      await logLoginAttempt(null, 'User', email, ipAddress, userAgent, 'failed', 'User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // check if user is active
    if (!user.isActive) {
      await logLoginAttempt(user._id, 'User', email, ipAddress, userAgent, 'failed', 'Account deactivated');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // check password
    const isPasswordMatch = await user.matchPassword(password);
    
    if (!isPasswordMatch) {
      await logLoginAttempt(user._id, 'User', email, ipAddress, userAgent, 'failed', 'Invalid password');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // log successful login
    await logLoginAttempt(user._id, 'User', email, ipAddress, userAgent, 'success');

    const token = generateToken(user, 'User');

    res.status(200).json({
      success: true,
      message: 'User login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('User login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

// @desc    User signup
// @route   POST /api/auth/user/signup
// @access  Public
export const userSignup = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      await logLoginAttempt(null, 'User', email, ipAddress, userAgent, 'failed', 'Email already registered');
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Check if name is already taken
    const existingName = await User.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingName) {
      return res.status(400).json({
        success: false,
        message: 'This name is already taken. Please choose a different name.'
      });
    }

    // Create new user
    const newUser = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      isActive: true
    });

    // Log successful registration
    await logLoginAttempt(newUser._id, 'User', email, ipAddress, userAgent, 'success');

    // Generate token for auto-login after signup
    const token = generateToken(newUser, 'User');

    res.status(201).json({
      success: true,
      message: 'Account created successfully! You are now logged in.',
      data: {
        token,
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          createdAt: newUser.createdAt
        }
      }
    });

  } catch (error) {
    console.error('User signup error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already registered`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// @desc    Check name/email availability
// @route   POST /api/auth/check-availability
// @access  Public
export const checkAvailability = async (req, res) => {
  try {
    const { email, name } = req.body;
    const availability = {};

    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      availability.email = {
        available: !emailExists,
        message: emailExists ? 'Email is already registered' : 'Email is available'
      };
    }

    if (name) {
      const nameExists = await User.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') } 
      });
      availability.name = {
        available: !nameExists,
        message: nameExists ? 'Name is already taken' : 'Name is available'
      };
    }

    res.status(200).json({
      success: true,
      data: availability
    });

  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking availability'
    });
  }
};

// @desc    Get current user/admin profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    let user;
    
    if (req.user.userType === 'Admin') {
      user = await Admin.findById(req.user.id).select('-password');
    } else {
      user = await User.findById(req.user.id).select('-password');
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
          userType: req.user.userType,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
  try {
    // in a stateless JWT system logout is handled client-side by removing the token
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    // You could implement token blacklisting here if needed lang ha

    // For now logout lang muna    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh
// @access  Private
export const refreshToken = async (req, res) => {
  try {
    let user;
    
    if (req.user.userType === 'Admin') {
      user = await Admin.findById(req.user.id).select('-password');
    } else {
      user = await User.findById(req.user.id).select('-password');
    }

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or account deactivated'
      });
    }

    const newToken = generateToken(user, req.user.userType);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error refreshing token'
    });
  }
};

export default {
  adminLogin,
  userLogin,
  userSignup,
  checkAvailability,
  getMe,
  logout,
  refreshToken
};