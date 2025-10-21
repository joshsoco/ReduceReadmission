import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Info,
  History as HistoryIcon,
} from 'lucide-react';
import { authService } from '@/features/auth/services/authService';
import { Button } from '@/components/ui/button';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const user = authService.getUser();

  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      name: 'Manual Entry',
      path: '/manual-entry',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      name: 'History',
      path: '/history',
      icon: <HistoryIcon className="w-5 h-5" />,
    },
    {
      name: 'About',
      path: '/about',
      icon: <Info className="w-5 h-5" />,
    },
  ];

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);

    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}> 
           <div className="p-2 rounded-lg">
              <img 
              src="/logo_red.webp" 
              alt="activity icon" 
              className="w-12 h-12 object-contain"
              />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">Hospital Readmission</h1>
              <p className="text-xs text-gray-500">Prediction System</p>
            </div>
          </div>

          {}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200
                  ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                {item.icon}
                <span className="text-sm">{item.name}</span>
              </button>
            ))}
          </div>

          {}
          <div className="hidden md:flex items-center gap-4">
            {}
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
              <div className="bg-blue-600 p-2 rounded-full">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              </div>
            </div>

            {}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
              className="text-gray-600 hover:text-gray-900"
            >
              <Settings className="w-5 h-5" />
            </Button>

            {}
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </Button>
          </div>

          {}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {}
            <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-lg mb-3">
              <div className="bg-blue-600 p-2 rounded-full">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              </div>
            </div>

            {}
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                {item.icon}
                <span className="text-sm">{item.name}</span>
              </button>
            ))}

            {}
            <button
              onClick={() => {
                navigate('/settings');
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <Settings className="w-5 h-5" />
              <span className="text-sm">Settings</span>
            </button>

            {}
            <button
              onClick={() => {
                handleLogout();
                setIsMobileMenuOpen(false);
              }}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};
