'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SimpleRichTextEditor from '@/components/SimpleRichTextEditor'
import { exportAssignmentToWord, exportAssignmentToPDF } from '@/utils/exportUtils'

interface Section {
  id: string
  title: string
  description: string
  guideQuestions: string[]
  wordCount?: string
}

interface AssignmentData {
  title: string
  objective: string
  sections: Section[]
  generalGuidance: string
  metadata?: {
    educationLevel: string
    educationLevelInfo: {
      name: string
      ageRange: string
      complexity: string
    }
    teacherName: string | null
    assignmentTitle: string | null
    instructions: string | null
    createdAt: string
  }
}

export default function WorkspacePage() {
  const [assignmentData, setAssignmentData] = useState<AssignmentData | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [sectionContents, setSectionContents] = useState<Record<string, string>>({})
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string}>>([])
  const [chatInput, setChatInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const router = useRouter()

  const handleExportWord = async () => {
    if (!assignmentData) return
    
    setIsExporting(true)
    try {
      await exportAssignmentToWord(assignmentData, sectionContents)
    } catch (error) {
      console.error('Word export failed:', error)
      alert('Er ging iets mis bij het exporteren naar Word. Probeer het opnieuw.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportPDF = async () => {
    if (!assignmentData) return
    
    setIsExporting(true)
    try {
      await exportAssignmentToPDF(assignmentData, sectionContents)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('Er ging iets mis bij het exporteren naar PDF. Probeer het opnieuw.')
    } finally {
      setIsExporting(false)
    }
  }

  useEffect(() => {
    const data = sessionStorage.getItem('assignmentData')
    console.log('Workspace: sessionStorage data:', data)
    
    if (!data) {
      console.log('No assignment data found, redirecting to home')
      router.push('/')
      return
    }
    
    try {
      const parsed = JSON.parse(data)
      console.log('Workspace: parsed data:', parsed)
      
      // Validate the data structure
      if (!parsed.title || !parsed.sections || !Array.isArray(parsed.sections)) {
        console.error('Invalid assignment data structure:', parsed)
        alert('Ongeldige opdracht data. Probeer opnieuw.')
        router.push('/')
        return
      }
      
      setAssignmentData(parsed)
      if (parsed.sections.length > 0) {
        setSelectedSection(parsed.sections[0].id)
      }
      
      // Initialize empty content for each section
      const initialContents: Record<string, string> = {}
      parsed.sections.forEach((section: Section) => {
        initialContents[section.id] = localStorage.getItem(`section-${section.id}`) || ''
      })
      setSectionContents(initialContents)
    } catch (e) {
      console.error('Error parsing assignment data:', e)
      router.push('/')
    }
  }, [router])

  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId)
    setChatMessages([]) // Clear chat when switching sections
  }

  const handleContentChange = (sectionId: string, content: string) => {
    setSectionContents(prev => ({ ...prev, [sectionId]: content }))
    localStorage.setItem(`section-${sectionId}`, content)
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !assignmentData) return

    const currentSection = assignmentData.sections.find(s => s.id === selectedSection)
    if (!currentSection) return

    const userMessage = chatInput
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          section: currentSection,
          currentContent: sectionContents[selectedSection],
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance
          },
          metadata: assignmentData.metadata
        })
      })

      if (response.ok) {
        const data = await response.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!assignmentData) return null

  const currentSection = assignmentData.sections.find(s => s.id === selectedSection)

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Sidebar - Sections */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          {/* Assignment Header */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            {assignmentData.metadata?.teacherName && (
              <p className="text-sm text-gray-600 mb-1">
                Docent: {assignmentData.metadata.teacherName}
              </p>
            )}
            <h2 className="text-lg font-bold text-gray-800">
              {assignmentData.metadata?.assignmentTitle || assignmentData.title}
            </h2>
            {assignmentData.metadata?.educationLevelInfo && (
              <p className="text-xs text-indigo-600 mt-1">
                {assignmentData.metadata.educationLevelInfo.name}
              </p>
            )}
            
            {/* Export Buttons */}
            <div className="mt-4 space-y-2">
              <button
                onClick={handleExportWord}
                disabled={isExporting}
                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isExporting
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isExporting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporteren...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    📄 Word
                  </span>
                )}
              </button>
              
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isExporting
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isExporting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporteren...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    📄 PDF
                  </span>
                )}
              </button>
            </div>
          </div>
          <nav className="space-y-2">
            {assignmentData.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedSection === section.id
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {section.title}
                {sectionContents[section.id] && (
                  <span className="ml-2 text-xs text-green-600">✓</span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Middle - Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {currentSection && (
            <>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  {currentSection.title}
                </h1>
                <p className="text-gray-600">{currentSection.description}</p>
                {currentSection.wordCount && (
                  <p className="text-sm text-gray-500 mt-1">
                    Richtlijn: {currentSection.wordCount} woorden
                  </p>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Hulpvragen om je op weg te helpen:
                </h3>
                <ul className="space-y-2">
                  {currentSection.guideQuestions.map((question, idx) => (
                    <li key={idx} className="flex items-start">
                      <span className="text-indigo-500 mr-2">•</span>
                      <span className="text-gray-600 text-sm">{question}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">Jouw tekst</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Gebruik de toolbar voor opmaak, tabellen en andere functies
                  </p>
                </div>
                <div className="p-4">
                  <SimpleRichTextEditor
                    value={sectionContents[selectedSection] || ''}
                    onChange={(content) => handleContentChange(selectedSection, content)}
                    placeholder="Begin hier met schrijven..."
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right - Collapsible Chat */}
      <div className={`transition-all duration-300 ${isChatOpen ? 'w-96' : 'w-12'} relative`}>
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-indigo-600 text-white p-2 rounded-l-lg hover:bg-indigo-700 transition-colors"
        >
          {isChatOpen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </button>

        {isChatOpen && (
          <div className="w-full h-full bg-white border-l border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Socratische Assistent</h3>
              <p className="text-sm text-gray-600">Ik help je door vragen te stellen</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                  <p className="text-sm">Stel een vraag over deze sectie</p>
                  <p className="text-xs mt-2">Ik zal je helpen door gerichte vragen te stellen</p>
                </div>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-left">
                  <div className="inline-block bg-gray-100 p-3 rounded-lg">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Stel een vraag..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}