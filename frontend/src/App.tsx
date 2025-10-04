import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoutes';
import { authService } from '@/features/auth/services/authService';

// Admin Dashboard component
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple logout calls
    
    setIsLoggingOut(true);
    
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
      // Even if logout fails on backend, we should still clear local storage
    } finally {
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  const user = authService.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-blue-900 mb-2">Admin Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.name}!</p>
              <p className="text-sm text-gray-500">Role: {user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold py-2 px-4 rounded transition duration-200"
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
          <p className="text-gray-600 text-lg text-center mt-4">
            Hospital Readmission Admin Panel - Manage your system efficiently
          </p>
          
          {/* Admin Actions */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">User Management</h3>
              <p className="text-blue-700 text-sm">Manage system users and permissions</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">System Settings</h3>
              <p className="text-green-700 text-sm">Configure application settings</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">Analytics</h3>
              <p className="text-purple-700 text-sm">View system analytics and reports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        
        {/* Redirect root to login or dashboard based on auth status */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* 404 Not Found - redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;