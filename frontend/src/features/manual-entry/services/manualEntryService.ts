import { PatientFormData, PredictionResult, SavedEntry } from '../models/patientModel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface PredictionResponse {
  success: boolean;
  data?: {
    riskLevel: 'Low' | 'Medium' | 'High';
    riskScore: number;
    recommendation: string;
  };
  message?: string;
  error?: string;
}

interface SaveResponse {
  success: boolean;
  data?: SavedEntry;
  message?: string;
  error?: string;
}

class ManualEntryService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  async predictReadmission(formData: PatientFormData): Promise<PredictionResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/manual-entry/predict`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(formData),
      });

      const result: PredictionResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Prediction failed');
      }

      if (!result.data) {
        throw new Error('No prediction data received');
      }

      return {
        riskLevel: result.data.riskLevel,
        riskScore: result.data.riskScore,
        recommendation: result.data.recommendation,
        predictedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    }
  }

  async saveEntry(formData: PatientFormData, prediction?: PredictionResult): Promise<SavedEntry> {
    try {
      const response = await fetch(`${API_BASE_URL}/manual-entry/save`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ formData, prediction }),
      });

      const result: SaveResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Save failed');
      }

      if (!result.data) {
        throw new Error('No data received');
      }

      return result.data;
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  }

  async getRecentEntries(limit: number = 5): Promise<SavedEntry[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/manual-entry/recent?limit=${limit}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch entries');
      }

      return result.data || [];
    } catch (error) {
      console.error('Fetch entries error:', error);
      return [];
    }
  }

  async deleteEntry(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/manual-entry/${id}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  exportToPDF(formData: PatientFormData, prediction: PredictionResult): void {
    console.log('Exporting to PDF:', { formData, prediction });
    alert('PDF export feature will be implemented with jsPDF library');
  }
}

export const manualEntryService = new ManualEntryService();
