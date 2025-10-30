import React, { useState, useRef } from 'react';
import { Sparkles, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { Navbar } from '@/components/Navbar';
import { UploadForm } from '@/features/upload/components/UploadForm';
import { ResultsTable, PredictionResult } from '@/features/upload/components/ResultsTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const DashboardPage: React.FC = () => {
  const user = authService.getUser();
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [disease, setDisease] = useState<string>('');
  const [isSavingHistory, setIsSavingHistory] = useState(false);
  
  // ✅ Track saved uploads to prevent duplicates
  const savedUploadsRef = useRef<Set<string>>(new Set());

  const handleUploadSuccess = async (data: any, fileName: string, fileSize?: number) => {
    console.log('=== Upload Success Handler ===');
    console.log('Data received:', data);
    console.log('File name:', fileName);
    console.log('File size:', fileSize);
    
    if (data.predictions && Array.isArray(data.predictions)) {
      setResults(data.predictions);
      setUploadedFileName(fileName);
      setDisease(data.disease || '');

      await saveToHistory({
        fileName,
        fileSize: fileSize || 0,
        predictions: data.predictions,
        disease: data.disease,
      });
    }
  };

  const saveToHistory = async (uploadData: { 
    fileName: string; 
    fileSize: number;
    predictions: any[]; 
    disease?: string;
  }) => {
    // ✅ Prevent duplicate saves
    if (isSavingHistory) {
      console.log('Already saving history, skipping duplicate call');
      return;
    }

    // ✅ Create unique identifier for this upload
    const uploadIdentifier = `${uploadData.fileName}_${uploadData.predictions.length}_${uploadData.disease}`;
    
    if (savedUploadsRef.current.has(uploadIdentifier)) {
      console.log('Upload already saved, skipping duplicate');
      return;
    }

    setIsSavingHistory(true);

    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const historyPayload = {
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        recordCount: uploadData.predictions.length,
        highRiskCount: uploadData.predictions.filter(p => p.risk === 'High').length,
        mediumRiskCount: uploadData.predictions.filter(p => p.risk === 'Medium').length,
        lowRiskCount: uploadData.predictions.filter(p => p.risk === 'Low').length,
        disease: uploadData.disease || 'Unknown',
        predictions: uploadData.predictions
      };

      console.log('=== Saving to History ===');
      console.log('Payload:', historyPayload);

      const response = await fetch(`${API_BASE_URL}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(historyPayload)
      });

      const responseData = await response.json();
      
      console.log('History save response:', responseData);

      if (!response.ok) {
        console.error('Failed to save history:', responseData);
      } else {
        console.log('✅ History saved successfully with ID:', responseData.data?.id);
        
        // ✅ Mark this upload as saved
        if (!responseData.isDuplicate) {
          savedUploadsRef.current.add(uploadIdentifier);
        }
      }
    } catch (error) {
      console.error('Error saving upload history:', error);
    } finally {
      setIsSavingHistory(false);
    }
  };

  // ✅ Clear saved uploads when component unmounts
  React.useEffect(() => {
    return () => {
      savedUploadsRef.current.clear();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Dashboard
              </h1>
              <p className="text-gray-600">
                Upload patient data to generate ML-powered readmission risk predictions.
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              ML Model Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-700">
              <p>• <strong>Models:</strong> XGBoost Classifier (Diabetes, CKD, COPD, Hypertension, Pneumonia)</p>
              <p>• <strong>Output:</strong> Risk Band (Low/Medium/High) with probability scores</p>
              <p>• <strong>Supported Formats:</strong> Excel (.xlsx) or CSV (.csv)</p>
              <p>• <strong>Required Columns:</strong> Patient demographics, diagnoses, procedures, medications</p>
            </div>
          </CardContent>
        </Card>

        <UploadForm onUploadSuccess={handleUploadSuccess} />

        {results.length > 0 && (
          <Alert className="mt-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Successfully generated {results.length} predictions using ML model
              {disease && ` for ${disease}`}
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <ResultsTable 
            results={results} 
            fileName={uploadedFileName} 
            disease={disease}
          />
        )}

        {results.length === 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Step 1:</strong> Prepare your patient data in Excel or CSV format
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Step 2:</strong> Upload the file using the form above
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Step 3:</strong> ML model will automatically analyze and generate predictions
                  </span>
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
