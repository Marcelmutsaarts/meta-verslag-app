// Simple test script to debug the analyze-assignment API
async function testAPI() {
  console.log('Testing analyze-assignment API...')
  
  // Create a simple form data with just instructions (no files)
  const formData = new FormData()
  formData.append('fileCount', '0')
  formData.append('instructions', 'Maak een eenvoudig verslag over klimaatverandering met 3 secties: inleiding, oorzaken, en conclusie')
  formData.append('educationLevel', 'HAVO')
  formData.append('teacherName', 'Test Docent')
  formData.append('assignmentTitle', 'Test Opdracht')
  formData.append('mode', 'preview')
  formData.append('formativeAssessment', JSON.stringify({
    enabled: false,
    strategies: {
      personalLearningGoals: { enabled: false },
      exampleBasedLearning: { enabled: false },
      diagnosticQuiz: { enabled: false }
    }
  }))
  
  try {
    console.log('Sending request...')
    const response = await fetch('http://localhost:3003/api/analyze-assignment', {
      method: 'POST',
      body: formData
    })
    
    console.log('Response status:', response.status)
    console.log('Response ok:', response.ok)
    
    const text = await response.text()
    console.log('Response text:', text)
    
    if (response.ok) {
      try {
        const json = JSON.parse(text)
        console.log('Parsed JSON:', json)
      } catch (e) {
        console.error('Failed to parse JSON:', e)
      }
    }
  } catch (error) {
    console.error('Request failed:', error)
  }
}

// Run the test
testAPI()