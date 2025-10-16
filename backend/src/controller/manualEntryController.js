import { body, validationResult } from 'express-validator';

export const predictManualEntry = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const patientData = req.body;

    const riskFactors = {
      age: patientData.age > 65 ? 2 : patientData.age > 50 ? 1 : 0,
      admissionType: patientData.admissionType === 'Emergency' ? 2 : 
                     patientData.admissionType === 'Urgent' ? 1 : 0,
      procedures: patientData.numberOfProcedures > 5 ? 2 : 
                  patientData.numberOfProcedures > 2 ? 1 : 0,
      medications: patientData.numberOfMedications > 10 ? 2 : 
                   patientData.numberOfMedications > 5 ? 1 : 0,
      glucose: patientData.glucoseLevel > 180 ? 2 : 
               patientData.glucoseLevel > 140 ? 1 : 0,
      a1c: patientData.a1cResult > 7.0 ? 2 : 
           patientData.a1cResult > 6.5 ? 1 : 0,
      bmi: patientData.bmi > 30 ? 1 : 0,
    };

    const totalRiskScore = Object.values(riskFactors).reduce((sum, val) => sum + val, 0);
    const maxPossibleScore = 11;
    const riskScore = totalRiskScore / maxPossibleScore;

    let riskLevel;
    let recommendation;

    if (riskScore >= 0.6) {
      riskLevel = 'High';
      recommendation = 'High risk of readmission. Recommend intensive follow-up care, home health services, and close monitoring. Schedule follow-up appointment within 7 days of discharge.';
    } else if (riskScore >= 0.35) {
      riskLevel = 'Medium';
      recommendation = 'Moderate risk of readmission. Recommend standard follow-up care and patient education. Schedule follow-up appointment within 14 days of discharge.';
    } else {
      riskLevel = 'Low';
      recommendation = 'Low risk of readmission. Standard discharge procedures recommended. Schedule routine follow-up appointment within 30 days.';
    }

    const prediction = {
      riskLevel,
      riskScore,
      recommendation,
      factors: riskFactors,
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      prediction,
    });

  } catch (error) {
    console.error('Error predicting manual entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating prediction',
      error: error.message,
    });
  }
};

export const saveManualEntry = async (req, res) => {
  try {
    const user = req.user;

    if (!user || (user.role !== 'doctor' && user.role !== 'admin' && user.role !== 'superadmin')) {
      return res.status(403).json({
        success: false,
        message: 'Only doctors and admins can save manual entries',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const entryData = {
      ...req.body,
      enteredBy: user.username,
      enteredByRole: user.role,
      createdAt: new Date().toISOString(),
      id: `ME-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    res.json({
      success: true,
      message: 'Manual entry saved successfully',
      entry: entryData,
    });

  } catch (error) {
    console.error('Error saving manual entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving manual entry',
      error: error.message,
    });
  }
};

export const getRecentEntries = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const mockEntries = [
      {
        id: 'ME-1234567890',
        patientId: 'P-12345',
        fullName: 'John Doe',
        age: 68,
        gender: 'Male',
        admissionDate: '2024-01-15',
        dischargeDate: '2024-01-20',
        admissionType: 'Emergency',
        primaryDiagnosis: 'Acute Myocardial Infarction',
        prediction: {
          riskLevel: 'High',
          riskScore: 0.72,
          recommendation: 'High risk of readmission. Recommend intensive follow-up care.',
        },
        enteredBy: 'dr.smith',
        enteredByRole: 'doctor',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'ME-0987654321',
        patientId: 'P-67890',
        fullName: 'Jane Smith',
        age: 45,
        gender: 'Female',
        admissionDate: '2024-01-18',
        dischargeDate: '2024-01-22',
        admissionType: 'Elective',
        primaryDiagnosis: 'Appendectomy',
        prediction: {
          riskLevel: 'Low',
          riskScore: 0.18,
          recommendation: 'Low risk of readmission. Standard discharge procedures recommended.',
        },
        enteredBy: 'dr.jones',
        enteredByRole: 'doctor',
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    res.json({
      success: true,
      entries: mockEntries,
      total: mockEntries.length,
    });

  } catch (error) {
    console.error('Error fetching recent entries:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recent entries',
      error: error.message,
    });
  }
};

export const deleteManualEntry = async (req, res) => {
  try {
    const user = req.user;

    if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can delete manual entries',
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Entry ID is required',
      });
    }

    res.json({
      success: true,
      message: 'Manual entry deleted successfully',
      deletedId: id,
    });

  } catch (error) {
    console.error('Error deleting manual entry:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting manual entry',
      error: error.message,
    });
  }
};

export const validateManualEntry = [
  body('patientId').trim().notEmpty().withMessage('Patient ID is required'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('age').isInt({ min: 0, max: 120 }).withMessage('Age must be between 0 and 120'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('admissionDate').isISO8601().withMessage('Invalid admission date'),
  body('dischargeDate').isISO8601().withMessage('Invalid discharge date'),
  body('admissionType').isIn(['Emergency', 'Urgent', 'Elective']).withMessage('Invalid admission type'),
  body('primaryDiagnosis').trim().notEmpty().withMessage('Primary diagnosis is required'),
];
