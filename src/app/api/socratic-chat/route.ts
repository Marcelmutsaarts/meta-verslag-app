import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper function to convert markdown/mixed content to readable text for context
function contentToText(content: string): string {
  if (!content) return ''
  
  // Handle both markdown and HTML content
  const text = content
    // Convert markdown headers
    .replace(/^### (.*$)/gim, '\n\n=== $1 ===\n')
    .replace(/^## (.*$)/gim, '\n\n=== $1 ===\n')
    .replace(/^# (.*$)/gim, '\n\n=== $1 ===\n')
    // Convert HTML headers to text with emphasis
    .replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, '\n\n=== $2 ===\n')
    // Convert paragraphs 
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Convert markdown lists
    .replace(/^- (.*$)/gim, '• $1\n')
    // Convert HTML lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    .replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, '\n')
    // Convert markdown tables
    .replace(/\|.*\|/g, (match) => {
      if (match.includes('---')) return '' // Skip separator rows
      return match.replace(/\|/g, ' | ') + '\n'
    })
    // Convert HTML tables to readable format
    .replace(/<table[^>]*>/gi, '\n--- TABEL ---\n')
    .replace(/<\/table>/gi, '\n--- EINDE TABEL ---\n')
    .replace(/<tr[^>]*>/gi, '\n')
    .replace(/<\/tr>/gi, '')
    .replace(/<th[^>]*>(.*?)<\/th>/gi, '[$1] ')
    .replace(/<td[^>]*>(.*?)<\/td>/gi, '$1 | ')
    // Convert markdown formatting
    .replace(/\*\*(.*?)\*\*/g, '**$1**')
    .replace(/\*(.*?)\*/g, '*$1*')
    .replace(/^> (.*$)/gim, '> $1')
    // Convert HTML formatting
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1')
    // Remove remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Clean up whitespace
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim()

  return text
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, section, currentContent, assignmentContext, metadata } = body

    // Convert content (markdown/HTML) to readable text for context
    const readableContent = contentToText(currentContent || '')

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const socraticPrompt = `
Je bent een socratische tutor die studenten begeleidt bij het schrijven van hun opdracht.

BELANGRIJK: Je mag NOOIT het werk voor de student doen. Je stelt alleen doordachte vragen die hen helpen zelf na te denken.

ONDERWIJSCONTEXT:
${metadata?.educationLevelInfo ? `- Onderwijsniveau: ${metadata.educationLevelInfo.name} (${metadata.educationLevelInfo.ageRange})` : ''}
${metadata?.educationLevelInfo ? `- Complexiteitsniveau: ${metadata.educationLevelInfo.complexity}` : ''}
${metadata?.teacherName ? `- Docent: ${metadata.teacherName}` : ''}

Context van de opdracht:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Algemene richtlijnen: ${assignmentContext.generalGuidance}

Huidige sectie:
- Titel: ${section.title}
- Beschrijving: ${section.description}
- Hulpvragen voor deze sectie: ${section.guideQuestions.join(', ')}

Wat de student tot nu toe heeft geschreven:
"${readableContent || 'Nog niets geschreven'}"

OPMERKING: De student gebruikt een rich text editor met opmaak en mogelijk tabellen. Begrijp de structuur en inhoud van hun werk.

Vraag van de student: "${message}"

Reageer als een socratische tutor, aangepast aan het onderwijsniveau:
1. Stel doordachte vragen die de student helpen zelf na te denken
2. Moedig kritisch denken aan op het juiste niveau
3. Help hen structuur aan te brengen in hun gedachten
4. Verwijs naar de hulpvragen van de sectie indien relevant
5. Geef NOOIT direct antwoorden of schrijf NOOIT tekst voor hen
6. Als ze om voorbeelden vragen, stel dan vragen die hen helpen zelf voorbeelden te bedenken
7. Wees bemoedigend maar blijf uitdagend
8. Houd je reactie beknopt (max 3-4 zinnen)

${metadata?.educationLevelInfo ? `
NIVEAU-SPECIFIEKE AANPAK voor ${metadata.educationLevelInfo.name}:
${metadata.educationLevel === 'PO' ? '- Gebruik eenvoudige, concrete taal\n- Stel praktische vragen\n- Geef duidelijke stap-voor-stap begeleiding' : ''}
${metadata.educationLevel === 'VMBO' ? '- Gebruik toegankelijke taal\n- Focus op praktische toepassingen\n- Verbind met alledaagse ervaringen' : ''}
${metadata.educationLevel === 'HAVO' ? '- Stimuleer analytisch denken\n- Gebruik gemiddeld complexe vragen\n- Moedig verbanden leggen aan' : ''}
${metadata.educationLevel === 'VWO' ? '- Stimuleer abstract denken\n- Stel complexe, meerlagige vragen\n- Moedig kritische analyse aan' : ''}
${metadata.educationLevel === 'MBO' ? '- Focus op praktijkgerichtheid\n- Verbind met beroepscontext\n- Stimuleer toepassingsgerichte vragen' : ''}
${metadata.educationLevel === 'HBO' ? '- Moedig toepassing van theorie aan\n- Stimuleer reflectief denken\n- Gebruik academische denkkaders' : ''}
${metadata.educationLevel === 'UNI' ? '- Stimuleer wetenschappelijk denken\n- Moedig diepgaande analyse aan\n- Gebruik complexe theoretische vragen' : ''}
` : ''}

Voorbeelden van goede socratische vragen:
- "Wat denk je dat de belangrijkste punten zijn die je wilt maken?"
- "Hoe zou je dit uitleggen aan iemand die er niets van weet?"
- "Welke bewijzen of voorbeelden zou je kunnen gebruiken om dit punt te ondersteunen?"
- "Wat zijn mogelijke tegenargumenten en hoe zou je daarop reageren?"
`

    const result = await model.generateContent(socraticPrompt)
    const response = result.response.text()

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Socratic chat error:', error)
    return NextResponse.json(
      { error: 'Er ging iets mis met de chat' },
      { status: 500 }
    )
  }
}