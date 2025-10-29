import * as XLSX from 'xlsx';
import { FileModel, ExcelFileData } from '../models/fileModel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PYTHON_ML_API = import.meta.env.VITE_PYTHON_ML_API || 'http://localhost:8000';

interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    fileName: string;
    rowCount: number;
    predictions?: any[];
    uploadId?: string;
    disease?: string;
    fileSize?: number;
    originalFile?: File; // ✅ Add originalFile to interface
  };
  error?: string;
}

interface ApiStatus {
  isConnected: boolean;
  message: string;
  timestamp: number;
}

class UploadService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async readExcelFile(file: File): Promise<ExcelFileData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            reject(new Error('File is empty'));
            return;
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);

          const dataObjects = rows.map((row: any) => {
            const obj: any = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          });

          resolve({
            file,
            data: dataObjects,
            headers,
            rowCount: rows.length,
          });
        } catch (error) {
          reject(new Error('Failed to parse Excel file'));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsBinaryString(file);
    });
  }

  async uploadFile(excelData: ExcelFileData): Promise<UploadResponse> {
    try {
      // Create FormData to send file to Python ML API
      const formData = new FormData();
      formData.append('file', excelData.file);

      console.log('📤 Uploading file to ML API:', excelData.file.name);

      // Call Python ML API for predictions
      const mlResponse = await fetch(`${PYTHON_ML_API}/upload?format=json`, {
        method: 'POST',
        body: formData,
      });

      if (!mlResponse.ok) {
        const errorData = await mlResponse.json();
        console.error('❌ ML API Error:', errorData);
        
        if (mlResponse.status === 400) {
          throw new Error(errorData.detail || 'Invalid file format or data');
        }
        
        throw new Error(errorData.detail || 'ML API prediction failed');
      }

      const mlResult = await mlResponse.json();
      console.log('📥 ML API Response:', mlResult);

      // ✅ Validate response structure
      if (!mlResult || typeof mlResult !== 'object') {
        throw new Error('Invalid response structure from prediction service');
      }

      if (!mlResult.disease) {
        console.warn('⚠️ No disease field in response, checking alternative fields');
        throw new Error('Disease type not detected in response');
      }

      if (!mlResult.records || !Array.isArray(mlResult.records)) {
        console.warn('⚠️ No records field in response');
        throw new Error('No prediction records in response');
      }

      // ✅ Extract disease name with validation
      const diseaseName = mlResult.disease.trim();
      console.log('✅ Detected disease:', diseaseName);

      if (!diseaseName || diseaseName === 'Unknown') {
        throw new Error('Could not determine disease type from uploaded file. Please ensure the file contains appropriate medical data or name the file with the disease type (e.g., "hypertension_patients.xlsx")');
      }

      // Transform ML API response to frontend format
      const predictions = mlResult.records.map((record: any, index: number) => {
        const riskLevel = record.Risk_Band;
        const probability = record.Predicted_Prob;

        const factors = this.generateContributingFactors(record, riskLevel);
        const interpretation = this.generateInterpretation(record, riskLevel, diseaseName);

        return {
          no: index + 1,
          patientId: record.patient_id || `P-${(index + 1).toString().padStart(5, '0')}`,
          risk: riskLevel,
          probability: probability,
          reasons: factors,
          predictedClass: record.Predicted_Class,
          recommendation: this.generateRecommendation(riskLevel, probability),
          interpretation: interpretation,
        };
      });

      console.log(`✅ Successfully processed ${predictions.length} predictions for ${diseaseName}`);

      return {
        success: true,
        message: `Successfully analyzed ${predictions.length} patient record${predictions.length !== 1 ? 's' : ''} for ${diseaseName} readmission risk`,
        data: {
          fileName: excelData.file.name,
          rowCount: excelData.rowCount || 0,
          predictions: predictions,
          disease: diseaseName,
          fileSize: excelData.file.size,
          originalFile: excelData.file
        },
      };
    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMessage = (error as Error).message;
      
      return {
        success: false,
        message: 'Failed to generate predictions',
        error: errorMessage.includes('non-medical') || 
               errorMessage.includes('not appear to contain') ||
               errorMessage.includes('Could not determine disease')
          ? errorMessage
          : 'Failed to process file. Please ensure it contains valid hospital readmission patient data.',
      };
    }
  }

  // ✅ Add generateInterpretation method
  private generateInterpretation(record: any, riskLevel: string, disease: string): string {
    const interpretations: string[] = [];

    // Disease-specific interpretations
    if (disease === 'Pneumonia') {
      if (record.age > 70) interpretations.push('Advanced age increases infection risk');
      if (record.comorb > 2) interpretations.push('Multiple comorbidities complicate recovery');
      if (record.clin_instab === 1) interpretations.push('Clinical instability at discharge');
    } else if (disease === 'Type 2 Diabetes') {
      if (record.age > 65) interpretations.push('Elderly diabetic patients have higher readmission risk');
      if (record.insulin_use === 1) interpretations.push('Insulin dependency indicates severe diabetes');
      if (record.albumin < 3.5) interpretations.push('Low albumin suggests malnutrition');
    } else if (disease === 'Chronic Kidney Disease') {
      if (record.gfr < 30) interpretations.push('Severely reduced kidney function');
      if (record.creatinine > 2.0) interpretations.push('Elevated creatinine indicates kidney damage');
    }

    // General risk-based interpretations
    if (riskLevel === 'High') {
      interpretations.push('Patient requires intensive post-discharge monitoring and follow-up care within 7 days');
    } else if (riskLevel === 'Medium') {
      interpretations.push('Standard follow-up care recommended within 14 days');
    } else {
      interpretations.push('Low risk - routine follow-up within 30 days sufficient');
    }

    return interpretations.length > 0 
      ? interpretations.join('. ') 
      : `${riskLevel} risk of readmission for ${disease}`;
  }

  private generateContributingFactors(record: any, riskLevel: string): string[] {
    const factors: string[] = [];

    // Add factors based on available data
    if (record.age > 65) factors.push('Age over 65');
    if (record.time_in_hospital > 7) factors.push('Extended hospital stay');
    if (record.num_procedures > 3) factors.push('Multiple procedures');
    if (record.num_medications > 10) factors.push('High medication count');
    if (record.number_diagnoses > 5) factors.push('Multiple diagnoses');
    if (record.number_emergency > 0) factors.push('Previous emergency visits');
    if (record.number_inpatient > 0) factors.push('Previous inpatient admissions');

    // Add risk-specific factors
    if (riskLevel === 'High') {
      if (factors.length < 3) {
        factors.push('High predicted risk score', 'Requires intensive follow-up');
      }
    } else if (riskLevel === 'Medium') {
      if (factors.length < 2) {
        factors.push('Moderate risk factors present');
      }
    }

    return factors.length > 0 ? factors : ['Standard risk profile'];
  }

  private generateRecommendation(riskLevel: string, probability: number): string {
    if (riskLevel === 'High' || probability > 0.66) {
      return 'High risk of readmission. Recommend intensive follow-up care, home health services, and close monitoring. Schedule follow-up appointment within 7 days of discharge.';
    } else if (riskLevel === 'Medium' || probability > 0.33) {
      return 'Moderate risk of readmission. Recommend standard follow-up care and patient education. Schedule follow-up appointment within 14 days of discharge.';
    } else {
      return 'Low risk of readmission. Standard discharge procedures recommended. Schedule routine follow-up appointment within 30 days.';
    }
  }

  async uploadSampleData(): Promise<UploadResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const sampleData = FileModel.getSampleData();
        resolve({
          success: true,
          message: 'Sample data loaded successfully',
          data: {
            fileName: 'sample_hospital_data.xlsx',
            rowCount: sampleData.length,
            predictions: sampleData.map((patient) => ({
              ...patient,
              prediction: patient.risk_score > 0.7 ? 'High Risk' : 'Low Risk',
            })),
          },
        });
      }, 1000);
    });
  }

  async checkApiStatus(): Promise<ApiStatus> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Check both backend and ML API
      const [backendResponse, mlResponse] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        }),
        fetch(`${PYTHON_ML_API}/`, {
          method: 'GET',
          signal: controller.signal,
        }),
      ]);

      clearTimeout(timeoutId);

      const backendOk = backendResponse.status === 'fulfilled' && backendResponse.value.ok;
      const mlOk = mlResponse.status === 'fulfilled' && mlResponse.value.ok;

      if (backendOk && mlOk) {
        return {
          isConnected: true,
          message: 'All APIs Connected',
          timestamp: Date.now(),
        };
      } else if (backendOk) {
        return {
          isConnected: false,
          message: 'ML API Disconnected',
          timestamp: Date.now(),
        };
      } else if (mlOk) {
        return {
          isConnected: false,
          message: 'Backend Disconnected',
          timestamp: Date.now(),
        };
      } else {
        return {
          isConnected: false,
          message: 'All APIs Disconnected',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      return {
        isConnected: false,
        message: 'API Connection Error',
        timestamp: Date.now(),
      };
    }
  }

  // ✅ Update downloadPDFReport to use the correct endpoint
  async downloadPDFReport(file: File): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${PYTHON_ML_API}/upload?format=pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to generate PDF report');
    }

    return await response.blob();
  }

  // ✅ Add method to get interpretations from ML API
  async getInterpretations(excelData: ExcelFileData): Promise<any[]> {
    try {
      const formData = new FormData();
      formData.append('file', excelData.file);

      const response = await fetch(`${PYTHON_ML_API}/upload?format=json`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to get interpretations');
      }

      const result = await response.json();
      return result.records || [];
    } catch (error) {
      console.error('Error getting interpretations:', error);
      return [];
    }
  }
}

export const uploadService = new UploadService();
export type { UploadResponse, ApiStatus };
