import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Navbar } from '@/components/Navbar';
import { settingsService } from '@/features/settings/services/settingsService';
import { authService } from '@/features/auth/services/authService';

export const SettingsPage: React.FC = () => {
  const user = authService.getUser();

  // Profile display state (read-only)
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    role: '',
    lastLogin: '',
    createdAt: ''
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // UI state
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoadingProfile(true);
      const response = await settingsService.getSettings();
      if (response.success && response.data) {
        setProfileData({
          name: response.data.name || '',
          email: response.data.email || '',
          role: response.data.role || '',
          lastLogin: response.data.lastLogin || '',
          createdAt: response.data.createdAt || ''
        });
      }
    } catch (error: any) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsLoadingPassword(true);

    try {
      const response = await settingsService.changePassword(passwordData);
      
      if (response.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully' });
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error: any) {
      setPasswordMessage({ type: 'error', text: error.message || 'Failed to change password' });
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">View your account information and change your password</p>
        </div>

        <div className="space-y-6">
          {/* Profile Information (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your account details (read-only)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProfile ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-600">Full Name</Label>
                    <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900">{profileData.name || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600">Email Address</Label>
                    <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900">{profileData.email || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600">Role</Label>
                    <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 capitalize">{profileData.role || user?.role || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600">Last Login</Label>
                    <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 text-sm">{formatDate(profileData.lastLogin)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600">Account Created</Label>
                    <div className="px-3 py-2 bg-gray-50 rounded-md border border-gray-200">
                      <p className="text-gray-900 text-sm">{formatDate(profileData.createdAt)}</p>
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Profile information cannot be edited. Contact system administrator for changes.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Password Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-600" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    disabled={isLoadingPassword}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Enter new password"
                    disabled={isLoadingPassword}
                    required
                  />
                  <p className="text-xs text-gray-500">Minimum 6 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    disabled={isLoadingPassword}
                    required
                  />
                </div>

                {passwordMessage && (
                  <Alert variant={passwordMessage.type === 'error' ? 'destructive' : 'default'}>
                    {passwordMessage.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>{passwordMessage.text}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isLoadingPassword}
                  className="w-full"
                >
                  {isLoadingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Change Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-green-600" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Status</span>
                  <span className="font-medium text-green-600 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Active
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Account Type</span>
                  <span className="font-medium">{user?.userType || 'Admin'}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-600">Access Level</span>
                  <span className="font-medium capitalize">{user?.role || 'Admin'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};