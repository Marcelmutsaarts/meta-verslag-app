'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SimpleRichTextEditor from '@/components/SimpleRichTextEditor'
import StudentLogin from '@/components/StudentLogin'
import WorkImport from '@/components/WorkImport'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import ThemeToggle from '@/components/ThemeToggle'
import { exportAssignmentToWord, exportAssignmentToPDF } from '@/utils/exportUtils'

// Types
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Student {
  name: string
  email?: string
}

interface FormativeState {
  learningGoals: {
    sections: { [sectionId: string]: { content: string; status: 'draft' | 'final'; updatedAt: string } }
    wholeAssignment?: { content: string; status: 'draft' | 'final'; updatedAt: string }
  }
  examples: {
    data: { [sectionId: string]: { content: string; generatedAt: string } }
    reflections: { [sectionId: string]: string }
    loading: { [sectionId: string]: boolean }
  }
  quiz: {
    isLoading: boolean
    currentQuiz?: any
  }
}

export default function WorkspacePage() {
  // State management
  const [assignmentData, setAssignmentData] = useState<any>(null)
  const [selectedSection, setSelectedSection] = useState('')
  const [sectionContents, setSectionContents] = useState<{ [key: string]: string }>({})
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  
  // Student state
  const [student, setStudent] = useState<Student | null>(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showImport, setShowImport] = useState(false)
  
  // Modal states
  const [showLearningGoalModal, setShowLearningGoalModal] = useState(false)
  const [showExampleModal, setShowExampleModal] = useState<string | null>(null)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [exampleContext, setExampleContext] = useState('')
  const [quizMessages, setQuizMessages] = useState<ChatMessage[]>([])
  const [quizInput, setQuizInput] = useState('')
  const [quizTyping, setQuizTyping] = useState(false)
  const [tooltip, setTooltip] = useState<{text: string, x: number, y: number, visible: boolean}>({
    text: '',
    x: 0,
    y: 0,
    visible: false
  })

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
    visible: boolean
    id: number
  } | null>(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState<{
    type: 'whole-assignment' | 'section'
    goal: string
    sectionTitle?: string
  } | null>(null)
  const [feedbackMessages, setFeedbackMessages] = useState<ChatMessage[]>([])
  const [feedbackInput, setFeedbackInput] = useState('')
  const [isFeedbackTyping, setIsFeedbackTyping] = useState(false)
  
  // Formative assessment state
  const [formativeState, setFormativeState] = useState<FormativeState>({
    learningGoals: { sections: {} },
    examples: { data: {}, reflections: {}, loading: {} },
    quiz: { isLoading: false }
  })
  
  // Sidebar collapsed sections
  const [collapsedSections, setCollapsedSections] = useState({
    studentInfo: false,
    workManagement: false,
    formativeOptions: true
  })

  const router = useRouter()

  // Toast notification functions
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Date.now()
    setToast({ message, type, visible: true, id })
    
    // Auto-hide after 4 seconds for success/info, 6 seconds for warnings/errors
    const duration = type === 'error' || type === 'warning' ? 6000 : 4000
    setTimeout(() => {
      setToast(prev => prev && prev.id === id ? { ...prev, visible: false } : prev)
    }, duration)

    // Remove completely after animation
    setTimeout(() => {
      setToast(prev => prev && prev.id === id ? null : prev)
    }, duration + 300)
  }

  const hideToast = () => {
    setToast(prev => prev ? { ...prev, visible: false } : null)
  }

  // Load assignment data on mount
  useEffect(() => {
    console.log('=== WORKSPACE LOADING ASSIGNMENT DATA ===')
    console.log('Checking sessionStorage for assignmentData...')
    
    const data = sessionStorage.getItem('assignmentData')
    console.log('Raw sessionStorage data:', data ? `Found data (${data.length} chars)` : 'No data found')
    
    if (data) {
      try {
        console.log('Parsing assignment data...')
        const parsed = JSON.parse(data)
        console.log('Successfully parsed assignment data:', {
          title: parsed.title,
          sectionsCount: parsed.sections?.length || 0,
          hasMetadata: !!parsed.metadata
        })
        
        setAssignmentData(parsed)
        if (parsed.sections && parsed.sections.length > 0) {
          console.log('Setting initial section to:', parsed.sections[0].id)
          setSelectedSection(parsed.sections[0].id)
        }
      } catch (error) {
        console.error('=== ERROR PARSING ASSIGNMENT DATA ===')
        console.error('Error details:', error)
        console.error('Raw data that failed to parse:', data)
        alert('Fout bij het laden van de opdracht data. Ga terug naar de hoofdpagina.')
        router.push('/')
      }
    } else {
      console.log('No assignment data found in sessionStorage, redirecting to home')
      router.push('/')
    }
  }, [router])

  // Load saved content for each section
  useEffect(() => {
    if (assignmentData?.sections) {
      const savedContents: { [key: string]: string } = {}
      assignmentData.sections.forEach((section: any) => {
        const saved = localStorage.getItem(`section-${section.id}`)
        if (saved) {
          savedContents[section.id] = saved
        }
      })
      setSectionContents(savedContents)
    }
  }, [assignmentData])

  // Load student info
  useEffect(() => {
    const savedStudent = localStorage.getItem('student')
    if (savedStudent) {
      try {
        setStudent(JSON.parse(savedStudent))
      } catch (error) {
        console.error('Error parsing student data:', error)
      }
    }
  }, [])

  // Load formative state
  useEffect(() => {
    if (assignmentData?.sections) {
      const newFormativeState: FormativeState = {
        learningGoals: { sections: {} },
        examples: { data: {}, reflections: {}, loading: {} },
        quiz: { isLoading: false }
      }

      // Load learning goals
      assignmentData.sections.forEach((section: any) => {
        const goalData = localStorage.getItem(`learningGoal-${section.id}`)
        if (goalData) {
          try {
            newFormativeState.learningGoals.sections[section.id] = JSON.parse(goalData)
          } catch (error) {
            console.error('Error parsing learning goal data:', error)
          }
        }
      })

      // Load whole assignment learning goal
      const wholeGoalData = localStorage.getItem('learningGoal-whole-assignment')
      if (wholeGoalData) {
        try {
          newFormativeState.learningGoals.wholeAssignment = JSON.parse(wholeGoalData)
        } catch (error) {
          console.error('Error parsing whole assignment learning goal:', error)
        }
      }

      // Load examples and reflections
      assignmentData.sections.forEach((section: any) => {
        const exampleData = localStorage.getItem(`example-${section.id}`)
        if (exampleData) {
          try {
            newFormativeState.examples.data[section.id] = JSON.parse(exampleData)
          } catch (error) {
            console.error('Error parsing example data:', error)
          }
        }

        const reflectionData = localStorage.getItem(`reflection-${section.id}`)
        if (reflectionData) {
          newFormativeState.examples.reflections[section.id] = reflectionData
        }
      })

      setFormativeState(newFormativeState)
    }
  }, [assignmentData])

  // Focus mode keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false)
      }
    }

    if (focusMode) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [focusMode])

  // Auto-start feedback when modal opens
  useEffect(() => {
    if (showFeedbackModal && feedbackMessages.length === 0) {
      console.log('Auto-starting feedback for modal:', showFeedbackModal)
      const goal = showFeedbackModal.goal
      const initialMessage = showFeedbackModal.type === 'whole-assignment' 
        ? `Ik heb een leerdoel opgesteld voor de hele opdracht: "${goal}". Kun je me kort en krachtig Socratische feedback geven om het leerdoel scherper te maken?`
        : `Ik heb een leerdoel opgesteld voor sectie "${showFeedbackModal.sectionTitle}": "${goal}". Kun je me kort en krachtig Socratische feedback geven om het leerdoel scherper te maken?`
      
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        handleFeedbackMessage(initialMessage, true) // Hide the automatic prompt from user
      }, 500)
    }
  }, [showFeedbackModal, feedbackMessages.length])

  // Handlers
  const handleSectionChange = (sectionId: string) => {
    setSelectedSection(sectionId)
    setChatMessages([])
    setChatInput('')
  }

  const handleContentChange = (sectionId: string, content: string) => {
    setSectionContents(prev => ({ ...prev, [sectionId]: content }))
    localStorage.setItem(`section-${sectionId}`, content)
  }

  const toggleSidebarSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const handleLogin = (studentData: Student) => {
    setStudent(studentData)
    localStorage.setItem('student', JSON.stringify(studentData))
    setShowLogin(false)
  }

  const handleLogout = () => {
    setStudent(null)
    localStorage.removeItem('student')
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isTyping) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: chatInput.trim()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsTyping(true)

    try {
      const currentSection = assignmentData.sections.find((s: any) => s.id === selectedSection)
      
      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          currentSection: currentSection ? {
            title: currentSection.title,
            description: currentSection.description,
            guideQuestions: currentSection.guideQuestions
          } : null,
          currentContent: sectionContents[selectedSection] || '',
          sectionProgress: assignmentData.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            content: sectionContents[section.id] || '',
            hasContent: !!(sectionContents[section.id] && sectionContents[section.id].trim())
          })),
          assignmentContext: {
            title: assignmentData.title,
            description: assignmentData.description || ''
          },
          metadata: assignmentData.metadata,
          learningGoals: {
            wholeAssignment: formativeState.learningGoals.wholeAssignment,
            currentSection: formativeState.learningGoals.sections[selectedSection],
            allSections: formativeState.learningGoals.sections
          },
          reflectionContext: formativeState.examples.reflections[selectedSection] ? {
            sectionId: selectedSection,
            reflection: formativeState.examples.reflections[selectedSection],
            example: formativeState.examples.data[selectedSection]
          } : null,
          formativeState: {
            quiz: formativeState.quiz,
            examples: formativeState.examples
          },
          isQuizMode: false,  // Updated to remove non-existent property
          quizContext: null,
          chatHistory: chatMessages
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response
        }
        setChatMessages(prev => [...prev, assistantMessage])
      } else {
        let errorMessage = `Failed to get response: ${response.status}`
        try {
          const errorData = await response.json()
          console.error('API Error Response:', response.status, errorData)
          errorMessage = `Failed: ${errorData.error} - ${errorData.details || ''}`
        } catch (e) {
          console.error('Could not parse error response as JSON:', e)
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, er ging iets mis. ${error instanceof Error ? error.message : 'Probeer het opnieuw.'}`
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  // New function for generating and placing examples
  const handleGenerateAndPlaceExample = async (scope: 'current-section' | 'whole-assignment') => {
    console.log('=== GENERATE AND PLACE EXAMPLE STARTED ===')
    console.log('Scope:', scope)
    
    const targetSectionId = scope === 'current-section' ? selectedSection : 'whole-assignment'
    
    if (formativeState.examples.loading[targetSectionId]) {
      console.log('Already loading, skipping...')
      return
    }

    // Set loading state
    setFormativeState(prev => ({
      ...prev,
      examples: {
        ...prev.examples,
        loading: { ...prev.examples.loading, [targetSectionId]: true }
      }
    }))

    try {
      // Generate the example using the existing API call logic
      const isWholeAssignment = scope === 'whole-assignment'
      const currentSection = !isWholeAssignment ? assignmentData.sections.find((s: any) => s.id === selectedSection) : null
      const teacherContext = assignmentData.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.customReflectionQuestions || ''
      
      // Combine teacher context and student context
      let combinedContext = ''
      if (teacherContext) {
        combinedContext += `Docent context: ${teacherContext}`
      }
      if (exampleContext.trim()) {
        if (combinedContext) combinedContext += '\n\n'
        combinedContext += `Student context: ${exampleContext.trim()}`
      }
      
      const requestBody = {
        scope: isWholeAssignment ? 'all-sections' : 'current-section',
        sectionId: targetSectionId,
        currentSection: !isWholeAssignment ? {
          id: selectedSection,
          title: currentSection?.title,
          description: currentSection?.description,
          content: sectionContents[selectedSection] || ''
        } : null,
        allSections: assignmentData.sections,
        assignmentContext: {
          title: assignmentData.title,
          objective: assignmentData.objective,
          sections: assignmentData.sections,
          educationLevel: assignmentData.metadata?.educationLevelInfo?.name
        },
        metadata: assignmentData.metadata,
        formativeAssessment: assignmentData.metadata?.formativeAssessment,
        customContext: combinedContext
      }
      
      console.log('Sending request to /api/generate-example...')
      
      const response = await fetch('/api/generate-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', errorText)
        throw new Error('Failed to generate example')
      }

      const exampleData = await response.json()
      console.log('Generated example data:', exampleData)
      
      if (exampleData) {
        // Place the example in the appropriate section(s)
        await placeExampleInSections(exampleData, scope)
        
        // Close the modal after successful placement
        setShowExampleModal(null)
        setExampleContext('')
        
        // Show success message
        showToast(
          `✅ Voorbeeld succesvol ${scope === 'current-section' ? 'geplaatst in de huidige sectie' : 'verdeeld over alle secties'}!`,
          'success'
        )
      }
    } catch (error) {
      console.error('Error generating and placing example:', error)
      showToast(
        `❌ Er ging iets mis bij het genereren en plaatsen van het voorbeeld: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
        'error'
      )
    } finally {
      setFormativeState(prev => ({
        ...prev,
        examples: {
          ...prev.examples,
          loading: { ...prev.examples.loading, [targetSectionId]: false }
        }
      }))
    }
  }

  // Helper function to convert markdown to HTML for rich text editor
  const convertMarkdownToHtml = (markdown: string): string => {
    if (!markdown) return ''
    
    let html = markdown
    
    // Convert bold text (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>')
    
    // Convert italic text (*text* or _text_)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
    html = html.replace(/_(.*?)_/g, '<em>$1</em>')
    
    // Convert headers (# Header)
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>')
    
    // Convert line breaks to paragraphs
    const paragraphs = html.split(/\n\s*\n/).filter(p => p.trim())
    html = paragraphs.map(p => {
      const trimmed = p.trim().replace(/\n/g, ' ')
      // Don't wrap if already a heading or list
      if (trimmed.match(/^<h[1-6]>/) || trimmed.match(/^<[uo]l>/)) {
        return trimmed
      }
      return `<p>${trimmed}</p>`
    }).join('')
    
    // Convert unordered lists (- item or * item)
    html = html.replace(/^[\s]*[-*]\s+(.+)$/gm, '<li>$1</li>')
    
    // Wrap consecutive list items in ul tags
    html = html.replace(/(<li>.*<\/li>)/g, (match) => {
      if (!match.includes('<ul>')) {
        return `<ul>${match}</ul>`
      }
      return match
    })
    
    // Convert numbered lists (1. item)
    html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    
    // Wrap consecutive numbered list items in ol tags
    html = html.replace(/(<li>.*<\/li>)/g, (match) => {
      if (!match.includes('<ol>') && !match.includes('<ul>')) {
        return `<ol>${match}</ol>`
      }
      return match
    })
    
    console.log('Markdown conversion:', { original: markdown.substring(0, 200), converted: html.substring(0, 200) })
    return html
  }

  // Helper function to place examples in sections
  const placeExampleInSections = async (exampleData: any, scope: 'current-section' | 'whole-assignment') => {
    console.log('=== PLACING EXAMPLE IN SECTIONS ===')
    console.log('Scope:', scope)
    console.log('Example data:', exampleData)
    
    if (scope === 'current-section') {
      // Place in current section only
      const content = exampleData.examples[selectedSection]
      if (content) {
        console.log('Placing content in current section:', selectedSection)
        
        // Convert markdown to HTML for rich text editor
        const htmlContent = convertMarkdownToHtml(content)
        console.log('Converted content for rich text editor')
        
        // Update the section content
        setSectionContents(prev => ({ ...prev, [selectedSection]: htmlContent }))
        localStorage.setItem(`section-${selectedSection}`, htmlContent)
        
        // Save example data for reference (original markdown + converted HTML)
        const exampleRecord = {
          content: htmlContent,
          originalMarkdown: content,
          generatedAt: new Date().toISOString()
        }
        
        setFormativeState(prev => ({
          ...prev,
          examples: {
            ...prev.examples,
            data: { ...prev.examples.data, [selectedSection]: exampleRecord }
          }
        }))
        
        localStorage.setItem(`example-${selectedSection}`, JSON.stringify(exampleRecord))
        console.log('Current section example placed successfully')
      } else {
        throw new Error('No content found for current section')
      }
    } else {
      // Place across all sections (whole assignment)
      console.log('Distributing content across all sections')
      console.log('Available examples:', Object.keys(exampleData.examples))
      
      let placedSections = 0
      const newSectionContents = { ...sectionContents }
      const newExampleData = { ...formativeState.examples.data }
      
      // Place content in each section
      assignmentData.sections.forEach((section: any) => {
        const content = exampleData.examples[section.id]
        if (content && content.trim()) {
          console.log(`Placing content in section: ${section.id} (${section.title})`)
          
          // Convert markdown to HTML for rich text editor
          const htmlContent = convertMarkdownToHtml(content)
          console.log('Converted content for section:', section.id)
          
          // Update section content
          newSectionContents[section.id] = htmlContent
          localStorage.setItem(`section-${section.id}`, htmlContent)
          
          // Save example reference for this section (original markdown + converted HTML)
          const exampleRecord = {
            content: htmlContent,
            originalMarkdown: content,
            generatedAt: new Date().toISOString()
          }
          newExampleData[section.id] = exampleRecord
          localStorage.setItem(`example-${section.id}`, JSON.stringify(exampleRecord))
          
          placedSections++
        } else {
          console.warn(`No content available for section: ${section.id}`)
        }
      })
      
      // Update state with all changes
      setSectionContents(newSectionContents)
      
      // Save whole assignment example record
      const wholeAssignmentRecord = {
        content: JSON.stringify(exampleData.examples),
        generatedAt: new Date().toISOString()
      }
      newExampleData['whole-assignment'] = wholeAssignmentRecord
      localStorage.setItem('example-whole-assignment', JSON.stringify(wholeAssignmentRecord))
      
      setFormativeState(prev => ({
        ...prev,
        examples: {
          ...prev.examples,
          data: newExampleData
        }
      }))
      
      console.log(`Successfully placed content in ${placedSections} sections`)
      
      if (placedSections === 0) {
        throw new Error('No content could be placed in any section')
      }
    }
    
    console.log('Example placement completed successfully')
  }

  // Function to view/review previous examples
  const handleViewExample = (exampleKey: string) => {
    const exampleData = formativeState.examples.data[exampleKey]
    if (exampleData) {
      console.log('Viewing example:', exampleKey, exampleData)
      
      // Show preview in a more user-friendly way
      const isWholeAssignment = exampleKey === 'whole-assignment'
      const previewLength = 300
      const content = exampleData.content
      const preview = content.length > previewLength 
        ? content.substring(0, previewLength) + '...' 
        : content
      
      showToast(
        `📄 Voorbeeld ${isWholeAssignment ? 'voor hele opdracht' : 'voor sectie'} (${content.length} tekens)`,
        'info'
      )
      
      // Could be enhanced to show in a proper modal later
      console.log('Full example content:', content)
    } else {
      showToast('❌ Geen voorbeeld data gevonden', 'error')
    }
  }

  // Existing function (kept for backward compatibility)
  const handleGenerateExample = async (sectionId: string) => {
    console.log('=== GENERATE EXAMPLE STARTED ===')
    console.log('Section ID:', sectionId)
    
    if (formativeState.examples.loading[sectionId]) {
      console.log('Already loading, skipping...')
      return
    }

    setFormativeState(prev => ({
      ...prev,
      examples: {
        ...prev.examples,
        loading: { ...prev.examples.loading, [sectionId]: true }
      }
    }))

    try {
      const isWholeAssignment = sectionId === 'whole-assignment'
      const currentSection = !isWholeAssignment ? assignmentData.sections.find((s: any) => s.id === sectionId) : null
      const contextPrompt = assignmentData.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.customReflectionQuestions || ''
      
      console.log('Request details:', {
        isWholeAssignment,
        currentSection: currentSection?.title,
        contextPrompt: contextPrompt.substring(0, 50) + '...',
        hasAssignmentData: !!assignmentData,
        hasMetadata: !!assignmentData.metadata
      })
      
      const requestBody = {
        scope: isWholeAssignment ? 'all-sections' : 'current-section',
        sectionId: sectionId, // Add the section ID to the request
        currentSection: !isWholeAssignment ? {
          id: sectionId,
          title: currentSection?.title,
          description: currentSection?.description,
          content: sectionContents[sectionId] || ''
        } : null,
        allSections: assignmentData.sections,
        assignmentContext: {
          title: assignmentData.title,
          objective: assignmentData.objective,
          sections: assignmentData.sections,
          educationLevel: assignmentData.metadata?.educationLevelInfo?.name
        },
        metadata: assignmentData.metadata,
        formativeAssessment: assignmentData.metadata?.formativeAssessment,
        customContext: contextPrompt
      }
      
      console.log('Sending request to /api/generate-example...')
      console.log('Request body size:', JSON.stringify(requestBody).length, 'characters')
      
      const response = await fetch('/api/generate-example', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      console.log('Response received:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      })

      if (response.ok) {
        console.log('Response OK, parsing JSON...')
        const data = await response.json()
        console.log('Response data:', data)
        
        if (!data.examples || !data.examples[sectionId]) {
          console.error('No example for section in response data:', data)
          throw new Error(`No example content found for section: ${sectionId}`)
        }
        
        const exampleData = {
          content: data.examples[sectionId],
          generatedAt: new Date().toISOString()
        }

        console.log('Saving example data:', {
          sectionId,
          contentLength: exampleData.content.length
        })

        setFormativeState(prev => ({
          ...prev,
          examples: {
            ...prev.examples,
            data: { ...prev.examples.data, [sectionId]: exampleData }
          }
        }))

        localStorage.setItem(`example-${sectionId}`, JSON.stringify(exampleData))
        console.log('Example generated and saved successfully')
      } else {
        console.error('Response not OK, getting error details...')
        const errorText = await response.text()
        console.error('Error response:', errorText)
        
        let errorMessage = 'Failed to generate example'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Error text is not JSON
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error generating example:', error)
      showToast('❌ Er ging iets mis bij het genereren van het voorbeeld. Probeer het opnieuw.', 'error')
    } finally {
      setFormativeState(prev => ({
        ...prev,
        examples: {
          ...prev.examples,
          loading: { ...prev.examples.loading, [sectionId]: false }
        }
      }))
    }
  }

  const handleStartQuiz = async (sectionId: string) => {
    setFormativeState(prev => ({
      ...prev,
      quiz: { ...prev.quiz, isLoading: true }
    }))

    try {
      const currentSection = assignmentData.sections.find((s: any) => s.id === sectionId)
      
      if (!currentSection) {
        throw new Error('Sectie niet gevonden')
      }

      // Prepare the target section with content
      const targetSection = {
        ...currentSection,
        content: sectionContents[sectionId] || ''
      }
      
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'current-section',
          targetSections: [targetSection],
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective || '',
            sections: assignmentData.sections
          },
          metadata: assignmentData.metadata,
          formativeState: formativeState
        }),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Quiz response data:', data)
        
        setFormativeState(prev => ({
          ...prev,
          quiz: { 
            ...prev.quiz, 
            active: true,
            scope: 'current-section',
            initialQuestion: data.initialQuestions,
            targetSections: data.targetSections,
            isLoading: false 
          }
        }))
        
        // Start the quiz by opening quiz modal with the initial question
        setQuizMessages([{
          role: 'assistant',
          content: data.initialQuestions
        }])
        setShowQuizModal(true)
        
        console.log('Quiz started successfully with question:', data.initialQuestions.substring(0, 100) + '...')
        
      } else {
        const errorData = await response.json()
        console.error('Quiz API error:', errorData)
        throw new Error(errorData.error || 'Failed to generate quiz')
      }
    } catch (error) {
      console.error('Error starting quiz:', error)
      showToast('❌ Er ging iets mis bij het genereren van de quiz. Probeer het opnieuw.', 'error')
    } finally {
      setFormativeState(prev => ({
        ...prev,
        quiz: { ...prev.quiz, isLoading: false }
      }))
    }
  }

  const handleStopQuiz = () => {
    setFormativeState(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        active: false,
        initialQuestion: '',
        targetSections: [],
        scope: ''
      }
    }))
    setShowQuizModal(false)
    setQuizMessages([])
    setQuizInput('')
    console.log('Quiz stopped')
  }

  const showTooltip = (e: React.MouseEvent, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      visible: true
    })
  }

  const hideTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }))
  }

  const handleQuizMessage = async () => {
    if (!quizInput.trim() || quizTyping) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: quizInput.trim()
    }

    setQuizMessages(prev => [...prev, userMessage])
    setQuizInput('')
    setQuizTyping(true)

    try {
      const currentSection = assignmentData.sections.find((s: any) => s.id === selectedSection)
      
      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          currentSection: currentSection ? {
            id: currentSection.id,
            title: currentSection.title,
            description: currentSection.description,
            guideQuestions: currentSection.guideQuestions
          } : null,
          currentContent: sectionContents[selectedSection] || '',
          sectionProgress: assignmentData.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            description: section.description,
            content: sectionContents[section.id] || '',
            hasContent: !!(sectionContents[section.id] && sectionContents[section.id].trim()),
            isCurrentSection: section.id === selectedSection
          })),
          assignmentContext: {
            title: assignmentData.title,
            description: assignmentData.description || '',
            objective: assignmentData.objective || ''
          },
          metadata: assignmentData.metadata,
          learningGoals: {
            wholeAssignment: formativeState.learningGoals.wholeAssignment,
            currentSection: formativeState.learningGoals.sections[selectedSection],
            allSections: formativeState.learningGoals.sections
          },
          formativeState: formativeState,
          isQuizMode: true,
          quizContext: null,
          chatHistory: quizMessages
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response
        }
        setQuizMessages(prev => [...prev, assistantMessage])
      } else {
        let errorMessage = `Failed to get response: ${response.status}`
        try {
          const errorData = await response.json()
          console.error('Quiz API Error Response:', response.status, errorData)
          errorMessage = `Failed: ${errorData.error} - ${errorData.details || ''}`
        } catch (e) {
          console.error('Could not parse error response as JSON:', e)
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error sending quiz message:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Er ging iets mis bij het versturen van je bericht. Probeer het opnieuw.'
      }
      setQuizMessages(prev => [...prev, errorMessage])
    } finally {
      setQuizTyping(false)
    }
  }

  const handleReflectionChat = async (sectionId: string, reflection: string) => {
    const currentSection = assignmentData.sections.find((s: any) => s.id === selectedSection)
    
    const reflectionMessage: ChatMessage = {
      role: 'user',
      content: `Ik heb een reflectie geschreven op het voorbeeld voor sectie "${currentSection.title}". Mijn reflectie: "${reflection}". Kun je me helpen om nog dieper na te denken over wat ik heb geleerd?`
    }

    setChatMessages([reflectionMessage])
    setIsChatOpen(true)
    
    // This would trigger the Socratic chat with the reflection context
    // The actual implementation would call handleSendMessage or similar
  }

  const handleFeedbackMessage = async (initialMessage?: string, hideUserMessage: boolean = false) => {
    console.log('handleFeedbackMessage called with:', initialMessage, 'hideUserMessage:', hideUserMessage)
    console.log('showFeedbackModal:', showFeedbackModal)
    
    if (!showFeedbackModal) {
      console.log('No feedback modal, returning')
      return
    }
    
    const messageContent = initialMessage || feedbackInput.trim()
    console.log('Message content:', messageContent)
    
    if (!messageContent && !initialMessage) {
      console.log('No message content, returning')
      return
    }

    // Only add user message to chat if it's not hidden (i.e., not an automatic prompt)
    if (!hideUserMessage) {
      const userMessage: ChatMessage = {
        role: 'user',
        content: messageContent
      }
      console.log('Adding user message to chat')
      setFeedbackMessages(prev => [...prev, userMessage])
    } else {
      console.log('Hiding user message (automatic prompt)')
    }
    
    if (!initialMessage) setFeedbackInput('')
    setIsFeedbackTyping(true)

    try {
      const currentSection = assignmentData.sections.find((s: any) => s.id === selectedSection)
      console.log('Current section:', currentSection)
      console.log('Making API call to /api/socratic-chat')
      
      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          currentSection: currentSection ? {
            title: currentSection.title,
            description: currentSection.description,
            guideQuestions: currentSection.guideQuestions
          } : null,
          currentContent: sectionContents[selectedSection] || '',
          sectionProgress: assignmentData.sections.map((section: any) => ({
            id: section.id,
            title: section.title,
            content: sectionContents[section.id] || '',
            hasContent: !!(sectionContents[section.id] && sectionContents[section.id].trim())
          })),
          assignmentContext: {
            title: assignmentData.title,
            description: assignmentData.description || ''
          },
          metadata: assignmentData.metadata,
          learningGoals: {
            wholeAssignment: formativeState.learningGoals.wholeAssignment,
            currentSection: formativeState.learningGoals.sections[selectedSection],
            allSections: formativeState.learningGoals.sections
          },
          feedbackContext: {
            type: showFeedbackModal.type,
            goal: showFeedbackModal.goal,
            sectionTitle: showFeedbackModal.sectionTitle,
            isFeedbackRequest: true
          },
          chatHistory: feedbackMessages
        }),
      })

      console.log('Response status:', response.status)
      
      if (response.ok) {
        console.log('Response OK, parsing JSON')
        const data = await response.json()
        console.log('Received data:', data)
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response
        }
        setFeedbackMessages(prev => [...prev, assistantMessage])
        console.log('Added assistant message to feedback messages')
      } else {
        const errorText = await response.text()
        console.error('API error response:', response.status, errorText)
        throw new Error(`Failed to get response: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('Error sending feedback message:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, er ging iets mis. Probeer het opnieuw.'
      }
      setFeedbackMessages(prev => [...prev, errorMessage])
    } finally {
      setIsFeedbackTyping(false)
    }
  }

  const handleExportJSON = () => {
    console.log('Export JSON clicked, student:', student)
    
    const studentData = student || { name: 'Anonieme Student', email: '' }

    setIsExporting(true)
    
    try {
      const exportData = {
        student: studentData,
        assignmentData,
        sectionContents,
        formativeState,
        exportedAt: new Date().toISOString()
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${studentData.name}_${assignmentData.title}_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting JSON:', error)
      showToast('❌ Er ging iets mis bij het exporteren. Probeer het opnieuw.', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportWork = (importData: any) => {
    try {
      if (importData.sectionContents) {
        setSectionContents(importData.sectionContents)
        Object.keys(importData.sectionContents).forEach(sectionId => {
          localStorage.setItem(`section-${sectionId}`, importData.sectionContents[sectionId])
        })
      }

      if (importData.formativeState) {
        setFormativeState(importData.formativeState)
        // Save formative data to localStorage
        if (importData.formativeState.learningGoals?.sections) {
          Object.keys(importData.formativeState.learningGoals.sections).forEach(sectionId => {
            localStorage.setItem(`learningGoal-${sectionId}`, JSON.stringify(importData.formativeState.learningGoals.sections[sectionId]))
          })
        }
        if (importData.formativeState.learningGoals?.wholeAssignment) {
          localStorage.setItem('learningGoal-whole-assignment', JSON.stringify(importData.formativeState.learningGoals.wholeAssignment))
        }
      }

      showToast('✅ Werk succesvol geïmporteerd!', 'success')
      setShowImport(false)
    } catch (error) {
      console.error('Error importing work:', error)
      showToast('❌ Er ging iets mis bij het importeren van het werk', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (!assignmentData || !assignmentData.sections || !Array.isArray(assignmentData.sections)) {
    console.error('Invalid assignment data structure:', assignmentData)
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-accent mx-auto mb-4"></div>
          <h2 className="text-heading text-xl font-semibold mb-2">Leeromgeving laden...</h2>
          <p className="text-muted">Even geduld, we bereiden je workspace voor.</p>
          {assignmentData && !assignmentData.sections && (
            <p className="text-red-500 mt-4">⚠️ Ongeldige data structuur. Probeer opnieuw.</p>
          )}
        </div>
      </div>
    )
  }

  const currentSection = assignmentData.sections.find((s: any) => s.id === selectedSection)

  return (
    <div className={`workspace-container h-screen flex ${focusMode ? 'focus-mode' : ''}`}>
      {/* Left Sidebar - Compact & Clean */}
      <div className="workspace-sidebar w-56 overflow-y-auto">
        <div className="p-4">
          {/* Assignment Header - Compact */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-body mb-1">
              {assignmentData.metadata?.assignmentTitle || assignmentData.title}
            </h2>
            <div className="flex items-center justify-between text-xs text-muted">
              {assignmentData.metadata?.teacherName && (
                <span>{assignmentData.metadata.teacherName}</span>
              )}
              {assignmentData.metadata?.educationLevelInfo && (
                <span className="status-badge final">
                  {assignmentData.metadata.educationLevelInfo.name}
                </span>
              )}
            </div>
          </div>

          {/* Section Navigation - Primary Focus */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-heading mb-3 uppercase tracking-wide">
              Secties
            </h3>
            <nav className="space-y-2">
              {assignmentData.sections.map((section: any, index: number) => {
                const hasContent = !!(sectionContents[section.id] && sectionContents[section.id].trim())
                const wordCount = hasContent ? sectionContents[section.id].split(/\s+/).length : 0
                
                return (
                  <button
                    key={section.id}
                    onClick={() => handleSectionChange(section.id)}
                    className={`nav-item ${selectedSection === section.id ? 'active' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="nav-item-title">{section.title}</span>
                      <div className="flex items-center space-x-2">
                        <div className={`progress-dot ${
                          selectedSection === section.id ? 'current' : hasContent ? 'has-content' : 'empty'
                        }`} />
                      </div>
                    </div>
                    <div className="nav-item-meta">
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
              className="flex items-center justify-between w-full text-sm font-semibold text-heading mb-2 uppercase tracking-wide hover:text-accent transition-colors"
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
              <div className="p-3 bg-card rounded-lg">
                {student ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-body">Ingelogd:</span>
                      <button
                        onClick={handleLogout}
                        className="text-xs text-red-600 hover:text-red-800 transition-colors"
                      >
                        Uitloggen
                      </button>
                    </div>
                    <p className="text-sm text-body font-medium">{student.name}</p>
                    {student.email && (
                      <p className="text-xs text-muted">{student.email}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-muted mb-3">Niet ingelogd</p>
                    <button
                      onClick={() => setShowLogin(true)}
                      className="w-full btn btn-primary text-sm"
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
              className="flex items-center justify-between w-full text-sm font-semibold text-heading mb-2 uppercase tracking-wide hover:text-accent transition-colors"
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
              <div className="space-y-2" style={{ position: 'relative', zIndex: 10 }}>
                <button
                  onClick={() => setShowImport(true)}
                  className="w-full btn btn-secondary text-sm"
                  type="button"
                >
                  Werk Importeren
                </button>

                <button
                  onClick={handleExportJSON}
                  className="w-full btn btn-secondary text-sm"
                  type="button"
                >
                  JSON Exporteren
                </button>

                <button
                  onClick={async () => {
                    console.log('Word export clicked, student:', student, 'isExporting:', isExporting)
                    const studentData = student || { name: 'Anonieme Student', email: '' }
                    setIsExporting(true)
                    try {
                      await exportAssignmentToWord(assignmentData, sectionContents, studentData)
                    } catch (error) {
                      console.error('Error exporting to Word:', error)
                      alert('Er ging iets mis bij het exporteren naar Word. Probeer het opnieuw.')
                    } finally {
                      setIsExporting(false)
                    }
                  }}
                  disabled={isExporting}
                  className="w-full btn btn-secondary text-sm disabled:opacity-50"
                  type="button"
                >
                  {isExporting ? 'Exporteren...' : 'Word Document'}
                </button>

                <button
                  onClick={async () => {
                    console.log('PDF export clicked, student:', student, 'isExporting:', isExporting)
                    const studentData = student || { name: 'Anonieme Student', email: '' }
                    setIsExporting(true)
                    try {
                      await exportAssignmentToPDF(assignmentData, sectionContents, studentData)
                    } catch (error) {
                      console.error('Error exporting to PDF:', error)
                      alert('Er ging iets mis bij het exporteren naar PDF. Probeer het opnieuw.')
                    } finally {
                      setIsExporting(false)
                    }
                  }}
                  disabled={isExporting}
                  className="w-full btn btn-secondary text-sm disabled:opacity-50"
                  type="button"
                >
                  {isExporting ? 'Exporteren...' : 'PDF Document'}
                </button>
              </div>
            )}
          </div>

          {/* Formative options indicator */}
          {assignmentData?.metadata?.formativeAssessment?.enabled && (
            <div className="p-3 bg-card rounded-lg">
              <div className="flex items-center text-sm text-accent mb-2">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                Formatief handelen actief
              </div>
              <p className="text-xs text-muted">
                Gebruik de + knoppen voor leerdoelen, voorbeelden en quizzes
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Middle - Content Area - FOCUS-FIRST DESIGN */}
      <div className="workspace-main flex-1 flex flex-col">
        {currentSection && (
          <>
            {/* Compact Section Header */}
            <div className="section-header-compact">
              <div className="flex items-center justify-between">
                <h2 className="section-title-compact">{currentSection.title}</h2>
                <div className="flex items-center space-x-2">
                  {/* Learning Goal Status Badge */}
                  {assignmentData?.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.enabled && (
                    <span className={`status-badge ${
                      formativeState.learningGoals.sections[currentSection.id]?.status === 'final' ? 'final' :
                      formativeState.learningGoals.sections[currentSection.id]?.status === 'draft' ? 'draft' : 'none'
                    }`}>
                      {formativeState.learningGoals.sections[currentSection.id]?.status === 'final' ? 'Doel OK' :
                       formativeState.learningGoals.sections[currentSection.id]?.status === 'draft' ? 'Concept' : 'Geen doel'}
                    </span>
                  )}
                  {/* Info Icon with Tooltip */}
                  <div className="info-badge tooltip tooltip-left" data-tooltip="Klik op de + knoppen rechtsonder voor hulp en extra functies">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Maximized Editor Container */}
            <div className="workspace-editor-container flex-1 m-4">
              <div className="h-full">
                <SimpleRichTextEditor
                  value={sectionContents[selectedSection] || ''}
                  onChange={(content) => handleContentChange(selectedSection, content)}
                  placeholder="Begin hier met schrijven..."
                  className="workspace-editor"
                />
              </div>
            </div>
          </>
        )}

        {/* Floating Action Buttons - Focus-First Design */}
        <div className={`floating-actions ${isChatOpen ? 'chat-open' : ''}`}>
          {/* Learning Goals Button */}
          {assignmentData?.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.enabled && (
            <button
              className="floating-btn"
              onClick={() => setShowLearningGoalModal(true)}
              onMouseEnter={(e) => showTooltip(e, "🎯 Leerdoelen - Stel je persoonlijke leerdoelen in voor bewuster leren")}
              onMouseLeave={hideTooltip}
            >
              <svg className="w-6 h-6 drop-shadow-sm" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}

          {/* Examples Button */}
          {assignmentData?.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.enabled && (
            <button
              className="floating-btn"
              onClick={() => setShowExampleModal(selectedSection)}
              onMouseEnter={(e) => showTooltip(e, "📝 Voorbeelden - Bekijk AI-gegenereerde voorbeelden om je schrijven te verbeteren")}
              onMouseLeave={hideTooltip}
            >
              <svg className="w-6 h-6 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}

          {/* Quiz Button */}
          {assignmentData?.metadata?.formativeAssessment?.strategies?.diagnosticQuiz?.enabled && (
            <button
              className="floating-btn"
              onClick={() => handleStartQuiz(selectedSection)}
              disabled={formativeState.quiz.isLoading}
              onMouseEnter={(e) => showTooltip(e, "📊 Diagnostische Quiz - Test je begrip en reflecteer op je geschreven tekst")}
              onMouseLeave={hideTooltip}
            >
              <svg className="w-6 h-6 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </button>
          )}

          {/* Guide Questions Button */}
          <button
            className="floating-btn"
            onClick={() => setShowGuideModal(true)}
            onMouseEnter={(e) => showTooltip(e, "❓ Hulp & Gidsvragen - Bekijk hulpvragen en instructies voor deze sectie")}
            onMouseLeave={hideTooltip}
          >
            <svg className="w-6 h-6 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Theme Toggle Button */}
          <div 
            className="floating-btn-wrapper"
            onMouseEnter={(e) => showTooltip(e, "🌙 Thema - Schakel tussen licht en donker uiterlijk")}
            onMouseLeave={hideTooltip}
          >
            <ThemeToggle />
          </div>

          {/* Focus Mode Button */}
          <button
            className={`floating-btn ${focusMode ? 'bg-accent-soft' : ''}`}
            onClick={() => setFocusMode(!focusMode)}
            onMouseEnter={(e) => showTooltip(e, focusMode ? "🔄 Focus Modus Verlaten - Druk ESC of klik hier om terug te keren" : "🎯 Focus Modus - Volledig scherm schrijven zonder afleiding")}
            onMouseLeave={hideTooltip}
          >
            {focusMode ? (
              <svg className="w-6 h-6 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Focus Mode Exit Controls - Only visible in focus mode */}
      {focusMode && (
        <div className="focus-mode-exit-controls">
          <div className="focus-mode-esc-indicator">
            <span>Druk <kbd>ESC</kbd> om te verlaten</span>
          </div>
          <button
            onClick={() => setFocusMode(false)}
            className="focus-mode-exit-btn"
            title="Focus modus verlaten"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Right - Collapsible Chat */}
      <div className={`chat-panel transition-all duration-300 ${isChatOpen ? 'w-96' : 'w-12'} relative`}>
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="chat-toggle absolute left-0 top-1/2 -translate-y-1/2"
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
          <div className="w-full h-full flex flex-col">
            <div className="p-4 border-b border-accent">
              <h3 className="font-semibold text-heading">Socratische Assistent</h3>
              <p className="text-sm text-muted">Ik help je door vragen te stellen</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center text-muted mt-8">
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
                    className={`inline-block p-3 rounded-lg max-w-xs ${
                      msg.role === 'user'
                        ? 'bg-accent text-white'
                        : 'bg-card text-body'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="text-left">
                  <div className="inline-block p-3 rounded-lg bg-card text-body">
                    <div className="flex items-center">
                      <div className="typing-animation">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-accent">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Stel een vraag..."
                  className="flex-1 px-3 py-2 bg-primary border border-accent rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || isTyping}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:bg-muted disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals and other components */}
      {showLogin && (
        <StudentLogin
          onCancel={() => setShowLogin(false)}
          onLogin={handleLogin}
        />
      )}

      {showImport && (
        <WorkImport
          onClose={() => setShowImport(false)}
          onImport={handleImportWork}
        />
      )}

      {/* Learning Goals Modal */}
      {showLearningGoalModal && (
        <div className="modal-overlay" onClick={() => setShowLearningGoalModal(false)}>
          <div className="modal-content w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading text-xl font-semibold">🎯 Leerdoelen</h3>
              <button
                onClick={() => setShowLearningGoalModal(false)}
                className="text-muted hover:text-heading transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-muted">Stel persoonlijke leerdoelen voor deze sectie of voor de hele opdracht.</p>
              
              {/* Whole assignment learning goal */}
              <div className="p-4 bg-card rounded-lg border border-accent mb-4">
                <h4 className="font-medium text-body mb-2">
                  Leerdoel voor de hele opdracht
                </h4>
                <textarea
                  className="w-full p-3 bg-primary border border-muted rounded text-body resize-none"
                  rows={3}
                  placeholder="Wat wil je leren met deze hele opdracht?"
                  value={formativeState.learningGoals.wholeAssignment?.content || ''}
                  onChange={(e) => {
                    const goalData = {
                      content: e.target.value,
                      status: 'draft' as const,
                      updatedAt: new Date().toISOString()
                    }
                    setFormativeState(prev => ({
                      ...prev,
                      learningGoals: {
                        ...prev.learningGoals,
                        wholeAssignment: goalData
                      }
                    }))
                    localStorage.setItem('learningGoal-whole-assignment', JSON.stringify(goalData))
                  }}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className={`status-badge ${formativeState.learningGoals.wholeAssignment?.status || 'none'}`}>
                    {formativeState.learningGoals.wholeAssignment?.status === 'final' ? 'Definitief' :
                     formativeState.learningGoals.wholeAssignment?.status === 'draft' ? 'Concept' : 'Geen doel'}
                  </span>
                  {formativeState.learningGoals.wholeAssignment?.content && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const goalData = {
                            ...formativeState.learningGoals.wholeAssignment!,
                            status: (formativeState.learningGoals.wholeAssignment!.status === 'final' ? 'draft' : 'final') as 'draft' | 'final',
                            updatedAt: new Date().toISOString()
                          }
                          setFormativeState(prev => ({
                            ...prev,
                            learningGoals: {
                              ...prev.learningGoals,
                              wholeAssignment: goalData
                            }
                          }))
                          localStorage.setItem('learningGoal-whole-assignment', JSON.stringify(goalData))
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        {formativeState.learningGoals.wholeAssignment?.status === 'final' ? 'Bewerk' : 'Maak Definitief'}
                      </button>
                      <button
                        onClick={() => {
                          const goal = formativeState.learningGoals.wholeAssignment?.content || ''
                          setShowFeedbackModal({
                            type: 'whole-assignment',
                            goal: goal
                          })
                          setFeedbackMessages([])
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        🤔 Feedback
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Section-specific learning goal */}
              <div className="p-4 bg-card rounded-lg border border-accent">
                <h4 className="font-medium text-body mb-2">
                  Leerdoel voor: {currentSection?.title}
                </h4>
                <textarea
                  className="w-full p-3 bg-primary border border-muted rounded text-body resize-none"
                  rows={3}
                  placeholder="Wat wil je leren in deze sectie?"
                  value={formativeState.learningGoals.sections[selectedSection]?.content || ''}
                  onChange={(e) => {
                    const goalData = {
                      content: e.target.value,
                      status: 'draft' as const,
                      updatedAt: new Date().toISOString()
                    }
                    setFormativeState(prev => ({
                      ...prev,
                      learningGoals: {
                        ...prev.learningGoals,
                        sections: {
                          ...prev.learningGoals.sections,
                          [selectedSection]: goalData
                        }
                      }
                    }))
                    localStorage.setItem(`learningGoal-${selectedSection}`, JSON.stringify(goalData))
                  }}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className={`status-badge ${formativeState.learningGoals.sections[selectedSection]?.status || 'none'}`}>
                    {formativeState.learningGoals.sections[selectedSection]?.status === 'final' ? 'Definitief' :
                     formativeState.learningGoals.sections[selectedSection]?.status === 'draft' ? 'Concept' : 'Geen doel'}
                  </span>
                  {formativeState.learningGoals.sections[selectedSection]?.content && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const goalData = {
                            ...formativeState.learningGoals.sections[selectedSection],
                            status: (formativeState.learningGoals.sections[selectedSection].status === 'final' ? 'draft' : 'final') as 'draft' | 'final',
                            updatedAt: new Date().toISOString()
                          }
                          setFormativeState(prev => ({
                            ...prev,
                            learningGoals: {
                              ...prev.learningGoals,
                              sections: {
                                ...prev.learningGoals.sections,
                                [selectedSection]: goalData
                              }
                            }
                          }))
                          localStorage.setItem(`learningGoal-${selectedSection}`, JSON.stringify(goalData))
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        {formativeState.learningGoals.sections[selectedSection]?.status === 'final' ? 'Bewerk' : 'Maak Definitief'}
                      </button>
                      <button
                        onClick={() => {
                          const goal = formativeState.learningGoals.sections[selectedSection]?.content || ''
                          setShowFeedbackModal({
                            type: 'section',
                            goal: goal,
                            sectionTitle: currentSection?.title
                          })
                          setFeedbackMessages([])
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        🤔 Feedback
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Examples Modal */}
      {showExampleModal && (
        <div className="modal-overlay" onClick={() => { setShowExampleModal(null); setExampleContext('') }}>
          <div className="modal-content w-full max-w-4xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-heading text-xl font-semibold">📝 Voorbeelden Genereren</h3>
              <button
                onClick={() => { setShowExampleModal(null); setExampleContext('') }}
                className="text-muted hover:text-heading transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <p className="text-muted text-center">
                Kies wat voor voorbeeld je wilt genereren. Het voorbeeld wordt automatisch op de juiste plek geplaatst.
              </p>

              {/* Context Input Section */}
              <div className="p-4 bg-card rounded-lg border border-accent">
                <label htmlFor="exampleContext" className="block text-sm font-medium text-heading mb-2">
                  💭 Extra Context (Optioneel)
                </label>
                <textarea
                  id="exampleContext"
                  value={exampleContext}
                  onChange={(e) => setExampleContext(e.target.value)}
                  placeholder="Geef extra context voor het voorbeeld... Bijvoorbeeld: 'Focus op praktijkvoorbeelden uit de zorg' of 'Gebruik voorbeelden die aansluiten bij het MBO niveau'"
                  className="w-full h-24 p-3 border border-muted rounded-lg resize-none text-sm
                           focus:ring-2 focus:ring-accent focus:border-transparent
                           bg-background text-body placeholder-muted"
                  maxLength={500}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-muted">
                    Deze context helpt de AI om meer relevante voorbeelden te maken
                  </span>
                  <span className="text-xs text-muted">
                    {exampleContext.length}/500
                  </span>
                </div>
              </div>

              {/* Direct Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Section Example */}
                <div className="p-6 bg-card rounded-lg border border-accent">
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto bg-accent-soft rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-heading mb-2">Huidige Sectie</h4>
                    <p className="text-sm text-muted mb-4">
                      Genereer een voorbeeld voor: <br />
                      <span className="font-medium text-body">"{currentSection?.title}"</span>
                    </p>
                    <button
                      onClick={() => handleGenerateAndPlaceExample('current-section')}
                      disabled={formativeState.examples.loading[selectedSection]}
                      className="w-full btn btn-primary"
                    >
                      {formativeState.examples.loading[selectedSection] ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Genereren...
                        </span>
                      ) : (
                        '✨ Genereer & Plaats'
                      )}
                    </button>
                  </div>
                </div>

                {/* Whole Assignment Example */}
                <div className="p-6 bg-card rounded-lg border border-accent">
                  <div className="text-center">
                    <div className="mb-4">
                      <div className="w-16 h-16 mx-auto bg-accent-soft rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    <h4 className="text-lg font-semibold text-heading mb-2">Hele Opdracht</h4>
                    <p className="text-sm text-muted mb-4">
                      Genereer een compleet voorbeeld voor alle secties van:<br />
                      <span className="font-medium text-body">"{assignmentData?.title}"</span>
                    </p>
                    <button
                      onClick={() => handleGenerateAndPlaceExample('whole-assignment')}
                      disabled={formativeState.examples.loading['whole-assignment']}
                      className="w-full btn btn-primary"
                    >
                      {formativeState.examples.loading['whole-assignment'] ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Genereren...
                        </span>
                      ) : (
                        '✨ Genereer & Verdeel'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Info Section */}
              <div className="p-4 bg-accent-soft rounded-lg border border-accent">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <h5 className="font-medium text-heading mb-1">Hoe werkt het?</h5>
                    <ul className="text-sm text-muted space-y-1">
                      <li>• <strong>Huidige Sectie:</strong> Genereert tekst die direct in je huidige sectie wordt geplaatst</li>
                      <li>• <strong>Hele Opdracht:</strong> Genereert een compleet voorbeeld dat automatisch over alle secties wordt verdeeld</li>
                      <li>• <strong>Extra Context:</strong> Geef specifieke wensen mee zoals 'focus op praktijk' of 'gebruik eenvoudige taal'</li>
                      <li>• <strong>Bestaande tekst:</strong> Wordt vervangen door het nieuwe voorbeeld</li>
                      <li>• <strong>Aanpassen:</strong> Je kunt het geplaatste voorbeeld achteraf nog bewerken</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Previous Examples Section */}
              {(formativeState.examples.data[selectedSection] || formativeState.examples.data['whole-assignment']) && (
                <div className="border-t border-accent pt-6">
                  <h4 className="font-medium text-heading mb-4">📂 Eerder gegenereerde voorbeelden</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formativeState.examples.data[selectedSection] && (
                      <div className="p-4 bg-card rounded border border-muted">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-body">Huidige Sectie</h5>
                          <button
                            onClick={() => handleViewExample(selectedSection)}
                            className="text-xs text-accent hover:text-accent-dark"
                          >
                            Bekijken →
                          </button>
                        </div>
                        <p className="text-xs text-muted">
                          {formativeState.examples.data[selectedSection].generatedAt && 
                            `Gegenereerd: ${new Date(formativeState.examples.data[selectedSection].generatedAt).toLocaleString()}`
                          }
                        </p>
                      </div>
                    )}
                    {formativeState.examples.data['whole-assignment'] && (
                      <div className="p-4 bg-card rounded border border-muted">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-body">Hele Opdracht</h5>
                          <button
                            onClick={() => handleViewExample('whole-assignment')}
                            className="text-xs text-accent hover:text-accent-dark"
                          >
                            Bekijken →
                          </button>
                        </div>
                        <p className="text-xs text-muted">
                          {formativeState.examples.data['whole-assignment'].generatedAt && 
                            `Gegenereerd: ${new Date(formativeState.examples.data['whole-assignment'].generatedAt).toLocaleString()}`
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showGuideModal && (
        <div className="modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="modal-content w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-heading text-xl font-semibold">📋 Gids & Hulp</h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-muted hover:text-heading transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Current Section Info */}
              {currentSection && (
                <div className="p-4 bg-card rounded-lg border border-accent">
                  <h4 className="font-medium text-body mb-2">Huidige sectie: {currentSection.title}</h4>
                  <p className="text-sm text-muted mb-3">{currentSection.description}</p>
                  
                  {/* Guide Questions */}
                  {currentSection.guideQuestions && currentSection.guideQuestions.length > 0 && (
                    <div>
                      <h5 className="font-medium text-body mb-2">💡 Hulpvragen:</h5>
                      <ul className="space-y-1">
                        {currentSection.guideQuestions.map((question: string, idx: number) => (
                          <li key={idx} className="text-sm text-body flex items-start">
                            <span className="text-accent mr-2">•</span>
                            {question}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Writing Tips */}
              <div className="p-4 bg-card rounded-lg border border-accent">
                <h4 className="font-medium text-body mb-3">✍️ Schrijftips</h4>
                <div className="space-y-2 text-sm text-body">
                  <p><strong>Planning:</strong> Begin met een outline van je hoofdpunten</p>
                  <p><strong>Structuur:</strong> Gebruik alinea's met één hoofdidee per alinea</p>
                  <p><strong>Bronnen:</strong> Onderbouw je argumenten met betrouwbare bronnen</p>
                  <p><strong>Revisie:</strong> Lees je tekst hardop voor om verbeteringen te vinden</p>
                </div>
              </div>

              {/* Socratic Assistant Info */}
              <div className="p-4 bg-card rounded-lg border border-accent">
                <h4 className="font-medium text-body mb-3">🤖 Socratische Assistent</h4>
                <p className="text-sm text-muted mb-2">
                  Je AI-assistent helpt door vragen te stellen, niet door antwoorden te geven. Gebruik de chat voor:
                </p>
                <ul className="space-y-1 text-sm text-body">
                  <li><span className="text-accent mr-2">•</span>Hulp bij brainstormen</li>
                  <li><span className="text-accent mr-2">•</span>Feedback op je tekst</li>
                  <li><span className="text-accent mr-2">•</span>Verdieping van je ideeën</li>
                  <li><span className="text-accent mr-2">•</span>Structuur suggesties</li>
                </ul>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsChatOpen(true)
                    setShowGuideModal(false)
                  }}
                  className="btn btn-primary flex-1"
                >
                  💬 Open Chat
                </button>
                <button
                  onClick={() => setShowGuideModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  ✅ Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal with Chatbot */}
      {showFeedbackModal && (
        <div className="modal-overlay" onClick={() => setShowFeedbackModal(null)}>
          <div className="modal-content w-full max-w-4xl p-0 h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-accent">
              <div>
                <h3 className="text-heading text-xl font-semibold">🤔 AI Feedback op je Leerdoel</h3>
                <p className="text-sm text-muted mt-1">
                  {showFeedbackModal.type === 'whole-assignment' 
                    ? 'Feedback voor hele opdracht' 
                    : `Feedback voor sectie "${showFeedbackModal.sectionTitle}"`}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowFeedbackModal(null)
                  setFeedbackMessages([])
                  setFeedbackInput('')
                }}
                className="text-muted hover:text-heading transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Learning Goal Display */}
            <div className="p-4 bg-card border-b border-accent">
              <h4 className="font-medium text-body mb-2">Je leerdoel:</h4>
              <p className="text-body italic bg-primary p-3 rounded border border-muted text-sm">
                "{showFeedbackModal.goal}"
              </p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {feedbackMessages.length === 0 && !isFeedbackTyping && (
                <div className="text-center text-muted mt-8">
                  <p className="text-sm">De AI bekijkt je leerdoel...</p>
                  <p className="text-xs mt-2">Je krijgt zo Socratische feedback om je leerdoel te verbeteren</p>
                </div>
              )}
              {feedbackMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block p-3 rounded-lg max-w-lg ${
                      msg.role === 'user'
                        ? 'bg-accent text-white'
                        : 'bg-card text-body border border-accent'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.content} />
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isFeedbackTyping && (
                <div className="text-left">
                  <div className="inline-block p-3 rounded-lg bg-card text-body border border-accent">
                    <div className="flex items-center">
                      <div className="typing-animation">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-accent">
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFeedbackMessage(undefined, false)}
                  placeholder="Stel een vraag of reageer op de feedback..."
                  className="flex-1 px-3 py-2 bg-primary border border-accent rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                />
                <button
                  onClick={() => handleFeedbackMessage(undefined, false)}
                  disabled={!feedbackInput.trim() || isFeedbackTyping}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:bg-muted disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              
              {/* Action buttons */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => {
                    setShowFeedbackModal(null)
                    setFeedbackMessages([])
                    setFeedbackInput('')
                  }}
                  className="btn btn-secondary text-sm"
                >
                  Sluiten
                </button>
                <button
                  onClick={() => {
                    // Go back to the learning goal modal to edit
                    setShowFeedbackModal(null)
                    setFeedbackMessages([])
                    setFeedbackInput('')
                    setShowLearningGoalModal(true)
                  }}
                  className="btn btn-primary text-sm"
                >
                  ✏️ Leerdoel Aanpassen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal */}
      {showQuizModal && (
        <div className="modal-overlay" onClick={() => setShowQuizModal(false)}>
          <div className="modal-content w-full max-w-4xl p-0 h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-accent">
              <div>
                <h3 className="text-heading text-xl font-semibold">📊 Diagnostische Quiz</h3>
                <p className="text-sm text-muted mt-1">
                  Reflecteer op je geschreven tekst en verbeter je begrip
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStopQuiz}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  title="Quiz beëindigen"
                >
                  Quiz Stoppen
                </button>
                <button
                  onClick={() => setShowQuizModal(false)}
                  className="text-muted hover:text-heading transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Context Display */}
            <div className="p-4 bg-card border-b border-accent">
              <h4 className="font-medium text-body mb-2">Quiz context:</h4>
              <p className="text-sm text-muted">
                Sectie: <span className="text-body font-medium">
                  {assignmentData.sections.find((s: any) => s.id === selectedSection)?.title || 'Onbekend'}
                </span>
              </p>
              {formativeState.learningGoals.sections[selectedSection]?.content && (
                <p className="text-sm text-muted mt-1">
                  Leerdoel: <span className="text-body italic">
                    "{formativeState.learningGoals.sections[selectedSection].content}"
                  </span>
                </p>
              )}
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {quizMessages.length === 0 && !quizTyping && (
                <div className="text-center text-muted mt-8">
                  <p className="text-sm">Quiz wordt geladen...</p>
                  <p className="text-xs mt-2">Wacht even terwijl de AI je vraag formuleert</p>
                </div>
              )}
              {quizMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${
                    msg.role === 'user' ? 'text-right' : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block p-4 rounded-lg max-w-3xl ${
                      msg.role === 'user'
                        ? 'bg-accent text-white'
                        : 'bg-card text-body border border-accent'
                    }`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {msg.role === 'user' ? '👤 Jij' : '🤖 Quiz AI'}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              
              {quizTyping && (
                <div className="text-left">
                  <div className="inline-block p-4 rounded-lg bg-card border border-accent">
                    <div className="text-sm font-medium mb-1">🤖 Quiz AI</div>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-muted text-sm">AI denkt na...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-accent p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={quizInput}
                  onChange={(e) => setQuizInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQuizMessage()}
                  placeholder="Typ je antwoord..."
                  className="flex-1 px-4 py-3 bg-primary border border-accent rounded-lg text-body focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  disabled={quizTyping}
                />
                <button
                  onClick={handleQuizMessage}
                  disabled={!quizInput.trim() || quizTyping}
                  className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-dark transition-colors disabled:bg-muted disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-3 text-center">
                <p className="text-xs text-muted">
                  💡 Tip: Wees eerlijk over je twijfels en gedachten. De AI helpt je door goede vragen te stellen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JavaScript Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translateX(-50%) translateY(-100%)',
            backgroundColor: '#000000',
            color: '#ffffff',
            padding: '10px 15px',
            borderRadius: '8px',
            border: '2px solid #A25DF8',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 999999,
            pointerEvents: 'none',
            whiteSpace: tooltip.text.includes(' - ') ? 'normal' : 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(162, 93, 248, 0.5)',
            maxWidth: '300px',
            lineHeight: '1.4'
          }}
        >
          {tooltip.text}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '8px solid #000000'
            }}
          />
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100000] transform transition-all duration-300 ease-in-out ${
            toast.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
          }`}
          style={{ maxWidth: '400px' }}
        >
          <div
            className={`p-4 rounded-lg shadow-lg border-l-4 ${
              toast.type === 'success'
                ? 'bg-green-50 border-green-500 text-green-800'
                : toast.type === 'error'
                ? 'bg-red-50 border-red-500 text-red-800'
                : toast.type === 'warning'
                ? 'bg-yellow-50 border-yellow-500 text-yellow-800'
                : 'bg-blue-50 border-blue-500 text-blue-800'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {toast.type === 'success' && (
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                  {toast.type === 'error' && (
                    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {toast.type === 'warning' && (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  {toast.type === 'info' && (
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium break-words">
                    {toast.message}
                  </p>
                </div>
              </div>
              <button
                onClick={hideToast}
                className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}