import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set in environment variables')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
      sectionProgress,
      assignmentContext, 
      metadata,
      learningGoals,
      reflectionContext,
      formativeState,
      feedbackContext,
      isQuizMode,
      quizContext
    } = body

    // Convert content (markdown/HTML) to readable text for context
    const readableContent = contentToText(currentContent || '')
    
    // Process all section contents for cross-section awareness
    const allSectionsContext = sectionProgress ? sectionProgress.map((section: any) => ({
      ...section,
      readableContent: contentToText(section.content || '')
    })) : []

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    // Create a comprehensive overview of all sections for context
    const sectionsOverview = allSectionsContext.length > 0 ? allSectionsContext.map((section: any) => 
      `${section.isCurrentSection ? '>>> HUIDIGE SECTIE <<<' : ''}
Sectie: "${section.title}"
Beschrijving: ${section.description}
Status: ${section.hasContent ? 'Heeft inhoud geschreven' : 'Nog leeg'}
${section.readableContent ? `Inhoud samenvatting: ${section.readableContent.substring(0, 200)}${section.readableContent.length > 200 ? '...' : ''}` : 'Geen inhoud'}`
    ).join('\n\n') : 'Geen sectie overzicht beschikbaar'

    // Helper function to get comprehensive learning goal context
    const getLearningGoalContext = () => {
      if (!metadata?.formativeAssessment?.strategies.personalLearningGoals.enabled) {
        return ''
      }
      
      let context = `
PERSOONLIJKE LEERDOELEN VAN STUDENT:
`
      
      const scope = metadata.formativeAssessment.strategies.personalLearningGoals.scope
      
      if (scope === 'per-section' && formativeState?.learningGoals) {
        // Show all section-specific learning goals
        Object.entries(formativeState.learningGoals.final).forEach(([sectionId, goal]) => {
          const section = assignmentContext.sections?.find((s: any) => s.id === sectionId)
          if (section && goal) {
            context += `- ${section.title}: "${goal}"${sectionId === currentSection.id ? ' (HUIDIGE SECTIE)' : ''}\n`
          }
        })
        
        // Show draft goals being worked on
        Object.entries(formativeState.learningGoals.drafts || {}).forEach(([sectionId, draft]) => {
          if (draft && !formativeState.learningGoals.final[sectionId]) {
            const section = assignmentContext.sections?.find((s: any) => s.id === sectionId)
            if (section) {
              context += `- ${section.title}: "${draft}" (CONCEPT)\n`
            }
          }
        })
      } else if (scope === 'whole-assignment') {
        const wholeGoal = formativeState?.learningGoals?.final?.['whole-assignment'] || learningGoals?.['whole-assignment']
        if (wholeGoal) {
          context += `Voor de hele opdracht: "${wholeGoal}"\n`
        }
        
        const draftGoal = formativeState?.learningGoals?.drafts?.['whole-assignment']
        if (draftGoal && !wholeGoal) {
          context += `Voor de hele opdracht: "${draftGoal}" (CONCEPT)\n`
        }
      }
      
      // Fallback to old system if new one is empty
      if (learningGoals && Object.keys(learningGoals).length > 0) {
        Object.entries(learningGoals).forEach(([key, goal]) => {
          if (goal && !context.includes(goal as string)) {
            context += `- ${key}: "${goal}"\n`
          }
        })
      }
      
      if (context.trim() === 'PERSOONLIJKE LEERDOELEN VAN STUDENT:') {
        return ''
      }
      
      context += `
LEERDOEL BEGELEIDING:
- Verwijs regelmatig naar relevante leerdoelen bij je begeleiding
- Help de student reflecteren op hoe hun werk bijdraagt aan hun leerdoelen
- Stel vragen die helpen de leerdoelen te bereiken
- Geef constructieve feedback op de kwaliteit van leerdoelen wanneer relevant
- Moedig diepere reflectie aan over wat ze werkelijk willen leren
- Leg verbanden tussen verschillende leerdoelen en secties
`
      
      return context
    }

    // Helper function to get reflection context
    const getReflectionContext = () => {
      if (!reflectionContext) return ''
      
      return `
REFLECTIE CONTEXT:
De student heeft zojuist een reflectie geschreven op een voorbeeld voor deze sectie.

Student reflectie: "${reflectionContext.reflection}"

Voorbeeld waar student op reflecteerde: "${reflectionContext.exampleContent}"

BELANGRIJK VOOR REFLECTIE BEGELEIDING:
- Dit is een vervolgconversatie op de student reflectie
- Daag de student uit om dieper na te denken
- Stel socratische vragen die de reflectie verdiepen
- Help de student verbanden te zien die ze misschien missen
- Leid ze naar nieuwe inzichten over het voorbeeld en hun eigen leerproces
- Moedig ze aan om concrete toepassingen te bedenken
- Vraag door op oppervlakkige antwoorden
`
    }

    // Helper function to get formative assessment context
    const getFormativeAssessmentContext = () => {
      if (!metadata?.formativeAssessment?.enabled) return ''
      
      let context = `
FORMATIEF HANDELEN CONTEXT:
De docent heeft formatieve strategieën ingeschakeld voor bewuster leren:
`
      
      if (metadata.formativeAssessment.strategies.personalLearningGoals.enabled) {
        context += `- 🎯 Persoonlijke leerdoelen zijn actief\n`
      }
      
      if (metadata.formativeAssessment.strategies.exampleBasedLearning.enabled) {
        context += `- 📝 Voorbeeldgericht leren is actief (${metadata.formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'ai-generated' ? 'AI-voorbeelden' : 'Docent voorbeelden'})\n`
      }
      
      return context + '\n'
    }

    // Helper function to get comprehensive formative context
    const getAllFormativeContext = () => {
      if (!formativeState) return ''
      
      let context = ''
      
      // Add quiz context if active
      if (formativeState.quiz?.active) {
        context += `
DIAGNOSTISCHE QUIZ ACTIEF:
- Scope: ${formativeState.quiz.scope === 'current-section' ? 'Huidige sectie' : 'Alle secties'}
- Student is bezig met een kritische evaluatie van zijn/haar geschreven tekst
- Doel: De student helpen zelfreflectie te ontwikkelen door socratische vragen
- BELANGRIJK: Je bent nu in QUIZ-MODUS - focus op het stellen van verdiepende vragen over de kwaliteit van de tekst
- Help de student kritisch nadenken over: argumentatie, bewijs, structuur, volledigheid, helderheid
- Vraag NOOIT om content te herschrijven - help alleen met reflectie en begrip

`
      }
      
      // Add reflection context for all sections
      if (formativeState.examples?.reflections && Object.keys(formativeState.examples.reflections).length > 0) {
        context += `
REFLECTIES VAN STUDENT OP VOORBEELDEN:
`
        Object.entries(formativeState.examples.reflections).forEach(([sectionId, reflection]) => {
          const section = assignmentContext.sections?.find((s: any) => s.id === sectionId)
          if (section && reflection) {
            context += `- ${section.title}: "${reflection}"${sectionId === currentSection.id ? ' (HUIDIGE SECTIE)' : ''}\n`
          }
        })
        context += '\n'
      }
      
      // Add available examples context
      if (formativeState.examples?.availableExamples && formativeState.examples.availableExamples.length > 0) {
        context += `BESCHIKBARE VOORBEELDEN:\n`
        formativeState.examples.availableExamples.forEach((sectionId: string) => {
          const section = assignmentContext.sections?.find((s: any) => s.id === sectionId)
          if (section) {
            context += `- ${section.title}${sectionId === currentSection.id ? ' (HUIDIGE SECTIE)' : ''}\n`
          }
        })
        context += '\n'
      }
      
      return context
    }

    const socraticPrompt = feedbackContext?.isFeedbackRequest ? `
Je bent een socratische tutor die gespecialiseerd is in het geven van feedback op leerdoelen.

BELANGRIJK: Geef korte, heldere en krachtige Socratische feedback die de student aanzet om het leerdoel verder aan te scherpen.

LEERDOEL FEEDBACK CONTEXT:
- Type: ${feedbackContext.type === 'whole-assignment' ? 'Leerdoel voor hele opdracht' : `Leerdoel voor sectie "${feedbackContext.sectionTitle}"`}
- Het leerdoel van de student: "${feedbackContext.goal}"

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Beschrijving: ${assignmentContext.description || 'Geen beschrijving'}
${metadata?.educationLevelInfo ? `- Onderwijsniveau: ${metadata.educationLevelInfo.name} (${metadata.educationLevelInfo.ageRange})` : ''}
${metadata?.teacherName ? `- Docent: ${metadata.teacherName}` : ''}

${feedbackContext.type === 'section' && currentSection ? `
SECTIE SPECIFIEKE CONTEXT:
- Sectie titel: ${currentSection.title}
- Sectie beschrijving: ${currentSection.description}
- Hulpvragen voor deze sectie: ${currentSection.guideQuestions?.join(', ') || 'Geen hulpvragen'}
` : ''}

ALLE SECTIES OVERZICHT (voor context):
${sectionsOverview}

SOCRATISCHE FEEDBACK PRINCIPES VOOR LEERDOELEN:
1. **Kort en krachtig**: Max 2-3 zinnen feedback
2. **Vraaggestuurd**: Stel 1-2 concrete vragen die het leerdoel verbeteren
3. **SMART-gericht**: Help specificiteit, meetbaarheid, haalbaarheid, relevantie
4. **Context-bewust**: Gebruik de opdracht en sectie context
5. **Activerend**: Zet aan tot actie en verbetering

FEEDBACK STRATEGIEËN:
- Als het leerdoel te vaag is: Vraag naar meer specificiteit
- Als het leerdoel te breed is: Help het smaller te maken
- Als het leerdoel niet meetbaar is: Vraag hoe ze succes zullen herkennen
- Als het leerdoel niet relevant lijkt: Vraag naar de connectie met de opdracht
- Als het leerdoel te simpel is: Daag uit tot dieper leren

Student vraag/opmerking: "${message}"

Geef nu korte, krachtige Socratische feedback die het leerdoel verbetert. Geen lange uitleg - gewoon effectieve vragen die tot actie aanzetten.
` : isQuizMode ? `
Je bent een diagnostische quiz begeleider die studenten helpt reflecteren op hun geschreven werk door middel van formatieve feedback.

QUIZ CONTEXT:
${quizContext || 'Diagnostische quiz gebaseerd op student tekst'}

BELANGRIJK: Dit is een diagnostische quiz gericht op FEEDBACK, FEEDUP en FEEDFORWARD:
- FEEDBACK: Waar staat de student nu? (huidige kwaliteit, sterke punten, aandachtspunten)
- FEEDUP: Waar gaat de student naartoe? (doelen, gewenste verbeteringen)
- FEEDFORWARD: Wat zijn de volgende stappen? (concrete acties, strategieën)

QUIZ BEGELEIDING PRINCIPES:
1. Reageer op het antwoord van de student met constructieve vragen die dieper ingaan
2. Geef waardering voor goede reflecties en zelfbewustzijn
3. Stel verdiepende vragen die kritisch denken stimuleren
4. Help de student concrete verbeterpunten te identificeren
5. Moedig de student aan om zelf oplossingen te bedenken
6. Geef geen directe antwoorden, maar begeleid hen naar eigen inzichten
7. Houd het gesprek gefocust op de kwaliteit van hun geschreven werk

ONDERWIJSCONTEXT:
${metadata?.educationLevelInfo ? `- Onderwijsniveau: ${metadata.educationLevelInfo.name} (${metadata.educationLevelInfo.ageRange})` : ''}
${metadata?.educationLevelInfo ? `- Complexiteitsniveau: ${metadata.educationLevelInfo.complexity}` : ''}
${metadata?.teacherName ? `- Docent: ${metadata.teacherName}` : ''}

${getFormativeAssessmentContext()}

${getLearningGoalContext()}

STUDENT TEKST CONTEXT:
- Huidige sectie: ${currentSection && currentSection.title ? currentSection.title : 'Onbekend'}
- Geschreven tekst: "${readableContent || 'Nog geen tekst geschreven'}"

Student antwoord/vraag: "${message}"

QUIZ FEEDBACK INSTRUCTIES:
1. Geef FEEDBACK op wat de student heeft geantwoord - wat is goed, wat kan beter?
2. Stel FEEDUP vragen - help hen doelen te stellen voor verbetering
3. Geef FEEDFORWARD - concrete vervolgvragen of acties voor verbetering
4. Gebruik de "waarom" en "hoe" vragen om dieper te graven
5. Moedig de student aan om zelf verbeteringen te bedenken
6. Houd het gesprek constructief en ondersteunend
7. Verwijs naar concrete delen van hun tekst waar relevant
8. Stimuleer kritische zelfreflectie zonder te oordelen

Reageer nu op hun antwoord met verdiepende vragen die feedback, feedup en feedforward stimuleren.
` : `
Je bent een socratische tutor die studenten begeleidt bij het schrijven van hun opdracht.

BELANGRIJK: Je mag NOOIT het werk voor de student doen. Je stelt alleen doordachte vragen die hen helpen zelf na te denken.

ONDERWIJSCONTEXT:
${metadata?.educationLevelInfo ? `- Onderwijsniveau: ${metadata.educationLevelInfo.name} (${metadata.educationLevelInfo.ageRange})` : ''}
${metadata?.educationLevelInfo ? `- Complexiteitsniveau: ${metadata.educationLevelInfo.complexity}` : ''}
${metadata?.teacherName ? `- Docent: ${metadata.teacherName}` : ''}

${getFormativeAssessmentContext()}

${getLearningGoalContext()}

${getReflectionContext()}

${getAllFormativeContext()}

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
12. Als er een persoonlijk leerdoel is ingesteld, verwijs hier regelmatig naar
13. Help de student reflecteren op hun leerdoel en geef feedback op de kwaliteit ervan
14. Stel vragen die aansluiten bij hun persoonlijke leerambities

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

${learningGoals && Object.keys(learningGoals).length > 0 ? `
Voorbeelden van leerdoel-gerichte vragen:
- "Hoe draagt wat je nu schrijft bij aan je persoonlijke leerdoel?"
- "Welke aspecten van je leerdoel zie je terug in je huidige werk?"
- "Op welke manier helpt deze sectie je om te bereiken wat je wilt leren?"
- "Wat zou je willen toevoegen om je leerdoel beter te realiseren?"
- "Hoe zou je je leerdoel kunnen verdiepen of specifieker maken?"
- "Welke nieuwe inzichten krijg je die aansluiten bij je leerdoelen?"
` : ''}

${reflectionContext ? `
Voorbeelden van reflectie-verdiepende vragen:
- "Je schrijft in je reflectie '${reflectionContext.reflection.substring(0, 50)}...'. Wat bedoel je daar precies mee?"
- "Welke specifieke elementen in het voorbeeld zorgen ervoor dat het zo effectief is?"
- "Hoe zou je dat wat je goed vindt aan het voorbeeld concreet kunnen toepassen in je eigen tekst?"
- "Wat zou er gebeuren als je dat aspect weglaat uit je eigen schrijven?"
- "Kun je een specifiek voorbeeld geven van hoe je dit gaat gebruiken?"
- "Wat is het verschil tussen hoe jij normaal zou schrijven en wat je in dit voorbeeld ziet?"
- "Welke nieuwe inzichten geeft dit voorbeeld je over effectief schrijven?"
- "Wat zou je aan iemand anders uitleggen over waarom dit voorbeeld goed werkt?"
` : ''}

${formativeState?.quiz?.active ? `
Voorbeelden van diagnostische quiz vragen (JE BENT IN QUIZ-MODUS):
- "Welk argument in je tekst vind je het overtuigendst en waarom denk je dat?"
- "Waar zou een kritische lezer mogelijk vraagtekens bij zetten in je tekst?"
- "Welk onderdeel van je tekst zou je als eerste verbeteren als je de tijd had?"
- "Hoe zou iemand die het oneens is met je standpunt reageren op je argumenten?"
- "Welke informatie ontbreekt er nog om je punt volledig te ondersteunen?"
- "Wat is de zwakste schakel in je argumentatie en hoe weet je dat?"
- "Hoe zou je je hoofdpunt in één zin samenvatten voor iemand die haast heeft?"
- "Welke aannames maak je die misschien niet voor iedereen vanzelfsprekend zijn?"
- "Waar zie je de sterkste verbinding tussen je verschillende punten?"
- "Als je één ding zou mogen toevoegen aan je tekst, wat zou dat zijn en waarom?"
` : ''}
`

    const result = await model.generateContent(socraticPrompt)
    const response = result.response.text()

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Socratic chat error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Er ging iets mis met de chat',
        details: errorMessage,
        type: error instanceof Error ? error.constructor.name : 'Unknown'
      },
      { status: 500 }
    )
  }
}