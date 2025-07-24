'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const educationLevels = [
  { value: 'PO', label: 'Primair Onderwijs (PO)', description: 'Basisschool, groep 1-8' },
  { value: 'VMBO', label: 'VMBO', description: 'Voorbereidend middelbaar beroepsonderwijs' },
  { value: 'HAVO', label: 'HAVO', description: 'Hoger algemeen voortgezet onderwijs' },
  { value: 'VWO', label: 'VWO', description: 'Voorbereidend wetenschappelijk onderwijs' },
  { value: 'MBO', label: 'MBO', description: 'Middelbaar beroepsonderwijs' },
  { value: 'HBO', label: 'HBO', description: 'Hoger beroepsonderwijs' },
  { value: 'UNI', label: 'Universiteit', description: 'Wetenschappelijk onderwijs' }
]

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [educationLevel, setEducationLevel] = useState('HAVO')
  const [teacherName, setTeacherName] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      
      if (validTypes.includes(selectedFile.type)) {
        setFile(selectedFile)
      } else {
        alert('Alleen PDF en DOCX bestanden zijn toegestaan')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      alert('Upload eerst een opdracht document')
      return
    }

    setIsAnalyzing(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('instructions', additionalInstructions)
      formData.append('educationLevel', educationLevel)
      formData.append('teacherName', teacherName)
      formData.append('assignmentTitle', assignmentTitle)

      const response = await fetch('/api/analyze-assignment', {
        method: 'POST',
        body: formData,
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (response.ok) {
        const data = await response.json()
        console.log('Received data:', data)
        sessionStorage.setItem('assignmentData', JSON.stringify(data))
        console.log('Data stored in sessionStorage, redirecting to /workspace')
        router.push('/workspace')
      } else {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        
        try {
          const errorData = JSON.parse(errorText)
          const errorMessage = errorData.error || 'Er ging iets mis bij het analyseren van de opdracht'
          const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : ''
          alert(errorMessage + errorDetails)
        } catch {
          alert('Er ging iets mis bij het analyseren van de opdracht\n\nDetails: ' + errorText)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Er ging iets mis bij het verwerken van het bestand')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Meta-Verslag App
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Genereer een online leeromgeving op basis van uw opdracht. 
            De app analyseert uw document en creëert een gestructureerde omgeving 
            met socratische begeleiding voor elke sectie.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Teacher and Assignment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="teacherName" className="block text-sm font-medium text-gray-700 mb-2">
                    Naam docent (optioneel)
                  </label>
                  <input
                    type="text"
                    id="teacherName"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Uw naam"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="assignmentTitle" className="block text-sm font-medium text-gray-700 mb-2">
                    Titel opdracht (optioneel)
                  </label>
                  <input
                    type="text"
                    id="assignmentTitle"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Titel van de opdracht"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                  />
                </div>
              </div>

              {/* Education Level */}
              <div>
                <label htmlFor="educationLevel" className="block text-sm font-medium text-gray-700 mb-2">
                  Onderwijsniveau *
                </label>
                <select
                  id="educationLevel"
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {educationLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label} - {level.description}
                    </option>
                  ))}
                </select>
              </div>
              {/* Document Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload opdracht document *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                  >
                    {file ? (
                      <div className="text-green-600">
                        <svg className="mx-auto h-12 w-12 mb-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-500">Klik om een ander bestand te kiezen</p>
                      </div>
                    ) : (
                      <div className="text-gray-500">
                        <svg className="mx-auto h-12 w-12 mb-2" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p className="font-medium">Klik om een bestand te uploaden</p>
                        <p className="text-sm">PDF of DOCX (max. 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Additional Instructions */}
              <div>
                <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                  Aanvullende instructies (optioneel)
                </label>
                <textarea
                  id="instructions"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Geef hier eventuele aanvullende instructies voor de leeromgeving..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={!file || isAnalyzing}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                  !file || isAnalyzing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 transform hover:scale-105'
                }`}
              >
                {isAnalyzing ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Opdracht wordt geanalyseerd...
                  </span>
                ) : (
                  'Genereer Leeromgeving'
                )}
              </button>
            </form>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Hoe werkt het?</h3>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Upload uw opdracht document (PDF of DOCX)</li>
                <li>2. De app analyseert de structuur en secties</li>
                <li>3. Er wordt een leeromgeving gegenereerd met:</li>
                <li className="ml-4">• Navigeerbare secties</li>
                <li className="ml-4">• Tekstvakken per sectie</li>
                <li className="ml-4">• Socratische chatbot begeleiding</li>
                <li>4. Studenten kunnen aan de slag met hun opdracht</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}