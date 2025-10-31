import { PatientFormData, PredictionResult, SavedEntry } from '../models/patientModel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface PredictionResponse {
  success: boolean;
  prediction?: PredictionResult;
  message?: string;
}

interface SaveResponse {
  success: boolean;
  entry?: SavedEntry;
  message?: string;
}

class ManualEntryService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
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

      if (!result.prediction) {
        throw new Error('No prediction data received');
      }

      return {
        riskLevel: result.prediction.riskLevel,
        riskScore: result.prediction.riskScore,
        recommendation: result.prediction.recommendation,
        predictedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Prediction error:', error);
      throw error;
    }
  }

  async saveEntry(formData: PatientFormData, prediction?: PredictionResult): Promise<SavedEntry> {
    const savedEntry: SavedEntry = {
      ...formData,
      prediction,
      id: `ME-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    // Save to localStorage
    const existingEntries = this.getLocalEntries();
    existingEntries.unshift(savedEntry);
    const limitedEntries = existingEntries.slice(0, 20);
    localStorage.setItem('manualEntries', JSON.stringify(limitedEntries));

    return savedEntry;
  }

  async getRecentEntries(limit: number = 5): Promise<SavedEntry[]> {
    const entries = this.getLocalEntries();
    return entries.slice(0, limit);
  }

  async deleteEntry(id: string): Promise<boolean> {
    const entries = this.getLocalEntries();
    const filtered = entries.filter(entry => entry.id !== id);
    localStorage.setItem('manualEntries', JSON.stringify(filtered));
    return true;
  }

  private getLocalEntries(): SavedEntry[] {
    const stored = localStorage.getItem('manualEntries');
    return stored ? JSON.parse(stored) : [];
  }

  exportToPDF(formData: PatientFormData, prediction: PredictionResult): void {
    console.log('Exporting to PDF:', { formData, prediction });
    alert('PDF export feature will be implemented with jsPDF library');
  }
}

export const manualEntryService = new ManualEntryService();
