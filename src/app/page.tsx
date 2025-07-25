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
        
        // Enhanced error feedback for different file types
        let userFriendlyMessage = `Fout bij het lezen van ${selectedFile.name}`
        let tips: string[] = []
        
        if (selectedFile.type === 'application/pdf') {
          tips = [
            'PDF bestanden kunnen soms problemen geven met complexe opmaak',
            'Probeer het bestand te converteren naar Word (.docx) formaat',
            'Controleer of het PDF bestand niet wachtwoord-beveiligd is',
            'Genereer het PDF opnieuw met een andere tool (bijv. Word → PDF)',
            'Gebruik een eenvoudiger PDF zonder afbeeldingen'
          ]
        } else if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          tips = [
            'Controleer of het Word bestand niet beschadigd is',
            'Probeer het bestand opnieuw op te slaan',
            'Gebruik een recente versie van Microsoft Word',
            'Converteer naar PDF als alternatief'
          ]
        } else {
          tips = [
            'Controleer of het bestand niet beschadigd is',
            'Ondersteunde formaten: PDF (.pdf), Word (.docx), Tekst (.txt)',
            'Probeer het bestand in een ander formaat op te slaan'
          ]
        }
        
        const detailedMessage = `${userFriendlyMessage}
        
🔧 Mogelijke oplossingen:
${tips.map(tip => `• ${tip}`).join('\n')}

📋 Technische details: ${errorMessage}`
        
        alert(detailedMessage)
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

      console.log('Sending request to analyze-assignment API...')
      console.log('Files to upload:', files.length)
      console.log('Instructions length:', additionalInstructions.length)
      console.log('Mode:', mode)
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('Request timeout after 120 seconds')
        controller.abort()
      }, 120000) // 2 minutes timeout
      
      const response = await fetch('/api/analyze-assignment', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      console.log('Response received!')
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (!response.ok) {
        console.error('Response not OK, status:', response.status)
      }

      if (response.ok) {
        const data = await response.json()
        console.log('Received data:', data)
        
        if (mode === 'preview') {
          console.log('Storing preview data in sessionStorage...')
          sessionStorage.setItem('previewData', JSON.stringify(data))
          console.log('Preview data stored successfully')
          
          // Small delay to ensure sessionStorage is written
          setTimeout(() => {
            console.log('Redirecting to /preview')
            router.push('/preview')
          }, 100)
        } else {
          console.log('Storing assignment data in sessionStorage...')
          sessionStorage.setItem('assignmentData', JSON.stringify(data))
          console.log('Assignment data stored successfully')
          
          // Verify storage worked
          const verification = sessionStorage.getItem('assignmentData')
          console.log('Storage verification:', verification ? 'SUCCESS' : 'FAILED')
          
          // Small delay to ensure sessionStorage is written
          setTimeout(() => {
            console.log('Redirecting to /workspace')
            router.push('/workspace')
          }, 100)
        }
      } else {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        
        try {
          const errorData = JSON.parse(errorText)
          const errorMessage = errorData.error || 'Er ging iets mis bij het analyseren van de opdracht'
          const errorDetails = errorData.details || ''
          
          // Enhanced error display with better formatting
          if (errorDetails) {
            alert(`❌ ${errorMessage}\n\n${errorDetails}`)
          } else {
            alert(`❌ ${errorMessage}`)
          }
        } catch {
          // Fallback for non-JSON error responses
          let friendlyError = 'Er ging iets mis bij het analyseren van de opdracht'
          
          if (errorText.toLowerCase().includes('pdf')) {
            friendlyError = 'Er ging iets mis bij het verwerken van een PDF bestand'
          } else if (errorText.toLowerCase().includes('canvas')) {
            friendlyError = 'Er is een probleem met de PDF rendering engine'
          } else if (errorText.toLowerCase().includes('timeout')) {
            friendlyError = 'De verwerking duurde te lang (timeout)'
          }
          
          alert(`❌ ${friendlyError}\n\n🔧 Mogelijke oplossingen:\n• Probeer bestanden in Word (.docx) formaat\n• Gebruik kleinere bestanden\n• Controleer of bestanden niet beschadigd zijn\n\n📋 Technische details: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`)
        }
      }
    } catch (error) {
      console.error('Detailed error information:')
      console.error('Error type:', typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      console.error('Full error object:', error)
      
      let errorMessage = 'Onbekende fout'
      let tips: string[] = []
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'De aanvraag duurde te lang (timeout na 2 minuten)'
          tips = [
            'Probeer opnieuw met kleinere bestanden',
            'Gebruik minder tekst of minder bestanden',
            'Controleer uw internetverbinding'
          ]
        } else if (error.message.toLowerCase().includes('pdf')) {
          errorMessage = 'PDF verwerking probleem'
          tips = [
            'Converteer PDF naar Word (.docx) formaat',
            'Gebruik een eenvoudigere PDF zonder afbeeldingen',
            'Controleer of het PDF bestand niet beschadigd is'
          ]
        } else if (error.message.toLowerCase().includes('network') || error.message.toLowerCase().includes('fetch')) {
          errorMessage = 'Netwerk verbinding probleem'
          tips = [
            'Controleer uw internetverbinding',
            'Probeer het opnieuw na een paar seconden',
            'Gebruik kleinere bestanden als het probleem aanhoudt'
          ]
        } else {
          errorMessage = error.message
          tips = [
            'Probeer het opnieuw',
            'Gebruik andere bestandsformaten (.docx of .txt)',
            'Controleer of bestanden niet beschadigd zijn'
          ]
        }
      }
      
      const tipsText = tips.length > 0 ? `\n\n🔧 Mogelijke oplossingen:\n${tips.map(tip => `• ${tip}`).join('\n')}` : ''
      
      alert(`❌ Er ging iets mis bij het verwerken: ${errorMessage}${tipsText}\n\n📋 Kijk in de browser console voor meer technische details.`)
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
    e.target.value = ''
  }

  return (
    <div className="min-h-screen">
      <div className="grid-main py-xl">
        {/* Hero Section */}
        <div className="text-center mb-xl animate-fade-in-up">
          <h1 className="text-hero mb-md">
            META-VERSLAG-APP
          </h1>
          <p className="text-subtitle mb-sm">
            TRANSFORMEER OPDRACHTEN IN INTERACTIEVE LEEROMGEVINGEN
          </p>
          <p className="text-motto">
            Socratische begeleiding voor elke student
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Main Upload Card */}
          <div className="card-primary text-center animate-fade-in-up animate-delay-1">
            <div className="mb-lg">
              <h2 className="text-heading text-2xl mb-sm">🎯 UPLOAD JE OPDRACHT</h2>
              <p className="text-muted">Sleep bestanden hier of klik om te selecteren</p>
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
                <div className="mb-4 p-3 rounded border-l-4" style={{backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: '#FBBF24', border: '1px solid rgba(251, 191, 36, 0.3)'}}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5" style={{color: '#FBBF24'}} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-body">
                        {totalTokens >= 20000 
                          ? 'Token limiet overschreden! Verwijder documenten om door te gaan.'
                          : 'Bijna aan de token limiet. Houd rekening met de 20,000 token limiet.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="file-upload-area border-2 border-dashed mb-md p-xl" style={{borderColor: 'var(--accent)', borderRadius: 'var(--radius-lg)'}}>
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
                  className="cursor-pointer block hover:opacity-80 transition-opacity"
                >
                  <div className="text-center">
                    <svg className="mx-auto h-16 w-16 mb-md" style={{color: 'var(--accent)'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-body font-medium text-lg mb-xs">📁 SELECTEER BESTANDEN</p>
                    <p className="text-muted text-sm">PDF, DOCX of TXT bestanden</p>
                    <div className="mt-sm">
                      <span className="text-sm" style={{color: 'var(--accent)'}}>
                        {formatTokenCount(totalTokens)} / 20k tokens
                      </span>
                    </div>
                  </div>
                </label>
              </div>
              
              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-body">Geüploade documenten:</h4>
                  {files.map((fileWithContent, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{backgroundColor: 'var(--bg-card)', border: '1px solid rgba(162, 93, 248, 0.2)'}}>
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {/* File type icon */}
                          <svg className="h-8 w-8" style={{color: 'var(--accent)'}} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-body truncate">
                            {fileWithContent.file.name}
                          </p>
                          <p className="text-xs text-muted">
                            {fileWithContent.tokens.toLocaleString()} tokens • {(fileWithContent.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0 ml-4 p-1 text-muted hover:text-red-500 transition-colors"
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
          </div>

          {/* Settings Grid */}
          <div className="grid-settings animate-fade-in-up animate-delay-2">
            {/* Formative Assessment Card */}
            <div className="card">
              <h3 className="text-heading text-lg mb-md">🎓 FORMATIEF HANDELEN</h3>
              <p className="text-muted text-sm mb-lg">Schakel extra leerfuncties in voor studenten</p>
              
              {/* Toggle switches for formative assessment strategies */}
              <div className="space-y-4">
                {/* Personal Learning Goals */}
                <div className="flex items-center justify-between p-md" style={{backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(162, 93, 248, 0.2)'}}>
                  <div>
                    <label className="text-body font-medium">🎯 Persoonlijke Leerdoelen</label>
                    <p className="text-muted text-sm">Studenten stellen eigen leerdoelen</p>
                  </div>
                  <label className="toggle">
                    <input 
                      type="checkbox" 
                      className="toggle-input"
                      checked={formativeAssessment.strategies.personalLearningGoals.enabled}
                      onChange={(e) => handleStrategyToggle('personalLearningGoals', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {/* Example-based Learning */}
                <div className="flex items-center justify-between p-md" style={{backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(162, 93, 248, 0.2)'}}>
                  <div>
                    <label className="text-body font-medium">📝 Voorbeeldgericht Leren</label>
                    <p className="text-muted text-sm">AI genereert of gebruik eigen voorbeelden</p>
                  </div>
                  <label className="toggle">
                    <input 
                      type="checkbox" 
                      className="toggle-input"
                      checked={formativeAssessment.strategies.exampleBasedLearning.enabled}
                      onChange={(e) => handleStrategyToggle('exampleBasedLearning', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                {/* Diagnostic Quiz */}
                <div className="flex items-center justify-between p-md" style={{backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(162, 93, 248, 0.2)'}}>
                  <div>
                    <label className="text-body font-medium">🧠 Diagnostische Quiz</label>
                    <p className="text-muted text-sm">Quiz voor zelfdiagnose van begrip</p>
                  </div>
                  <label className="toggle">
                    <input 
                      type="checkbox" 
                      className="toggle-input"
                      checked={formativeAssessment.strategies.diagnosticQuiz.enabled}
                      onChange={(e) => handleStrategyToggle('diagnosticQuiz', e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Settings Card */}
            <div className="card">
              <h3 className="text-heading text-lg mb-md">⚙️ INSTELLINGEN</h3>
              <p className="text-muted text-sm mb-lg">Basis configuratie en metadata</p>
              
              <div className="space-y-4">
                {/* Teacher Name */}
                <div>
                  <label htmlFor="teacherName" className="form-label">
                    Docentnaam (optioneel)
                  </label>
                  <input
                    type="text"
                    id="teacherName"
                    className="form-input"
                    placeholder="Uw naam"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                  />
                </div>

                {/* Assignment Title */}
                <div>
                  <label htmlFor="assignmentTitle" className="form-label">
                    Opdrachttitel (optioneel)
                  </label>
                  <input
                    type="text"
                    id="assignmentTitle"
                    className="form-input"
                    placeholder="Naam van de opdracht"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                  />
                </div>

                {/* Education Level */}
                <div>
                  <label htmlFor="educationLevel" className="form-label">
                    Onderwijsniveau *
                  </label>
                  <select
                    id="educationLevel"
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="form-input"
                  >
                    {educationLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Options - Collapsible */}
          <div className="animate-fade-in-up animate-delay-3">
            <div className="card">
              <h3 className="text-heading text-lg mb-md">⚙️ GEAVANCEERDE OPTIES</h3>
              <p className="text-muted text-sm mb-lg">Aanvullende instructies en formatieve strategieën</p>
              <div>
                <label htmlFor="instructions" className="form-label">
                  Aanvullende instructies (hoge prioriteit voor AI)
                </label>
                
                {/* Information Box */}
                <div className="mb-3 p-4 rounded-lg" style={{backgroundColor: 'rgba(162, 93, 248, 0.1)', border: '1px solid rgba(162, 93, 248, 0.3)'}}>
                  <div className="flex items-start">
                    <svg className="w-5 h-5 mt-0.5 mr-3 flex-shrink-0" style={{color: 'var(--accent)'}} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-body">
                      <p className="font-medium mb-1">💡 Tip voor betere resultaten:</p>
                      <p>Je kunt nu ook <strong>zonder documenten</strong> een leeromgeving genereren door alleen onderstaande toelichting in te vullen. Handig voor:</p>
                      <ul className="list-disc list-inside mt-1 mb-2 text-xs text-muted">
                        <li>Eigen opdrachten zonder bestaande documenten</li>
                        <li>Specifieke sectie-structuren die je wilt definiëren</li>
                        <li>Snelle prototyping van leeromgevingen</li>
                      </ul>
                      <p className="font-mono text-xs mt-2 p-2 rounded" style={{backgroundColor: 'rgba(162, 93, 248, 0.1)', color: 'var(--accent)'}}>
                        Voorbeeld: "Maak een verslag over duurzaamheid met secties: 1. Inleiding, 2. Probleem analyse, 3. Oplossingen, 4. Conclusie"
                      </p>
                    </div>
                  </div>
                </div>

                <textarea
                  id="instructions"
                  rows={5}
                  className="form-input resize-none"
                  placeholder="Geef hier structuurinstructies of andere belangrijke richtlijnen die de AI moet volgen. Deze instructies krijgen hoge prioriteit bij het analyseren van uw documenten..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                />
                
                {/* Character/Priority Indicator */}
                {additionalInstructions.trim() && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center" style={{color: 'var(--accent)'}}>
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Hoge prioriteit instructies ingesteld
                    </span>
                    <span className="text-muted">
                      {additionalInstructions.length} karakters
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 mt-xl">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'preview')}
                  disabled={(files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)}
                  className={`btn btn-secondary flex-1 ${
                    (files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)
                      ? 'opacity-50 cursor-not-allowed pointer-events-none'
                      : ''
                  }`}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
                  className={`btn btn-primary flex-1 ${
                    (files.length === 0 && !additionalInstructions.trim()) || isAnalyzing || !isWithinTokenLimit(totalTokens)
                      ? 'opacity-50 cursor-not-allowed pointer-events-none'
                      : ''
                  }`}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            </div>
          </div>
        </form>

        <div className="mt-8 p-4 rounded-lg card">
          <h3 className="font-semibold text-heading mb-2">📚 Hoe werkt het?</h3>
          <ol className="text-sm text-body space-y-1">
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
  )
}