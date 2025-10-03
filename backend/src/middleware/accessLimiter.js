import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import User from '../models/User.js';

// middleware to verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.substring(7); // remove "Bearer " prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token not found.'
      });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired.'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    } else {
      console.error('Token verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error during authentication.'
      });
    }
  }
};

// middleware to ensure user is authenticated admin
export const adminAuth = async (req, res, next) => {
  try {
    //verify the token
    await new Promise((resolve, reject) => {
      verifyToken(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // check if user exists and is admin
    const admin = await Admin.findById(req.user.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found.'
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Admin account is deactivated.'
      });
    }

    // verify user type is admin
    if (req.user.userType !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during admin authentication.'
    });
  }
};

// Middleware to ensure user is authenticated (admin or regular user)
export const userAuth = async (req, res, next) => {
  try {
    await new Promise((resolve, reject) => {
      verifyToken(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    let user;
    
    // check user type and fetch appropriate user
    if (req.user.userType === 'Admin') {
      user = await Admin.findById(req.user.id).select('-password');
    } else if (req.user.userType === 'User') {
      user = await User.findById(req.user.id).select('-password');
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type.'
      });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    req.authenticatedUser = user;
    next();
  } catch (error) {
    console.error('User auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during user authentication.'
    });
  }
};

// Middleware to ensure user is super admin
export const superAdminAuth = async (req, res, next) => {
  try {
    // First check admin auth
    await new Promise((resolve, reject) => {
      adminAuth(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Check if admin has superadmin role
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Super admin privileges required.'
      });
    }

    next();
  } catch (error) {
    console.error('Super admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during super admin authentication.'
    });
  }
};

// Middleware to check if user owns the resource or is admin
export const ownerOrAdminAuth = async (req, res, next) => {
  try {

    await new Promise((resolve, reject) => {
      verifyToken(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const resourceUserId = req.params.userId || req.params.id;
    
    // If user is admin, allow access
    if (req.user.userType === 'Admin') {
      const admin = await Admin.findById(req.user.id).select('-password');
      if (admin && admin.isActive) {
        req.authenticatedUser = admin;
        return next();
      }
    }
    
    // If user is the owner of the resource, allow access
    if (req.user.id === resourceUserId && req.user.userType === 'User') {
      const user = await User.findById(req.user.id).select('-password');
      if (user && user.isActive) {
        req.authenticatedUser = user;
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own resources or need admin privileges.'
    });
  } catch (error) {
    console.error('Owner or admin auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authorization.'
    });
  }
};

export default {
  verifyToken,
  adminAuth,
  userAuth,
  superAdminAuth,
  ownerOrAdminAuth
};