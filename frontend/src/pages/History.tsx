import React, { useEffect, useState, useRef } from 'react';
import { History as HistoryIcon, Clock, FileSpreadsheet, CheckCircle2, AlertCircle, TrendingUp, Loader2, Trash2, MoreVertical, Download, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { historyService, HistoryItem, HistoryStats } from '@/features/history/services/historyService';
import { authService } from '@/features/auth/services/authService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const HistoryPage: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<HistoryStats>({
    totalUploads: 0,
    totalRecords: 0,
    totalHighRisk: 0,
    totalMediumRisk: 0,
    totalLowRisk: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [diseaseFilter, setDiseaseFilter] = useState<string>('all');

  const isLoadingRef = useRef(false);

  const user = authService.getUser();
  const canDelete = user?.role === 'admin' || user?.role === 'superadmin';

  useEffect(() => {
    loadHistory();
  }, [currentPage, diseaseFilter]);

  const loadHistory = async () => {
    if (isLoadingRef.current) {
      console.log('History already loading, skipping duplicate request');
      return;
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const response = await historyService.getHistory(currentPage, 20, diseaseFilter);
      setHistoryItems(response.data.history);
      setStatistics(response.data.statistics);
      setTotalPages(response.data.pagination.totalPages);
    } catch (err) {
      setError((err as Error).message);
      console.error('Error loading history:', err);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    try {
      await historyService.deleteHistory(id);
      await loadHistory();
    } catch (err) {
      alert(`Failed to delete: ${(err as Error).message}`);
    }
  };

  // ✅ NEW: Export individual item to CSV
  const exportItemToCSV = (item: HistoryItem) => {
    const csvData = [{
      'File Name': item.fileName,
      'Upload Date': item.uploadDate,
      'Upload Time': item.uploadTime,
      'Disease': item.disease || 'Unknown',
      'Total Records': item.recordCount,
      'High Risk': item.highRiskCount,
      'Medium Risk': item.mediumRiskCount,
      'Low Risk': item.lowRiskCount,
      'High Risk %': `${((item.highRiskCount / item.recordCount) * 100).toFixed(1)}%`,
      'Medium Risk %': `${((item.mediumRiskCount / item.recordCount) * 100).toFixed(1)}%`,
      'Low Risk %': `${((item.lowRiskCount / item.recordCount) * 100).toFixed(1)}%`
    }];

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Upload Summary');

    // Auto-size columns
    const maxWidth = 20;
    const cols = Object.keys(csvData[0]).map(key => ({
      wch: Math.min(maxWidth, Math.max(key.length, String(csvData[0][key as keyof typeof csvData[0]]).length))
    }));
    ws['!cols'] = cols;

    const sanitizedFileName = item.fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    XLSX.writeFile(wb, `${sanitizedFileName}_summary.csv`, { bookType: 'csv' });
  };

  // ✅ NEW: Export individual item to PDF
  const exportItemToPDF = (item: HistoryItem) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text('Upload Summary Report', 14, 20);

    // File Info
    doc.setFontSize(11);
    doc.setTextColor(75, 85, 99); // gray-600
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`File: ${item.fileName}`, 14, 37);
    doc.text(`Uploaded: ${item.uploadDate} at ${item.uploadTime}`, 14, 44);
    if (item.disease) {
      doc.text(`Disease: ${item.disease}`, 14, 51);
    }

    // Summary Statistics Box
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setFillColor(249, 250, 251); // gray-50
    doc.roundedRect(14, 58, 182, 40, 3, 3, 'FD');

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text('SUMMARY STATISTICS', 20, 66);

    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text(`Total Records: ${item.recordCount}`, 20, 75);

    // Risk breakdown
    const highPct = ((item.highRiskCount / item.recordCount) * 100).toFixed(1);
    const mediumPct = ((item.mediumRiskCount / item.recordCount) * 100).toFixed(1);
    const lowPct = ((item.lowRiskCount / item.recordCount) * 100).toFixed(1);

    doc.setTextColor(220, 38, 38); // red-600
    doc.text(`High Risk: ${item.highRiskCount} (${highPct}%)`, 20, 84);

    doc.setTextColor(245, 158, 11); // orange-500
    doc.text(`Medium Risk: ${item.mediumRiskCount} (${mediumPct}%)`, 85, 84);

    doc.setTextColor(34, 197, 94); // green-500
    doc.text(`Low Risk: ${item.lowRiskCount} (${lowPct}%)`, 150, 84);

    // Risk Distribution Table
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('Risk Distribution', 14, 110);

    const tableData = [
      ['Risk Level', 'Count', 'Percentage', 'Status'],
      [
        'High Risk',
        item.highRiskCount.toString(),
        `${highPct}%`,
        'Requires immediate follow-up'
      ],
      [
        'Medium Risk',
        item.mediumRiskCount.toString(),
        `${mediumPct}%`,
        'Standard monitoring required'
      ],
      [
        'Low Risk',
        item.lowRiskCount.toString(),
        `${lowPct}%`,
        'Routine care adequate'
      ]
    ];

    autoTable(doc, {
      head: [tableData[0]],
      body: tableData.slice(1),
      startY: 115,
      theme: 'grid',
      headStyles: {
        fillColor: [59, 130, 246], // blue-500
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 90 }
      },
      didDrawCell: (data) => {
        // Color-code the risk levels
        if (data.section === 'body' && data.column.index === 0) {
          const riskLevel = data.cell.text[0];
          if (riskLevel === 'High Risk') {
            doc.setFillColor(254, 226, 226); // red-100
          } else if (riskLevel === 'Medium Risk') {
            doc.setFillColor(254, 243, 199); // orange-100
          } else if (riskLevel === 'Low Risk') {
            doc.setFillColor(220, 252, 231); // green-100
          }
        }
      }
    });

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // gray-400
    doc.text('Generated by Hospital Readmission Prediction System', 14, pageHeight - 10);
    doc.text(`Report ID: ${item._id}`, 14, pageHeight - 6);

    // Save
    const sanitizedFileName = item.fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${sanitizedFileName}_summary.pdf`);
  };

  // ...existing export functions for overall stats...
  const exportUploadsToCSV = () => {
    const csvData = historyItems.map(item => ({
      'File Name': item.fileName,
      'Upload Date': item.uploadDate,
      'Upload Time': item.uploadTime,
      'Disease': item.disease || 'Unknown',
      'Total Records': item.recordCount,
      'High Risk': item.highRiskCount,
      'Medium Risk': item.mediumRiskCount,
      'Low Risk': item.lowRiskCount
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Upload History');
    XLSX.writeFile(wb, `upload_history_${new Date().toISOString().split('T')[0]}.csv`, { bookType: 'csv' });
  };

  const exportUploadsToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Upload History Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Uploads: ${statistics.totalUploads}`, 14, 34);
    doc.text(`Total Records Processed: ${statistics.totalRecords}`, 14, 40);
    doc.text(`High Risk Cases: ${statistics.totalHighRisk}`, 14, 46);

    const tableData = historyItems.map(item => [
      item.fileName,
      item.uploadDate,
      item.disease || 'Unknown',
      item.recordCount,
      item.highRiskCount,
      item.mediumRiskCount,
      item.lowRiskCount
    ]);

    autoTable(doc, {
      head: [['File Name', 'Date', 'Disease', 'Records', 'High', 'Medium', 'Low']],
      body: tableData,
      startY: 52,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 15 }
      }
    });

    doc.save(`upload_history_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportRecordsToCSV = () => {
    const csvData = historyItems.map(item => ({
      'File Name': item.fileName,
      'Upload Date': item.uploadDate,
      'Disease': item.disease || 'Unknown',
      'Total Records': item.recordCount
    }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Records Summary');
    XLSX.writeFile(wb, `records_summary_${new Date().toISOString().split('T')[0]}.csv`, { bookType: 'csv' });
  };

  const exportRecordsToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Records Summary Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Records Processed: ${statistics.totalRecords}`, 14, 34);
    doc.text(`Across ${statistics.totalUploads} uploads`, 14, 40);

    const tableData = historyItems.map(item => [
      item.fileName,
      item.uploadDate,
      item.disease || 'Unknown',
      item.recordCount
    ]);

    autoTable(doc, {
      head: [['File Name', 'Date', 'Disease', 'Total Records']],
      body: tableData,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94] },
      styles: { fontSize: 9, cellPadding: 3 }
    });

    doc.save(`records_summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportHighRiskToCSV = () => {
    const csvData = historyItems
      .filter(item => item.highRiskCount > 0)
      .map(item => ({
        'File Name': item.fileName,
        'Upload Date': item.uploadDate,
        'Disease': item.disease || 'Unknown',
        'High Risk Count': item.highRiskCount,
        'Percentage': `${((item.highRiskCount / item.recordCount) * 100).toFixed(1)}%`
      }));

    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'High Risk Cases');
    XLSX.writeFile(wb, `high_risk_cases_${new Date().toISOString().split('T')[0]}.csv`, { bookType: 'csv' });
  };

  const exportHighRiskToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('High Risk Cases Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total High Risk Cases: ${statistics.totalHighRisk}`, 14, 34);
    doc.text(`Across ${statistics.totalUploads} uploads`, 14, 40);

    const tableData = historyItems
      .filter(item => item.highRiskCount > 0)
      .map(item => [
        item.fileName,
        item.uploadDate,
        item.disease || 'Unknown',
        item.highRiskCount,
        `${((item.highRiskCount / item.recordCount) * 100).toFixed(1)}%`
      ]);

    autoTable(doc, {
      head: [['File Name', 'Date', 'Disease', 'High Risk', 'Percentage']],
      body: tableData,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 9, cellPadding: 3 }
    });

    doc.save(`high_risk_cases_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const stats = [
    {
      label: 'Total Uploads',
      value: statistics.totalUploads.toString(),
      icon: <FileSpreadsheet className="w-5 h-5" />,
      color: 'blue',
      exportCSV: exportUploadsToCSV,
      exportPDF: exportUploadsToPDF
    },
    {
      label: 'Total Records',
      value: statistics.totalRecords.toLocaleString(),
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'green',
      exportCSV: exportRecordsToCSV,
      exportPDF: exportRecordsToPDF
    },
    {
      label: 'High Risk Cases',
      value: statistics.totalHighRisk.toLocaleString(),
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'red',
      exportCSV: exportHighRiskToCSV,
      exportPDF: exportHighRiskToPDF
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <HistoryIcon className="w-8 h-8 text-blue-600" />
            Upload History
          </h1>
          <p className="text-gray-600">
            View your past uploads and prediction results
          </p>
        </div>

        {/* Stats Cards with Export Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="relative">
              <CardContent className="p-6">
                <div className="absolute top-4 right-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={stat.exportCSV} className="cursor-pointer">
                        <Download className="w-4 h-4 mr-2" />
                        Download CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={stat.exportPDF} className="cursor-pointer">
                        <FileDown className="w-4 h-4 mr-2" />
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`
                      p-3 rounded-lg
                      ${stat.color === 'blue' && 'bg-blue-50 text-blue-600'}
                      ${stat.color === 'green' && 'bg-green-50 text-green-600'}
                      ${stat.color === 'red' && 'bg-red-50 text-red-600'}
                    `}
                  >
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Uploads Table */}
        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>
                Your most recent data uploads and predictions
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 md:gap-3 px-3 py-2">
              <label
                htmlFor="diseaseFilter"
                className="text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                Filter by Disease:
              </label>
              <select
                id="diseaseFilter"
                value={diseaseFilter}
                onChange={(e) => {
                  setDiseaseFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              >
                <option value="all">All Diseases</option>
                <option value="Type 2 Diabetes">Type 2 Diabetes</option>
                <option value="Pneumonia">Pneumonia</option>
                <option value="Hypertension">Hypertension</option>
                <option value="Chronic Kidney Disease">Chronic Kidney Disease</option>
                <option value="COPD">COPD</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 bg-red-50">
                {error}
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="font-medium">No upload history yet</p>
                <p className="text-sm mt-2">
                  Your uploaded files and predictions will appear here
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {historyItems.map((item) => (
                    <div
                      key={item._id}
                      className="border rounded-xl p-4 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {item.fileName}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {item.uploadDate} at {item.uploadTime}
                              </span>
                              {item.disease && (
                                <Badge variant="outline" className="text-xs capitalize">
                                  {item.disease}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-5">
                          {/* ✅ Risk Statistics - Keep original layout */}
                          <div className="flex items-center gap-5 text-sm">
                            <div className="flex flex-col items-center min-w-[80px]">
                              <p className="text-gray-600">Records</p>
                              <p className="font-semibold text-gray-900">{item.recordCount}</p>
                            </div>
                            <div className="flex flex-col items-center min-w-[80px]">
                              <p className="text-gray-600">High Risk</p>
                              <p className="font-semibold text-red-600">{item.highRiskCount}</p>
                            </div>
                            <div className="flex flex-col items-center min-w-[80px]">
                              <p className="text-gray-600">Medium Risk</p>
                              <p className="font-semibold text-yellow-600">{item.mediumRiskCount}</p>
                            </div>
                            <div className="flex flex-col items-center min-w-[80px]">
                              <p className="text-gray-600">Low Risk</p>
                              <p className="font-semibold text-green-600">{item.lowRiskCount}</p>
                            </div>
                          </div>

                          {/* ✅ Action Buttons: Download Dropdown + Status + Delete */}
                          <div className="flex items-center gap-2">
                            {/* Download Dropdown */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  Export
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => exportItemToPDF(item)}
                                  className="cursor-pointer"
                                >
                                  <FileDown className="w-4 h-4 mr-2 text-red-500" />
                                  PDF Report
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => exportItemToCSV(item)}
                                  className="cursor-pointer"
                                >
                                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" />
                                  CSV Export
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Status Badge */}
                            <Badge variant="success" className="flex items-center gap-1 px-2 py-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </Badge>

                            {/* Delete Button */}
                            {canDelete && (
                              <Button
                                onClick={() => handleDelete(item._id, item.fileName)}
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};