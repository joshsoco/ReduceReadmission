import React, { useState } from 'react';
import { Sparkles, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { Navbar } from '@/components/Navbar';
import { UploadForm } from '@/features/upload/components/UploadForm';
import { ResultsTable, PredictionResult } from '@/features/upload/components/ResultsTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const DashboardPage: React.FC = () => {
  const user = authService.getUser();
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  const generateMockData = () => {
    const patientNames = [
      'John Smith', 'Mary Johnson', 'Robert Williams', 'Patricia Brown',
      'Michael Davis', 'Jennifer Miller', 'William Wilson', 'Linda Moore',
      'David Taylor', 'Elizabeth Anderson', 'Richard Thomas', 'Barbara Jackson',
      'Joseph White', 'Susan Harris', 'Thomas Martin', 'Jessica Thompson',
      'Charles Garcia', 'Sarah Martinez', 'Christopher Robinson', 'Karen Clark'
    ];

    const conditions = [
      'Previous hospital readmissions (2 times in last year)',
      'Diabetes mellitus with complications',
      'Chronic heart failure (NYHA Class III)',
      'Chronic kidney disease (Stage 4)',
      'COPD with frequent exacerbations',
      'Multiple medication regimen (12+ medications)',
      'Poor medication adherence history',
      'Advanced age (75+ years)',
      'Lives alone with limited support',
      'Recent emergency department visits',
      'Hypertension (uncontrolled)',
      'Post-surgical complications',
      'Cognitive impairment/Dementia',
      'Depression affecting self-care',
      'Limited health literacy',
      'Substance abuse history',
      'Anemia requiring treatment',
      'Atrial fibrillation',
      'Obesity (BMI > 35)',
      'Malnutrition/Weight loss'
    ];

    const mockResults: PredictionResult[] = Array.from({ length: 20 }, (_, index) => {
      const riskRand = Math.random();
      const risk: 'High' | 'Medium' | 'Low' =
        riskRand > 0.7 ? 'High' :
        riskRand > 0.35 ? 'Medium' : 'Low';

      const probability =
        risk === 'High' ? Math.random() * 0.25 + 0.65 :
        risk === 'Medium' ? Math.random() * 0.30 + 0.35 :
        Math.random() * 0.35;

      const numReasons = risk === 'High' ? 4 + Math.floor(Math.random() * 3) :
                        risk === 'Medium' ? 2 + Math.floor(Math.random() * 3) :
                        1 + Math.floor(Math.random() * 2);

      const shuffled = [...conditions].sort(() => 0.5 - Math.random());
      const selectedReasons = shuffled.slice(0, numReasons);

      return {
        no: index + 1,
        patientId: `P-${(index + 1).toString().padStart(5, '0')}`,
        risk,
        probability,
        reasons: selectedReasons
      };
    });

    setResults(mockResults);
    setUploadedFileName('sample_patients_data.xlsx');
  };

  const handleUploadSuccess = (data: any, fileName: string) => {
    const mockResults: PredictionResult[] = data.map((row: any, index: number) => ({
      no: index + 1,
      patientId: row.patient_id || `P-${(index + 1).toString().padStart(5, '0')}`,
      risk: Math.random() > 0.7 ? 'High' : Math.random() > 0.4 ? 'Medium' : 'Low',
      probability: Math.random() * 0.5 + 0.3,
      reasons: [
        'Previous readmissions',
        'Chronic conditions',
        'Age factor',
        'Medication adherence'
      ].slice(0, Math.floor(Math.random() * 3) + 2)
    }));

    setResults(mockResults);
    setUploadedFileName(fileName);
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
                Upload patient data to generate readmission risk predictions.
              </p>
            </div>
            <Button
              onClick={generateMockData}
              variant="outline"
              className="flex items-center gap-2 bg-black text-white hover:from-purple-600 hover:to-blue-600 border-0"
            >

              Generate Sample Data
            </Button>
          </div>
        </div>

        <div className="mb-8">
          <UploadForm onUploadSuccess={handleUploadSuccess} />
        </div>

        {results.length > 0 && (
          <ResultsTable results={results} fileName={uploadedFileName} />
        )}

        <Card className="mt-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              Upload Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Data Format:</strong> Ensure your Excel file contains patient data with columns like patient_id, age,
                  diagnosis, previous_admissions, etc.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>File Requirements:</strong> File should be in .xls, .xlsx or CSV format (maximum 10MB)
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Template:</strong> Download the template if you need a reference format for proper data structure
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Testing:</strong> Use sample data to test the system before uploading real patient data
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>
                  <strong>Next Step:</strong> After uploading, click "Process and Analyze Data" to generate predictions, or use "Generate Sample Data" button above
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
