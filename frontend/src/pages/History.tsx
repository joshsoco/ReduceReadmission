import React from 'react';
import { History as HistoryIcon, Clock, FileSpreadsheet, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/Navbar';

export const HistoryPage: React.FC = () => {
  const historyItems = [
    {
      id: 1,
      fileName: 'patients_data_oct_2025.xlsx',
      uploadDate: '2025-10-15',
      uploadTime: '14:30',
      recordCount: 156,
      highRiskCount: 23,
      status: 'completed',
      accuracy: 94.2,
    },
    {
      id: 2,
      fileName: 'batch_analysis_september.xlsx',
      uploadDate: '2025-09-28',
      uploadTime: '10:15',
      recordCount: 203,
      highRiskCount: 31,
      status: 'completed',
      accuracy: 93.8,
    },
    {
      id: 3,
      fileName: 'weekly_patient_data_w40.xlsx',
      uploadDate: '2025-10-08',
      uploadTime: '09:45',
      recordCount: 89,
      highRiskCount: 12,
      status: 'completed',
      accuracy: 95.1,
    },
    {
      id: 4,
      fileName: 'emergency_admissions_oct.xlsx',
      uploadDate: '2025-10-12',
      uploadTime: '16:20',
      recordCount: 67,
      highRiskCount: 18,
      status: 'completed',
      accuracy: 92.5,
    },
    {
      id: 5,
      fileName: 'patient_cohort_q4.xlsx',
      uploadDate: '2025-10-01',
      uploadTime: '11:30',
      recordCount: 421,
      highRiskCount: 67,
      status: 'completed',
      accuracy: 94.7,
    },
  ];

  const stats = [
    {
      label: 'Total Uploads',
      value: '127',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      color: 'blue',
    },
    {
      label: 'Total Records',
      value: '8,456',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'green',
    },
    {
      label: 'Avg Accuracy',
      value: '94.2%',
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'purple',
    },
    {
      label: 'High Risk Cases',
      value: '892',
      icon: <AlertCircle className="w-5 h-5" />,
      color: 'red',
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

        {}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div
                    className={`
                      p-3 rounded-lg
                      ${stat.color === 'blue' && 'bg-blue-50 text-blue-600'}
                      ${stat.color === 'green' && 'bg-green-50 text-green-600'}
                      ${stat.color === 'purple' && 'bg-purple-50 text-purple-600'}
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

        {}
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>
              Your most recent data uploads and predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {}
                    <div className="flex items-start gap-3 flex-1">
                      <div className="p-2 bg-blue-50 rounded-lg">
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
                        </div>
                      </div>
                    </div>

                    {}
                    <div className="flex gap-6 text-sm">
                      <div>
                        <p className="text-gray-600">Records</p>
                        <p className="font-semibold text-gray-900">{item.recordCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">High Risk</p>
                        <p className="font-semibold text-red-600">{item.highRiskCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Accuracy</p>
                        <p className="font-semibold text-green-600">{item.accuracy}%</p>
                      </div>
                    </div>

                    {}
                    <div className="flex items-center gap-3">
                      <Badge variant="success" className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Completed
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {}
            {historyItems.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <HistoryIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="font-medium">No upload history yet</p>
                <p className="text-sm mt-2">
                  Your uploaded files and predictions will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
