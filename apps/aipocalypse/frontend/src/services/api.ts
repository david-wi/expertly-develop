import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Current User (from identity API)
export async function getCurrentUser() {
  try {
    const response = await fetch('https://identity-api.ai.devintensive.com/api/v1/auth/me', {
      credentials: 'include',
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}
