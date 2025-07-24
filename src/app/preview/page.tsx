'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Section {
  id: string
  title: string
  description: string
  guideQuestions: string[]
  wordCount?: string
}

interface PreviewData {
  title: string
  objective: string
  sections: Section[]
  generalGuidance: string
  metadata?: {
    educationLevelInfo: {
      name: string
      ageRange: string
    }
    teacherName: string | null
    assignmentTitle: string | null
    instructions: string | null
    createdAt: string
  }
}

export default function PreviewPage() {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const router = useRouter()

  useEffect(() => {
    const data = sessionStorage.getItem('previewData')
    if (!data) {
      console.log('No preview data found, redirecting to home')
      router.push('/')
      return
    }

    try {
      const parsed = JSON.parse(data)
      setPreviewData(parsed)
      setSections([...parsed.sections])
    } catch (error) {
      console.error('Error parsing preview data:', error)
      router.push('/')
    }
  }, [router])

  const handleSectionChange = (index: number, field: keyof Section, value: string | string[]) => {
    const newSections = [...sections]
    if (field === 'guideQuestions' && Array.isArray(value)) {
      newSections[index][field] = value
    } else if (typeof value === 'string') {
      (newSections[index] as any)[field] = value
    }
    setSections(newSections)
  }

  const addSection = () => {
    const newSection: Section = {
      id: `sectie-${Date.now()}`,
      title: 'Nieuwe Sectie',
      description: 'Beschrijving van de nieuwe sectie',
      guideQuestions: ['Hulpvraag 1', 'Hulpvraag 2'],
      wordCount: '200-300'
    }
    setSections([...sections, newSection])
  }

  const removeSection = (index: number) => {
    if (sections.length > 1) {
      setSections(sections.filter((_, i) => i !== index))
    }
  }

  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null) return

    const newSections = [...sections]
    const draggedSection = newSections[draggedIndex]
    newSections.splice(draggedIndex, 1)
    newSections.splice(dropIndex, 0, draggedSection)
    setSections(newSections)
    setDraggedIndex(null)
  }

  const generateFinalEnvironment = async () => {
    if (!previewData) return

    setIsGenerating(true)
    
    try {
      // Get original form data from sessionStorage
      const formDataJSON = sessionStorage.getItem('uploadFormData')
      if (!formDataJSON) {
        throw new Error('Geen upload data gevonden')
      }

      const originalFormData = JSON.parse(formDataJSON)
      const formData = new FormData()
      
      // Re-add all files
      for (let i = 0; i < originalFormData.fileCount; i++) {
        const fileData = originalFormData[`file_${i}`]
        if (fileData) {
          // Convert base64 back to file
          const byteCharacters = atob(fileData.data)
          const byteNumbers = new Array(byteCharacters.length)
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const file = new File([byteArray], fileData.name, { type: fileData.type })
          formData.append(`file_${i}`, file)
        }
      }

      // Add other form data
      formData.append('fileCount', originalFormData.fileCount.toString())
      formData.append('instructions', originalFormData.instructions || '')
      formData.append('educationLevel', originalFormData.educationLevel || 'HAVO')
      formData.append('teacherName', originalFormData.teacherName || '')
      formData.append('assignmentTitle', originalFormData.assignmentTitle || '')
      formData.append('mode', 'final')
      formData.append('customSections', JSON.stringify(sections))

      const response = await fetch('/api/analyze-assignment', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        sessionStorage.setItem('assignmentData', JSON.stringify(data))
        router.push('/workspace')
      } else {
        const errorText = await response.text()
        console.error('Error response:', errorText)
        alert('Er ging iets mis bij het genereren van de leeromgeving')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Er ging iets mis bij het genereren van de leeromgeving')
    } finally {
      setIsGenerating(false)
    }
  }

  const regeneratePreview = async () => {
    router.push('/')
  }

  if (!previewData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Sectie Structuur Preview
          </h1>
          <p className="text-lg text-gray-600">
            Bekijk en pas de sectie-structuur aan voordat je de definitieve leeromgeving genereert
          </p>
        </div>

        {/* Assignment Overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-indigo-600 mb-3">{previewData.title}</h2>
            <p className="text-gray-700 mb-4 leading-relaxed">{previewData.objective}</p>
            {previewData.metadata?.educationLevelInfo && (
              <div className="inline-flex items-center px-4 py-2 bg-indigo-50 rounded-full">
                <span className="text-sm font-medium text-indigo-700">
                  {previewData.metadata.educationLevelInfo.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section Editor Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Secties ({sections.length})</h3>
            <p className="text-sm text-gray-600 mt-1">Sleep secties om de volgorde te wijzigen</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCollapsedSections(new Set())}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Alles uitklappen
              </button>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => setCollapsedSections(new Set(sections.map(s => s.id)))}
                className="text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Alles inklappen
              </button>
            </div>
            <button
              onClick={addSection}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Sectie Toevoegen
            </button>
          </div>
        </div>

        {/* Sections List */}
        <div className="space-y-6 mb-12">
          {sections.map((section, index) => (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 ${
                draggedIndex === index ? 'opacity-50 scale-95' : 'hover:shadow-md cursor-move'
              }`}
            >
              {/* Section Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full text-sm font-bold">
                        {index + 1}
                      </span>
                      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-800">
                      {section.title || `Sectie ${index + 1}`}
                    </h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleSectionCollapse(section.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title={collapsedSections.has(section.id) ? "Sectie uitklappen" : "Sectie inklappen"}
                    >
                      <svg 
                        className={`w-5 h-5 transition-transform duration-200 ${
                          collapsedSections.has(section.id) ? 'rotate-0' : 'rotate-180'
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {sections.length > 1 && (
                      <button
                        onClick={() => removeSection(index)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Sectie verwijderen"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Section Content - Collapsible */}
              {!collapsedSections.has(section.id) && (
                <div className="p-6 space-y-6">
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sectie Titel
                    </label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => handleSectionChange(index, 'title', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-lg"
                      placeholder="Voer een sectie titel in..."
                    />
                  </div>

                  {/* Description Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beschrijving
                    </label>
                    <textarea
                      value={section.description}
                      onChange={(e) => handleSectionChange(index, 'description', e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      placeholder="Beschrijf wat studenten in deze sectie moeten doen..."
                    />
                  </div>

                  {/* Guide Questions */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Hulpvragen voor studenten
                      </label>
                      <button
                        onClick={() => {
                          const newQuestions = [...section.guideQuestions, 'Nieuwe hulpvraag']
                          handleSectionChange(index, 'guideQuestions', newQuestions)
                        }}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        + Vraag toevoegen
                      </button>
                    </div>
                    <div className="space-y-3">
                      {section.guideQuestions.map((question, qIndex) => (
                        <div key={qIndex} className="flex items-center space-x-3">
                          <input
                            type="text"
                            value={question}
                            onChange={(e) => {
                              const newQuestions = [...section.guideQuestions]
                              newQuestions[qIndex] = e.target.value
                              handleSectionChange(index, 'guideQuestions', newQuestions)
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder={`Hulpvraag ${qIndex + 1}`}
                          />
                          {section.guideQuestions.length > 1 && (
                            <button
                              onClick={() => {
                                const newQuestions = section.guideQuestions.filter((_, i) => i !== qIndex)
                                handleSectionChange(index, 'guideQuestions', newQuestions)
                              }}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Word Count */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Woordenaantal (optioneel)
                    </label>
                    <input
                      type="text"
                      value={section.wordCount || ''}
                      onChange={(e) => handleSectionChange(index, 'wordCount', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="bijv. 200-300 woorden"
                    />
                  </div>
                </div>
              )}

              {/* Collapsed Section Summary */}
              {collapsedSections.has(section.id) && (
                <div className="px-6 py-4 text-sm text-gray-600">
                  <div className="space-y-2">
                    <p><span className="font-medium">Beschrijving:</span> {section.description || 'Geen beschrijving'}</p>
                    <p><span className="font-medium">Hulpvragen:</span> {section.guideQuestions.length} vragen</p>
                    {section.wordCount && (
                      <p><span className="font-medium">Woordenaantal:</span> {section.wordCount}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Floating Action Bar */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={regeneratePreview}
                className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Terug naar Upload
              </button>
              
              <button
                onClick={generateFinalEnvironment}
                disabled={isGenerating}
                className={`flex items-center px-8 py-3 rounded-xl font-semibold text-white transition-all ${
                  isGenerating
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Leeromgeving wordt gegenereerd...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Genereer Leeromgeving
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom spacing for floating action bar */}
        <div className="h-32"></div>
      </div>
    </div>
  )
}