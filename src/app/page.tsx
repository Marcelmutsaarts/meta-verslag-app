'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { estimateTokens, formatTokenCount, getTokenCountColor, isWithinTokenLimit } from '@/utils/tokenCounter'

const educationLevels = [
  { value: 'PO', label: 'Primair Onderwijs (PO)', description: 'Basisschool, groep 1-8' },
  { value: 'VMBO', label: 'VMBO', description: 'Voorbereidend middelbaar beroepsonderwijs' },
  { value: 'HAVO', label: 'HAVO', description: 'Hoger algemeen voortgezet onderwijs' },
  { value: 'VWO', label: 'VWO', description: 'Voorbereidend wetenschappelijk onderwijs' },
  { value: 'MBO', label: 'MBO', description: 'Middelbaar beroepsonderwijs' },
  { value: 'HBO', label: 'HBO', description: 'Hoger beroepsonderwijs' },
  { value: 'UNI', label: 'Universiteit', description: 'Wetenschappelijk onderwijs' }
]

interface FileWithContent {
  file: File
  content: string
  tokens: number
}

interface FormativeAssessment {
  enabled: boolean
  strategies: {
    personalLearningGoals: {
      enabled: boolean
      scope: 'per-section' | 'whole-report'
      customPrompt: string
    }
    exampleBasedLearning: {
      enabled: boolean
      exampleSource: 'ai-generated' | 'teacher-provided'
      exampleFiles: File[]
      customReflectionQuestions: string
    }
    diagnosticQuiz: {
      enabled: boolean
      scope: 'per-section' | 'whole-report'
      customPrompt: string
    }
  }
}

