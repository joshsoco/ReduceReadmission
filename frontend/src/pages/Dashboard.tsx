import React, { useState } from 'react';
import { Sparkles, CheckCircle2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { Navbar } from '@/components/Navbar';
import { UploadForm } from '@/features/upload/components/UploadForm';
import { ResultsTable, PredictionResult } from '@/features/upload/components/ResultsTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const DashboardPage: React.FC = () => {
  const user = authService.getUser();
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [disease, setDisease] = useState<string>('');

  const handleUploadSuccess = (data: any, fileName: string) => {
    if (data.predictions && Array.isArray(data.predictions)) {
      setResults(data.predictions);
      setUploadedFileName(fileName);
      setDisease(data.disease || '');
    }
  };

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
              <p>• <strong>Model:</strong> XGBoost Classifier (Diabetes & Pneumonia)</p>
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
