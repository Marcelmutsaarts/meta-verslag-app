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
    formativeAssessment: FormativeAssessment | null
    exampleDocuments: Array<{ name: string, content: string }> | null
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
    exportOptions: true,
    formativeOptions: false
  })
  
  // Enhanced Formative assessment states
  const [formativeState, setFormativeState] = useState({
    learningGoals: {
      drafts: {} as Record<string, string>,
      final: {} as Record<string, string>,
      feedback: {} as Record<string, string>,
      status: {} as Record<string, 'draft' | 'feedback' | 'final'>
    },
    examples: {
      content: {} as Record<string, string>,
      loading: {} as Record<string, boolean>,
      reflections: {} as Record<string, string>
    },
    quiz: {
      active: false,
      scope: 'current-section' as 'current-section' | 'all-sections',
      targetSections: [] as string[],
      chatMessages: [] as Array<{role: string, content: string}>,
      chatInput: '',
      isLoading: false
    },
    dialogs: {
      feedbackDialog: { open: false, goalKey: '' },
      reflectionDialog: { open: false, sectionId: '' },
      exampleScope: { open: false, scope: 'current-section' as 'current-section' | 'all-sections' },
      exampleContext: { open: false, scope: 'current-section' as 'current-section' | 'all-sections', context: '' },
      quizDialog: { open: false, scope: 'current-section' as 'current-section' | 'all-sections' }
    }
  })

  // Legacy state for backward compatibility (will be migrated)
  const [learningGoals, setLearningGoals] = useState<Record<string, string>>({})
  const [showExampleModal, setShowExampleModal] = useState(false)
  const [exampleScope, setExampleScope] = useState<'current-section' | 'all-sections'>('current-section')
  
  const router = useRouter()

  // Quiz handler function
  const handleStartQuiz = async (scope: 'current-section' | 'all-sections') => {
    if (!assignmentData) return

    // Prepare sections to include in quiz
    let targetSections: Section[] = []
    let hasContent = false

    if (scope === 'current-section') {
      const currentSection = assignmentData.sections.find(s => s.id === selectedSection)
      if (currentSection && sectionContents[selectedSection]?.trim()) {
        targetSections = [currentSection]
        hasContent = true
      }
    } else {
      targetSections = assignmentData.sections.filter(section => 
        sectionContents[section.id]?.trim()
      )
      hasContent = targetSections.length > 0
    }

    if (!hasContent) {
      alert('Er is geen tekst geschreven om te analyseren.')
      return
    }

    // Set loading state and open dialog
    setFormativeState(prev => ({
      ...prev,
      quiz: {
        ...prev.quiz,
        active: true,
        scope,
        targetSections: targetSections.map(s => s.id),
        isLoading: true,
        chatMessages: [],
        chatInput: ''
      },
      dialogs: {
        ...prev.dialogs,
        quizDialog: { open: true, scope }
      }
    }))

    // Start the quiz via API
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          targetSections: targetSections.map(section => ({
            id: section.id,
            title: section.title,
            description: section.description,
            guideQuestions: section.guideQuestions,
            content: sectionContents[section.id] || ''
          })),
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance,
            sections: assignmentData.sections
          },
          metadata: assignmentData.metadata,
          formativeState: {
            learningGoals: formativeState.learningGoals,
            examples: {
              reflections: formativeState.examples.reflections,
              availableExamples: Object.keys(formativeState.examples.content)
            }
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        setFormativeState(prev => ({
          ...prev,
          quiz: {
            ...prev.quiz,
            isLoading: false,
            chatMessages: [{ role: 'assistant', content: data.initialQuestions }]
          }
        }))
      } else {
        throw new Error('Quiz generatie mislukt')
      }
    } catch (error) {
      console.error('Quiz error:', error)
      alert('Er ging iets mis bij het starten van de quiz')
      
      setFormativeState(prev => ({
        ...prev,
        quiz: {
          ...prev.quiz,
          active: false,
          isLoading: false
        },
        dialogs: {
          ...prev.dialogs,
          quizDialog: { open: false, scope: 'current-section' }
        }
      }))
    }
  }

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
      const initialLearningGoals: Record<string, string> = {}
      
      // Initialize formative state
      const initialFormativeState = {
        learningGoals: {
          drafts: {} as Record<string, string>,
          final: {} as Record<string, string>,
          feedback: {} as Record<string, string>,
          status: {} as Record<string, 'draft' | 'feedback' | 'final'>
        },
        examples: {
          content: {} as Record<string, string>,
          loading: {} as Record<string, boolean>,
          reflections: {} as Record<string, string>
        },
        dialogs: {
          feedbackDialog: { open: false, goalKey: '' },
          reflectionDialog: { open: false, sectionId: '' },
          exampleScope: { open: false, scope: 'current-section' as 'current-section' | 'all-sections' },
          exampleContext: { open: false, scope: 'current-section' as 'current-section' | 'all-sections', context: '' },
          quizDialog: { open: false, scope: 'current-section' as 'current-section' | 'all-sections' }
        },
        quiz: {
          active: false,
          questions: [],
          answers: {},
          isLoading: false,
          chatMessages: [],
          chatInput: ''
        }
      }

      parsed.sections.forEach((section: Section) => {
        // Regular content
        initialContents[section.id] = localStorage.getItem(`section-${section.id}`) || ''
        
        // Legacy learning goals
        initialLearningGoals[section.id] = localStorage.getItem(`learning-goal-${section.id}`) || ''
        
        // New formative state from localStorage
        const scope = parsed.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.scope
        const goalKey = scope === 'per-section' ? section.id : 'whole-assignment'
        
        // Load learning goal states
        const draftGoal = localStorage.getItem(`learning-goal-draft-${goalKey}`)
        const finalGoal = localStorage.getItem(`learning-goal-final-${goalKey}`)
        
        if (draftGoal) {
          initialFormativeState.learningGoals.drafts[goalKey] = draftGoal
          initialFormativeState.learningGoals.status[goalKey] = 'draft'
        }
        if (finalGoal) {
          initialFormativeState.learningGoals.final[goalKey] = finalGoal
          initialFormativeState.learningGoals.status[goalKey] = 'final'
        }
        
        // Load examples
        const example = localStorage.getItem(`example-${section.id}`)
        if (example) {
          initialFormativeState.examples.content[section.id] = example
        }
        
        // Load reflections
        const reflection = localStorage.getItem(`reflection-${section.id}`)
        if (reflection) {
          initialFormativeState.examples.reflections[section.id] = reflection
        }
      })

      // For whole-assignment scope, ensure we only load once
      if (parsed.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.scope === 'whole-report') {
        const goalKey = 'whole-assignment'
        const draftGoal = localStorage.getItem(`learning-goal-draft-${goalKey}`)
        const finalGoal = localStorage.getItem(`learning-goal-final-${goalKey}`)
        
        if (draftGoal) {
          initialFormativeState.learningGoals.drafts[goalKey] = draftGoal
          initialFormativeState.learningGoals.status[goalKey] = 'draft'
        }
        if (finalGoal) {
          initialFormativeState.learningGoals.final[goalKey] = finalGoal
          initialFormativeState.learningGoals.status[goalKey] = 'final'
        }
      }

      setSectionContents(initialContents)
      setLearningGoals(initialLearningGoals)
      setFormativeState(initialFormativeState)
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
      
      setAssignmentData(studentWork.assignmentData as AssignmentData)
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

  // Enhanced Formative assessment handlers
  const updateFormativeState = (updater: (prev: typeof formativeState) => typeof formativeState) => {
    setFormativeState(updater)
  }

  const handleLearningGoalDraft = (goalKey: string, goal: string) => {
    updateFormativeState(prev => ({
      ...prev,
      learningGoals: {
        ...prev.learningGoals,
        drafts: { ...prev.learningGoals.drafts, [goalKey]: goal },
        status: { ...prev.learningGoals.status, [goalKey]: 'draft' }
      }
    }))
    localStorage.setItem(`learning-goal-draft-${goalKey}`, goal)
  }

  const handleLearningGoalFeedback = async (goalKey: string) => {
    if (!assignmentData) return
    
    const goal = formativeState.learningGoals.drafts[goalKey]
    if (!goal) return

    updateFormativeState(prev => ({
      ...prev,
      learningGoals: {
        ...prev.learningGoals,
        status: { ...prev.learningGoals.status, [goalKey]: 'feedback' }
      },
      dialogs: {
        ...prev.dialogs,
        feedbackDialog: { open: true, goalKey }
      }
    }))

    try {
      // Request feedback from socratic chat
      const scope = assignmentData.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.scope
      const feedbackPrompt = `Ik heb het volgende leerdoel geformuleerd: "${goal}"

${scope === 'per-section' 
  ? `Dit is mijn leerdoel voor de sectie "${assignmentData.sections.find(s => s.id === goalKey)?.title}".`
  : 'Dit is mijn leerdoel voor de hele opdracht.'
}

Kun je me kritische feedback geven op dit leerdoel? Help me het te verbeteren door socratische vragen te stellen.`

      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: feedbackPrompt,
          currentSection: assignmentData.sections.find(s => s.id === selectedSection),
          currentContent: sectionContents[selectedSection],
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance,
            sections: assignmentData.sections
          },
          metadata: assignmentData.metadata,
          learningGoals: { [goalKey]: goal }
        })
      })

      if (response.ok) {
        const data = await response.json()
        updateFormativeState(prev => ({
          ...prev,
          learningGoals: {
            ...prev.learningGoals,
            feedback: { ...prev.learningGoals.feedback, [goalKey]: data.response }
          }
        }))
      }
    } catch (error) {
      console.error('Error getting learning goal feedback:', error)
    }
  }

  const handleLearningGoalFinalize = (goalKey: string, finalGoal: string) => {
    updateFormativeState(prev => ({
      ...prev,
      learningGoals: {
        ...prev.learningGoals,
        final: { ...prev.learningGoals.final, [goalKey]: finalGoal },
        status: { ...prev.learningGoals.status, [goalKey]: 'final' }
      },
      dialogs: {
        ...prev.dialogs,
        feedbackDialog: { open: false, goalKey: '' }
      }
    }))
    localStorage.setItem(`learning-goal-final-${goalKey}`, finalGoal)
  }

  const handleGenerateExample = async (scope: 'current-section' | 'all-sections', customContext?: string) => {
    if (!assignmentData) return

    // Set loading state for relevant sections
    const sectionsToLoad = scope === 'current-section' 
      ? [selectedSection]
      : assignmentData.sections.map(s => s.id)

    updateFormativeState(prev => ({
      ...prev,
      examples: {
        ...prev.examples,
        loading: sectionsToLoad.reduce((acc, sectionId) => ({
          ...acc,
          [sectionId]: true
        }), prev.examples.loading)
      }
    }))

    try {
      const response = await fetch('/api/generate-example', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          currentSection: assignmentData.sections.find(s => s.id === selectedSection),
          allSections: assignmentData.sections,
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance
          },
          metadata: assignmentData.metadata,
          formativeAssessment: assignmentData.metadata?.formativeAssessment,
          customContext: customContext || ''
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        updateFormativeState(prev => ({
          ...prev,
          examples: {
            ...prev.examples,
            content: { ...prev.examples.content, ...data.examples },
            loading: sectionsToLoad.reduce((acc, sectionId) => ({
              ...acc,
              [sectionId]: false
            }), prev.examples.loading)
          }
        }))

        // Store examples in localStorage
        Object.entries(data.examples).forEach(([sectionId, example]) => {
          localStorage.setItem(`example-${sectionId}`, example as string)
        })
      } else {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        alert(`Er ging iets mis bij het genereren van het voorbeeld: ${response.status}`)
      }
    } catch (error) {
      console.error('Error generating example:', error)
      // Reset loading states on error
      updateFormativeState(prev => ({
        ...prev,
        examples: {
          ...prev.examples,
          loading: sectionsToLoad.reduce((acc, sectionId) => ({
            ...acc,
            [sectionId]: false
          }), prev.examples.loading)
        }
      }))
      alert('Er ging iets mis bij het genereren van het voorbeeld')
    }
  }

  const handleOpenReflection = (sectionId: string) => {
    updateFormativeState(prev => ({
      ...prev,
      dialogs: {
        ...prev.dialogs,
        reflectionDialog: { open: true, sectionId }
      }
    }))
  }

  const [reflectionChat, setReflectionChat] = useState<{
    messages: Array<{role: string, content: string}>,
    loading: boolean,
    started: boolean
  }>({
    messages: [],
    loading: false,
    started: false
  })

  const handleStartReflectionDialogue = async (sectionId: string, reflection: string) => {
    if (!assignmentData || !reflection.trim()) return

    const currentSection = assignmentData.sections.find(s => s.id === sectionId)
    const exampleContent = formativeState.examples.content[sectionId]
    
    if (!currentSection || !exampleContent) return

    setReflectionChat(prev => ({ ...prev, loading: true, started: true }))

    try {
      // Create progress summary for cross-section awareness
      const sectionProgress = assignmentData.sections.map(section => ({
        id: section.id,
        title: section.title,
        description: section.description,
        content: sectionContents[section.id] || '',
        wordCount: section.wordCount,
        hasContent: !!(sectionContents[section.id] && sectionContents[section.id].trim()),
        isCurrentSection: section.id === sectionId
      }))

      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Ik heb een reflectie geschreven op het voorbeeld voor sectie "${currentSection.title}". Mijn reflectie: "${reflection}". Kun je me helpen om nog dieper na te denken over wat ik heb geleerd?`,
          currentSection: currentSection,
          currentContent: sectionContents[sectionId],
          sectionProgress: sectionProgress,
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance,
            sections: assignmentData.sections
          },
          metadata: assignmentData.metadata,
          learningGoals: formativeState.learningGoals.final,
          formativeState: {
            learningGoals: formativeState.learningGoals,
            examples: {
              reflections: formativeState.examples.reflections,
              availableExamples: Object.keys(formativeState.examples.content)
            }
          },
          reflectionContext: {
            sectionId,
            reflection,
            exampleContent: exampleContent.substring(0, 500)
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        setReflectionChat(prev => ({
          ...prev,
          messages: [
            { role: 'user', content: `💭 Mijn reflectie: "${reflection}"` },
            { role: 'assistant', content: data.response }
          ],
          loading: false
        }))
      }
    } catch (error) {
      console.error('Error getting reflection feedback:', error)
      setReflectionChat(prev => ({ ...prev, loading: false }))
    }
  }

  const handleReflectionChatSubmit = async (message: string, sectionId: string) => {
    if (!assignmentData || !message.trim()) return

    const currentSection = assignmentData.sections.find(s => s.id === sectionId)
    if (!currentSection) return

    // Add user message immediately
    setReflectionChat(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: message }],
      loading: true
    }))

    try {
      const sectionProgress = assignmentData.sections.map(section => ({
        id: section.id,
        title: section.title,
        description: section.description,
        content: sectionContents[section.id] || '',
        wordCount: section.wordCount,
        hasContent: !!(sectionContents[section.id] && sectionContents[section.id].trim()),
        isCurrentSection: section.id === sectionId
      }))

      const response = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          currentSection: currentSection,
          currentContent: sectionContents[sectionId],
          sectionProgress: sectionProgress,
          assignmentContext: {
            title: assignmentData.title,
            objective: assignmentData.objective,
            generalGuidance: assignmentData.generalGuidance,
            sections: assignmentData.sections
          },
          metadata: assignmentData.metadata,
          learningGoals: formativeState.learningGoals.final,
          formativeState: {
            learningGoals: formativeState.learningGoals,
            examples: {
              reflections: formativeState.examples.reflections,
              availableExamples: Object.keys(formativeState.examples.content)
            }
          },
          reflectionContext: {
            sectionId,
            reflection: formativeState.examples.reflections[sectionId],
            exampleContent: formativeState.examples.content[sectionId]?.substring(0, 500)
          }
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        setReflectionChat(prev => ({
          ...prev,
          messages: [...prev.messages, { role: 'assistant', content: data.response }],
          loading: false
        }))
      }
    } catch (error) {
      console.error('Error in reflection chat:', error)
      setReflectionChat(prev => ({ ...prev, loading: false }))
    }
  }

  // Legacy handlers for backward compatibility
  const handleLearningGoalChange = (sectionId: string, goal: string) => {
    setLearningGoals(prev => ({ ...prev, [sectionId]: goal }))
    localStorage.setItem(`learning-goal-${sectionId}`, goal)
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
          metadata: assignmentData.metadata,
          learningGoals: formativeState.learningGoals.final, // Include finalized learning goals for feedback
          formativeState: {
            learningGoals: formativeState.learningGoals,
            examples: {
              reflections: formativeState.examples.reflections,
              availableExamples: Object.keys(formativeState.examples.content)
            }
          }
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

          {/* Formative options moved to content area - keeping minimal sidebar indicator */}
          {assignmentData?.metadata?.formativeAssessment?.enabled && (
            <div className="mb-4">
              <div className="flex items-center text-sm text-purple-600 mb-2">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1z" clipRule="evenodd" />
                </svg>
                <span className="text-xs uppercase tracking-wide">Formatief Handelen Actief</span>
              </div>
              <p className="text-xs text-gray-500">
                Gebruik de opties in het content gebied
              </p>
            </div>
          )}

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
          {/* Quiz Section - Always visible when quiz is enabled */}
          {assignmentData?.metadata?.formativeAssessment?.strategies?.diagnosticQuiz?.enabled && (
            <div className="mb-8 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-purple-800 flex items-center mb-2">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H4v10a2 2 0 002 2h8a2 2 0 002-2V5h-2a1 1 0 100-2 2 2 0 012 2v10a4 4 0 01-4 4H6a4 4 0 01-4-4V5z" clipRule="evenodd" />
                    </svg>
                    Diagnostische Quiz - Hele Opdracht
                  </h2>
                  <p className="text-sm text-purple-600">Test je begrip van de complete opdracht met een quiz</p>
                </div>
                <button
                    onClick={() => handleStartQuiz('all-sections')}
                    disabled={formativeState.quiz.isLoading}
                    className="px-4 py-2 bg-pink-600 text-white text-sm rounded-lg hover:bg-pink-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  >
                    {formativeState.quiz.isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Quiz laden...
                      </>
                    ) : (
                      <>
                        📚 Start Quiz
                      </>
                    )}
                  </button>
              </div>
            </div>
          )}

          {/* Whole Assignment Learning Goal (appears above all sections) */}
          {assignmentData?.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.enabled && 
           assignmentData.metadata.formativeAssessment.strategies.personalLearningGoals.scope === 'whole-report' && (
            <div className="mb-8 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 sticky top-0 z-10 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-purple-800 flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Leerdoel voor Hele Opdracht
                </h2>
                <div className="flex space-x-2">
                  {assignmentData.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.enabled && (
                    <button
                      onClick={() => handleGenerateExample('all-sections')}
                      disabled={formativeState.examples.loading['whole-assignment']}
                      className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      {formativeState.examples.loading['whole-assignment'] ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Genereren...
                        </>
                      ) : (
                        <>
                          📝 Voorbeeld Hele Verslag
                        </>
                      )}
                    </button>
                  )}
                  {assignmentData.metadata?.formativeAssessment?.strategies?.diagnosticQuiz?.enabled &&
                   assignmentData.metadata.formativeAssessment.strategies.diagnosticQuiz.scope === 'whole-report' && (
                    <button
                      onClick={() => handleStartQuiz('all-sections')}
                      disabled={formativeState.quiz.isLoading}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      {formativeState.quiz.isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Quiz starten...
                        </>
                      ) : (
                        <>
                          🧠 Quiz Hele Verslag
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {formativeState.learningGoals.status['whole-assignment'] === 'final' ? (
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800">✅ Definitief Leerdoel</span>
                    <button
                      onClick={() => {
                        const currentGoal = formativeState.learningGoals.final['whole-assignment']
                        handleLearningGoalDraft('whole-assignment', currentGoal)
                        updateFormativeState(prev => ({
                          ...prev,
                          learningGoals: {
                            ...prev.learningGoals,
                            status: { ...prev.learningGoals.status, 'whole-assignment': 'draft' }
                          }
                        }))
                      }}
                      className="text-xs text-purple-600 hover:text-purple-800"
                    >
                      Bewerken
                    </button>
                  </div>
                  <p className="text-gray-700">{formativeState.learningGoals.final['whole-assignment']}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    className="w-full px-4 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder={assignmentData.metadata?.formativeAssessment?.strategies.personalLearningGoals.customPrompt ||
                      'Beschrijf in 2-3 zinnen wat je persoonlijk wilt leren van deze opdracht...'}
                    value={formativeState.learningGoals.drafts['whole-assignment'] || ''}
                    onChange={(e) => handleLearningGoalDraft('whole-assignment', e.target.value)}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleLearningGoalFeedback('whole-assignment')}
                      disabled={!formativeState.learningGoals.drafts['whole-assignment']?.trim()}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      💬 Krijg Feedback
                    </button>
                    <button
                      onClick={() => {
                        const goal = formativeState.learningGoals.drafts['whole-assignment']
                        if (goal?.trim()) {
                          handleLearningGoalFinalize('whole-assignment', goal)
                        }
                      }}
                      disabled={!formativeState.learningGoals.drafts['whole-assignment']?.trim()}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      ✅ Definitief Maken
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

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

              {/* Independent Example Generation Section */}
              {assignmentData?.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.enabled && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-orange-800 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      Voorbeelden Genereren
                    </h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        updateFormativeState(prev => ({
                          ...prev,
                          dialogs: {
                            ...prev.dialogs,
                            exampleContext: { open: true, scope: 'current-section', context: '' }
                          }
                        }))
                      }}
                      disabled={formativeState.examples.loading[selectedSection]}
                      className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      {formativeState.examples.loading[selectedSection] ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Genereren...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          📝 Voorbeeld Huidige Sectie
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        updateFormativeState(prev => ({
                          ...prev,
                          dialogs: {
                            ...prev.dialogs,
                            exampleContext: { open: true, scope: 'all-sections', context: '' }
                          }
                        }))
                      }}
                      disabled={Object.values(formativeState.examples.loading).some(Boolean)}
                      className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      {Object.values(formativeState.examples.loading).some(Boolean) ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Genereren...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                          📝 Voorbeeld Alle Secties
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                    💡 <strong>Tip:</strong> Genereer een voorbeeld om te zien hoe deze sectie (of alle secties) eruit kunnen zien. Gebruik het als inspiratie voor je eigen tekst.
                  </div>
                </div>
              )}

              {/* Per-Section Learning Goal */}
              {assignmentData?.metadata?.formativeAssessment?.strategies?.personalLearningGoals?.enabled && 
               assignmentData.metadata.formativeAssessment.strategies.personalLearningGoals.scope === 'per-section' && (
                <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-purple-800 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Leerdoel voor deze Sectie
                    </h3>
                    <div className="flex space-x-2">
                      {assignmentData.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.enabled && (
                        <button
                          onClick={() => handleGenerateExample('current-section')}
                          disabled={formativeState.examples.loading[selectedSection]}
                          className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                        >
                          {formativeState.examples.loading[selectedSection] ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Genereren...
                            </>
                          ) : (
                            '📝 Voorbeeld'
                          )}
                        </button>
                      )}
                      {assignmentData.metadata?.formativeAssessment?.strategies?.diagnosticQuiz?.enabled && (
                        <button
                          onClick={() => handleStartQuiz('current-section')}
                          disabled={formativeState.quiz.isLoading}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                        >
                          {formativeState.quiz.isLoading ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Quiz...
                            </>
                          ) : (
                            '🧠 Quiz'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {formativeState.learningGoals.status[selectedSection] === 'final' ? (
                    <div className="p-3 bg-white rounded border border-green-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-green-800">✅ Definitief Leerdoel</span>
                        <button
                          onClick={() => {
                            const currentGoal = formativeState.learningGoals.final[selectedSection]
                            handleLearningGoalDraft(selectedSection, currentGoal)
                            updateFormativeState(prev => ({
                              ...prev,
                              learningGoals: {
                                ...prev.learningGoals,
                                status: { ...prev.learningGoals.status, [selectedSection]: 'draft' }
                              }
                            }))
                          }}
                          className="text-xs text-purple-600 hover:text-purple-800"
                        >
                          Bewerken
                        </button>
                      </div>
                      <p className="text-sm text-gray-700">{formativeState.learningGoals.final[selectedSection]}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        className="w-full px-3 py-2 border border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder={assignmentData.metadata?.formativeAssessment?.strategies.personalLearningGoals.customPrompt ||
                          'Beschrijf in 2-3 zinnen wat je persoonlijk wilt leren van deze sectie...'}
                        value={formativeState.learningGoals.drafts[selectedSection] || ''}
                        onChange={(e) => handleLearningGoalDraft(selectedSection, e.target.value)}
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleLearningGoalFeedback(selectedSection)}
                          disabled={!formativeState.learningGoals.drafts[selectedSection]?.trim()}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          💬 Feedback
                        </button>
                        <button
                          onClick={() => {
                            const goal = formativeState.learningGoals.drafts[selectedSection]
                            if (goal?.trim()) {
                              handleLearningGoalFinalize(selectedSection, goal)
                            }
                          }}
                          disabled={!formativeState.learningGoals.drafts[selectedSection]?.trim()}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          ✅ Definitief
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Example Content Display */}
              {formativeState.examples.content[selectedSection] && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-orange-800 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      Voorbeeldtekst voor deze Sectie
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenReflection(selectedSection)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        💭 Reflecteer
                      </button>
                      <button
                        onClick={() => {
                          updateFormativeState(prev => ({
                            ...prev,
                            examples: {
                              ...prev.examples,
                              content: { ...prev.examples.content, [selectedSection]: '' }
                            }
                          }))
                          localStorage.removeItem(`example-${selectedSection}`)
                        }}
                        className="text-orange-600 hover:text-orange-800 text-sm"
                        title="Voorbeeld verwijderen"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-orange-100 max-h-96 overflow-y-auto">
                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                      {formativeState.examples.content[selectedSection]}
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-700">
                      💡 <strong>Let op:</strong> Dit is een voorbeeld ter inspiratie. Gebruik het om te begrijpen wat er verwacht wordt, maar schrijf je eigen unieke tekst.
                    </p>
                  </div>
                  
                  {formativeState.examples.reflections[selectedSection] && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">Jouw reflectie op dit voorbeeld:</h4>
                      <p className="text-sm text-blue-700">{formativeState.examples.reflections[selectedSection]}</p>
                    </div>
                  )}
                </div>
              )}

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

              {/* Quiz button for current section if quiz is enabled */}
              {assignmentData?.metadata?.formativeAssessment?.strategies?.diagnosticQuiz?.enabled && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-purple-800 flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H4v10a2 2 0 002 2h8a2 2 0 002-2V5h-2a1 1 0 100-2 2 2 0 012 2v10a4 4 0 01-4 4H6a4 4 0 01-4-4V5z" clipRule="evenodd" />
                        </svg>
                        Quiz voor deze sectie
                      </h3>
                      <p className="text-sm text-purple-600 mt-1">Test je begrip van deze sectie</p>
                    </div>
                    <button
                      onClick={() => handleStartQuiz('current-section')}
                      disabled={formativeState.quiz.isLoading || !sectionContents[selectedSection]?.trim()}
                      className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      {formativeState.quiz.isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Quiz laden...
                        </>
                      ) : (
                        <>
                          📊 Start Quiz
                        </>
                      )}
                    </button>
                  </div>
                  {!sectionContents[selectedSection]?.trim() && (
                    <p className="text-sm text-purple-600 mt-2 italic">
                      💡 Schrijf eerst tekst voor deze sectie voordat je de quiz kunt starten
                    </p>
                  )}
                </div>
              )}

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
      
      {/* Learning Goal Feedback Dialog */}
      {formativeState.dialogs?.feedbackDialog?.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 text-purple-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Feedback op je Leerdoel
              </h3>
              <button
                onClick={() => updateFormativeState(prev => ({
                  ...prev,
                  dialogs: { ...prev.dialogs, feedbackDialog: { open: false, goalKey: '' } }
                }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2">Jouw huidige leerdoel:</h4>
              <p className="text-sm text-purple-700">
                {formativeState.learningGoals.drafts[formativeState.dialogs.feedbackDialog.goalKey]}
              </p>
            </div>

            {formativeState.learningGoals.feedback[formativeState.dialogs.feedbackDialog.goalKey] && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Feedback van je begeleider:</h4>
                <div className="text-sm text-blue-700 whitespace-pre-wrap">
                  {formativeState.learningGoals.feedback[formativeState.dialogs.feedbackDialog.goalKey]}
                </div>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verbeter je leerdoel op basis van de feedback:
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Herformuleer je leerdoel..."
                defaultValue={formativeState.learningGoals.drafts[formativeState.dialogs.feedbackDialog.goalKey]}
                onChange={(e) => handleLearningGoalDraft(formativeState.dialogs.feedbackDialog.goalKey, e.target.value)}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => updateFormativeState(prev => ({
                  ...prev,
                  dialogs: { ...prev.dialogs, feedbackDialog: { open: false, goalKey: '' } }
                }))}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Later Afmaken
              </button>
              <button
                onClick={() => handleLearningGoalFeedback(formativeState.dialogs.feedbackDialog.goalKey)}
                className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Meer Feedback
              </button>
              <button
                onClick={() => {
                  const currentGoal = formativeState.learningGoals.drafts[formativeState.dialogs.feedbackDialog.goalKey]
                  if (currentGoal) {
                    handleLearningGoalFinalize(formativeState.dialogs.feedbackDialog.goalKey, currentGoal)
                  }
                }}
                className="py-2 px-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Definitief Maken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reflection Dialog */}
      {formativeState.dialogs?.reflectionDialog?.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Reflectie op Voorbeeld
                {reflectionChat.started && <span className="ml-2 text-sm text-blue-600">+ Socratische Dialoog</span>}
              </h3>
              <button
                onClick={() => {
                  updateFormativeState(prev => ({
                    ...prev,
                    dialogs: { ...prev.dialogs, reflectionDialog: { open: false, sectionId: '' } }
                  }))
                  setReflectionChat({ messages: [], loading: false, started: false })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {!reflectionChat.started ? (
                // Initial reflection phase
                <div className="h-full flex flex-col">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-4">
                      {assignmentData?.metadata?.formativeAssessment?.strategies?.exampleBasedLearning?.customReflectionQuestions || 
                       'Wat vind je goed aan dit voorbeeld? Waarom denk je dat dit effectief is? Hoe kun je dit toepassen in je eigen werk?'}
                    </p>
                  </div>

                  <div className="flex-1 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jouw reflectie:
                    </label>
                    <textarea
                      rows={10}
                      className="w-full h-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                      placeholder="Beschrijf wat je van dit voorbeeld leert..."
                      value={formativeState.examples.reflections[formativeState.dialogs.reflectionDialog.sectionId] || ''}
                      onChange={(e) => {
                        const sectionId = formativeState.dialogs.reflectionDialog.sectionId
                        updateFormativeState(prev => ({
                          ...prev,
                          examples: {
                            ...prev.examples,
                            reflections: { ...prev.examples.reflections, [sectionId]: e.target.value }
                          }
                        }))
                        localStorage.setItem(`reflection-${sectionId}`, e.target.value)
                      }}
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        updateFormativeState(prev => ({
                          ...prev,
                          dialogs: { ...prev.dialogs, reflectionDialog: { open: false, sectionId: '' } }
                        }))
                        setReflectionChat({ messages: [], loading: false, started: false })
                      }}
                      className="py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Later Afmaken
                    </button>
                    <button
                      onClick={async () => {
                        const sectionId = formativeState.dialogs.reflectionDialog.sectionId
                        const reflection = formativeState.examples.reflections[sectionId]
                        
                        if (reflection && reflection.trim()) {
                          await handleStartReflectionDialogue(sectionId, reflection)
                        }
                      }}
                      disabled={!formativeState.examples.reflections[formativeState.dialogs.reflectionDialog.sectionId]?.trim()}
                      className="py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      💬 Start Socratische Dialoog
                    </button>
                    <button
                      onClick={() => {
                        updateFormativeState(prev => ({
                          ...prev,
                          dialogs: { ...prev.dialogs, reflectionDialog: { open: false, sectionId: '' } }
                        }))
                        setReflectionChat({ messages: [], loading: false, started: false })
                      }}
                      className="py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Alleen Opslaan
                    </button>
                  </div>
                </div>
              ) : (
                // Chat dialogue phase
                <div className="h-full flex flex-col">
                  {/* Chat messages */}
                  <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                    {reflectionChat.messages.map((msg, idx) => (
                      <div key={idx} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block max-w-[80%] p-3 rounded-lg ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))}
                    {reflectionChat.loading && (
                      <div className="text-left mb-4">
                        <div className="inline-block bg-white text-gray-800 border border-gray-200 p-3 rounded-lg">
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Denk na...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Chat input */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault()
                      const formData = new FormData(e.target as HTMLFormElement)
                      const message = formData.get('message') as string
                      if (message.trim()) {
                        handleReflectionChatSubmit(message, formativeState.dialogs.reflectionDialog.sectionId)
                        ;(e.target as HTMLFormElement).reset()
                      }
                    }}
                    className="flex space-x-2"
                  >
                    <input
                      name="message"
                      type="text"
                      placeholder="Stel je vraag of deel je gedachten..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={reflectionChat.loading}
                    />
                    <button
                      type="submit"
                      disabled={reflectionChat.loading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Verstuur
                    </button>
                  </form>

                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => setReflectionChat({ messages: [], loading: false, started: false })}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      ← Terug naar reflectie
                    </button>
                    <button
                      onClick={() => {
                        updateFormativeState(prev => ({
                          ...prev,
                          dialogs: { ...prev.dialogs, reflectionDialog: { open: false, sectionId: '' } }
                        }))
                        setReflectionChat({ messages: [], loading: false, started: false })
                      }}
                      className="py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Afronden
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Example Context Dialog */}
      {formativeState.dialogs?.exampleContext?.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Voorbeeld Genereren: {formativeState.dialogs.exampleContext.scope === 'current-section' ? 'Huidige Sectie' : 'Alle Secties'}
              </h3>
              <button
                onClick={() => updateFormativeState(prev => ({
                  ...prev,
                  dialogs: { ...prev.dialogs, exampleContext: { open: false, scope: 'current-section', context: '' } }
                }))}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Extra context (optioneel)
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Geef extra informatie die het voorbeeld moet bevatten of waar rekening mee gehouden moet worden. 
                Bijvoorbeeld: onderwerp, specifieke voorbeelden, stijl, etc.
              </p>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Bijv: 'Maak een voorbeeld over duurzaamheid in de mode-industrie' of 'Gebruik een formele academische schrijfstijl' of 'Voeg praktische voorbeelden toe'"
                value={formativeState.dialogs.exampleContext.context}
                onChange={(e) => updateFormativeState(prev => ({
                  ...prev,
                  dialogs: { 
                    ...prev.dialogs, 
                    exampleContext: { 
                      ...prev.dialogs.exampleContext, 
                      context: e.target.value 
                    } 
                  }
                }))}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => updateFormativeState(prev => ({
                  ...prev,
                  dialogs: { ...prev.dialogs, exampleContext: { open: false, scope: 'current-section', context: '' } }
                }))}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={async () => {
                  const scope = formativeState.dialogs.exampleContext.scope
                  const context = formativeState.dialogs.exampleContext.context
                  
                  // Close dialog
                  updateFormativeState(prev => ({
                    ...prev,
                    dialogs: { ...prev.dialogs, exampleContext: { open: false, scope: 'current-section', context: '' } }
                  }))
                  
                  // Generate example with context
                  await handleGenerateExample(scope, context)
                }}
                className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Genereer Voorbeeld
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Example Modal */}
      {showExampleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Voorbeeld Bekijken</h3>
            <p className="text-sm text-gray-600 mb-4">
              Kies de scope voor het voorbeeld dat je wilt bekijken:
            </p>
            
            <div className="space-y-3 mb-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="exampleScope"
                  value="current-section"
                  checked={exampleScope === 'current-section'}
                  onChange={(e) => setExampleScope(e.target.value as 'current-section')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-800">Deze sectie</div>
                  <div className="text-sm text-gray-600">
                    Krijg een voorbeeld voor &quot;{currentSection?.title}&quot;
                  </div>
                </div>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="exampleScope"
                  value="all-sections"
                  checked={exampleScope === 'all-sections'}
                  onChange={(e) => setExampleScope(e.target.value as 'all-sections')}
                  className="mr-3"
                />
                <div>
                  <div className="font-medium text-gray-800">Hele verslag</div>
                  <div className="text-sm text-gray-600">
                    Krijg een voorbeeld van een compleet verslag
                  </div>
                </div>
              </label>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowExampleModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={() => {
                  handleGenerateExample(exampleScope)
                  setShowExampleModal(false)
                }}
                className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                Voorbeeld Bekijken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Dialog */}
      {formativeState.dialogs?.quizDialog?.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                    </svg>
                    Diagnostische Quiz
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {formativeState.quiz.scope === 'current-section' 
                      ? `Kritische vragen over "${assignmentData?.sections.find(s => s.id === selectedSection)?.title}"`
                      : 'Kritische vragen over je volledige tekst'
                    }
                  </p>
                </div>
                <button
                  onClick={() => setFormativeState(prev => ({
                    ...prev,
                    quiz: { ...prev.quiz, active: false },
                    dialogs: { ...prev.dialogs, quizDialog: { open: false, scope: 'current-section' } }
                  }))}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left side - Quiz Chat */}
              <div className="flex-1 flex flex-col">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {formativeState.quiz.isLoading ? (
                    <div className="text-center py-8">
                      <div className="inline-flex items-center px-4 py-2 bg-purple-50 text-purple-700 rounded-lg">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Quiz wordt gegenereerd...
                      </div>
                    </div>
                  ) : formativeState.quiz.chatMessages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>Er ging iets mis bij het laden van de quiz.</p>
                    </div>
                  ) : (
                    formativeState.quiz.chatMessages.map((msg, idx) => (
                      <div key={idx} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block max-w-[80%] p-4 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {formativeState.quiz.isLoading && formativeState.quiz.chatMessages.length > 0 && (
                    <div className="text-left">
                      <div className="inline-block bg-gray-100 p-4 rounded-lg">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-6 border-t border-gray-200">
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault()
                      if (!formativeState.quiz.chatInput.trim() || formativeState.quiz.isLoading) return

                      const userMessage = formativeState.quiz.chatInput
                      
                      // Add user message immediately
                      setFormativeState(prev => ({
                        ...prev,
                        quiz: {
                          ...prev.quiz,
                          chatMessages: [...prev.quiz.chatMessages, { role: 'user', content: userMessage }],
                          chatInput: '',
                          isLoading: true
                        }
                      }))

                      // Send to quiz endpoint for continuation
                      try {
                        const response = await fetch('/api/socratic-chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            message: userMessage,
                            currentSection: assignmentData?.sections.find(s => s.id === selectedSection),
                            currentContent: sectionContents[selectedSection] || '',
                            sectionProgress: assignmentData?.sections.map(section => ({
                              ...section,
                              content: sectionContents[section.id] || '',
                              hasContent: Boolean(sectionContents[section.id]?.trim()),
                              isCurrentSection: section.id === selectedSection
                            })),
                            assignmentContext: {
                              title: assignmentData?.title,
                              objective: assignmentData?.objective,
                              generalGuidance: assignmentData?.generalGuidance,
                              sections: assignmentData?.sections
                            },
                            metadata: assignmentData?.metadata,
                            learningGoals: formativeState.learningGoals.final,
                            formativeState: {
                              learningGoals: formativeState.learningGoals,
                              examples: {
                                reflections: formativeState.examples.reflections,
                                availableExamples: Object.keys(formativeState.examples.content)
                              },
                              quiz: {
                                active: true,
                                scope: formativeState.quiz.scope,
                                targetSections: formativeState.quiz.targetSections
                              }
                            },
                            isQuizMode: true,
                            quizContext: formativeState.quiz.questions[0] || 'Diagnostische quiz gebaseerd op geschreven tekst'
                          })
                        })

                        if (response.ok) {
                          const data = await response.json()
                          setFormativeState(prev => ({
                            ...prev,
                            quiz: {
                              ...prev.quiz,
                              chatMessages: [...prev.quiz.chatMessages, { role: 'assistant', content: data.response }],
                              isLoading: false
                            }
                          }))
                        } else {
                          throw new Error('Quiz chat failed')
                        }
                      } catch (error) {
                        console.error('Quiz chat error:', error)
                        setFormativeState(prev => ({
                          ...prev,
                          quiz: {
                            ...prev.quiz,
                            isLoading: false
                          }
                        }))
                      }
                    }}
                    className="flex space-x-3"
                  >
                    <input
                      type="text"
                      value={formativeState.quiz.chatInput}
                      onChange={(e) => setFormativeState(prev => ({
                        ...prev,
                        quiz: { ...prev.quiz, chatInput: e.target.value }
                      }))}
                      placeholder="Beantwoord de vragen of stel een vraag..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={formativeState.quiz.isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!formativeState.quiz.chatInput.trim() || formativeState.quiz.isLoading}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </form>
                  
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm text-purple-700">
                      💡 <strong>Tip:</strong> Deze quiz helpt je kritisch naar je eigen tekst te kijken. Neem de tijd om eerlijk te antwoorden op de vragen.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right side - Section content (readonly) */}
              <div className="w-96 bg-gray-50 border-l border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-medium text-gray-800">Je geschreven tekst</h3>
                  <p className="text-sm text-gray-600">
                    {formativeState.quiz.scope === 'current-section' 
                      ? 'Huidige sectie' 
                      : 'Alle secties met tekst'
                    }
                  </p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {formativeState.quiz.scope === 'current-section' ? (
                    <div className="bg-white p-4 rounded border">
                      <h4 className="font-medium text-gray-800 mb-2">
                        {assignmentData?.sections.find(s => s.id === selectedSection)?.title}
                      </h4>
                      <div className="text-sm text-gray-600 max-h-64 overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: sectionContents[selectedSection] || '' }} />
                      </div>
                    </div>
                  ) : (
                    formativeState.quiz.targetSections.map(sectionId => {
                      const section = assignmentData?.sections.find(s => s.id === sectionId)
                      return (
                        <div key={sectionId} className="bg-white p-4 rounded border">
                          <h4 className="font-medium text-gray-800 mb-2">{section?.title}</h4>
                          <div className="text-sm text-gray-600 max-h-32 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: sectionContents[sectionId] || '' }} />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}