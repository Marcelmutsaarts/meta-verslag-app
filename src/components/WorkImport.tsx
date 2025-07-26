'use client'

import { useState, useRef } from 'react'
import { workspaceStorage, type StudentWork } from '@/utils/workspaceStorage'

interface WorkImportProps {
  onImport: (studentWork: StudentWork) => void
  onClose?: () => void
}

export default function WorkImport({ onImport, onClose }: WorkImportProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      alert('Selecteer een geldig JSON bestand')
      return
    }

    setIsLoading(true)
    
    try {
      const result = await workspaceStorage.importFromFile(file)
      
      if (result.success && result.data) {
        onImport(result.data)
      } else {
        alert(`Fout bij het laden: ${result.error}`)
      }
    } catch (error) {
      console.error('Import failed:', error)
      alert('Er ging iets mis bij het importeren van het bestand')
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Werk Importeren
        </h2>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-300 hover:border-indigo-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileInput}
            className="hidden"
          />
          
          {isLoading ? (
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-12 w-12 text-indigo-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600">Bestand wordt geladen...</p>
            </div>
          ) : (
            <div>
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600 mb-2">
                Sleep je JSON bestand hierheen of
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                klik om te selecteren
              </button>
              <p className="text-sm text-gray-500 mt-2">
                Alleen .json bestanden worden geaccepteerd
              </p>
            </div>
          )}
        </div>
        
        <div className="flex space-x-3 pt-6">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              Annuleren
            </button>
          )}
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-700">
            <strong>Let op:</strong> Het importeren overschrijft je huidige werk. 
            Zorg dat je eerst je huidige werk hebt geëxporteerd als je het wilt behouden.
          </p>
        </div>
      </div>
    </div>
  )
}