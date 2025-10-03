import React from 'react';
import { SignupForm } from '@/features/auth/components/SignupForm';
import { Navigate } from 'react-router-dom';
import { authService } from '@/features/auth/services/authService';

export const SignupPage: React.FC = () => {
  if (authService.isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <SignupForm />
        </div>
      </div>
    </div>
  );
};