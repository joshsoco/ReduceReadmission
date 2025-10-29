import React, { useState } from 'react';
import { Download, FileDown, Brain, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const PYTHON_ML_API = import.meta.env.VITE_PYTHON_ML_API || 'http://localhost:8000';

export interface PredictionResult {
  no: number;
  patientId?: string;
  risk: 'High' | 'Medium' | 'Low';
  probability: number;
  reasons: string[];
  recommendation?: string;
  predictedClass?: number;
  interpretation?: string;
}

interface ResultsTableProps {
  results: PredictionResult[];
  fileName?: string;
  disease?: string;
  originalFile?: File;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ 
  results, 
  fileName = 'predictions', 
  disease,
  originalFile 
}) => {
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // ✅ Debug: Log originalFile status
  React.useEffect(() => {
    console.log('🔍 ResultsTable Debug:', {
      hasOriginalFile: !!originalFile,
      fileName: originalFile?.name,
      fileSize: originalFile?.size,
      disease,
      resultsCount: results.length
    });
  }, [originalFile, disease, results]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'success';
      default: return 'secondary';
    }
  };

  // ✅ MAIN FUNCTION: Export PDF from Backend with Interpretations
  const exportPDFFromBackend = async () => {
    if (!originalFile) {
      setPdfError('Please upload a new file to generate the professional PDF report.');
      alert('Professional PDF export requires the original file. Please upload your data again, or use "Export Excel" instead.');
      return;
    }

    setIsDownloadingPDF(true);
    setPdfError(null);

    try {
      console.log('📄 Requesting PDF from backend...');
      console.log('File:', originalFile.name, 'Size:', originalFile.size);
      
      const formData = new FormData();
      formData.append('file', originalFile);

      const response = await fetch(`${PYTHON_ML_API}/upload?format=pdf`, {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      // Get the PDF blob
      const blob = await response.blob();
      console.log('PDF blob size:', blob.size);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sanitizedDisease = disease?.replace(/\s+/g, '_') || 'Unknown';
      a.download = `${sanitizedDisease}_Risk_Report_${timestamp}.pdf`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ PDF downloaded successfully');

    } catch (error) {
      console.error('❌ PDF export failed:', error);
      setPdfError((error as Error).message);
      alert(`PDF Export Failed: ${(error as Error).message}\n\nPlease try again or use "Export Excel" instead.`);
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // ✅ Fallback: Local PDF export (simple version without SHAP)
  const exportPDFLocal = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Hospital Readmission Prediction Results', 14, 20);

    // Metadata
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Predictions: ${results.length}`, 14, 34);
    if (disease) {
      doc.text(`Disease Type: ${disease}`, 14, 40);
    }

    // Create table data
    const tableData = results.map(result => [
      result.no,
      result.patientId || `P-${result.no.toString().padStart(5, '0')}`,
      result.risk,
      `${(result.probability * 100).toFixed(1)}%`,
      result.reasons.slice(0, 2).join('; '),
      result.interpretation?.substring(0, 50) || 'N/A'
    ]);

    // Add table
    autoTable(doc, {
      head: [['No.', 'Patient ID', 'Risk', 'Probability', 'Top Factors', 'Interpretation']],
      body: tableData,
      startY: disease ? 46 : 40,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 18 },
        3: { cellWidth: 20 },
        4: { cellWidth: 50 },
        5: { cellWidth: 65 }
      }
    });

    doc.save(`${fileName}_predictions_local.pdf`);
  };

  // Excel export
  const exportToExcel = () => {
    const excelData = results.map(result => ({
      'No.': result.no,
      'Patient ID': result.patientId || `P-${result.no.toString().padStart(5, '0')}`,
      'Risk Level': result.risk,
      'Probability': `${(result.probability * 100).toFixed(1)}%`,
      'Predicted Class': result.predictedClass || 'N/A',
      'Contributing Factors': result.reasons.join(', '),
      'Interpretation': result.interpretation || 'N/A',
      'Recommendation': result.recommendation || ''
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ML Predictions');

    ws['!cols'] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 50 },
      { wch: 60 },
      { wch: 60 }
    ];

    XLSX.writeFile(wb, `${fileName}_ML_predictions.xlsx`);
  };

  if (results.length === 0) {
    return null;
  }

  const highRisk = results.filter(r => r.risk === 'High').length;
  const mediumRisk = results.filter(r => r.risk === 'Medium').length;
  const lowRisk = results.filter(r => r.risk === 'Low').length;

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              ML Prediction Results
            </CardTitle>
            <CardDescription>
              Showing {results.length} patient prediction{results.length !== 1 ? 's' : ''} from XGBoost model
            </CardDescription>
            {disease && (
              <p className="text-xs text-gray-500 mt-1">
                Disease Type: <span className="font-semibold">{disease}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportPDFFromBackend}
              variant="default"
              size="sm"
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={isDownloadingPDF}
              title={!originalFile ? 'Upload a file first to enable professional PDF export' : 'Download professional PDF report with SHAP analysis'}
            >
              {isDownloadingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  {originalFile ? 'Export PDF Report' : 'PDF Report (Upload Required)'}
                </>
              )}
            </Button>

            {/* Excel Export */}
            <Button
              onClick={exportToExcel}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Error Alert */}
        {pdfError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>PDF Export Failed:</strong> {pdfError}
              <br />
              <span className="text-sm mt-2 block">
                Please try again or use "Export Excel" instead.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600 font-medium">High Risk</p>
            <p className="text-2xl font-bold text-red-700">{highRisk}</p>
            <p className="text-xs text-red-500">{((highRisk / results.length) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-600 font-medium">Medium Risk</p>
            <p className="text-2xl font-bold text-yellow-700">{mediumRisk}</p>
            <p className="text-xs text-yellow-500">{((mediumRisk / results.length) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-600 font-medium">Low Risk</p>
            <p className="text-2xl font-bold text-green-700">{lowRisk}</p>
            <p className="text-xs text-green-500">{((lowRisk / results.length) * 100).toFixed(1)}%</p>
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="text-left p-3 font-semibold text-gray-700">No.</th>
                <th className="text-left p-3 font-semibold text-gray-700">Patient ID</th>
                <th className="text-left p-3 font-semibold text-gray-700">Risk Level</th>
                <th className="text-left p-3 font-semibold text-gray-700">Probability</th>
                <th className="text-left p-3 font-semibold text-gray-700">Contributing Factors</th>
                <th className="text-left p-3 font-semibold text-gray-700">Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.no} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 text-gray-900">{result.no}</td>
                  <td className="p-3 text-gray-900 font-medium">
                    {result.patientId || `P-${result.no.toString().padStart(5, '0')}`}
                  </td>
                  <td className="p-3">
                    <Badge variant={getRiskColor(result.risk) as any}>
                      {result.risk}
                    </Badge>
                  </td>
                  <td className="p-3 text-gray-900">
                    {(result.probability * 100).toFixed(1)}%
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {result.reasons.join(', ')}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {result.interpretation || (
                      <span className="text-gray-400 italic">
                        {result.risk === 'High' ? 'High readmission risk detected' : 
                         result.risk === 'Medium' ? 'Moderate readmission risk' : 
                         'Low readmission risk'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
