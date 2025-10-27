import { validationResult } from 'express-validator';
import History from '../models/History.js';
import mongoose from 'mongoose';

export const saveUploadHistory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    const user = req.user;
    console.log('=== Save History Request ===');
    console.log('User ID:', user.id);
    console.log('Request body:', req.body);
    
    const {
      fileName,
      fileSize,
      recordCount,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      disease,
      predictions
    } = req.body;

    const now = new Date();
    
    // Generate unique upload ID to prevent duplicates
    const uploadId = `${user.id}_${fileName}_${now.getTime()}`;
    
    // Check if this exact upload already exists (within last 5 seconds)
    const fiveSecondsAgo = new Date(now.getTime() - 5000);
    const existingUpload = await History.findOne({
      userId: user.id,
      fileName: fileName,
      createdAt: { $gte: fiveSecondsAgo }
    });

    if (existingUpload) {
      console.log('⚠️  Duplicate upload detected, returning existing entry');
      return res.status(200).json({
        success: true,
        message: 'Upload history already exists',
        data: {
          id: existingUpload._id,
          fileName: existingUpload.fileName,
          timestamp: existingUpload.createdAt
        }
      });
    }
    
    const historyEntry = await History.create({
      userId: user.id,
      fileName,
      fileSize: fileSize || 0,
      uploadDate: now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }),
      uploadTime: now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      recordCount: recordCount || 0,
      highRiskCount: highRiskCount || 0,
      mediumRiskCount: mediumRiskCount || 0,
      lowRiskCount: lowRiskCount || 0,
      disease: disease || 'Unknown',
      predictions: predictions || [],
      status: 'completed',
      uploadedBy: {
        name: user.name || user.email,
        email: user.email,
        role: user.role
      },
      uploadId: uploadId
    });

    console.log('✅ History saved successfully:', historyEntry._id);

    res.status(201).json({
      success: true,
      message: 'Upload history saved successfully',
      data: {
        id: historyEntry._id,
        fileName: historyEntry.fileName,
        timestamp: historyEntry.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Save history error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate upload detected',
        error: 'This upload has already been saved'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error saving upload history',
      error: error.message
    });
  }
};

export const getUploadHistory = async (req, res) => {
  try {
    const user = req.user;
    const { 
      page = 1, 
      limit = 50, 
      disease, 
      startDate, 
      endDate 
    } = req.query;

    console.log('Fetching history for user:', user.id);

    // Use string ID directly in query - mongoose will handle conversion
    const query = { userId: user.id };

    // Filter by disease if provided
    if (disease && disease !== 'all') {
      query.disease = disease;
    }

    // Filter by date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [historyItems, total] = await Promise.all([
      History.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-predictions')
        .lean(),
      History.countDocuments(query)
    ]);

    console.log('Found history items:', historyItems.length);

    // Calculate statistics using string ID
    const stats = await History.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(user.id) // Use 'new' keyword
        } 
      },
      {
        $group: {
          _id: null,
          totalUploads: { $sum: 1 },
          totalRecords: { $sum: '$recordCount' },
          totalHighRisk: { $sum: '$highRiskCount' },
          totalMediumRisk: { $sum: '$mediumRiskCount' },
          totalLowRisk: { $sum: '$lowRiskCount' }
        }
      }
    ]);

    console.log('Statistics calculated:', stats);

    res.status(200).json({
      success: true,
      data: {
        history: historyItems,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        },
        statistics: stats.length > 0 ? stats[0] : {
          totalUploads: 0,
          totalRecords: 0,
          totalHighRisk: 0,
          totalMediumRisk: 0,
          totalLowRisk: 0
        }
      }
    });

  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching upload history',
      error: error.message
    });
  }
};

export const getHistoryById = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const historyItem = await History.findOne({
      _id: id,
      userId: user.id // String ID works fine here
    }).lean();

    if (!historyItem) {
      return res.status(404).json({
        success: false,
        message: 'History item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: historyItem
    });

  } catch (error) {
    console.error('Get history by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching history item',
      error: error.message
    });
  }
};

export const deleteHistory = async (req, res) => {
  try {
    const user = req.user;
    const { id } = req.params;

    const historyItem = await History.findOneAndDelete({
      _id: id,
      userId: user.id // String ID works fine here
    });

    if (!historyItem) {
      return res.status(404).json({
        success: false,
        message: 'History item not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'History item deleted successfully',
      data: {
        id: historyItem._id,
        fileName: historyItem.fileName
      }
    });

  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting history item',
      error: error.message
    });
  }
};

export const getHistoryStats = async (req, res) => {
  try {
    const user = req.user;

    console.log('Fetching stats for user:', user.id);

    const stats = await History.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(user.id) // Use 'new' keyword
        } 
      },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalUploads: { $sum: 1 },
                totalRecords: { $sum: '$recordCount' },
                totalHighRisk: { $sum: '$highRiskCount' },
                totalMediumRisk: { $sum: '$mediumRiskCount' },
                totalLowRisk: { $sum: '$lowRiskCount' }
              }
            }
          ],
          byDisease: [
            {
              $group: {
                _id: '$disease',
                count: { $sum: 1 },
                records: { $sum: '$recordCount' },
                highRisk: { $sum: '$highRiskCount' }
              }
            }
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                fileName: 1,
                disease: 1,
                recordCount: 1,
                uploadDate: 1,
                uploadTime: 1,
                createdAt: 1
              }
            }
          ]
        }
      }
    ]);

    console.log('Stats result:', JSON.stringify(stats, null, 2));

    res.status(200).json({
      success: true,
      data: {
        overall: stats[0].overall[0] || {
          totalUploads: 0,
          totalRecords: 0,
          totalHighRisk: 0,
          totalMediumRisk: 0,
          totalLowRisk: 0
        },
        byDisease: stats[0].byDisease,
        recentUploads: stats[0].recent
      }
    });

  } catch (error) {
    console.error('Get history stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching history statistics',
      error: error.message
    });
  }
};

export default {
  saveUploadHistory,
  getUploadHistory,
  getHistoryById,
  deleteHistory,
  getHistoryStats
};