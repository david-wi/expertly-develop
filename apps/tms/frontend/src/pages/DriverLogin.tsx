import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Phone, Lock, Loader2 } from 'lucide-react'

const DRIVER_API = import.meta.env.VITE_API_URL || ''

async function driverRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${DRIVER_API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.json()
}

interface DriverLoginResponse {
  driver_id: string
  name: string
  phone: string
  carrier_id: string | null
  token: string
}

export default function DriverLogin() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [rememberDevice, setRememberDevice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const formatPhone = useCallback((value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }, [])

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(raw)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || !pin) return

    setLoading(true)
    setError('')

    try {
      const result = await driverRequest<DriverLoginResponse>('/api/v1/driver-app/login', {
        method: 'POST',
        body: JSON.stringify({ phone, pin }),
      })

      // Store driver session
      const storage = rememberDevice ? localStorage : sessionStorage
      storage.setItem('driver_id', result.driver_id)
      storage.setItem('driver_name', result.name)
      storage.setItem('driver_token', result.token)
      if (result.carrier_id) {
        storage.setItem('driver_carrier_id', result.carrier_id)
      }

      navigate('/driver')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }, [phone, pin, rememberDevice, navigate])

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-lg mb-4">
            <Truck className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white">Expertly TMS</h1>
          <p className="text-blue-200 mt-1">Driver App</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 space-y-5">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Phone Input */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                value={formatPhone(phone)}
                onChange={handlePhoneChange}
                className="w-full pl-11 pr-4 py-3.5 text-lg rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          {/* PIN Input */}
          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              PIN
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="Enter PIN"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full pl-11 pr-4 py-3.5 text-lg rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none tracking-[0.3em]"
              />
            </div>
          </div>

          {/* Remember Device */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Remember this device</span>
          </label>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !phone || !pin}
            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-lg rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[56px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="text-center text-blue-200 text-xs mt-6">
          Contact dispatch if you need help logging in
        </p>
      </div>
    </div>
  )
}
