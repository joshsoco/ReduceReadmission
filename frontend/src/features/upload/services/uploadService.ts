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

      // Call Python ML API for predictions
      const mlResponse = await fetch(`${PYTHON_ML_API}/upload?format=json`, {
        method: 'POST',
        body: formData,
      });

      if (!mlResponse.ok) {
        const errorData = await mlResponse.json();
        throw new Error(errorData.error || 'ML API prediction failed');
      }

      const mlResult = await mlResponse.json();

      // Transform ML API response to frontend format
      const predictions = mlResult.records.map((record: any, index: number) => {
        const riskLevel = record.Risk_Band;
        const probability = record.Predicted_Prob;

        // Generate contributing factors based on risk level
        const factors = this.generateContributingFactors(record, riskLevel);

        return {
          no: index + 1,
          patientId: record.patient_id || `P-${(index + 1).toString().padStart(5, '0')}`,
          risk: riskLevel,
          probability: probability,
          reasons: factors,
          riskScore: probability,
          predictedClass: record.Predicted_Class,
          recommendation: this.generateRecommendation(riskLevel, probability),
        };
      });

      // Also save to backend for history tracking
      try {
        await fetch(`${API_BASE_URL}/upload/excel`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            fileName: excelData.file.name,
            fileSize: excelData.file.size,
            headers: excelData.headers,
            data: excelData.data,
            rowCount: excelData.rowCount,
            predictions: predictions,
            mlModelInfo: {
              disease: mlResult.disease,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      } catch (backendError) {
        console.warn('Failed to save to backend:', backendError);
      }

      return {
        success: true,
        message: `Predictions generated successfully for ${mlResult.disease}`,
        data: {
          fileName: excelData.file.name,
          rowCount: excelData.rowCount || 0,
          predictions: predictions,
          disease: mlResult.disease,
        },
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        message: 'Failed to generate predictions',
        error: (error as Error).message,
      };
    }
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

  async downloadPDFReport(file: File): Promise<Blob> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${PYTHON_ML_API}/upload?format=pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF report');
    }

    return await response.blob();
  }
}

export const uploadService = new UploadService();
export type { UploadResponse, ApiStatus };