export default function Home() {
  const [files, setFiles] = useState<FileWithContent[]>([])
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [educationLevel, setEducationLevel] = useState('HAVO')
  const [teacherName, setTeacherName] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [totalTokens, setTotalTokens] = useState(0)
  
  // Formative Assessment State
  const [formativeAssessment, setFormativeAssessment] = useState<FormativeAssessment>({
    enabled: false,
    strategies: {
      personalLearningGoals: {
        enabled: false,
        scope: 'per-section',
        customPrompt: ''
      },
      exampleBasedLearning: {
        enabled: false,
        exampleSource: 'ai-generated',
        exampleFiles: [],
        customReflectionQuestions: ''
      },
      diagnosticQuiz: {
        enabled: false,
        scope: 'per-section',
        customPrompt: ''
      }
    }
  })
  const [assessmentCollapsed, setAssessmentCollapsed] = useState(true)
  
  const router = useRouter()

  // Update total tokens when files change
  useEffect(() => {
    const total = files.reduce((sum, file) => sum + file.tokens, 0)
    setTotalTokens(total)
  }, [files])

  const extractTextFromFile = async (file: File): Promise<string> => {
    // For client-side, we'll estimate token count by file size
    // Actual text extraction will happen on the server
    if (file.type === 'text/plain') {
      return await file.text()
    }
    
    // Very conservative estimates - better to underestimate than overestimate
    let estimatedChars = 0
    const fileSizeKB = file.size / 1024
    
    if (file.type === 'application/pdf') {
      // PDFs: Very conservative - assume mostly formatting, little text
      estimatedChars = Math.max(100, Math.min(fileSizeKB * 50, 10000))
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // DOCX: Conservative estimate with cap
      estimatedChars = Math.max(200, Math.min(fileSizeKB * 150, 15000))
    }
    
    // Return placeholder text for token counting (will be replaced on server)
    return 'x'.repeat(estimatedChars)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    
    const selectedFiles = Array.from(e.target.files)
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    
    // Enhanced validation
    for (const selectedFile of selectedFiles) {
      // Check file type
      if (!validTypes.includes(selectedFile.type)) {
        alert(`Bestand ${selectedFile.name}: Alleen PDF, DOCX en TXT bestanden zijn toegestaan`)
        continue
      }
      
      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB in bytes
      if (selectedFile.size > maxSize) {
        alert(`Bestand ${selectedFile.name}: Bestand is te groot (max 10MB)`)
        continue
      }
      
      // Check if file already exists
      if (files.some(f => f.file.name === selectedFile.name)) {
        alert(`Bestand ${selectedFile.name} is al toegevoegd`)
        continue
      }
      
      try {
        console.log(`Processing file: ${selectedFile.name} (${selectedFile.type}, ${(selectedFile.size / 1024).toFixed(1)} KB)`)
        
        const content = await extractTextFromFile(selectedFile)
        const tokens = estimateTokens(content)
        
        // Validate that we got some content for non-text files
        if (selectedFile.type !== 'text/plain' && content.length < 100) {
          console.warn(`File ${selectedFile.name} produced minimal content, but adding anyway`)
        }
        
        const newFile: FileWithContent = {
          file: selectedFile,
          content,
          tokens
        }
        
        setFiles(prev => [...prev, newFile])
        console.log(`Successfully added file: ${selectedFile.name} (${tokens} tokens)`)
        
      } catch (error) {
        console.error('Error reading file:', error)
        const errorMessage = error instanceof Error ? error.message : 'Onbekende fout'
        alert(`Fout bij het lezen van ${selectedFile.name}: ${errorMessage}\\n\\nTips:\\n- Controleer of het bestand niet beschadigd is\\n- Probeer het bestand opnieuw op te slaan\\n- Voor PDF: probeer een andere PDF viewer/generator`)
      }
    }
    
    // Reset input
    e.target.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent, mode: 'preview' | 'final' = 'final') => {
    e.preventDefault()
    if (files.length === 0 && !additionalInstructions.trim()) {
      alert('Upload minimaal één opdracht document OF voeg toelichting toe')
      return
    }

    if (!isWithinTokenLimit(totalTokens)) {
      alert(`Te veel tokens: ${totalTokens}. Maximum is 20,000 tokens.`)
      return
    }

    setIsAnalyzing(true)

    try {
      const formData = new FormData()
      
      // Add all files
      files.forEach((fileWithContent, index) => {
        formData.append(`file_${index}`, fileWithContent.file)
      })
      
      // Add metadata
      formData.append('fileCount', files.length.toString())
      formData.append('instructions', additionalInstructions)
      formData.append('educationLevel', educationLevel)
      formData.append('teacherName', teacherName)
      formData.append('assignmentTitle', assignmentTitle)
      formData.append('mode', mode)
      formData.append('formativeAssessment', JSON.stringify(formativeAssessment))

      // Add example files for formative assessment if provided
      if (formativeAssessment.enabled && 
          formativeAssessment.strategies.exampleBasedLearning.enabled &&
          formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'teacher-provided' &&
          formativeAssessment.strategies.exampleBasedLearning.exampleFiles.length > 0) {
        
        formativeAssessment.strategies.exampleBasedLearning.exampleFiles.forEach((file, index) => {
          formData.append(`exampleFile_${index}`, file)
        })
        formData.append('exampleFileCount', formativeAssessment.strategies.exampleBasedLearning.exampleFiles.length.toString())
      }

      // Store form data for potential final generation later
      if (mode === 'preview') {
        const formDataForStorage: any = {
          fileCount: files.length,
          instructions: additionalInstructions,
          educationLevel,
          teacherName,
          assignmentTitle,
          formativeAssessment: formativeAssessment
        }
        
        // Convert files to base64 for storage
        const filePromises = files.map(async (fileWithContent, i) => {
          const file = fileWithContent.file
          const reader = new FileReader()
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(file)
          })
          return {
            index: i,
            data: {
              name: file.name,
              type: file.type,
              data: base64.split(',')[1] // Remove data:mime;base64, prefix
            }
          }
        })
        
        const fileResults = await Promise.all(filePromises)
        fileResults.forEach(({ index, data }) => {
          formDataForStorage[`file_${index}`] = data
        })
        
        // Handle example files for formative assessment
        if (formativeAssessment.enabled && 
            formativeAssessment.strategies.exampleBasedLearning.enabled &&
            formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'teacher-provided' &&
            formativeAssessment.strategies.exampleBasedLearning.exampleFiles.length > 0) {
          
          const exampleFilePromises = formativeAssessment.strategies.exampleBasedLearning.exampleFiles.map(async (file, i) => {
            const reader = new FileReader()
            const base64 = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string)
              reader.readAsDataURL(file)
            })
            return {
              index: i,
              data: {
                name: file.name,
                type: file.type,
                data: base64.split(',')[1] // Remove data:mime;base64, prefix
              }
            }
          })
          
          const exampleFileResults = await Promise.all(exampleFilePromises)
          exampleFileResults.forEach(({ index, data }) => {
            formDataForStorage[`exampleFile_${index}`] = data
          })
          formDataForStorage.exampleFileCount = formativeAssessment.strategies.exampleBasedLearning.exampleFiles.length
        }
        
        sessionStorage.setItem('uploadFormData', JSON.stringify(formDataForStorage))
      }

      const response = await fetch('/api/analyze-assignment', {
        method: 'POST',
        body: formData,
      })

      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)

      if (response.ok) {
        const data = await response.json()
        console.log('Received data:', data)
        
        if (mode === 'preview') {
          sessionStorage.setItem('previewData', JSON.stringify(data))
          console.log('Preview data stored, redirecting to /preview')
          router.push('/preview')
        } else {
          sessionStorage.setItem('assignmentData', JSON.stringify(data))
          console.log('Data stored in sessionStorage, redirecting to /workspace')
          router.push('/workspace')
        }
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

  // Formative Assessment Handlers
  const handleAssessmentToggle = (enabled: boolean) => {
    setFormativeAssessment(prev => ({ ...prev, enabled }))
  }

  const handleStrategyToggle = (strategy: keyof FormativeAssessment['strategies'], enabled: boolean) => {
    setFormativeAssessment(prev => ({
      ...prev,
      strategies: {
        ...prev.strategies,
        [strategy]: {
          ...prev.strategies[strategy],
          enabled
        }
      }
    }))
  }

  const handleStrategyUpdate = (
    strategy: keyof FormativeAssessment['strategies'], 
    updates: Partial<FormativeAssessment['strategies'][typeof strategy]>
  ) => {
    setFormativeAssessment(prev => ({
      ...prev,
      strategies: {
        ...prev.strategies,
        [strategy]: {
          ...prev.strategies[strategy],
          ...updates
        }
      }
    }))
  }

  const handleExampleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    
    const selectedFiles = Array.from(e.target.files)
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    
    const validFiles = selectedFiles.filter(file => {
      if (!validTypes.includes(file.type)) {
        alert(`Bestand ${file.name}: Alleen PDF, DOCX en TXT bestanden zijn toegestaan voor voorbeelden`)
        return false
      }
      return true
    })

    handleStrategyUpdate('exampleBasedLearning', { exampleFiles: validFiles })
    e.target.value = '' // Reset input
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
              {/* Multiple Document Upload */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Upload opdracht documenten {!additionalInstructions.trim() && <span className="text-red-500">*</span>}
                    {additionalInstructions.trim() && <span className="text-green-600 text-xs">(optioneel met toelichting)</span>}
                  </label>
                  <div className={`text-sm font-medium ${getTokenCountColor(totalTokens)}`}>
                    {formatTokenCount(totalTokens)}
                  </div>
                </div>
                
                {/* Token limit warning */}
                {totalTokens > 15000 && (
                  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          {totalTokens >= 20000 
                            ? 'Token limiet overschreden! Verwijder documenten om door te gaan.'
                            : 'Bijna aan de token limiet. Houd rekening met de 20,000 token limiet.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    multiple
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                  >
                    <div className="text-gray-500">
                      <svg className="mx-auto h-12 w-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="font-medium">Klik om documenten toe te voegen</p>
                      <p className="text-sm">PDF, DOCX of TXT bestanden (meerdere selecteren mogelijk)</p>
                    </div>
                  </label>
                </div>
                
                {/* File List */}
                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Geüploade documenten:</h4>
                    {files.map((fileWithContent, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            {/* File type icon */}
                            <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {fileWithContent.file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {fileWithContent.tokens.toLocaleString()} tokens • {(fileWithContent.file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0 ml-4 p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Verwijder bestand"
                        >
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9zM4 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM8 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Additional Instructions - Enhanced */}
              <div>
                <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
                  Aanvullende instructies (hoge prioriteit voor AI)
                </label>
                
                {/* Information Box */}
                <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">💡 Tip voor betere resultaten:</p>
                      <p>Je kunt nu ook <strong>zonder documenten</strong> een leeromgeving genereren door alleen onderstaande toelichting in te vullen. Handig voor:</p>
                      <ul className="list-disc list-inside mt-1 mb-2 text-xs">
                        <li>Eigen opdrachten zonder bestaande documenten</li>
                        <li>Specifieke sectie-structuren die je wilt definiëren</li>
                        <li>Snelle prototyping van leeromgevingen</li>
                      </ul>
                      <p className="font-mono text-xs mt-2 bg-blue-100 p-2 rounded">
                        Voorbeeld: &quot;Maak een verslag over duurzaamheid met secties: 1. Inleiding, 2. Probleem analyse, 3. Oplossingen, 4. Conclusie&quot;
                      </p>
                    </div>
                  </div>
                </div>

                <textarea
                  id="instructions"
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="Geef hier structuurinstructies of andere belangrijke richtlijnen die de AI moet volgen. Deze instructies krijgen hoge prioriteit bij het analyseren van uw documenten..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                />
                
                {/* Character/Priority Indicator */}
                {additionalInstructions.trim() && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-green-600 font-medium flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Hoge prioriteit instructies ingesteld
                    </span>
                    <span className="text-gray-500">
                      {additionalInstructions.length} karakters
                    </span>
                  </div>
                )}
              </div>

              {/* Formative Assessment Options */}
              <div>
                <button
                  type="button"
                  onClick={() => setAssessmentCollapsed(!assessmentCollapsed)}
                  className="flex items-center justify-between w-full text-sm font-medium text-gray-700 mb-3 hover:text-gray-900 transition-colors"
                >
                  <span className="flex items-center">
                    <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L3 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l3-1.75a1 1 0 011.098.132zm8.764 0a1 1 0 011.098-.132l3 1.75A.996.996 0 0119 6v2a1 1 0 11-2 0v-.277l-1.254.145a1 1 0 11-.992-1.736L15.984 6l-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364.372L10 10.054l1.254-.716a1 1 0 11.992 1.736L11 11.777V12a1 1 0 11-2 0v-.223l-1.246-.707a1 1 0 01-.372-1.364zm2.236 4.504a1 1 0 01.992 0l1.75 1a1 1 0 01-.372 1.868L10 15.277l-1.254.277a1 1 0 01-.372-1.868l1.75-1z" clipRule="evenodd" />
                    </svg>
                    Formatief Handelen (Optioneel)
                  </span>
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${
                      assessmentCollapsed ? 'rotate-0' : 'rotate-180'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {!assessmentCollapsed && (
                  <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                    {/* Main Toggle */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">Formatief Handelen Inschakelen</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Voeg actieve leerstrategieën toe om studenten bewuster te laten leren
                        </p>
                      </div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formativeAssessment.enabled}
                          onChange={(e) => handleAssessmentToggle(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${
                          formativeAssessment.enabled ? 'bg-purple-600' : 'bg-gray-300'
                        }`}>
                          <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                            formativeAssessment.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </div>
                      </label>
                    </div>

                    {formativeAssessment.enabled && (
                      <div className="space-y-6">
                        {/* Personal Learning Goals Strategy */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-800">🎯 Persoonlijke Leerdoelen</h4>
                              <p className="text-sm text-gray-600">
                                Studenten schrijven hun persoonlijke leerdoel voor de opdracht
                              </p>
                            </div>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formativeAssessment.strategies.personalLearningGoals.enabled}
                                onChange={(e) => handleStrategyToggle('personalLearningGoals', e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${
                                formativeAssessment.strategies.personalLearningGoals.enabled ? 'bg-purple-500' : 'bg-gray-300'
                              }`}>
                                <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${
                                  formativeAssessment.strategies.personalLearningGoals.enabled ? 'translate-x-5' : 'translate-x-1'
                                }`} />
                              </div>
                            </label>
                          </div>

                          {formativeAssessment.strategies.personalLearningGoals.enabled && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Wanneer leerdoelen instellen?
                                </label>
                                <div className="space-y-2">
                                  <label className="flex items-center">
                                    <input
                                      type="radio"
                                      name="learningGoalScope"
                                      value="per-section"
                                      checked={formativeAssessment.strategies.personalLearningGoals.scope === 'per-section'}
                                      onChange={(e) => handleStrategyUpdate('personalLearningGoals', { scope: e.target.value as 'per-section' })}
                                      className="mr-2"
                                    />
                                    <span className="text-sm text-gray-700">Per sectie (student stelt doel per onderdeel)</span>
                                  </label>
                                  <label className="flex items-center">
                                    <input
                                      type="radio"
                                      name="learningGoalScope"
                                      value="whole-report"
                                      checked={formativeAssessment.strategies.personalLearningGoals.scope === 'whole-report'}
                                      onChange={(e) => handleStrategyUpdate('personalLearningGoals', { scope: e.target.value as 'whole-report' })}
                                      className="mr-2"
                                    />
                                    <span className="text-sm text-gray-700">Hele opdracht (één hoofddoel voor hele verslag)</span>
                                  </label>
                                </div>
                              </div>

                              <div>
                                <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 mb-2">
                                  Aangepaste prompt (optioneel)
                                </label>
                                <textarea
                                  id="customPrompt"
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Bijv.: 'Beschrijf in 2-3 zinnen wat je met deze opdracht wilt leren en waarom dit belangrijk voor je is...'"
                                  value={formativeAssessment.strategies.personalLearningGoals.customPrompt}
                                  onChange={(e) => handleStrategyUpdate('personalLearningGoals', { customPrompt: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Example-Based Learning Strategy */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-800">📝 Voorbeeldgericht Leren</h4>
                              <p className="text-sm text-gray-600">
                                Studenten analyseren een goed voorbeeld en reflecteren hierop
                              </p>
                            </div>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formativeAssessment.strategies.exampleBasedLearning.enabled}
                                onChange={(e) => handleStrategyToggle('exampleBasedLearning', e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${
                                formativeAssessment.strategies.exampleBasedLearning.enabled ? 'bg-purple-500' : 'bg-gray-300'
                              }`}>
                                <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${
                                  formativeAssessment.strategies.exampleBasedLearning.enabled ? 'translate-x-5' : 'translate-x-1'
                                }`} />
                              </div>
                            </label>
                          </div>

                          {formativeAssessment.strategies.exampleBasedLearning.enabled && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Bron van voorbeelden
                                </label>
                                <div className="space-y-2">
                                  <label className="flex items-center">
                                    <input
                                      type="radio"
                                      name="exampleSource"
                                      value="ai-generated"
                                      checked={formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'ai-generated'}
                                      onChange={(e) => handleStrategyUpdate('exampleBasedLearning', { exampleSource: e.target.value as 'ai-generated' })}
                                      className="mr-2"
                                    />
                                    <span className="text-sm text-gray-700">AI-gegenereerde voorbeelden</span>
                                  </label>
                                  <label className="flex items-center">
                                    <input
                                      type="radio"
                                      name="exampleSource"
                                      value="teacher-provided"
                                      checked={formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'teacher-provided'}
                                      onChange={(e) => handleStrategyUpdate('exampleBasedLearning', { exampleSource: e.target.value as 'teacher-provided' })}
                                      className="mr-2"
                                    />
                                    <span className="text-sm text-gray-700">Door docent aangeleverd</span>
                                  </label>
                                </div>
                              </div>

                              {formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'teacher-provided' && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload voorbeelddocumenten
                                  </label>
                                  <input
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleExampleFileChange}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                    multiple
                                  />
                                  {formativeAssessment.strategies.exampleBasedLearning.exampleFiles.length > 0 && (
                                    <div className="mt-2 text-sm text-green-600">
                                      {formativeAssessment.strategies.exampleBasedLearning.exampleFiles.length} bestand(en) geselecteerd
                                    </div>
                                  )}
                                </div>
                              )}

                              <div>
                                <label htmlFor="reflectionQuestions" className="block text-sm font-medium text-gray-700 mb-2">
                                  Aangepaste reflectievragen (optioneel)
                                </label>
                                <textarea
                                  id="reflectionQuestions"
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Bijv.: 'Wat vind je goed aan dit voorbeeld? Waarom denk je dat dit effectief is? Hoe kun je dit toepassen in je eigen werk?'"
                                  value={formativeAssessment.strategies.exampleBasedLearning.customReflectionQuestions}
                                  onChange={(e) => handleStrategyUpdate('exampleBasedLearning', { customReflectionQuestions: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Diagnostic Quiz Strategy */}
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-gray-800">🧠 Diagnostische Quiz</h4>
                              <p className="text-sm text-gray-600">
                                Studenten krijgen kritische vragen over hun eigen geschreven tekst
                              </p>
                            </div>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formativeAssessment.strategies.diagnosticQuiz.enabled}
                                onChange={(e) => handleStrategyToggle('diagnosticQuiz', e.target.checked)}
                                className="sr-only"
                              />
                              <div className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${
                                formativeAssessment.strategies.diagnosticQuiz.enabled ? 'bg-purple-500' : 'bg-gray-300'
                              }`}>
                                <span className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${
                                  formativeAssessment.strategies.diagnosticQuiz.enabled ? 'translate-x-5' : 'translate-x-1'
                                }`} />
                              </div>
                            </label>
                          </div>

                          {formativeAssessment.strategies.diagnosticQuiz.enabled && (
                            <div className="space-y-3">
                              <div>
                                <label htmlFor="quizPrompt" className="block text-sm font-medium text-gray-700 mb-2">
                                  Aangepaste quiz instructie (optioneel)
                                </label>
                                <textarea
                                  id="quizPrompt"
                                  rows={2}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                  placeholder="Bijv.: 'Focus op argumentatie en bewijs. Stel kritische vragen over de sterkte van de argumenten...'"
                                  value={formativeAssessment.strategies.diagnosticQuiz.customPrompt}
                                  onChange={(e) => handleStrategyUpdate('diagnosticQuiz', { customPrompt: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'preview')}
                  disabled={(files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                    (files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-700 transform hover:scale-105'
                  }`}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyseren...
                    </span>
                  ) : (
                    '🔍 Test Structuur'
                  )}
                </button>

                <button
                  type="submit"
                  disabled={(files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)}
                  className={`flex-1 py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                    (files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)
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
                    '🚀 Genereer Leeromgeving'
                  )}
                </button>
              </div>
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