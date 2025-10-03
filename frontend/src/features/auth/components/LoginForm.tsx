import React from "react"
import { Eye, EyeOff, Mail, Lock, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useLoginViewModel } from "../hooks/useLoginViewModel"
import { useNavigate } from "react-router-dom"

interface LoginFormProps {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
  className?: string
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onError,
  className = "",
}) => {
  const { viewModel, actions } = useLoginViewModel()
  const [showPassword, setShowPassword] = React.useState(false)
  const [userType, setUserType] = React.useState<'admin' | 'user'>('admin')
  const navigate = useNavigate()

  const handleLoginSuccess = () => {
    navigate("/dashboard", { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await actions.handleLogin(userType)
    if (result.success) {
      onSuccess?.(result.data)
      handleLoginSuccess()
    } else if (result.error) {
      onError?.(result.error)
    }
  }

  return (
    <div className={`w-full max-w-md space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Welcome Login</h1>
        <p className="text-muted-foreground">
          Sign in to your Account to continue
        </p>
      </div>

      {/* User Type Selection */}
      <div className="flex rounded-lg border p-1 bg-muted/50">
        <button
          type="button"
          onClick={() => setUserType('admin')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            userType === 'admin'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Admin Login
        </button>
        <button
          type="button"
          onClick={() => setUserType('user')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all ${
            userType === 'user'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          User Login
        </button>
      </div>

      {/* Error Alert */}
      {viewModel.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            {viewModel.errorMessage ||
              "Login failed. Please check your credentials and try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={viewModel.formData.email}
              onChange={(e) => actions.updateField("email", e.target.value)}
              disabled={viewModel.status === "loading"}
              className="pl-10 pr-10"
            />
          </div>
          {viewModel.validationErrors.email && (
            <p className="text-sm text-destructive">{viewModel.validationErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={viewModel.formData.password}
              onChange={(e) => actions.updateField("password", e.target.value)}
              disabled={viewModel.status === "loading"}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {viewModel.validationErrors.password && (
            <p className="text-sm text-destructive">{viewModel.validationErrors.password}</p>
          )}
        </div>

        {/* Remember & Forgot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="rememberMe"
              checked={viewModel.formData.rememberMe}
              onCheckedChange={(checked) =>
                actions.updateField("rememberMe", !!checked)
              }
              disabled={viewModel.status === "loading"}
            />
            <Label htmlFor="rememberMe" className="text-sm">
              Remember me
            </Label>
          </div>
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={!viewModel.canSubmit || viewModel.status === "loading"}
        >
          {viewModel.status === "loading" ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
              Signing in...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Sign In as {userType === 'admin' ? 'Admin' : 'User'}
            </div>
          )}
        </Button>

        {/* Signup - Only show for user login */}
        {userType === 'user' && (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="font-semibold text-primary hover:underline"
            >
              Sign up
            </button>
          </p>
        )}
      </form>
    </div>
  )
}