import { useState } from 'react';
import { authService } from '../services/authService';

interface FormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ValidationErrors {
  email?: string;
  password?: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

interface LoginViewModel {
  formData: FormData;
  validationErrors: ValidationErrors;
  status: Status;
  errorMessage: string;
  canSubmit: boolean;
}

interface LoginResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const useLoginViewModel = () => {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field as keyof ValidationErrors]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof ValidationErrors];
        return newErrors;
      });
    }
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleLogin = async (): Promise<LoginResult> => {
    if (!validateForm()) {
      return { success: false, error: 'Validation failed' };
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await authService.login({
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      setStatus('success');
      return { success: true, data: response };
    } catch (error: any) {
      setStatus('error');
      const message = error.message || 'Login failed. Please try again.';
      setErrorMessage(message);
      return { success: false, error: message };
    }
  };

  const canSubmit = formData.email.trim() !== '' && formData.password.trim() !== '';

  const viewModel: LoginViewModel = {
    formData,
    validationErrors,
    status,
    errorMessage,
    canSubmit,
  };

  const actions = {
    updateField,
    handleLogin,
  };

  return { viewModel, actions };
};
