import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

// Middleware to verify JWT token
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token not found.'
      });
    }

    // Verify token
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

// Middleware to ensure user is authenticated admin
export const adminAuth = async (req, res, next) => {
  try {
    // Verify the token first
    await new Promise((resolve, reject) => {
      verifyToken(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    // Check if user exists and is admin
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

    // Verify user type is admin
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

export default {
  verifyToken,
  adminAuth,
  superAdminAuth
};