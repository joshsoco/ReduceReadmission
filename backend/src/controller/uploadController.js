import { validationResult } from 'express-validator';

export const uploadExcelData = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { fileName, fileSize, headers, data, rowCount, timestamp, disease, predictions } = req.body;
    const user = req.user;

    if (!fileName || !data || !rowCount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fileName, data, or rowCount'
      });
    }

    console.log('Upload processed for user:', user.id);
    console.log('File:', fileName, 'Rows:', rowCount);

    // DO NOT save history here - let frontend handle it via /api/history endpoint
    
    res.status(200).json({
      success: true,
      message: 'File uploaded and processed successfully',
      data: {
        fileName,
        rowCount,
        predictions: predictions || [],
        disease: disease || 'Unknown',
        uploadId: `upload_${Date.now()}`
      }
    });

  } catch (error) {
    console.error('Upload Excel error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export default {
  uploadExcelData
};
