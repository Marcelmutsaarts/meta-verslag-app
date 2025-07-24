'use client'

import { useState } from 'react'

export default function TestPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAPI = async () => {
    setLoading(true)
    try {
      // Create a test file
      const testContent = `
        Opdracht: Essay over Duurzaamheid
        
        Schrijf een essay van 1500 woorden over duurzaamheid in Nederland.
        
        Het essay moet de volgende onderdelen bevatten:
        1. Inleiding - Introduceer het onderwerp duurzaamheid
        2. Huidige situatie - Beschrijf de huidige staat van duurzaamheid in Nederland
        3. Uitdagingen - Bespreek de belangrijkste uitdagingen
        4. Oplossingen - Presenteer mogelijke oplossingen
        5. Conclusie - Vat samen en geef je visie
      `
      
      const blob = new Blob([testContent], { type: 'text/plain' })
      const file = new File([blob], 'test-opdracht.txt', { type: 'text/plain' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('instructions', 'Dit is een test opdracht voor studenten')

      const response = await fetch('/api/analyze-assignment', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setResult({
        status: response.status,
        ok: response.ok,
        data: data
      })
    } catch (error) {
      setResult({
        error: error?.toString()
      })
    } finally {
      setLoading(false)
    }
  }

  const checkSessionStorage = () => {
    const data = sessionStorage.getItem('assignmentData')
    setResult({
      hasData: !!data,
      data: data ? JSON.parse(data) : null
    })
  }

  const clearSessionStorage = () => {
    sessionStorage.removeItem('assignmentData')
    setResult({ message: 'SessionStorage cleared' })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Debug Test Page</h1>
        
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Test API</h2>
            <button
              onClick={testAPI}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Testing...' : 'Test Analyze Assignment API'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">SessionStorage</h2>
            <div className="space-x-4">
              <button
                onClick={checkSessionStorage}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Check SessionStorage
              </button>
              <button
                onClick={clearSessionStorage}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Clear SessionStorage
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Navigation</h2>
            <div className="space-x-4">
              <a href="/" className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 inline-block">
                Go to Home
              </a>
              <a href="/workspace" className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 inline-block">
                Go to Workspace
              </a>
            </div>
          </div>

          {result && (
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Result</h2>
              <pre className="bg-gray-100 p-4 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}