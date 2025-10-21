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
  // TODO: Add these fields when ML backend is ready
  // riskScore?: number;
  // recommendation?: string;
  // confidence?: number;
}

interface ResultsTableProps {
  results: PredictionResult[];
  fileName?: string;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({ results, fileName = 'predictions' }) => {
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
    // TODO: Add ML model info when ready
    // doc.text(`ML Model: [Model Name] v[Version]`, 14, 40);

    const tableData = results.map(result => [
      result.no,
      result.patientId || `P-${result.no.toString().padStart(5, '0')}`,
      result.risk,
      `${(result.probability * 100).toFixed(1)}%`,
      result.reasons.join('; ')
      // TODO: Add risk score and recommendation columns
      // result.riskScore?.toFixed(2),
      // result.recommendation
    ]);

    autoTable(doc, {
      head: [['No.', 'Patient ID', 'Risk', 'Probability', 'Reasons']], // TODO: Add 'Score', 'Recommendation'
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 'auto' }
      }
    });

    doc.save(`${fileName}_AI_predictions.pdf`);
  };

  const exportToExcel = () => {
    const excelData = results.map(result => ({
      'No.': result.no,
      'Patient ID': result.patientId || `P-${result.no.toString().padStart(5, '0')}`,
      'Risk Level': result.risk,
      'Probability': `${(result.probability * 100).toFixed(1)}%`,
      'Contributing Factors': result.reasons.join(', ')
      // TODO: Add these columns when ML backend is ready
      // 'Risk Score': result.riskScore,
      // 'Recommendation': result.recommendation,
      // 'Confidence': result.confidence
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AI Predictions');

    ws['!cols'] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 50 }
      // TODO: Add widths for new columns
    ];

    XLSX.writeFile(wb, `${fileName}_AI_predictions.xlsx`);
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              AI Prediction Results
            </CardTitle>
            <CardDescription>
              Showing {results.length} patient prediction{results.length !== 1 ? 's' : ''} from machine learning analysis
            </CardDescription>
            {/* TODO: Add model info when ready */}
            {/* <p className="text-xs text-gray-500 mt-1">
              Model: [Model Name] | Accuracy: [XX]% | Last Updated: [Date]
            </p> */}
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">No.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Patient ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Risk</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Probability</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contributing Factors</th>
                {/* TODO: Add these columns when ML backend is ready */}
                {/* <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Score</th> */}
                {/* <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Recommendation</th> */}
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={result.no} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-900">{result.no}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {result.patientId || `P-${result.no.toString().padStart(5, '0')}`}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getRiskColor(result.risk) as any}>
                      {result.risk}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {(result.probability * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <ul className="list-disc list-inside space-y-1">
                      {result.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </td>
                  {/* TODO: Add these cells when ML backend is ready */}
                  {/* <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {result.riskScore?.toFixed(2)}
                  </td> */}
                  {/* <td className="px-4 py-3 text-sm text-gray-600">
                    {result.recommendation}
                  </td> */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
