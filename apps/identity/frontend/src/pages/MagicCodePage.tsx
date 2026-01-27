import { useState, FormEvent, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Mail, AlertCircle, Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { authApi, setOrganizationId } from '../services/api'

type Step = 'email' | 'code'

export default function MagicCodePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('return_url')

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)

  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Focus first code input when entering code step
  useEffect(() => {
    if (step === 'code' && codeInputRefs.current[0]) {
      codeInputRefs.current[0].focus()
    }
  }, [step])

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await authApi.requestMagicCode(email)
      setCodeSent(true)
      setStep('code')
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError('Failed to send code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    // Only allow alphanumeric
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleaned.length > 1) {
      // Handle paste
      const chars = cleaned.slice(0, 6).split('')
      const newCode = [...code]
      chars.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char
        }
      })
      setCode(newCode)
      // Focus the next empty input or last input
      const nextIndex = Math.min(index + chars.length, 5)
      codeInputRefs.current[nextIndex]?.focus()
    } else {
      const newCode = [...code]
      newCode[index] = cleaned
      setCode(newCode)
      // Move to next input
      if (cleaned && index < 5) {
        codeInputRefs.current[index + 1]?.focus()
      }
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setError('Please enter the complete 6-character code')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const response = await authApi.verifyMagicCode(email, fullCode)

      // Store organization ID for other API calls
      setOrganizationId(response.user.organization_id)

      // Redirect to return_url or home
      if (returnUrl) {
        window.location.href = returnUrl
      } else {
        navigate('/')
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError('Invalid code. Please try again.')
      }
      // Clear code on error
      setCode(['', '', '', '', '', ''])
      codeInputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError(null)
    setLoading(true)
    setCode(['', '', '', '', '', ''])

    try {
      await authApi.requestMagicCode(email)
      setCodeSent(true)
    } catch (err: any) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Build login link with return_url if present
  const loginLink = returnUrl
    ? `/login?return_url=${encodeURIComponent(returnUrl)}`
    : '/login'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Expertly</h1>
          <p className="text-slate-400 mt-2">
            {step === 'email' ? 'Sign in with email code' : 'Enter your code'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-8">
          {step === 'email' ? (
            <form onSubmit={handleRequestCode} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                <p className="text-sm">
                  Available for <strong>@expertly.com</strong> email addresses only.
                </p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@expertly.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  'Send login code'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {codeSent && !error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">Code sent to {email}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-4 text-center">
                  Enter the 6-character code
                </label>
                <div className="flex justify-center gap-2">
                  {code.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { codeInputRefs.current[index] = el }}
                      type="text"
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      maxLength={6}
                      className="w-12 h-14 text-center text-2xl font-mono font-bold bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all uppercase"
                    />
                  ))}
                </div>
                <p className="text-center text-sm text-slate-400 mt-3">
                  Code expires in 15 minutes
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.join('').length !== 6}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify code'
                )}
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email')
                    setCode(['', '', '', '', '', ''])
                    setError(null)
                  }}
                  className="text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* Back to password login */}
          <div className="mt-6 pt-6 border-t border-slate-700 text-center">
            <Link
              to={loginLink}
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              Sign in with password instead
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-500">
          Unified authentication for all Expertly apps
        </p>
      </div>
    </div>
  )
}
