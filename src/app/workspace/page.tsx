'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SimpleRichTextEditor from '@/components/SimpleRichTextEditor'
import StudentLogin from '@/components/StudentLogin'
import WorkImport from '@/components/WorkImport'
import { exportAssignmentToWord, exportAssignmentToPDF } from '@/utils/exportUtils'
import { studentAuth, type Student } from '@/utils/studentAuth'
import { workspaceStorage, type StudentWork } from '@/utils/workspaceStorage'

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
  
  // Student authentication states
  const [student, setStudent] = useState<Student | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showImport, setShowImport] = useState(false)
  
  // Sidebar collapse states
  const [collapsedSections, setCollapsedSections] = useState({
    studentInfo: false,
    workManagement: true,
    exportOptions: true
  })
  
  const router = useRouter()

  // Toggle collapsible sections
  const toggleSidebarSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

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
    // Check for logged in student
    const currentStudent = studentAuth.getCurrentStudent()
    setStudent(currentStudent)
    
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

  // Student login handlers
  const handleLogin = (loggedInStudent: Student) => {
    setStudent(loggedInStudent)
    setShowLogin(false)
  }

  const handleLogout = () => {
    if (confirm('Weet je zeker dat je wilt uitloggen? Je werk wordt lokaal opgeslagen.')) {
      studentAuth.logout()
      setStudent(null)
    }
  }

  // JSON Export/Import handlers
  const handleExportJSON = () => {
    if (!assignmentData || !student) {
      alert('Je moet ingelogd zijn om je werk te exporteren')
      return
    }

    try {
      const studentWork = workspaceStorage.exportToJSON(
        student.name,
        student.email,
        assignmentData,
        sectionContents
      )
      
      workspaceStorage.downloadJSON(studentWork)
    } catch (error) {
      console.error('JSON export failed:', error)
      alert('Er ging iets mis bij het exporteren. Probeer het opnieuw.')
    }
  }

  const handleImport = (studentWork: StudentWork) => {
    try {
      workspaceStorage.applyImportedData(studentWork)
      
      // Update current state
      setStudent({
        name: studentWork.studentName,
        email: studentWork.studentEmail,
        loginTime: new Date().toISOString()
      })
      
      setAssignmentData(studentWork.assignmentData)
      setSectionContents(studentWork.sectionContents)
      
      // Set first section as selected
      if (studentWork.assignmentData.sections.length > 0) {
        setSelectedSection(studentWork.assignmentData.sections[0].id)
      }
      
      setShowImport(false)
      alert('Werk succesvol geïmporteerd!')
    } catch (error) {
      console.error('Import failed:', error)
      alert('Er ging iets mis bij het importeren')
    }
  }

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
      // Create progress summary for cross-section awareness
      const sectionProgress = assignmentData.sections.map(section => ({
        id: section.id,
        title: section.title,
        description: section.description,
        content: sectionContents[section.id] || '',
        wordCount: section.wordCount,
        hasContent: !!(sectionContents[section.id] && sectionContents[section.id].trim()),
        isCurrentSection: section.id === selectedSection
      }))

      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          currentSection: currentSection,
          currentContent: sectionContents[selectedSection],
          allSectionContents: sectionContents, // NEW: All section contents
          sectionProgress: sectionProgress,    // NEW: Progress tracking
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance,
            sections: assignmentData.sections // Include section metadata
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
      {/* Left Sidebar - Redesigned */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          {/* Assignment Header - Compact */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">
              {assignmentData.metadata?.assignmentTitle || assignmentData.title}
            </h2>
            <div className="flex items-center justify-between text-xs text-gray-500">
              {assignmentData.metadata?.teacherName && (
                <span>{assignmentData.metadata.teacherName}</span>
              )}
              {assignmentData.metadata?.educationLevelInfo && (
                <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded">
                  {assignmentData.metadata.educationLevelInfo.name}
                </span>
              )}
            </div>
          </div>

          {/* Section Navigation - Primary Focus */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Secties
            </h3>
            <nav className="space-y-1">
              {assignmentData.sections.map((section, index) => {
                const hasContent = !!(sectionContents[section.id] && sectionContents[section.id].trim())
                const wordCount = hasContent ? sectionContents[section.id].split(/\s+/).length : 0
                
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={`w-full text-left px-3 py-3 rounded-lg transition-all group ${
                      selectedSection === section.id
                        ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{section.title}</span>
                      <div className="flex items-center space-x-1">
                        {hasContent && (
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        )}
                        <span className={`text-xs ${
                          selectedSection === section.id ? 'text-indigo-600' : 'text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {hasContent ? `${wordCount} woorden` : 'Nog niet gestart'}
                    </div>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Student Info - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => toggleSidebarSection('studentInfo')}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide hover:text-gray-900 transition-colors"
            >
              <span>Student</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${
                  collapsedSections.studentInfo ? 'rotate-0' : 'rotate-180'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {!collapsedSections.studentInfo && (
              <div className="p-3 bg-gray-50 rounded-lg">
                {student ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Ingelogd:</span>
                      <button
                        onClick={handleLogout}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors"
                      >
                        Uitloggen
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{student.name}</p>
                    {student.email && (
                      <p className="text-xs text-gray-500">{student.email}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-3">Niet ingelogd</p>
                    <button
                      onClick={() => setShowLogin(true)}
                      className="w-full py-2 px-3 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Inloggen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Work Management - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => toggleSidebarSection('workManagement')}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide hover:text-gray-900 transition-colors"
            >
              <span>Werk Beheren</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${
                  collapsedSections.workManagement ? 'rotate-0' : 'rotate-180'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {!collapsedSections.workManagement && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowImport(true)}
                  className="w-full py-2 px-3 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Werk Importeren
                </button>

                <button
                  onClick={handleExportJSON}
                  disabled={!student}
                  className={`w-full py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
                    !student
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                  title={!student ? 'Log eerst in om je werk te exporteren' : ''}
                >
                  JSON Exporteren
                </button>
              </div>
            )}
          </div>

          {/* Export Options - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => toggleSidebarSection('exportOptions')}
              className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide hover:text-gray-900 transition-colors"
            >
              <span>Exporteren</span>
              <svg 
                className={`w-4 h-4 transition-transform duration-200 ${
                  collapsedSections.exportOptions ? 'rotate-0' : 'rotate-180'
                }`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {!collapsedSections.exportOptions && (
              <div className="space-y-2">
                <button
                  onClick={handleExportWord}
                  disabled={isExporting}
                  className={`w-full py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
                    isExporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isExporting ? 'Exporteren...' : 'Word Document'}
                </button>
                
                <button
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  className={`w-full py-2 px-3 text-sm rounded-lg font-medium transition-colors ${
                    isExporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isExporting ? 'Exporteren...' : 'PDF Document'}
                </button>
              </div>
            )}
          </div>
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
      
      {/* Student Login Modal */}
      {showLogin && (
        <StudentLogin
          onLogin={handleLogin}
          onCancel={() => setShowLogin(false)}
        />
      )}
      
      {/* Work Import Modal */}
      {showImport && (
        <WorkImport
          onImport={handleImport}
          onCancel={() => setShowImport(false)}
        />
      )}
    </div>
  )
}