export interface PatientFormData {
  patientId: string;
  fullName: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  admissionDate: string;
  dischargeDate: string;
  admissionType: 'Emergency' | 'Urgent' | 'Elective';
  primaryDiagnosis: string;
  secondaryDiagnoses: string;
  numberOfProcedures: number;
  numberOfMedications: number;
  bloodPressure: string;
  glucoseLevel: number;
  a1cResult: number;
  weight: number;
  bmi: number;
  notes: string;
}

export interface PredictionResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  riskScore: number;
  recommendation: string;
  predictedAt: string;
}

export interface SavedEntry extends PatientFormData {
  id: string;
  prediction?: PredictionResult;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const initialFormData: PatientFormData = {
  patientId: '',
  fullName: '',
  age: 0,
  gender: 'Male',
  admissionDate: '',
  dischargeDate: '',
  admissionType: 'Elective',
  primaryDiagnosis: '',
  secondaryDiagnoses: '',
  numberOfProcedures: 0,
  numberOfMedications: 0,
  bloodPressure: '',
  glucoseLevel: 0,
  a1cResult: 0,
  weight: 0,
  bmi: 0,
  notes: '',
};

export const sampleData: PatientFormData = {
  patientId: 'P-12345',
  fullName: 'John Doe',
  age: 65,
  gender: 'Male',
  admissionDate: '2025-01-10',
  dischargeDate: '2025-01-15',
  admissionType: 'Emergency',
  primaryDiagnosis: 'Acute Myocardial Infarction',
  secondaryDiagnoses: 'Hypertension, Type 2 Diabetes, Chronic Kidney Disease',
  numberOfProcedures: 2,
  numberOfMedications: 8,
  bloodPressure: '140/90',
  glucoseLevel: 180,
  a1cResult: 7.5,
  weight: 85,
  bmi: 28.5,
  notes: 'Patient has history of non-compliance with medication regimen. Lives alone with limited family support.',
};
