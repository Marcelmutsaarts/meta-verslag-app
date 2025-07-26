// Simple test script to debug the generate-example API
async function testExampleAPI() {
  console.log('Testing generate-example API...')
  
  const requestBody = {
    scope: 'current-section',
    sectionId: 'inleiding',
    currentSection: {
      id: 'inleiding',
      title: 'Inleiding',
      description: 'Geef een korte introductie tot het onderwerp klimaatverandering.',
      content: ''
    },
    allSections: [
      { id: 'inleiding', title: 'Inleiding' },
      { id: 'oorzaken', title: 'Oorzaken' },
      { id: 'conclusie', title: 'Conclusie' }
    ],
    assignmentContext: {
      title: 'Test Opdracht',
      objective: 'Schrijf een verslag over klimaatverandering',
      sections: [
        { id: 'inleiding', title: 'Inleiding' },
        { id: 'oorzaken', title: 'Oorzaken' }, 
        { id: 'conclusie', title: 'Conclusie' }
      ],
      educationLevel: 'HAVO'
    },
    metadata: {
      educationLevel: 'HAVO',
      educationLevelInfo: {
        name: 'HAVO',
        ageRange: '12-17 jaar',
        complexity: 'middelniveau, analytisch denken'
      },
      formativeAssessment: {
        enabled: true,
        strategies: {
          exampleBasedLearning: {
            enabled: true,
            exampleSource: 'ai-generated'
          }
        }
      }
    },
    formativeAssessment: {
      enabled: true,
      strategies: {
        exampleBasedLearning: {
          enabled: true,
          exampleSource: 'ai-generated'
        }
      }
    },
    customContext: ''
  }
  
  try {
    console.log('Sending request...')
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    
    const response = await fetch('http://localhost:3003/api/generate-example', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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
testExampleAPI()