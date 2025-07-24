'use client'

import { useState } from 'react'
import { studentAuth, type Student } from '@/utils/studentAuth'

interface StudentLoginProps {
  onLogin: (student: Student) => void
  onCancel?: () => void
}

export default function StudentLogin({ onLogin, onCancel }: StudentLoginProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      alert('Voer je naam in')
      return
    }

    setIsLoading(true)
    
    try {
      const student = studentAuth.login(name, email || undefined)
      onLogin(student)
    } catch (error) {
      console.error('Login failed:', error)
      alert('Er ging iets mis bij het inloggen')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Inloggen als Student
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-2">
              Naam *
            </label>
            <input
              type="text"
              id="studentName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Je volledige naam"
              required
            />
          </div>
          
          <div>
            <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Email (optioneel)
            </label>
            <input
              type="email"
              id="studentEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="je@email.com"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                Annuleren
              </button>
            )}
            
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className={`flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                isLoading || !name.trim()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Inloggen...
                </span>
              ) : (
                'Inloggen'
              )}
            </button>
          </div>
        </form>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Let op:</strong> Je gegevens worden alleen lokaal op je apparaat opgeslagen. 
            Voor het beste resultaat, gebruik altijd hetzelfde apparaat en browser.
          </p>
        </div>
      </div>
    </div>
  )
}