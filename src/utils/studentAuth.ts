// Simple student authentication using localStorage
// This is a basic implementation - for production, consider more secure methods

export interface Student {
  name: string
  email?: string
  loginTime: string
}

export const studentAuth = {
  // Login a student
  login(name: string, email?: string): Student {
    const student: Student = {
      name: name.trim(),
      email: email?.trim(),
      loginTime: new Date().toISOString()
    }
    
    localStorage.setItem('student', JSON.stringify(student))
    return student
  },

  // Get current logged in student
  getCurrentStudent(): Student | null {
    try {
      const studentData = localStorage.getItem('student')
      if (!studentData) return null
      
      return JSON.parse(studentData)
    } catch {
      return null
    }
  },

  // Check if student is logged in
  isLoggedIn(): boolean {
    return this.getCurrentStudent() !== null
  },

  // Logout student
  logout(): void {
    localStorage.removeItem('student')
  },

  // Update student info
  updateStudent(updates: Partial<Student>): Student | null {
    const current = this.getCurrentStudent()
    if (!current) return null

    const updated = { ...current, ...updates }
    localStorage.setItem('student', JSON.stringify(updated))
    return updated
  }
}