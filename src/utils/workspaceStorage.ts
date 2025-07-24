// Utilities for saving and loading student work as JSON

export interface StudentWork {
  studentName: string
  studentEmail?: string
  assignmentTitle: string
  assignmentData: {
    title: string
    sections: Array<{
      id: string
      title: string
      description: string
    }>
    metadata?: {
      teacherName: string | null
      assignmentTitle: string | null
      educationLevelInfo: {
        name: string
        ageRange: string
      }
      createdAt: string
    }
  }
  sectionContents: Record<string, string>
  chatHistory?: Array<{
    sectionId: string
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
      timestamp: string
    }>
  }>
  lastSaved: string
  version: string
}

export const workspaceStorage = {
  // Export student work to JSON
  exportToJSON(
    studentName: string,
    studentEmail: string | undefined,
    assignmentData: any,
    sectionContents: Record<string, string>,
    chatHistory?: any[]
  ): StudentWork {
    const studentWork: StudentWork = {
      studentName,
      studentEmail,
      assignmentTitle: assignmentData.metadata?.assignmentTitle || assignmentData.title,
      assignmentData,
      sectionContents,
      chatHistory,
      lastSaved: new Date().toISOString(),
      version: '1.0'
    }

    return studentWork
  },

  // Download JSON file
  downloadJSON(studentWork: StudentWork): void {
    const jsonString = JSON.stringify(studentWork, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    // Create filename
    const studentName = studentWork.studentName.replace(/[^a-zA-Z0-9]/g, '_')
    const assignmentName = studentWork.assignmentTitle.replace(/[^a-zA-Z0-9]/g, '_')
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${studentName}_${assignmentName}_${timestamp}.json`
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  },

  // Validate imported JSON
  validateImportedData(data: any): { valid: boolean; error?: string } {
    try {
      if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Ongeldig JSON formaat' }
      }

      const required = ['studentName', 'assignmentData', 'sectionContents', 'lastSaved', 'version']
      for (const field of required) {
        if (!(field in data)) {
          return { valid: false, error: `Ontbrekend veld: ${field}` }
        }
      }

      if (!data.assignmentData.sections || !Array.isArray(data.assignmentData.sections)) {
        return { valid: false, error: 'Ongeldige sectie data' }
      }

      if (typeof data.sectionContents !== 'object') {
        return { valid: false, error: 'Ongeldige sectie inhoud' }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: 'Fout bij validatie van gegevens' }
    }
  },

  // Load student work from JSON
  async importFromFile(file: File): Promise<{ success: boolean; data?: StudentWork; error?: string }> {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      const validation = this.validateImportedData(data)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      return { success: true, data: data as StudentWork }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Onbekende fout bij het laden van het bestand' 
      }
    }
  },

  // Apply imported data to current session
  applyImportedData(studentWork: StudentWork): void {
    // Set student info
    localStorage.setItem('student', JSON.stringify({
      name: studentWork.studentName,
      email: studentWork.studentEmail,
      loginTime: new Date().toISOString()
    }))

    // Set assignment data
    sessionStorage.setItem('assignmentData', JSON.stringify(studentWork.assignmentData))

    // Set section contents
    for (const [sectionId, content] of Object.entries(studentWork.sectionContents)) {
      localStorage.setItem(`section-${sectionId}`, content)
    }

    // TODO: Restore chat history if needed
  }
}