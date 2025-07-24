'use client'

import { useState } from 'react'

export default function TestAPI() {
  const [results, setResults] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)

  const testAnalyzeAssignment = async () => {
    setIsLoading(true)
    try {
      // Create a test file
      const testContent = `
        Opdracht: Reflectieverslag
        
        Schrijf een reflectieverslag over je stage-ervaring.
        
        Het verslag moet de volgende onderdelen bevatten:
        1. Inleiding - Beschrijf kort je stage organisatie en functie
        2. Leerdoelen - Wat wilde je leren tijdens de stage?
        3. Ervaringen - Beschrijf je belangrijkste ervaringen
        4. Reflectie - Wat heb je geleerd? Wat zou je anders doen?
        5. Conclusie - Samenvat je belangrijkste inzichten
      `
      
      const blob = new Blob([testContent], { type: 'text/plain' })
      const file = new File([blob], 'test-opdracht.txt', { type: 'text/plain' })
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('instructions', 'Dit is een test')

      console.log('Testing /api/analyze-assignment...')
      const response = await fetch('/api/analyze-assignment', {
        method: 'POST',
        body: formData,
      })

      const responseText = await response.text()
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      console.log('Response text:', responseText)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { error: 'Could not parse response', rawResponse: responseText }
      }

      setResults(prev => ({
        ...prev,
        analyzeAssignment: {
          status: response.status,
          ok: response.ok,
          data,
          headers: Object.fromEntries(response.headers.entries())
        }
      }))
    } catch (error) {
      console.error('Test error:', error)
      setResults(prev => ({
        ...prev,
        analyzeAssignment: {
          error: error instanceof Error ? error.message : 'Unknown error',
          errorDetails: error
        }
      }))
    }
    setIsLoading(false)
  }

  const testUploadDocx = async () => {
    setIsLoading(true)
    try {
      const testContent = 'Test document content'
      const blob = new Blob([testContent], { type: 'text/plain' })
      const file = new File([blob], 'test.txt', { type: 'text/plain' })
      
      const formData = new FormData()
      formData.append('file', file)

      console.log('Testing /api/upload-docx...')
      const response = await fetch('/api/upload-docx', {
        method: 'POST',
        body: formData,
      })

      const responseText = await response.text()
      console.log('Response:', responseText)

      let data
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        data = { error: 'Could not parse response', rawResponse: responseText }
      }

      setResults(prev => ({
        ...prev,
        uploadDocx: {
          status: response.status,
          ok: response.ok,
          data
        }
      }))
    } catch (error) {
      console.error('Test error:', error)
      setResults(prev => ({
        ...prev,
        uploadDocx: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">API Test Page</h1>
        
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Test Endpoints</h2>
            
            <div className="space-y-2">
              <button
                onClick={testAnalyzeAssignment}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
              >
                Test /api/analyze-assignment
              </button>
              
              <button
                onClick={testUploadDocx}
                disabled={isLoading}
                className="ml-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
              >
                Test /api/upload-docx
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Results</h2>
            <pre className="text-xs overflow-auto bg-gray-100 p-4 rounded">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Console Output</h2>
            <p className="text-sm text-gray-600">
              Open browser console (F12) to see detailed logs
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}