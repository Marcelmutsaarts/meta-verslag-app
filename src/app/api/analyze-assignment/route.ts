import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import mammoth from 'mammoth'

export async function POST(request: NextRequest) {
  console.log('=== ANALYZE ASSIGNMENT API CALLED ===')
  console.log('Request method:', request.method)
  console.log('Request URL:', request.url)
  console.log('Timestamp:', new Date().toISOString())
  
  try {
    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY is not set in environment variables')
      return NextResponse.json({ 
        error: 'API configuratie fout. Controleer de environment variabelen.',
        details: 'GEMINI_API_KEY ontbreekt'
      }, { status: 500 })
    }
    
    console.log('API key check passed')

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    
    console.log('Parsing form data...')
    const formData = await request.formData()
    console.log('Form data parsed successfully')
    
    const fileCount = parseInt(formData.get('fileCount') as string) || 0
    const instructions = formData.get('instructions') as string
    const educationLevel = formData.get('educationLevel') as string
    const teacherName = formData.get('teacherName') as string
    const assignmentTitle = formData.get('assignmentTitle') as string
    const mode = formData.get('mode') as string || 'final' // 'preview' or 'final'
    const customSections = formData.get('customSections') as string // JSON string of custom sections
    const formativeAssessmentData = formData.get('formativeAssessment') as string
    const exampleFileCount = parseInt(formData.get('exampleFileCount') as string) || 0
    
    console.log('Form data extracted:')
    console.log('- fileCount:', fileCount)
    console.log('- instructions length:', instructions?.length || 0)
    console.log('- educationLevel:', educationLevel)
    console.log('- mode:', mode)
    console.log('- exampleFileCount:', exampleFileCount)

    if (fileCount === 0 && !instructions?.trim()) {
      return NextResponse.json({ error: 'Geen bestanden geüpload en geen toelichting gegeven' }, { status: 400 })
    }

    // Extract text from all documents
    const documents: Array<{ name: string, content: string }> = []
    let totalTextLength = 0

    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`) as File
      if (!file) {
        console.warn(`File ${i} not found in form data`)
        continue
      }

      console.log(`Processing file ${i}: ${file.name} (${file.type})`)

      const buffer = Buffer.from(await file.arrayBuffer())
      let documentText = ''

      if (file.type === 'application/pdf') {
        try {
          console.log(`Starting PDF parsing for: ${file.name} (${file.size} bytes)`)
          
          // Dynamic import with better error handling
          let pdfParse
          try {
            pdfParse = (await import('pdf-parse')).default
          } catch (importError) {
            console.error('Failed to import pdf-parse:', importError)
            return NextResponse.json({ 
              error: `PDF parsing library niet beschikbaar`,
              details: `Er is een probleem met de PDF verwerkings-library. Probeer het document als Word (.docx) of tekst (.txt) bestand te uploaden.`
            }, { status: 500 })
          }
          
          // Enhanced PDF parsing with multiple strategies
          const pdfData = await pdfParse(buffer, {
            // Disable image parsing to avoid canvas issues
            max: 0
          })
          
          documentText = pdfData.text
          
          // Comprehensive content validation
          if (!documentText || documentText.trim().length < 10) {
            console.warn(`PDF ${file.name} has minimal text content (${documentText?.length || 0} chars). Trying fallback...`)
            
            // Fallback strategy: parse without options
            try {
              const fallbackPdfData = await pdfParse(buffer)
              documentText = fallbackPdfData.text || ''
              console.log(`Fallback extraction result: ${documentText.length} chars`)
            } catch (fallbackError) {
              console.error('Fallback PDF parsing also failed:', fallbackError)
              documentText = ''
            }
          }
          
          // Final validation
          if (!documentText || documentText.trim().length < 10) {
            console.warn(`PDF ${file.name} extraction unsuccessful. Content length: ${documentText?.length || 0}`)
            return NextResponse.json({ 
              error: `Geen tekst gevonden in PDF bestand: ${file.name}`,
              details: `Het PDF bestand bevat mogelijk alleen afbeeldingen, is wachtwoord-beveiligd, of heeft een complex formaat. Probeer:
              
• Het bestand te converteren naar Word (.docx) of tekst (.txt)
• Een andere PDF viewer/generator te gebruiken
• Te controleren of het bestand niet beschadigd is
• Het bestand opnieuw op te slaan als PDF`
            }, { status: 400 })
          }
          
          console.log(`PDF parsing successful for ${file.name}: ${documentText.length} characters extracted`)
          
        } catch (pdfError) {
          console.error('=== PDF PARSING ERROR ===')
          console.error('Error type:', typeof pdfError)
          console.error('Error message:', pdfError instanceof Error ? pdfError.message : 'Unknown error')
          console.error('Error stack:', pdfError instanceof Error ? pdfError.stack : 'No stack trace')
          console.error('File details:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type
          })
          
          // Categorize error types for better user feedback
          let userMessage = `Fout bij het lezen van PDF bestand: ${file.name}`
          let userDetails = ''
          
          const errorMessage = pdfError instanceof Error ? pdfError.message.toLowerCase() : ''
          
          if (errorMessage.includes('canvas') || errorMessage.includes('node')) {
            userDetails = `Er is een probleem met de PDF rendering engine. Dit kan gebeuren bij complexe PDF's met afbeeldingen. 

Probeer:
• Het bestand te converteren naar Word (.docx) 
• Een eenvoudigere PDF te maken zonder afbeeldingen
• Het bestand als tekst (.txt) op te slaan`
          } else if (errorMessage.includes('password') || errorMessage.includes('encrypted')) {
            userDetails = `Het PDF bestand is wachtwoord-beveiligd. Verwijder eerst de beveiliging en probeer opnieuw.`
          } else if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
            userDetails = `Het PDF bestand lijkt beschadigd te zijn. Probeer het bestand opnieuw te genereren of op te slaan.`
          } else {
            userDetails = `Onbekende PDF fout. Probeer het bestand in een ander formaat (.docx of .txt) te uploaden.

Technische details: ${pdfError instanceof Error ? pdfError.message : 'Onbekende fout'}`
          }
          
          return NextResponse.json({ 
            error: userMessage,
            details: userDetails
          }, { status: 400 })
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          // Enhanced Word parsing
          const result = await mammoth.extractRawText({buffer})
          
          documentText = result.value
          
          // Log any warnings from mammoth
          if (result.messages && result.messages.length > 0) {
            console.log(`Mammoth warnings for ${file.name}:`, result.messages)
          }
          
          // Additional validation for Word content
          if (!documentText || documentText.trim().length < 10) {
            console.warn(`Word document ${file.name} appears to have minimal text content.`)
            
            // Try alternative extraction method
            try {
              const altResult = await mammoth.extractRawText({ buffer })
              documentText = altResult.value || ''
            } catch (altError) {
              console.error('Alternative Word extraction failed:', altError)
            }
          }
          
        } catch (wordError) {
          console.error('Word parsing error:', wordError)
          console.error('Word error details:', {
            message: wordError instanceof Error ? wordError.message : 'Unknown error',
            stack: wordError instanceof Error ? wordError.stack : 'No stack trace',
            fileName: file.name,
            fileSize: file.size
          })
          return NextResponse.json({ 
            error: `Fout bij het lezen van Word bestand: ${file.name}`,
            details: `Het Word bestand kan mogelijk beschadigd zijn of een ongewoon formaat hebben. Details: ${wordError instanceof Error ? wordError.message : 'Onbekende fout'}`
          }, { status: 400 })
        }
      } else if (file.type === 'text/plain') {
        // Improved text file handling
        try {
          documentText = buffer.toString('utf-8')
          
          // Try alternative encodings if UTF-8 fails
          if (!documentText || documentText.includes('�')) {
            console.log(`Trying alternative encoding for ${file.name}`)
            documentText = buffer.toString('latin1') || buffer.toString('ascii')
          }
        } catch (textError) {
          console.error('Text file parsing error:', textError)
          return NextResponse.json({ 
            error: `Fout bij het lezen van tekst bestand: ${file.name}`,
            details: 'Het bestand kan mogelijk een onondersteunde encoding hebben.'
          }, { status: 400 })
        }
      } else {
        // Improved fallback with better error messages
        console.warn(`Unknown file type ${file.type} for ${file.name}, attempting text extraction`)
        try {
          documentText = buffer.toString('utf-8')
          
          // Validate that we got readable text
          if (!documentText || documentText.length < 10 || documentText.includes('�')) {
            throw new Error('Content appears to be binary or corrupted')
          }
        } catch (fallbackError) {
          console.error('Fallback text extraction failed:', fallbackError)
          return NextResponse.json({ 
            error: `Onbekend of onondersteund bestandsformaat voor ${file.name}`,
            details: 'Ondersteunde formaten: PDF (.pdf), Word (.docx), en Tekst (.txt). Controleer of het bestand niet beschadigd is.'
          }, { status: 400 })
        }
      }

      if (!documentText || documentText.trim().length === 0) {
        console.warn(`No text found in ${file.name}`)
        continue
      }

      documents.push({
        name: file.name,
        content: documentText.trim()
      })
      
      totalTextLength += documentText.length
    }

    if (documents.length === 0 && !instructions?.trim()) {
      return NextResponse.json({ error: 'Geen bruikbare tekstinhoud gevonden in de geüploade bestanden en geen toelichting gegeven' }, { status: 400 })
    }

    console.log(`Processed ${documents.length} documents with total text length: ${totalTextLength}`)

    // Process formative assessment data
    let formativeAssessment = null
    const exampleDocuments: Array<{ name: string, content: string }> = []
    
    if (formativeAssessmentData) {
      try {
        formativeAssessment = JSON.parse(formativeAssessmentData)
        console.log('Formative assessment enabled:', formativeAssessment.enabled)
        
        // Process example files if provided
        if (exampleFileCount > 0 && 
            formativeAssessment.enabled &&
            formativeAssessment.strategies.exampleBasedLearning.enabled &&
            formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'teacher-provided') {
          
          for (let i = 0; i < exampleFileCount; i++) {
            const exampleFile = formData.get(`exampleFile_${i}`) as File
            if (!exampleFile) continue
            
            console.log(`Processing example file ${i}: ${exampleFile.name} (${exampleFile.type})`)
            
            const buffer = Buffer.from(await exampleFile.arrayBuffer())
            let exampleText = ''
            
            if (exampleFile.type === 'application/pdf') {
              try {
                console.log(`Parsing example PDF: ${exampleFile.name}`)
                const pdfParse = (await import('pdf-parse')).default
                const pdfData = await pdfParse(buffer, {
                  max: 0 // Disable image parsing
                })
                exampleText = pdfData.text
                
                if (!exampleText || exampleText.trim().length < 10) {
                  console.warn(`Example PDF ${exampleFile.name} has minimal content, skipping`)
                  continue
                }
              } catch (pdfError) {
                console.error('Example PDF parsing error:', pdfError)
                console.error('Example file details:', {
                  fileName: exampleFile.name,
                  fileSize: exampleFile.size
                })
                continue // Skip this example file but continue with others
              }
            } else if (exampleFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
              const result = await mammoth.extractRawText({ buffer })
              exampleText = result.value
            } else {
              try {
                exampleText = buffer.toString('utf-8')
              } catch {
                console.error(`Could not process example file ${exampleFile.name}`)
                continue
              }
            }
            
            if (exampleText && exampleText.trim().length > 0) {
              exampleDocuments.push({
                name: exampleFile.name,
                content: exampleText.trim()
              })
            }
          }
          
          console.log(`Processed ${exampleDocuments.length} example documents`)
        }
      } catch (error) {
        console.error('Error parsing formative assessment data:', error)
        formativeAssessment = null
      }
    }

    // Analyze the document with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    // Get education level details
    const levelMap: Record<string, { name: string; ageRange: string; complexity: string }> = {
      'PO': { name: 'Primair Onderwijs', ageRange: '4-12 jaar', complexity: 'eenvoudig, concrete taal' },
      'VMBO': { name: 'VMBO', ageRange: '12-16 jaar', complexity: 'toegankelijk, praktijkgericht' },
      'HAVO': { name: 'HAVO', ageRange: '12-17 jaar', complexity: 'middelniveau, analytisch denken' },
      'VWO': { name: 'VWO', ageRange: '12-18 jaar', complexity: 'hoog niveau, abstract denken' },
      'MBO': { name: 'MBO', ageRange: '16-20 jaar', complexity: 'praktijkgericht, beroepsmatig' },
      'HBO': { name: 'HBO', ageRange: '18-22 jaar', complexity: 'hoger niveau, toepassing theorie' },
      'UNI': { name: 'Universiteit', ageRange: '18+ jaar', complexity: 'wetenschappelijk, diepgaande analyse' }
    }

    const levelInfo = levelMap[educationLevel] || levelMap['HAVO']

    // Create combined document content for analysis
    const combinedContent = documents.length > 0 
      ? documents.map(doc => `
=== DOCUMENT: ${doc.name} ===
${doc.content}
`).join('\n\n')
      : `
=== ALLEEN TOELICHTING MODUS ===
Geen documenten geüpload. Gebruik alleen de toelichting om de opdracht te begrijpen.
`

    // Helper function to generate formative assessment prompt section
    const getFormativeAssessmentPrompt = () => {
      if (!formativeAssessment || !formativeAssessment.enabled) return ''
      
      let assessmentPrompt = `\n\n🎯 FORMATIEF HANDELEN INSTRUCTIES:\n`
      assessmentPrompt += `De docent heeft formatief handelen ingeschakeld met de volgende strategieën:\n\n`
      
      if (formativeAssessment.strategies.personalLearningGoals.enabled) {
        assessmentPrompt += `📝 PERSOONLIJKE LEERDOELEN:\n`
        assessmentPrompt += `- Scope: ${formativeAssessment.strategies.personalLearningGoals.scope === 'per-section' ? 'Per sectie' : 'Hele opdracht'}\n`
        
        if (formativeAssessment.strategies.personalLearningGoals.customPrompt) {
          assessmentPrompt += `- Aangepaste prompt: "${formativeAssessment.strategies.personalLearningGoals.customPrompt}"\n`
        } else {
          const defaultPrompt = formativeAssessment.strategies.personalLearningGoals.scope === 'per-section' 
            ? 'Beschrijf in 2-3 zinnen wat je persoonlijk wilt leren van deze sectie.'
            : 'Beschrijf in 2-3 zinnen wat je persoonlijk wilt leren van deze opdracht.'
          assessmentPrompt += `- Standaard prompt: "${defaultPrompt}"\n`
        }
        assessmentPrompt += `\n`
      }
      
      if (formativeAssessment.strategies.exampleBasedLearning.enabled) {
        assessmentPrompt += `📚 VOORBEELDGERICHT LEREN:\n`
        assessmentPrompt += `- Bron: ${formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'ai-generated' ? 'AI-gegenereerde voorbeelden' : 'Door docent aangeleverde voorbeelden'}\n`
        
        if (formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'teacher-provided' && exampleDocuments.length > 0) {
          assessmentPrompt += `- Voorbeelddocumenten (${exampleDocuments.length}):\n`
          exampleDocuments.forEach(doc => {
            assessmentPrompt += `  * ${doc.name}: ${doc.content.substring(0, 200)}${doc.content.length > 200 ? '...' : ''}\n`
          })
        }
        
        if (formativeAssessment.strategies.exampleBasedLearning.customReflectionQuestions) {
          assessmentPrompt += `- Aangepaste reflectievragen: "${formativeAssessment.strategies.exampleBasedLearning.customReflectionQuestions}"\n`
        } else {
          assessmentPrompt += `- Standaard reflectievragen: "Wat vind je goed aan dit voorbeeld? Waarom denk je dat dit effectief is? Hoe kun je dit toepassen in je eigen werk?"\n`
        }
        assessmentPrompt += `\n`
      }
      
      assessmentPrompt += `BELANGRIJK: Integreer deze formatieve strategieën in de leeromgeving door:\n`
      assessmentPrompt += `1. Voor persoonlijke leerdoelen: Voeg de juiste prompts toe aan de begin van relevante secties\n`
      assessmentPrompt += `2. Voor voorbeeldgericht leren: Zorg dat studenten eerst het voorbeeld analyseren voordat ze zelf schrijven\n`
      assessmentPrompt += `3. Pas de sectie-beschrijvingen aan om deze strategieën te ondersteunen\n`
      assessmentPrompt += `4. Zorg dat de socratische vragen rekening houden met deze formatieve elementen\n\n`
      
      return assessmentPrompt
    }

    let prompt = ''
    
    if (mode === 'preview') {
      // Preview mode: Generate basic section structure only (faster)
      prompt = `
Analyseer de volgende opdracht documenten en maak een basis sectie-structuur voor een leeromgeving.

${instructions ? `
🚨 HOGE PRIORITEIT INSTRUCTIES VAN DOCENT:
${instructions}

BELANGRIJK: Deze instructies van de docent hebben ABSOLUTE PRIORITEIT boven alle andere informatie. Volg deze instructies nauwkeurig op, vooral voor sectie-structuur en specifieke eisen.
` : ''}

CONTEXT:
- Onderwijsniveau: ${levelInfo.name} (${levelInfo.ageRange})
- Complexiteitsniveau: ${levelInfo.complexity}
${teacherName ? `- Docent: ${teacherName}` : ''}
${assignmentTitle ? `- Opdrachttitel: ${assignmentTitle}` : ''}
- Aantal documenten: ${documents.length}
${documents.length === 0 ? `\n⚠️  ALLEEN TOELICHTING MODUS: Er zijn geen documenten geüpload. Baseer de opdracht VOLLEDIG op de toelichting van de docent.` : ''}

Document inhoud (eerste 3000 karakters):
${combinedContent.substring(0, 3000)}${combinedContent.length > 3000 ? '...' : ''}
${getFormativeAssessmentPrompt()}
Taak: Maak een basis sectie-structuur. Als de docent specifieke secties heeft aangegeven, volg deze dan exact op. Houd het beknopt voor snelle preview.

Geef je antwoord ALLEEN in dit JSON formaat:
{
  "title": "Titel van de opdracht",
  "objective": "Wat moeten de studenten schrijven/maken",
  "sections": [
    {
      "id": "unieke-id",
      "title": "Sectie titel",
      "description": "Korte beschrijving van wat er verwacht wordt",
      "guideQuestions": ["Basis vraag 1", "Basis vraag 2"],
      "wordCount": "Geschat aantal woorden"
    }
  ],
  "generalGuidance": "Korte algemene richtlijnen"
}

BELANGRIJK: Antwoord ALLEEN met de JSON, geen andere tekst.
`
    } else if (mode === 'final' && customSections) {
      // Final mode with custom sections: Use provided structure
      const sections = JSON.parse(customSections)
      prompt = `
Genereer een volledige leeromgeving met de onderstaande aangepaste sectie-structuur.

${instructions ? `
🚨 HOGE PRIORITEIT INSTRUCTIES VAN DOCENT:
${instructions}

BELANGRIJK: Deze instructies van de docent hebben ABSOLUTE PRIORITEIT boven alle andere informatie. Pas alle gegenereerde content aan volgens deze specifieke instructies.
` : ''}

CONTEXT:
- Onderwijsniveau: ${levelInfo.name} (${levelInfo.ageRange})
- Complexiteitsniveau: ${levelInfo.complexity}
${teacherName ? `- Docent: ${teacherName}` : ''}
${assignmentTitle ? `- Opdrachttitel: ${assignmentTitle}` : ''}
- Aantal documenten: ${documents.length}
${documents.length === 0 ? `\n⚠️  ALLEEN TOELICHTING MODUS: Er zijn geen documenten geüpload. Baseer de opdracht VOLLEDIG op de toelichting van de docent.` : ''}

Document inhoud:
${combinedContent}

AANGEPASTE SECTIE-STRUCTUUR (door docent bepaald):
${JSON.stringify(sections, null, 2)}
${getFormativeAssessmentPrompt()}
Taak: Gebruik EXACT de bovenstaande sectie-structuur en vul deze aan met:
1. Uitgebreide beschrijvingen per sectie
2. Socratische hulpvragen die aansluiten bij de sectie-inhoud
3. Specifieke richtlijnen gebaseerd op de documenten

Geef je antwoord in dit JSON formaat met de EXACTE sectie-structuur:
{
  "title": "Titel van de opdracht",
  "objective": "Wat moeten de studenten schrijven/maken",  
  "sections": [gebruik EXACT de aangepaste secties met uitgebreide descriptions en guideQuestions],
  "generalGuidance": "Uitgebreide richtlijnen voor de opdracht"
}

BELANGRIJK: 
- Behoud EXACT de sectie IDs en titels uit de aangepaste structuur
- Vul alleen descriptions en guideQuestions uitgebreid aan
- Antwoord ALLEEN met de JSON
`
    } else {
      // Final mode: Full analysis (original behavior)
      prompt = `
Analyseer de volgende opdracht documenten en identificeer de structuur voor een leeromgeving.

${instructions ? `
🚨 HOGE PRIORITEIT INSTRUCTIES VAN DOCENT:
${instructions}

BELANGRIJK: Deze instructies van de docent hebben ABSOLUTE PRIORITEIT boven alle andere informatie. Als de docent specifieke secties of structuur aangeeft, volg deze dan nauwkeurig op.
` : ''}

CONTEXT:
- Onderwijsniveau: ${levelInfo.name} (${levelInfo.ageRange})
- Complexiteitsniveau: ${levelInfo.complexity}
${teacherName ? `- Docent: ${teacherName}` : ''}
${assignmentTitle ? `- Opdrachttitel: ${assignmentTitle}` : ''}
- Aantal documenten: ${documents.length}
${documents.length === 0 ? `\n⚠️  ALLEEN TOELICHTING MODUS: Er zijn geen documenten geüpload. Baseer de opdracht VOLLEDIG op de toelichting van de docent.` : ''}

Document inhoud:
${combinedContent}
${getFormativeAssessmentPrompt()}
Taak:
1. EERST: Check of de docent specifieke instructies heeft gegeven voor de sectie-indeling
2. Identificeer wat de leerlingen/studenten moeten schrijven
3. Bepaal de secties van de opdracht (gebruik docent instructies als beschikbaar)
4. Geef per sectie een beschrijving van wat er verwacht wordt
5. Pas de complexiteit en taal aan het onderwijsniveau aan

BELANGRIJK: Houd rekening met het onderwijsniveau (${levelInfo.name}) bij:
- De formulering van sectie-beschrijvingen
- De complexiteit van de hulpvragen
- Het verwachte denkniveau van de studenten

Geef je antwoord ALLEEN in het volgende JSON formaat, zonder extra tekst ervoor of erna:
{
  "title": "Titel van de opdracht",
  "objective": "Wat moeten de studenten schrijven/maken",
  "sections": [
    {
      "id": "unieke-id",
      "title": "Sectie titel",
      "description": "Wat wordt er in deze sectie verwacht",
      "guideQuestions": ["Vraag 1 om de student te helpen", "Vraag 2", "etc"],
      "wordCount": "Geschat aantal woorden (optioneel)"
    }
  ],
  "generalGuidance": "Algemene richtlijnen voor de opdracht"
}

BELANGRIJK: Antwoord ALLEEN met de JSON, geen andere tekst.

Zorg ervoor dat:
- De secties logisch geordend zijn
- Elke sectie duidelijke verwachtingen heeft
- De guide questions socratisch van aard zijn (stellen vragen, geven geen antwoorden)
- De structuur aansluit bij het type opdracht
`
    }

    console.log('=== SENDING REQUEST TO GEMINI API ===')
    console.log('Prompt length:', prompt.length)
    console.log('Model being used: gemini-2.5-flash-preview-05-20')
    console.log('Request time:', new Date().toISOString())
    
    let result
    try {
      console.log('Calling model.generateContent()...')
      result = await model.generateContent(prompt)
      console.log('Gemini API call completed successfully')
    } catch (geminiError) {
      console.error('=== GEMINI API ERROR ===')
      console.error('Error type:', typeof geminiError)
      console.error('Error message:', geminiError instanceof Error ? geminiError.message : String(geminiError))
      console.error('Error stack:', geminiError instanceof Error ? geminiError.stack : 'No stack')
      console.error('Full error object:', geminiError)
      throw new Error(`Gemini API fout: ${geminiError instanceof Error ? geminiError.message : 'Onbekende fout'}`)
    }
    
    console.log('Extracting response text...')
    const responseText = result.response.text()
    console.log('Response text length:', responseText.length)
    console.log('Response text preview:', responseText.substring(0, 200) + '...')
    
    // Try to extract JSON from response
    let analysisData
    
    // First try: parse the entire response as JSON
    try {
      analysisData = JSON.parse(responseText.trim())
    } catch {
      // Second try: extract JSON from response using regex
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('No JSON found in response:', responseText)
        throw new Error('Kon geen geldige JSON vinden in de response')
      }
      
      try {
        analysisData = JSON.parse(jsonMatch[0])
      } catch {
        // Third try: clean up common issues
        const cleanedJson = jsonMatch[0]
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim()
        
        try {
          analysisData = JSON.parse(cleanedJson)
        } catch {
          console.error('JSON parse error after cleaning')
          console.error('Attempted to parse:', cleanedJson)
          throw new Error('Ongeldige JSON in de response')
        }
      }
    }

    console.log('Parsed analysis data:', analysisData)
    
    // Add metadata to the response
    const responseData = {
      ...analysisData,
      metadata: {
        educationLevel,
        educationLevelInfo: levelInfo,
        teacherName: teacherName || null,
        assignmentTitle: assignmentTitle || null,
        instructions: instructions || null,
        formativeAssessment: formativeAssessment || null,
        exampleDocuments: exampleDocuments.length > 0 ? exampleDocuments : null,
        createdAt: new Date().toISOString()
      }
    }
    
    console.log('=== FINAL RESPONSE READY ===')
    console.log('Response data sections count:', responseData.sections?.length || 0)
    console.log('Response data title:', responseData.title)
    console.log('Sending successful response...')
    
    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error analyzing assignment:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace'
    })
    return NextResponse.json(
      { 
        error: 'Er ging iets mis bij het analyseren van de opdracht',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}