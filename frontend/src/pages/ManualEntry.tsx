import React, { useEffect } from 'react';
import { 
  FileText, User, Calendar, Stethoscope, Activity, 
  AlertCircle, CheckCircle2, TrendingUp, Save, 
  RefreshCw, Database, FileDown, Trash2, Clock 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/Navbar';
import { useManualEntry } from '@/features/manual-entry/hooks/useManualEntry';
import { authService } from '@/features/auth/services/authService';

export const ManualEntryPage: React.FC = () => {
  const {
    formData,
    prediction,
    recentEntries,
    status,
    error,
    updateField,
    predictReadmission,
    saveEntry,
    loadSampleData,
    resetForm,
    loadRecentEntries,
    deleteEntry,
    exportReport,
  } = useManualEntry();

  const user = authService.getUser();
  const userRole = user?.role || 'nurse';

  const canSave = userRole === 'doctor' || userRole === 'admin' || userRole === 'superadmin';
  const canDelete = userRole === 'admin' || userRole === 'superadmin';

  useEffect(() => {
    loadRecentEntries();
  }, [loadRecentEntries]);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    await predictReadmission();
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'success';
      default: return 'secondary';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'High': return <AlertCircle className="w-5 h-5" />;
      case 'Medium': return <TrendingUp className="w-5 h-5" />;
      case 'Low': return <CheckCircle2 className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            Manual Data Entry
          </h1>
          <p className="text-gray-600">
            Enter patient information manually for readmission risk prediction
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handlePredict}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Patient Demographics
                  </CardTitle>
                  <CardDescription>
                    Basic patient information and admission details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="patientId">Patient ID *</Label>
                      <Input
                        id="patientId"
                        value={formData.patientId}
                        onChange={(e) => updateField('patientId', e.target.value)}
                        placeholder="P-12345"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        placeholder="Joshua Co"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="age">Age *</Label>
                      <Input
                        id="age"
                        type="number"
                        value={formData.age || ''}
                        onChange={(e) => updateField('age', parseInt(e.target.value) || 0)}
                        placeholder="65"
                        min="0"
                        max="120"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <select
                        id="gender"
                        value={formData.gender}
                        onChange={(e) => updateField('gender', e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        required
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="admissionDate">Admission Date *</Label>
                      <Input
                        id="admissionDate"
                        type="date"
                        value={formData.admissionDate}
                        onChange={(e) => updateField('admissionDate', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dischargeDate">Discharge Date *</Label>
                      <Input
                        id="dischargeDate"
                        type="date"
                        value={formData.dischargeDate}
                        onChange={(e) => updateField('dischargeDate', e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="admissionType">Admission Type *</Label>
                      <select
                        id="admissionType"
                        value={formData.admissionType}
                        onChange={(e) => updateField('admissionType', e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        required
                      >
                        <option value="Emergency">Emergency</option>
                        <option value="Urgent">Urgent</option>
                        <option value="Elective">Elective</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-green-600" />
                    Diagnosis Information
                  </CardTitle>
                  <CardDescription>
                    Medical diagnoses and treatment details
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryDiagnosis">Primary Diagnosis *</Label>
                    <Input
                      id="primaryDiagnosis"
                      value={formData.primaryDiagnosis}
                      onChange={(e) => updateField('primaryDiagnosis', e.target.value)}
                      placeholder="e.g., Acute Myocardial Infarction"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secondaryDiagnoses">Secondary Diagnoses</Label>
                    <textarea
                      id="secondaryDiagnoses"
                      value={formData.secondaryDiagnoses}
                      onChange={(e) => updateField('secondaryDiagnoses', e.target.value)}
                      placeholder="e.g., Hypertension, Type 2 Diabetes, Chronic Kidney Disease (comma-separated)"
                      className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numberOfProcedures">Number of Procedures</Label>
                      <Input
                        id="numberOfProcedures"
                        type="number"
                        value={formData.numberOfProcedures || ''}
                        onChange={(e) => updateField('numberOfProcedures', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="numberOfMedications">Number of Medications</Label>
                      <Input
                        id="numberOfMedications"
                        type="number"
                        value={formData.numberOfMedications || ''}
                        onChange={(e) => updateField('numberOfMedications', parseInt(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-600" />
                    Clinical Data
                  </CardTitle>
                  <CardDescription>
                    Vital signs and laboratory results
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bloodPressure">Blood Pressure</Label>
                      <Input
                        id="bloodPressure"
                        value={formData.bloodPressure}
                        onChange={(e) => updateField('bloodPressure', e.target.value)}
                        placeholder="120/80"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="glucoseLevel">Glucose Level (mg/dL)</Label>
                      <Input
                        id="glucoseLevel"
                        type="number"
                        value={formData.glucoseLevel || ''}
                        onChange={(e) => updateField('glucoseLevel', parseFloat(e.target.value) || 0)}
                        placeholder="100"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="a1cResult">A1C Result (%)</Label>
                      <Input
                        id="a1cResult"
                        type="number"
                        step="0.1"
                        value={formData.a1cResult || ''}
                        onChange={(e) => updateField('a1cResult', parseFloat(e.target.value) || 0)}
                        placeholder="5.7"
                        min="0"
                        max="15"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        value={formData.weight || ''}
                        onChange={(e) => updateField('weight', parseFloat(e.target.value) || 0)}
                        placeholder="70"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="bmi">BMI</Label>
                      <Input
                        id="bmi"
                        type="number"
                        step="0.1"
                        value={formData.bmi || ''}
                        onChange={(e) => updateField('bmi', parseFloat(e.target.value) || 0)}
                        placeholder="25.0"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Additional Notes</Label>
                    <textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => updateField('notes', e.target.value)}
                      placeholder="Any additional relevant information about the patient's condition, social factors, or concerns..."
                      className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap gap-3 mt-6">
                <Button
                  type="submit"
                  disabled={status === 'predicting'}
                  className="flex items-center gap-2"
                >
                  {status === 'predicting' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Predicting...
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4" />
                      Predict Readmission
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  onClick={loadSampleData}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Database className="w-4 h-4" />
                  Use Sample Data
                </Button>

                <Button
                  type="button"
                  onClick={resetForm}
                  variant="ghost"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Form
                </Button>
              </div>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
          </div>

          <div className="space-y-6">
            {prediction && (
              <Card className={`border-2 ${
                prediction.riskLevel === 'High' ? 'border-red-200 bg-red-50' :
                prediction.riskLevel === 'Medium' ? 'border-yellow-200 bg-yellow-50' :
                'border-green-200 bg-green-50'
              }`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getRiskIcon(prediction.riskLevel)}
                    Prediction Result
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <Badge 
                      variant={getRiskColor(prediction.riskLevel) as any}
                      className="text-lg px-4 py-2"
                    >
                      {prediction.riskLevel} Risk
                    </Badge>
                    <p className="text-3xl font-bold mt-3">
                      {(prediction.riskScore * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-600 mt-1">Readmission Probability</p>
                  </div>

                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Recommendation</h4>
                    <p className="text-sm text-gray-700">{prediction.recommendation}</p>
                  </div>

                  <div className="flex gap-2">
                    {canSave && (
                      <Button
                        onClick={saveEntry}
                        disabled={status === 'saving'}
                        className="flex-1 flex items-center justify-center gap-2"
                        variant="default"
                      >
                        {status === 'saving' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Record
                          </>
                        )}
                      </Button>
                    )}

                    <Button
                      onClick={exportReport}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      Export
                    </Button>
                  </div>

                  {!canSave && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        Only doctors and admins can save records
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Recent Entries
                </CardTitle>
                <CardDescription>Last 5 manual entries</CardDescription>
              </CardHeader>
              <CardContent>
                {recentEntries.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No recent entries
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recentEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">
                              {entry.fullName}
                            </p>
                            <p className="text-xs text-gray-600">{entry.patientId}</p>
                            {entry.prediction && (
                              <Badge
                                variant={getRiskColor(entry.prediction.riskLevel) as any}
                                className="mt-1 text-xs"
                              >
                                {entry.prediction.riskLevel}
                              </Badge>
                            )}
                          </div>
                          {canDelete && (
                            <Button
                              onClick={() => deleteEntry(entry.id)}
                              variant="ghost"
                              size="sm"
                              className="ml-2 h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-sm">Quick Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-gray-700">
                <p>• Fill in all required fields (*) before predicting</p>
                <p>• Use accurate clinical data for better predictions</p>
                <p>• Sample data is available for testing</p>
                <p>• Nurses can predict but cannot save records</p>
                <p>• Admins have full access to all features</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
