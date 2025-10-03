import { useState, useCallback } from 'react';
import { authService } from '../services/authService';

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
}

interface AvailabilityStatus {
  name?: { available: boolean; message: string; checking: boolean };
  email?: { available: boolean; message: string; checking: boolean };
}

type Status = 'idle' | 'loading' | 'success' | 'error';

interface SignupViewModel {
  formData: SignupFormData;
  validationErrors: ValidationErrors;
  availabilityStatus: AvailabilityStatus;
  status: Status;
  errorMessage: string;
  canSubmit: boolean;
}

interface SignupResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useSignupViewModel = () => {
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>({});
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateField = (field: keyof SignupFormData, value: any): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        if (value.trim().length > 50) return 'Name must be less than 50 characters';
        if (!/^[a-zA-Z\s]+$/.test(value.trim())) return 'Name can only contain letters and spaces';
        break;
      
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Invalid email format';
        break;
      
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Password must contain at least one uppercase letter, lowercase letter, and number';
        }
        break;
      
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        break;
      
      case 'agreeToTerms':
        if (!value) return 'You must agree to the terms and conditions';
        break;
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};
    
    Object.keys(formData).forEach((key) => {
      const field = key as keyof SignupFormData;
      const error = validateField(field, formData[field]);
      if (error) errors[field] = error;
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const checkAvailability = useCallback(async (field: 'name' | 'email', value: string) => {
    if (!value.trim()) return;
    
    // Set checking status
    setAvailabilityStatus(prev => ({
      ...prev,
      [field]: { available: false, message: 'Checking...', checking: true }
    }));

    try {
      const response = await authService.checkAvailability({ [field]: value.trim() });
      
      if (response.data?.[field]) {
        setAvailabilityStatus(prev => ({
          ...prev,
          [field]: {
            available: response.data![field]!.available,
            message: response.data![field]!.message,
            checking: false
          }
        }));
      }
    } catch (error: any) {
      setAvailabilityStatus(prev => ({
        ...prev,
        [field]: { available: false, message: 'Failed to check availability', checking: false }
      }));
    }
  }, []);

  const updateField = (field: keyof SignupFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Clear general error message
    if (errorMessage) {
      setErrorMessage('');
    }

    // Check availability for name and email after user stops typing
    if ((field === 'name' || field === 'email') && value.trim()) {
      const timeoutId = setTimeout(() => {
        checkAvailability(field, value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSignup = async (): Promise<SignupResult> => {
    if (!validateForm()) {
      return { success: false, error: 'Please fix the validation errors' };
    }

    // Check if name and email are available
    const nameAvailable = availabilityStatus.name?.available !== false;
    const emailAvailable = availabilityStatus.email?.available !== false;
    
    if (!nameAvailable || !emailAvailable) {
      return { success: false, error: 'Please choose a different name or email' };
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await authService.signup({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      setStatus('success');
      return { success: true, data: response };
    } catch (error: any) {
      setStatus('error');
      const message = error.message || 'Signup failed. Please try again.';
      setErrorMessage(message);
      return { success: false, error: message };
    }
  };

  const canSubmit = Object.values(formData).every(value => 
    typeof value === 'boolean' ? value : value.trim() !== ''
  ) && Object.keys(validationErrors).length === 0;

  const viewModel: SignupViewModel = {
    formData,
    validationErrors,
    availabilityStatus,
    status,
    errorMessage,
    canSubmit,
  };

  const actions = {
    updateField,
    handleSignup,
    checkAvailability,
  };

  return { viewModel, actions };
};