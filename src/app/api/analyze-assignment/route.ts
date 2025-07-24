import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import mammoth from 'mammoth'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const instructions = formData.get('instructions') as string
    const educationLevel = formData.get('educationLevel') as string
    const teacherName = formData.get('teacherName') as string
    const assignmentTitle = formData.get('assignmentTitle') as string

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    // Extract text from document
    const buffer = Buffer.from(await file.arrayBuffer())
    let documentText = ''

    console.log('File type:', file.type)
    console.log('File name:', file.name)

    if (file.type === 'application/pdf') {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(buffer)
        documentText = pdfData.text
      } catch (pdfError) {
        console.error('PDF parsing error:', pdfError)
        return NextResponse.json({ error: 'Fout bij het lezen van het PDF bestand' }, { status: 400 })
      }
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer })
      documentText = result.value
    } else {
      // Fallback: try to read as text if no specific type matches
      try {
        documentText = buffer.toString('utf-8')
      } catch {
        return NextResponse.json({ error: 'Onbekend bestandsformaat. Gebruik PDF of DOCX.' }, { status: 400 })
      }
    }

    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json({ error: 'Geen tekst gevonden in het document' }, { status: 400 })
    }

    console.log('Extracted text length:', documentText.length)

    // Analyze the document with Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

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

    const prompt = `
Analyseer het volgende opdracht document en identificeer de structuur voor een leeromgeving.

CONTEXT:
- Onderwijsniveau: ${levelInfo.name} (${levelInfo.ageRange})
- Complexiteitsniveau: ${levelInfo.complexity}
${teacherName ? `- Docent: ${teacherName}` : ''}
${assignmentTitle ? `- Opdrachttitel: ${assignmentTitle}` : ''}

Document inhoud:
${documentText}

${instructions ? `Aanvullende instructies van de docent: ${instructions}` : ''}

Taak:
1. Identificeer wat de leerlingen/studenten moeten schrijven
2. Bepaal de standaard secties van de opdracht
3. Geef per sectie een beschrijving van wat er verwacht wordt
4. Pas de complexiteit en taal aan het onderwijsniveau aan

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

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    
    console.log('Gemini response:', responseText)
    
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
        createdAt: new Date().toISOString()
      }
    }
    
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