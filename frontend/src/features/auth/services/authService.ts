const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
  userType?: 'admin' | 'user'; // Add user type selection
}

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    admin?: {
      id: string;
      name: string;
      email: string;
      role: string;
      lastLogin: string;
    };
    user?: {
      id: string;
      name: string;
      email: string;
      createdAt: string;
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

interface SignupCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface SignupResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: {
      id: string;
      name: string;
      email: string;
      createdAt: string;
    };
  };
}

interface AvailabilityCheck {
  email?: string;
  name?: string;
}

interface AvailabilityResponse {
  success: boolean;
  data?: {
    email?: {
      available: boolean;
      message: string;
    };
    name?: {
      available: boolean;
      message: string;
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
      // Default to admin login if no userType specified
      const userType = credentials.userType || 'admin';
      const endpoint = userType === 'admin' ? '/auth/admin/login' : '/auth/user/login';
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

      // Store user data
      const userData = data.data?.admin || data.data?.user;
      if (userData) {
        const userInfo = {
          ...userData,
          userType: userType,
        };
        localStorage.setItem('user', JSON.stringify(userInfo));
      }

      return data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Network error. Please try again.');
    }
  }

  async logout(): Promise<void> {
    try {
      // Call backend logout endpoint
      const token = this.getToken();
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear storage regardless of API call result
      localStorage.removeItem('authToken');
      sessionStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
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

  async signup(credentials: SignupCredentials): Promise<SignupResponse> {
    try {
      if (credentials.password !== credentials.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const response = await fetch(`${API_BASE_URL}/auth/user/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: credentials.name.trim(),
          email: credentials.email.trim(),
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      // Store the token and user data
      if (data.data?.token) {
        localStorage.setItem('authToken', data.data.token);
        
        const userInfo = {
          ...data.data.user,
          userType: 'user',
        };
        localStorage.setItem('user', JSON.stringify(userInfo));
      }

      return data;
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Network error. Please try again.');
    }
  }

  async checkAvailability(check: AvailabilityCheck): Promise<AvailabilityResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/check-availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(check),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to check availability');
      }

      return data;
    } catch (error: any) {
      console.error('Check availability error:', error);
      throw new Error(error.message || 'Failed to check availability');
    }
  }

  getToken(): string | null {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
  }

  getUser(): any {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  getUserType(): 'admin' | 'user' | null {
    const user = this.getUser();
    return user?.userType || user?.role === 'superadmin' || user?.role === 'admin' ? 'admin' : 'user';
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