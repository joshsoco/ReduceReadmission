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

    const { fileName, fileSize, headers, data, rowCount, timestamp } = req.body;

    if (!fileName || !data || !rowCount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fileName, data, or rowCount'
      });
    }

    const predictions = data.map((row, index) => ({
      ...row,
      prediction: Math.random() > 0.5 ? 'High Risk' : 'Low Risk',
      probability: Math.random(),
      rowNumber: index + 1
    }));

    res.status(200).json({
      success: true,
      message: 'File uploaded and processed successfully',
      data: {
        fileName,
        rowCount,
        predictions,
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
