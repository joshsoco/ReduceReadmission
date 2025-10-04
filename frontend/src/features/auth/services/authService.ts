const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    admin: {
      id: string;
      name: string;
      email: string;
      role: string;
      lastLogin: string;
    };
  };
}

interface UserProfile {
  success: boolean;
  data?: {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      userType: string;
      isActive: boolean;
      createdAt: string;
      lastLogin?: string;
    };
  };
}

class AuthService {
  private getAuthHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store the token based on remember me preference
      if (data.data?.token) {
        if (credentials.rememberMe) {
          localStorage.setItem('authToken', data.data.token);
        } else {
          sessionStorage.setItem('authToken', data.data.token);
        }
      }

      // Store admin data
      if (data.data?.admin) {
        const adminInfo = {
          ...data.data.admin,
          userType: 'Admin',
        };
        localStorage.setItem('user', JSON.stringify(adminInfo));
      }

      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Network error. Please try again.');
    }
  }

// ...existing code...

  async logout(): Promise<void> {
    // For JWT-based auth, we don't actually need to call the backend
    // Just clear the client-side storage since JWTs are stateless
    this.clearStorage();
    console.log('User logged out successfully');
  }

  async logoutWithServerCall(): Promise<void> {
    try {
      // Call backend logout endpoint if you need server-side logout tracking
      const token = this.getToken();
      if (token) {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
        
        if (!response.ok) {
          console.warn(`Logout API returned ${response.status}: ${response.statusText}`);
        }
      }
    } catch (error) {
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear storage regardless of API call result
      this.clearStorage();
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }


  async getCurrentUser(): Promise<UserProfile> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get user profile');
      }

      // Update stored user data
      if (data.data?.user) {
        localStorage.setItem('user', JSON.stringify(data.data.user));
      }

      return data;
    } catch (error: any) {
      console.error('Get current user error:', error);
      throw new Error(error.message || 'Failed to fetch user profile');
    }
  }

  async refreshToken(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Token refresh failed');
      }

      if (data.data?.token) {
        // Update token in the same storage where it was originally stored
        if (localStorage.getItem('authToken')) {
          localStorage.setItem('authToken', data.data.token);
        } else if (sessionStorage.getItem('authToken')) {
          sessionStorage.setItem('authToken', data.data.token);
        }
      }
    } catch (error: any) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      this.logout();
      throw new Error(error.message || 'Session expired. Please login again.');
    }
  }

  getToken(): string | null {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  getUser(): any {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Basic token validation - check if it's not expired
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      
      if (payload.exp < currentTime) {
        // Token is expired, clear it
        this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      // Invalid token format
      this.logout();
      return false;
    }
  }

  isAdmin(): boolean {
    const user = this.getUser();
    return user?.userType === 'Admin' || user?.role === 'admin' || user?.role === 'superadmin';
  }

  isSuperAdmin(): boolean {
    const user = this.getUser();
    return user?.role === 'superadmin';
  }
}

export const authService = new AuthService();