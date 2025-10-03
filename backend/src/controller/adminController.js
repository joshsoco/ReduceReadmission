import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private (Admin)
export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          isActive: admin.isActive,
          lastLogin: admin.lastLogin,
          avatar: admin.avatar,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching profile'
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/admin/profile
// @access  Private (Admin)
export const updateProfile = async (req, res) => {
  try {
    // check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, avatar } = req.body;
    const adminId = req.admin.id;

    // Check if email is already taken by another admin
    if (email) {
      const existingAdmin = await Admin.findOne({ 
        email, 
        _id: { $ne: adminId } 
      });
      
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Email is already registered to another admin'
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (avatar !== undefined) updateData.avatar = avatar;

    // Update admin profile
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        admin: {
          id: updatedAdmin._id,
          name: updatedAdmin.name,
          email: updatedAdmin.email,
          role: updatedAdmin.role,
          isActive: updatedAdmin.isActive,
          avatar: updatedAdmin.avatar,
          lastLogin: updatedAdmin.lastLogin,
          createdAt: updatedAdmin.createdAt,
          updatedAt: updatedAdmin.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Update admin profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
};

// @desc    Change admin password
// @route   PUT /api/admin/change-password
// @access  Private (Admin)
export const changePassword = async (req, res) => {
  try {
    // check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const adminId = req.admin.id;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    const admin = await Admin.findById(adminId).select('+password');
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.matchPassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is different from current password
    const isSamePassword = await admin.matchPassword(newPassword);
    
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Update password (will be hashed by pre-save middleware)
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
};

// @desc    Get all admins (Super Admin only)
// @route   GET /api/admin/all
// @access  Private (Super Admin)
export const getAllAdmins = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get admins with pagination
    const admins = await Admin.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalAdmins = await Admin.countDocuments(filter);
    const totalPages = Math.ceil(totalAdmins / limit);

    res.status(200).json({
      success: true,
      data: {
        admins,
        pagination: {
          currentPage: page,
          totalPages,
          totalAdmins,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching admins'
    });
  }
};

// @desc    Create new admin (Super Admin only)
// @route   POST /api/admin/create
// @access  Private (Super Admin)
export const createAdmin = async (req, res) => {
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

    const { name, email, password, role = 'admin' } = req.body;

    // check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Admin with this email already exists'
      });
    }

    // create new admin
    const newAdmin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password,
      role
    });

    // remove password from response
    const adminResponse = await Admin.findById(newAdmin._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'Admin created successfully',
      data: {
        admin: adminResponse
      }
    });

  } catch (error) {
    console.error('Create admin error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Email is already registered'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error creating admin'
    });
  }
};

// @desc    Update admin status (Super Admin only)
// @route   PUT /api/admin/:id/status
// @access  Private (Super Admin)
export const updateAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Don't allow deactivating own account
    if (id === req.admin.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify your own account status'
      });
    }

    const admin = await Admin.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        admin
      }
    });

  } catch (error) {
    console.error('Update admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating admin status'
    });
  }
};

// @desc    Delete admin (Super Admin only)
// @route   DELETE /api/admin/:id
// @access  Private (Super Admin)
export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Don't allow deleting own account
    if (id === req.admin.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const admin = await Admin.findById(id);
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    await Admin.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting admin'
    });
  }
};

export default {
  getProfile,
  updateProfile,
  changePassword,
  getAllAdmins,
  createAdmin,
  updateAdminStatus,
  deleteAdmin
};