'use client'

import { useEffect, useState } from 'react'

export default function DebugPage() {
  const [sessionData, setSessionData] = useState<string | null>(null)
  const [routes, setRoutes] = useState<string[]>([])

  useEffect(() => {
    // Check sessionStorage
    const data = sessionStorage.getItem('assignmentData')
    setSessionData(data)

    // List known routes
    setRoutes([
      '/',
      '/workspace',
      '/test-api',
      '/debug'
    ])
  }, [])

  const clearSession = () => {
    sessionStorage.removeItem('assignmentData')
    setSessionData(null)
    alert('Session cleared')
  }

  const testRedirect = () => {
    window.location.href = '/workspace'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Debug Page</h1>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Session Storage</h2>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">assignmentData:</p>
            <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
              {sessionData ? JSON.stringify(JSON.parse(sessionData), null, 2) : 'No data in sessionStorage'}
            </pre>
          </div>
          <button
            onClick={clearSession}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear Session Storage
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Routes</h2>
          <ul className="space-y-2">
            {routes.map(route => (
              <li key={route}>
                <a href={route} className="text-blue-600 hover:underline">
                  {route}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Navigation Test</h2>
          <button
            onClick={testRedirect}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Direct Redirect to /workspace
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Browser Info</h2>
          <p className="text-sm">User Agent: {typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A'}</p>
          <p className="text-sm">Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
        </div>
      </div>
    </div>
  )
}