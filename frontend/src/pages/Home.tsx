import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'

interface HealthResponse {
  status: string
}

export default function Home() {
  const [healthStatus, setHealthStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await apiGet<HealthResponse>('/api/health')
        setHealthStatus(data.status)
      } catch (err) {
        setError('Failed to fetch health status')
        console.error(err)
      }
    }
    fetchHealth()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-8">Preschool Agent</h1>
      <div className="text-lg mb-4">
        <p>API Health Check Status:</p>
        {error ? (
          <p className="text-red-500 font-bold">{error}</p>
        ) : healthStatus ? (
          <p className="text-green-500 font-bold">{healthStatus}</p>
        ) : (
          <p className="text-gray-400">Loading...</p>
        )}
      </div>
    </div>
  )
}
