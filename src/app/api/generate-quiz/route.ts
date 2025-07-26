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
      // Remove HTML tags for cleaner analysis
      const cleanContent = section.content.replace(/<[^>]*>/g, '').trim()
      
      return `
SECTIE: ${section.title}
Beschrijving: ${section.description}
Hulpvragen: ${section.guideQuestions.join(', ')}
Geschreven inhoud (${cleanContent.length} karakters):
${cleanContent}
`
    }

    // Create content analysis
    const contentAnalysis = targetSections.map(formatSectionContent).join('\n---\n')

    let prompt = ''
    
    if (scope === 'current-section') {
      const currentSection = targetSections[0]
      prompt = `
Je bent een expert in formatief handelen en diagnostische evaluatie. Genereer een reeks kritische, diagnostische vragen voor een student die zijn/haar geschreven tekst wil evalueren.

${getFormativeContext()}

${getLearningGoalsContext()}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Onderwijsniveau: ${metadata?.educationLevelInfo?.name} (${metadata?.educationLevelInfo?.ageRange})

STUDENT TEKST ANALYSE:
${contentAnalysis}

BELANGRIJKE INSTRUCTIES voor de quiz:
1. Begin met ÉÉN OPEN, REFLECTIEVE VRAAG die de student uitnodigt om over hun eigen werk na te denken
2. Deze eerste vraag moet breed genoeg zijn om een gesprek te starten, maar specifiek genoeg om waardevol te zijn
3. Focus op FEEDBACK (Waar sta je nu?), FEEDUP (Waar ga je naartoe?) en FEEDFORWARD (Wat zijn de volgende stappen?)
4. Stel geen vragen waarop je zelf antwoorden geeft - laat de student nadenken en antwoorden
5. Houd rekening met het onderwijsniveau (${metadata?.educationLevelInfo?.complexity})
6. Als er leerdoelen zijn, verwijs dan subtiel naar deze waar relevant

VOORBEELDEN van goede openingsvragen:
- "Als je terugkijkt naar je tekst, wat vind je zelf het sterkste punt en waar twijfel je nog het meest over?"
- "Stel je voor dat een kritische lezer je tekst leest - welk deel zou de meeste vragen oproepen en waarom?"
- "Hoe zou je in eigen woorden uitleggen wat je belangrijkste boodschap is in deze sectie?"

FORMAAT:
Begin met een vriendelijke, uitnodigende inleiding (1-2 zinnen) die de student op hun gemak stelt.
Stel dan ÉÉN open vraag die uitnodigt tot reflectie.
Eindig met: "Neem de tijd om hier rustig over na te denken en deel je gedachten."

Genereer nu de openingsvraag voor de diagnostische quiz:
`
    } else {
      prompt = `
Je bent een expert in formatief handelen en diagnostische evaluatie. Genereer een reeks kritische, diagnostische vragen voor een student die zijn/haar complete geschreven werk wil evalueren.

${getFormativeContext()}

${getLearningGoalsContext()}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Onderwijsniveau: ${metadata?.educationLevelInfo?.name} (${metadata?.educationLevelInfo?.ageRange})

STUDENT TEKST ANALYSE (${targetSections.length} secties):
${contentAnalysis}

BELANGRIJKE INSTRUCTIES voor de quiz:
1. Begin met ÉÉN OPEN, REFLECTIEVE VRAAG die de student uitnodigt om over hun complete werk na te denken
2. Deze eerste vraag moet breed genoeg zijn om een gesprek te starten over het geheel, maar specifiek genoeg om waardevol te zijn
3. Focus op FEEDBACK (Waar sta je nu?), FEEDUP (Waar ga je naartoe?) en FEEDFORWARD (Wat zijn de volgende stappen?)
4. Stel geen vragen waarop je zelf antwoorden geeft - laat de student nadenken en antwoorden
5. Houd rekening met het onderwijsniveau (${metadata?.educationLevelInfo?.complexity})
6. Als er leerdoelen zijn, verwijs dan subtiel naar deze waar relevant
7. Focus op de samenhang en rode draad door het hele werk

VOORBEELDEN van goede openingsvragen voor complete werken:
- "Nu je je hele werk hebt geschreven, hoe zou je de rode draad omschrijven die door alle secties loopt?"
- "Als je terugkijkt op je complete tekst, welk deel ben je het meest trots op en welk deel zou je nog willen versterken?"
- "Stel dat je je werk in een lift pitch van 30 seconden moet samenvatten - wat zou je dan vertellen?"

FORMAAT:
Begin met een vriendelijke, uitnodigende inleiding (1-2 zinnen) die de student op hun gemak stelt.
Stel dan ÉÉN open vraag die uitnodigt tot reflectie over het complete werk.
Eindig met: "Neem de tijd om hier rustig over na te denken en deel je gedachten."

Genereer nu de openingsvraag voor de diagnostische quiz:
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