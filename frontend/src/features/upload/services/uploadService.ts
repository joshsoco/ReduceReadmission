import * as XLSX from 'xlsx';
import { FileModel, ExcelFileData } from '../models/fileModel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    fileName: string;
    rowCount: number;
    predictions?: any[];
    uploadId?: string;
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
          
          // Check if file is CSV
          const isCSV = file.name.toLowerCase().endsWith('.csv');
          
          let workbook: XLSX.WorkBook;
          
          if (isCSV) {
            // Parse CSV file
            workbook = XLSX.read(data, { type: 'binary', raw: true });
          } else {
            // Parse Excel file
            workbook = XLSX.read(data, { type: 'binary' });
          }

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length === 0) {
            reject(new Error(`${isCSV ? 'CSV' : 'Excel'} file is empty`));
            return;
          }

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1);

          const dataObjects = rows
            .filter((row: any) => row.length > 0)
            .map((row: any) => {
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
            rowCount: dataObjects.length,
          });
        } catch (error) {
          reject(new Error('Failed to read file: ' + (error as Error).message));
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
      // TODO: This will send data to backend ML model for predictions
      // Once ML model is trained configure the endpoint
      
      const response = await fetch(`${API_BASE_URL}/upload/excel`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          fileName: excelData.file.name,
          fileSize: excelData.file.size,
          headers: excelData.headers,
          data: excelData.data,
          rowCount: excelData.rowCount,
          timestamp: new Date().toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      // TODO: Backend should return predictions in this format:
      // {
      //   success: true,
      //   message: 'Predictions generated successfully',
      //   data: {
      //     fileName: string,
      //     rowCount: number,
      //     predictions: [
      //       {
      //         patientId: string,
      //         riskLevel: 'High' | 'Medium' | 'Low',
      //         riskScore: number,
      //         probability: number,
      //         contributingFactors: string[],
      //         recommendation: string
      //       }
      //     ]
      //   }
      // }

      return {
        success: true,
        message: 'File uploaded successfully',
        data: result.data,
      };
    } catch (error) {
      console.error('Upload error:', error);
      return {
        success: false,
        message: 'Failed to upload file',
        error: (error as Error).message,
      };
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

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return {
          isConnected: true,
          message: 'API Connected',
          timestamp: Date.now(),
        };
      } else {
        return {
          isConnected: false,
          message: 'API Error',
          timestamp: Date.now(),
        };
      }
    } catch (error) {
      return {
        isConnected: false,
        message: 'API Disconnected',
        timestamp: Date.now(),
      };
    }
  }

  downloadTemplate(): void {
    const headers = [
      'patient_id',
      'age',
      'gender',
      'admission_date',
      'discharge_date',
      'diagnosis',
      'length_of_stay',
      'previous_admissions',
      'risk_score',
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patient Data');

    XLSX.writeFile(wb, 'hospital_readmission_template.xlsx');
  }
}

export const uploadService = new UploadService();
export type { UploadResponse, ApiStatus };
