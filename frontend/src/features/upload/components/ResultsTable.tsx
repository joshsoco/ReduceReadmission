import React from 'react';
import { Download, FileDown, Brain } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PredictionResult {
  no: number;
  patientId?: string;
  risk: 'High' | 'Medium' | 'Low';
  probability: number;
  reasons: string[];
  riskScore?: number;
  recommendation?: string;
  predictedClass?: number;
}

interface ResultsTableProps {
  results: PredictionResult[];
  fileName?: string;
  disease?: string;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ results, fileName = 'predictions', disease }) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'High':
        return 'destructive';
      case 'Medium':
        return 'secondary';
      case 'Low':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Hospital Readmission Prediction Results', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Predictions: ${results.length}`, 14, 34);
    if (disease) {
      doc.text(`Disease Type: ${disease}`, 14, 40);
    }

    const tableData = results.map(result => [
      result.no,
      result.patientId || `P-${result.no.toString().padStart(5, '0')}`,
      result.risk,
      `${(result.probability * 100).toFixed(1)}%`,
      result.riskScore?.toFixed(3) || 'N/A',
      result.reasons.join('; ')
    ]);

    autoTable(doc, {
      head: [['No.', 'Patient ID', 'Risk', 'Probability', 'Score', 'Factors']],
      body: tableData,
      startY: disease ? 46 : 40,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 'auto' }
      }
    });

    doc.save(`${fileName}_ML_predictions.pdf`);
  };

  const exportToExcel = () => {
    const excelData = results.map(result => ({
      'No.': result.no,
      'Patient ID': result.patientId || `P-${result.no.toString().padStart(5, '0')}`,
      'Risk Level': result.risk,
      'Probability': `${(result.probability * 100).toFixed(1)}%`,
      'Risk Score': result.riskScore?.toFixed(3) || 'N/A',
      'Predicted Class': result.predictedClass || 'N/A',
      'Contributing Factors': result.reasons.join(', '),
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
      { wch: 12 },
      { wch: 50 },
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
              Showing {results.length} patient prediction{results.length !== 1 ? 's' : ''} from XGBoost machine learning model
            </CardDescription>
            {disease && (
              <p className="text-xs text-gray-500 mt-1">
                Disease Type: <span className="font-semibold">{disease}</span>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportToPDF}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </Button>
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
                <th className="text-left p-3 font-semibold text-gray-700">Score</th>
                <th className="text-left p-3 font-semibold text-gray-700">Contributing Factors</th>
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
                  <td className="p-3 text-gray-900">
                    {result.riskScore?.toFixed(3) || 'N/A'}
                  </td>
                  <td className="p-3 text-sm text-gray-600">
                    {result.reasons.join(', ')}
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
