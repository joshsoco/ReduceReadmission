import { useState, useCallback } from 'react';
import { PatientFormData, PredictionResult, SavedEntry, initialFormData } from '../models/patientModel';
import { manualEntryService } from '../services/manualEntryService';

export type Status = 'idle' | 'predicting' | 'saving' | 'loading' | 'success' | 'error';

interface UseManualEntryReturn {
  formData: PatientFormData;
  prediction: PredictionResult | null;
  recentEntries: SavedEntry[];
  status: Status;
  error: string | null;
  updateField: (field: keyof PatientFormData, value: any) => void;
  predictReadmission: () => Promise<void>;
  saveEntry: () => Promise<void>;
  resetForm: () => void;
  loadRecentEntries: () => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  exportReport: () => void;
}

export const useManualEntry = (): UseManualEntryReturn => {
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [recentEntries, setRecentEntries] = useState<SavedEntry[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const updateField = useCallback((field: keyof PatientFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const predictReadmission = useCallback(async () => {
    setStatus('predicting');
    setError(null);

    try {
      const result = await manualEntryService.predictReadmission(formData);
      setPrediction(result);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError((err as Error).message || 'Failed to predict readmission risk');
    }
  }, [formData]);

  const saveEntry = useCallback(async () => {
    if (!prediction) {
      setError('Please predict readmission risk before saving');
      return;
    }

    setStatus('saving');
    setError(null);

    try {
      const savedEntry = await manualEntryService.saveEntry(formData, prediction);
      setStatus('success');
      setRecentEntries(prev => [savedEntry, ...prev.slice(0, 4)]);
      
      setTimeout(() => {
        resetForm();
      }, 2000);
    } catch (err) {
      setStatus('error');
      setError((err as Error).message || 'Failed to save entry');
    }
  }, [formData, prediction]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setPrediction(null);
    setError(null);
    setStatus('idle');
  }, []);

  const loadRecentEntries = useCallback(async () => {
    setStatus('loading');
    try {
      const entries = await manualEntryService.getRecentEntries(5);
      setRecentEntries(entries);
      setStatus('idle');
    } catch (err) {
      setError((err as Error).message || 'Failed to load recent entries');
      setStatus('error');
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    const success = await manualEntryService.deleteEntry(id);
    if (success) {
      setRecentEntries(prev => prev.filter(entry => entry.id !== id));
    }
  }, []);

  const exportReport = useCallback(() => {
    if (!prediction) {
      setError('Please predict readmission risk before exporting');
      return;
    }
    manualEntryService.exportToPDF(formData, prediction);
  }, [formData, prediction]);

  return {
    formData,
    prediction,
    recentEntries,
    status,
    error,
    updateField,
    predictReadmission,
    saveEntry,
    resetForm,
    loadRecentEntries,
    deleteEntry,
    exportReport,
  };
};
