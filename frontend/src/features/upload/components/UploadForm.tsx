import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  File,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Database,
  Loader2,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUploadViewModel } from '../hooks/useUploadViewModel';
import { FileModel } from '../models/fileModel';

interface UploadFormProps {
  onUploadSuccess?: (data: any, fileName: string) => void;
}

export const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess }) => {
  const navigate = useNavigate();
  const {
    status,
    file,
    excelData,
    validationResult,
    uploadResponse,
    error,
    isDragging,
    apiStatus,
    fileInputRef,
    handleFileSelect,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    openFilePicker,
    uploadFile,
    useSampleData,
    downloadTemplate,
    reset,
  } = useUploadViewModel();

  useEffect(() => {
    if (status === 'success' && excelData && file && onUploadSuccess) {
      onUploadSuccess(excelData, file.name);
    }
  }, [status, excelData, file, onUploadSuccess]);

  const isProcessing = status === 'validating' || status === 'reading' || status === 'uploading';

  return (
    <div className="space-y-6">
      {}
      <div className="flex justify-end">
        <Badge
          variant={apiStatus.isConnected ? 'success' : 'destructive'}
          className="flex items-center gap-2"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              apiStatus.isConnected ? 'bg-white animate-pulse' : 'bg-white'
            }`}
          />
          {apiStatus.message}
        </Badge>
      </div>

      {}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            Upload Patient Data
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xls or .xlsx) containing patient readmission data for analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-all duration-200 ease-in-out
              ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }
              ${isProcessing ? 'pointer-events-none opacity-50' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />

            <div className="flex flex-col items-center gap-4">
              {isProcessing ? (
                <>
                  <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-700">
                      {status === 'validating' && 'Validating file...'}
                      {status === 'reading' && 'Reading Excel file...'}
                      {status === 'uploading' && 'Uploading data...'}
                    </p>
                    <Progress value={status === 'uploading' ? 75 : 50} className="w-64" />
                  </div>
                </>
              ) : (
                <>
                  <div className="relative">
                    <Upload className="w-16 h-16 text-gray-400" />
                    {isDragging && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Upload className="w-16 h-16 text-blue-500 animate-bounce" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-700">
                      {isDragging ? 'Drop your file here' : 'Drag and drop your Excel file here'}
                    </p>
                    <p className="text-sm text-gray-500">or click to browse files</p>
                    <p className="text-xs text-gray-400">
                      Accepted formats: .xls, .xlsx (Max 10MB)
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {}
          {file && validationResult?.isValid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <File className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-600">
                        {FileModel.formatFileSize(file.size)}
                      </p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  {excelData && (
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>
                        <span className="font-medium">Rows:</span> {excelData.rowCount}
                      </p>
                      <p>
                        <span className="font-medium">Columns:</span> {excelData.headers?.length}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {}
          {status === 'success' && uploadResponse && (
            <Alert className="border-green-200 bg-green-50 text-green-900">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong>{uploadResponse.message}</strong>
                {uploadResponse.data && (
                  <div className="mt-2 text-sm">
                    <p>File: {uploadResponse.data.fileName}</p>
                    <p>Processed {uploadResponse.data.rowCount} records</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={openFilePicker}
              disabled={isProcessing}
              className="flex items-center gap-2"
              variant="default"
            >
              <Upload className="w-4 h-4" />
              Upload Excel
            </Button>

            <Button
              onClick={useSampleData}
              disabled={isProcessing}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Database className="w-4 h-4" />
              Use Sample Data
            </Button>

            <Button
              onClick={() => navigate('/manual-entry')}
              className="flex items-center gap-2"
              variant="outline"
            >
              <FileText className="w-4 h-4" />
              Manual Entry
            </Button>
          </div>

          {}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              onClick={downloadTemplate}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>

            {(file || status === 'success') && (
              <Button
                onClick={reset}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </Button>
            )}
          </div>

          {}
          {excelData && status === 'idle' && (
            <div className="pt-4">
              <Button
                onClick={uploadFile}
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                <Upload className="w-5 h-5" />
                Process and Analyze Data
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
