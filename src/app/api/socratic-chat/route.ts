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
    const { 
      message, 
      currentSection, 
      currentContent, 
      allSectionContents, 
      sectionProgress,
      assignmentContext, 
      metadata 
    } = body

    // Convert content (markdown/HTML) to readable text for context
    const readableContent = contentToText(currentContent || '')
    
    // Process all section contents for cross-section awareness
    const allSectionsContext = sectionProgress ? sectionProgress.map(section => ({
      ...section,
      readableContent: contentToText(section.content || '')
    })) : []

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    // Create a comprehensive overview of all sections for context
    const sectionsOverview = allSectionsContext.length > 0 ? allSectionsContext.map(section => 
      `${section.isCurrentSection ? '>>> HUIDIGE SECTIE <<<' : ''}
Sectie: "${section.title}"
Beschrijving: ${section.description}
Status: ${section.hasContent ? 'Heeft inhoud geschreven' : 'Nog leeg'}
${section.readableContent ? `Inhoud samenvatting: ${section.readableContent.substring(0, 200)}${section.readableContent.length > 200 ? '...' : ''}` : 'Geen inhoud'}`
    ).join('\n\n') : 'Geen sectie overzicht beschikbaar'

    const socraticPrompt = `
Je bent een socratische tutor die studenten begeleidt bij het schrijven van hun opdracht.

BELANGRIJK: Je mag NOOIT het werk voor de student doen. Je stelt alleen doordachte vragen die hen helpen zelf na te denken.

ONDERWIJSCONTEXT:
${metadata?.educationLevelInfo ? `- Onderwijsniveau: ${metadata.educationLevelInfo.name} (${metadata.educationLevelInfo.ageRange})` : ''}
${metadata?.educationLevelInfo ? `- Complexiteitsniveau: ${metadata.educationLevelInfo.complexity}` : ''}
${metadata?.teacherName ? `- Docent: ${metadata.teacherName}` : ''}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Algemene richtlijnen: ${assignmentContext.generalGuidance}

HUIDIGE SECTIE (waar student aan werkt):
- Titel: ${currentSection.title}
- Beschrijving: ${currentSection.description}
- Hulpvragen voor deze sectie: ${currentSection.guideQuestions.join(', ')}

Wat de student in deze sectie heeft geschreven:
"${readableContent || 'Nog niets geschreven'}"

OVERZICHT VAN ALLE SECTIES (voor holistische begeleiding):
${sectionsOverview}

CROSS-SECTIE BEWUSTZIJN:
- Je hebt inzicht in wat de student in andere secties heeft geschreven
- Gebruik deze informatie om verbanden te leggen tussen secties
- Help de student consistentie te bewaren tussen verschillende delen
- Wijs op mogelijke tegenstrijdigheden of gemiste verbindingen
- Moedig de student aan om eerder geschreven content te gebruiken waar relevant
- Stel vragen die helpen de rode draad door de hele opdracht te behouden

OPMERKING: De student gebruikt een rich text editor met opmaak en mogelijk tabellen. Begrijp de structuur en inhoud van hun werk.

Vraag van de student: "${message}"

Reageer als een socratische tutor, aangepast aan het onderwijsniveau:
1. Stel doordachte vragen die de student helpen zelf na te denken
2. Moedig kritisch denken aan op het juiste niveau
3. Help hen structuur aan te brengen in hun gedachten
4. Verwijs naar de hulpvragen van de sectie indien relevant
5. Gebruik je kennis van andere secties om verbanden te leggen
6. Help de student consistentie te bewaren tussen secties
7. Geef NOOIT direct antwoorden of schrijf NOOIT tekst voor hen
8. Als ze om voorbeelden vragen, stel dan vragen die hen helpen zelf voorbeelden te bedenken
9. Wees bemoedigend maar blijf uitdagend
10. Houd je reactie beknopt (max 3-4 zinnen)
11. Verwijs subtiel naar eerder geschreven content als dat relevant is

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

Voorbeelden van cross-sectie bewustzijn vragen:
- "Hoe sluit wat je hier schrijft aan bij wat je eerder in [andere sectie] hebt beschreven?"
- "Is er een verband tussen dit punt en wat je in de inleiding hebt gesteld?"
- "Hoe zou je dit argument kunnen versterken met informatie uit je eerdere secties?"
- "Welke rode draad zie je door je hele opdracht heen lopen?"
- "Past dit wel bij de toon en stijl die je in andere secties gebruikt?"
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