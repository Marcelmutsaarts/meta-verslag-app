import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      scope, // 'current-section' | 'all-sections'
      targetSections,
      assignmentContext,
      metadata,
      formativeState
    } = body

    if (!scope || !targetSections || targetSections.length === 0) {
      return NextResponse.json(
        { error: 'Scope en target sections zijn vereist' },
        { status: 400 }
      )
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    // Helper function to get formative assessment context
    const getFormativeContext = () => {
      if (!metadata?.formativeAssessment?.enabled) return ''
      
      let context = `\nFORMATIEVE ASSESSMENT CONTEXT:\n`
      
      if (metadata.formativeAssessment.strategies?.diagnosticQuiz?.enabled) {
        context += `- Diagnostische quiz is actief\n`
        context += `- Scope: ${metadata.formativeAssessment.strategies.diagnosticQuiz.scope}\n`
        
        if (metadata.formativeAssessment.strategies.diagnosticQuiz.customPrompt) {
          context += `- Aangepaste instructies: "${metadata.formativeAssessment.strategies.diagnosticQuiz.customPrompt}"\n`
        }
      }
      
      return context + '\n'
    }

    // Helper function to get learning goals context
    const getLearningGoalsContext = () => {
      if (!formativeState?.learningGoals) return ''
      
      let context = `\nSTUDENT LEERDOELEN:\n`
      
      // Add final learning goals
      if (formativeState.learningGoals.final && Object.keys(formativeState.learningGoals.final).length > 0) {
        Object.entries(formativeState.learningGoals.final).forEach(([key, goal]) => {
          if (goal) {
            const section = assignmentContext.sections?.find((s: any) => s.id === key)
            const sectionTitle = section ? section.title : key
            context += `- ${sectionTitle}: "${goal}"\n`
          }
        })
      }
      
      return context + '\n'
    }

    // Helper function to format section content for analysis
    const formatSectionContent = (section: any) => {
      // Remove HTML tags for cleaner analysis but preserve structure
      const cleanContent = section.content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      return `
SECTIE: "${section.title}"
Beschrijving: ${section.description}
Hulpvragen voor deze sectie: ${section.guideQuestions?.join(' | ') || 'Geen hulpvragen'}
Geschreven inhoud door student (${cleanContent.length} karakters):
${cleanContent || 'Nog geen inhoud geschreven'}

ANALYSE VAN GESCHREVEN INHOUD:
${cleanContent.length > 50 ? 'Student heeft substantiële inhoud geschreven - analyseer diepte, argumentatie, structuur en volledigheid' : 'Student heeft nog weinig/geen inhoud geschreven - focus op begrip van de opgave en startpunten'}
`
    }

    // Create content analysis
    const contentAnalysis = targetSections.map(formatSectionContent).join('\n---\n')

    let prompt = ''
    
    if (scope === 'current-section') {
      const currentSection = targetSections[0]
      const hasContent = currentSection.content && currentSection.content.trim().length > 50
      
      prompt = `
Je bent een expert in Socratische pedagogiek en diagnostische evaluatie. Je taak is om een contextbewuste, inhoudelijk gerichte openingsvraag te stellen die de student aanzet tot kritische reflectie op hun geschreven werk.

${getFormativeContext()}

${getLearningGoalsContext()}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Onderwijsniveau: ${metadata?.educationLevelInfo?.name} (${metadata?.educationLevelInfo?.ageRange})
- Complexiteitsniveau: ${metadata?.educationLevelInfo?.complexity}

GEDETAILLEERDE STUDENT ANALYSE:
${contentAnalysis}

SOCRATISCHE QUIZ PRINCIPES:
1. INHOUDELIJK GERICHT: Verwijs specifiek naar wat de student heeft geschreven
2. NIVEAU-AANGEPAST: Houd rekening met ${metadata?.educationLevelInfo?.complexity} niveau
3. LEERDOEL-BEWUST: ${formativeState?.learningGoals ? 'Koppel aan het leerdoel waar relevant' : 'Focus op leerprocessen'}
4. KRITISCH DENKEND: Stimuleer analyse, evaluatie en synthese
5. VEILIG & UITNODIGEND: Creëer een veilige ruimte voor eerlijke reflectie

STRATEGISCHE AANPAK:
${hasContent ? `
STUDENT HEEFT INHOUD GESCHREVEN - Focus op kwaliteitsverbetering:
- Analyseer argumentatie, bewijs en logica
- Vraag naar verbanden en consistentie
- Stimuleer kritische evaluatie van eigen werk
- Help identificeren sterke en zwakke punten
- Moedig diepere uitwerking aan waar nodig
` : `
STUDENT HEEFT WEINIG/GEEN INHOUD - Focus op begrip en startpunten:
- Controleer begrip van de opdracht
- Help bij het vinden van een beginpunt
- Stimuleer ideeontwikkeling
- Verbind aan voorkennis en ervaringen
- Maak de taak minder overweldigend
`}

VOORBEELDEN van contextbewuste openingsvragen:
${hasContent ? `
- "Ik zie dat je [specifiek punt uit hun tekst] hebt beschreven. Wat was je redenering om het op deze manier aan te pakken?"
- "In je tekst schrijf je [citaat]. Hoe zeker ben je van dit punt, en welke bewijzen ondersteunen dit?"
- "Als je je tekst voorleest aan [relevante doelgroep], welk deel zou volgens jou de sterkste indruk maken en waarom?"
` : `
- "Ik zie dat je nog aan het begin staat van deze sectie. Wat komt er bij je op als je de titel '${currentSection.title}' leest?"
- "Als je aan deze opdracht denkt, welk onderdeel lijkt je het meest uitdagend en waar zou je willen beginnen?"
- "Wat weet je al over dit onderwerp uit je eigen ervaring of eerdere lessen?"
`}

FORMAAT VEREISTEN:
1. Begin met een warme, bemoedigende opening (1 zin)
2. Toon dat je hun werk hebt gelezen door specifiek te refereren aan hun content
3. Stel ÉÉN concrete, open vraag die uitnodigt tot reflectie
4. Eindig bemoedigend en uitnodigend

Genereer nu een contextbewuste, inhoudelijk gerichte openingsvraag voor de diagnostische quiz:
`
    } else {
      const totalContent = targetSections.reduce((acc: number, section: any) => acc + (section.content || '').length, 0)
      const hasSubstantialContent = totalContent > 200
      
      prompt = `
Je bent een expert in Socratische pedagogiek en diagnostische evaluatie. Je taak is om een contextbewuste, inhoudelijk gerichte openingsvraag te stellen die de student aanzet tot kritische reflectie op hun complete geschreven werk.

${getFormativeContext()}

${getLearningGoalsContext()}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Onderwijsniveau: ${metadata?.educationLevelInfo?.name} (${metadata?.educationLevelInfo?.ageRange})
- Complexiteitsniveau: ${metadata?.educationLevelInfo?.complexity}

GEDETAILLEERDE ANALYSE VAN ALLE SECTIES (${targetSections.length} secties):
${contentAnalysis}

SOCRATISCHE QUIZ PRINCIPES VOOR GEHELE WERK:
1. HOLISTISCHE BENADERING: Focus op samenhang, consistentie en rode draad
2. INHOUDELIJK GERICHT: Verwijs naar specifieke secties en verbanden
3. NIVEAU-AANGEPAST: Houd rekening met ${metadata?.educationLevelInfo?.complexity} niveau
4. LEERDOEL-BEWUST: ${formativeState?.learningGoals ? 'Verbind alle leerdoelen en secties' : 'Focus op leerprocessen'}
5. KRITISCH DENKEND: Stimuleer analyse van het geheel
6. VEILIG & UITNODIGEND: Creëer ruimte voor eerlijke zelfreflectie

STRATEGISCHE AANPAK:
${hasSubstantialContent ? `
STUDENT HEEFT SUBSTANTIEEL WERK GESCHREVEN - Focus op coherentie en kwaliteit:
- Analyseer samenhang tussen secties
- Vraag naar consistentie in argumentatie
- Stimuleer evaluatie van de rode draad
- Help identificeren sterkste en zwakste delen
- Moedig reflectie aan op het totaalbeeld
` : `
STUDENT HEEFT BEPERKT WERK GESCHREVEN - Focus op overzicht en planning:
- Help bij het zien van het grote geheel
- Stimuleer planning en prioritering
- Verbind delen die wel geschreven zijn
- Moedig stapsgewijze aanpak aan
- Focus op begrip van de opdracht als geheel
`}

VOORBEELDEN van contextbewuste openingsvragen voor hele werk:
${hasSubstantialContent ? `
- "Als je alle secties van je werk overziet, welke rode draad loopt daar doorheen en waar zie je die het duidelijkst terug?"
- "Welke sectie van je werk vormt volgens jou de kern van je verhaal, en hoe ondersteunen de andere delen dit kernpunt?"
- "Als een expert je complete werk zou lezen, op welk onderdeel zou die volgens jou de meeste feedback geven?"
` : `
- "Als je naar je opdracht als geheel kijkt, waar zie je de sterkste verbinding tussen de verschillende onderdelen?"
- "Van alle secties die je moet schrijven, welke voelt het meest natuurlijk aan en waarom denk je dat dat zo is?"
- "Als je je werk tot nu toe zou moeten uitleggen aan een medestudent, wat zou je zeggen dat je hoofdboodschap is?"
`}

FORMAAT VEREISTEN:
1. Begin met een warme, bemoedigende opening over hun complete werk
2. Erken hun inspanning en toon dat je het geheel hebt bekeken
3. Stel ÉÉN concrete vraag die uitnodigt tot reflectie op samenhang
4. Eindig bemoedigend en uitnodigend

Genereer nu een contextbewuste, inhoudelijk gerichte openingsvraag voor de diagnostische quiz over het complete werk:
`
    }

    console.log('Generating diagnostic quiz with scope:', scope)
    
    const result = await model.generateContent(prompt)
    const quizContent = result.response.text()
    
    console.log('Generated quiz length:', quizContent.length)

    return NextResponse.json({
      success: true,
      scope,
      initialQuestions: quizContent,
      targetSections: targetSections.map((s: any) => s.id),
      metadata: {
        generatedAt: new Date().toISOString(),
        questionsCount: (quizContent.match(/\d+\./g) || []).length,
        scope
      }
    })

  } catch (error) {
    console.error('Error generating quiz:', error)
    return NextResponse.json(
      { 
        error: 'Er ging iets mis bij het genereren van de quiz',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}