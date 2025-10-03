import React from "react"
import { Eye, EyeOff, Mail, Lock, User, UserPlus, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSignupViewModel } from "../hooks/useSignupViewModel"
import { useNavigate } from "react-router-dom"

interface SignupFormProps {
  onSuccess?: (data: any) => void
  onError?: (error: string) => void
  className?: string
}

export const SignupForm: React.FC<SignupFormProps> = ({
  onSuccess,
  onError,
  className = "",
}) => {
  const { viewModel, actions } = useSignupViewModel()
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)
  const navigate = useNavigate()

  const handleSignupSuccess = () => {
    navigate("/dashboard", { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = await actions.handleSignup()
    if (result.success) {
      onSuccess?.(result.data)
      handleSignupSuccess()
    } else if (result.error) {
      onError?.(result.error)
    }
  }

  const getAvailabilityIcon = (field: 'name' | 'email') => {
    const status = viewModel.availabilityStatus[field]
    if (!status) return null
    
    if (status.checking) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    }
    
    if (status.available) {
      return <Check className="h-4 w-4 text-green-500" />
    } else {
      return <X className="h-4 w-4 text-red-500" />
    }
  }

  const getAvailabilityMessage = (field: 'name' | 'email') => {
    const status = viewModel.availabilityStatus[field]
    if (!status || status.checking) return null
    
    return (
      <p className={`text-xs ${status.available ? 'text-green-600' : 'text-red-600'}`}>
        {status.message}
      </p>
    )
  }

  return (
    <div className={`w-full max-w-md space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Create Account</h1>
        <p className="text-muted-foreground">
          Join us today and get started
        </p>
      </div>

      {/* Error Alert */}
      {viewModel.status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>
            {viewModel.errorMessage ||
              "Signup failed. Please check your information and try again."}
          </AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="Enter your full name"
              value={viewModel.formData.name}
              onChange={(e) => actions.updateField("name", e.target.value)}
              disabled={viewModel.status === "loading"}
              className="pl-10 pr-10"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getAvailabilityIcon('name')}
            </div>
          </div>
          {viewModel.validationErrors.name && (
            <p className="text-sm text-destructive">{viewModel.validationErrors.name}</p>
          )}
          {getAvailabilityMessage('name')}
        </div>

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
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {getAvailabilityIcon('email')}
            </div>
          </div>
          {viewModel.validationErrors.email && (
            <p className="text-sm text-destructive">{viewModel.validationErrors.email}</p>
          )}
          {getAvailabilityMessage('email')}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
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

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={viewModel.formData.confirmPassword}
              onChange={(e) => actions.updateField("confirmPassword", e.target.value)}
              disabled={viewModel.status === "loading"}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {viewModel.validationErrors.confirmPassword && (
            <p className="text-sm text-destructive">{viewModel.validationErrors.confirmPassword}</p>
          )}
        </div>

        {/* Terms Agreement */}
        <div className="space-y-2">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="agreeToTerms"
              checked={viewModel.formData.agreeToTerms}
              onCheckedChange={(checked) =>
                actions.updateField("agreeToTerms", !!checked)
              }
              disabled={viewModel.status === "loading"}
              className="mt-0.5"
            />
            <Label htmlFor="agreeToTerms" className="text-sm leading-5">
              I agree to the{" "}
              <button
                type="button"
                onClick={() => window.open("/terms", "_blank")}
                className="text-primary hover:underline"
              >
                Terms and Conditions
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={() => window.open("/privacy", "_blank")}
                className="text-primary hover:underline"
              >
                Privacy Policy
              </button>
            </Label>
          </div>
          {viewModel.validationErrors.agreeToTerms && (
            <p className="text-sm text-destructive">{viewModel.validationErrors.agreeToTerms}</p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={!viewModel.canSubmit || viewModel.status === "loading"}
        >
          {viewModel.status === "loading" ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Account...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Create Account
            </div>
          )}
        </Button>

        {/* Login Link */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="font-semibold text-primary hover:underline"
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  )
}