import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      scope, // 'current-section' | 'all-sections'
      currentSection,
      allSections,
      assignmentContext,
      metadata,
      formativeAssessment,
      customContext
    } = body

    if (!scope || !assignmentContext) {
      return NextResponse.json(
        { error: 'Scope en assignment context zijn vereist' },
        { status: 400 }
      )
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' })

    // Helper function to get formative assessment context
    const getFormativeContext = () => {
      if (!formativeAssessment?.enabled) return ''
      
      let context = `\nFORMATIEVE ASSESSMENT CONTEXT:\n`
      
      if (formativeAssessment.strategies?.exampleBasedLearning?.enabled) {
        context += `- Voorbeeldgericht leren is actief\n`
        context += `- Bron: ${formativeAssessment.strategies.exampleBasedLearning.exampleSource === 'ai-generated' ? 'AI-gegenereerde voorbeelden' : 'Door docent aangeleverde voorbeelden'}\n`
        
        if (formativeAssessment.strategies.exampleBasedLearning.customReflectionQuestions) {
          context += `- Reflectievragen: "${formativeAssessment.strategies.exampleBasedLearning.customReflectionQuestions}"\n`
        }
      }
      
      return context + '\n'
    }

    // Helper function to get custom context
    const getCustomContext = () => {
      if (!customContext || !customContext.trim()) return ''
      
      return `
EXTRA CONTEXT VAN DOCENT/STUDENT:
${customContext}

BELANGRIJK: Houd rekening met deze extra context bij het genereren van het voorbeeld. Pas het voorbeeld aan zodat het aansluit bij de gegeven context.

`
    }

    let prompt = ''
    
    if (scope === 'current-section') {
      // Generate example for current section only
      prompt = `
Je bent een expert in het schrijven van educatieve voorbeelden. Genereer een CONCREET, UITGEWERKT voorbeeld voor de volgende sectie van een student opdracht.

${getFormativeContext()}

${getCustomContext()}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Onderwijsniveau: ${metadata?.educationLevelInfo?.name} (${metadata?.educationLevelInfo?.ageRange})

SECTIE INFORMATIE:
- Titel: ${currentSection.title}
- Beschrijving: ${currentSection.description}
- Richtlijn woordaantal: ${currentSection.wordCount || 'Niet gespecificeerd'}
- Hulpvragen: ${currentSection.guideQuestions.join(', ')}

BELANGRIJKE INSTRUCTIES:
1. Genereer een VOLLEDIG UITGEWERKT voorbeeld van hoe deze sectie eruit zou kunnen zien
2. Maak het voorbeeld realistisch en passend bij het onderwijsniveau
3. Gebruik concrete inhoud, geen placeholder tekst
4. Het voorbeeld moet educatief waardevol zijn
5. Houd rekening met het richtlijn woordaantal
6. Laat het voorbeeld zien hoe de hulpvragen kunnen worden beantwoord
7. Gebruik duidelijke, toegankelijke taal voor het onderwijsniveau
8. Maak het voorbeeld inspirerend maar haalbaar

FORMAAT:
Geef alleen de voorbeeldtekst terug, geen uitleg of meta-commentaar. De tekst moet direct bruikbaar zijn als voorbeeld in de sectie.

Genereer nu een concreet, uitgewerkt voorbeeld:
`
    } else {
      // Generate example for complete assignment
      prompt = `
Je bent een expert in het schrijven van educatieve voorbeelden. Genereer een CONCREET, UITGEWERKT voorbeeld van een compleet verslag/opdracht.

${getFormativeContext()}

${getCustomContext()}

OPDRACHT CONTEXT:
- Titel: ${assignmentContext.title}
- Doel: ${assignmentContext.objective}
- Onderwijsniveau: ${metadata?.educationLevelInfo?.name} (${metadata?.educationLevelInfo?.ageRange})

SECTIE STRUCTUUR:
${allSections.map((section: any, index: number) => `
${index + 1}. ${section.title}
   - Beschrijving: ${section.description}
   - Woordaantal: ${section.wordCount || 'Niet gespecificeerd'}
   - Hulpvragen: ${section.guideQuestions.join(', ')}
`).join('')}

BELANGRIJKE INSTRUCTIES:
1. Genereer een VOLLEDIG UITGEWERKT voorbeeld van het complete verslag
2. Behandel ALLE secties in logische volgorde
3. Maak het voorbeeld realistisch en passend bij het onderwijsniveau
4. Gebruik concrete inhoud, geen placeholder tekst
5. Zorg voor samenhang tussen de secties
6. Het voorbeeld moet educatief waardevol zijn
7. Houd rekening met de richtlijn woordaantallen per sectie
8. Laat zien hoe alle hulpvragen kunnen worden beantwoord
9. Gebruik duidelijke, toegankelijke taal voor het onderwijsniveau
10. Maak het voorbeeld inspirerend maar haalbaar

FORMAAT:
Structureer het voorbeeld met duidelijke sectie-headers EXACT zoals hieronder:

${allSections.map((section: any, index: number) => `
# ${section.title}
[Voorbeeldinhoud voor ${section.title}]
`).join('')}

BELANGRIJK: 
- Gebruik EXACT de sectietitels zoals hierboven aangegeven
- Begin elke sectie met # gevolgd door de exacte titel
- Geef alleen de voorbeeldtekst terug, geen uitleg of meta-commentaar
- Zorg dat elke sectie substantiële inhoud heeft (minimaal 2-3 alinea's)

Genereer nu een concreet, uitgewerkt voorbeeld van het complete verslag:
`
    }

    console.log('Generating example with scope:', scope)
    
    const result = await model.generateContent(prompt)
    const exampleContent = result.response.text()
    
    console.log('Generated example length:', exampleContent.length)

    // Parse the example for multi-section content if needed
    let parsedExample
    if (scope === 'all-sections') {
      parsedExample = {}
      
      console.log('Parsing multi-section example...')
      
      // First try: split by markdown headers (# Title)
      const headerSections = exampleContent.split(/^# /gm).filter(Boolean)
      console.log('Found header sections:', headerSections.length)
      
      if (headerSections.length > 0) {
        allSections.forEach((section: any) => {
          // Look for exact section title match first
          let matchingSection = headerSections.find(s => {
            const firstLine = s.split('\n')[0].trim()
            return firstLine.toLowerCase() === section.title.toLowerCase()
          })
          
          // If no exact match, try partial matching
          if (!matchingSection) {
            const sectionTitle = section.title.toLowerCase()
            matchingSection = headerSections.find(s => {
              const firstLine = s.split('\n')[0].toLowerCase()
              return firstLine.includes(sectionTitle) || sectionTitle.includes(firstLine)
            })
          }
          
          if (matchingSection) {
            const lines = matchingSection.split('\n')
            const content = lines.slice(1).join('\n').trim()
            if (content.length > 30) {
              parsedExample[section.id] = content
              console.log(`Matched section "${section.title}" by title`)
            }
          }
        })
      }
      
      // If header parsing didn't work well, try alternative splitting
      if (Object.keys(parsedExample).length < allSections.length / 2) {
        console.log('Header parsing failed, trying alternative methods...')
        parsedExample = {}
        
        // Try splitting by section titles in text
        let remainingContent = exampleContent
        allSections.forEach((section: any, index: number) => {
          const nextSection = allSections[index + 1]
          
          // Look for section title in content
          const titlePattern = new RegExp(`\\b${section.title}\\b`, 'i')
          const titleMatch = remainingContent.search(titlePattern)
          
          if (titleMatch !== -1) {
            let sectionEnd = remainingContent.length
            
            // Find where next section starts
            if (nextSection) {
              const nextTitlePattern = new RegExp(`\\b${nextSection.title}\\b`, 'i')
              const nextMatch = remainingContent.search(nextTitlePattern)
              if (nextMatch > titleMatch) {
                sectionEnd = nextMatch
              }
            }
            
            // Extract content between current and next section
            let sectionContent = remainingContent.substring(titleMatch, sectionEnd)
            
            // Clean up the content
            sectionContent = sectionContent
              .replace(new RegExp(`^.*${section.title}.*\n?`, 'i'), '') // Remove section header line
              .replace(/^#+\s*.*$/gm, '') // Remove any remaining headers
              .trim()
            
            if (sectionContent.length > 30) {
              parsedExample[section.id] = sectionContent
              console.log(`Matched section "${section.title}" by content search`)
            }
          }
        })
      }
      
      // Final fallback: distribute content evenly
      if (Object.keys(parsedExample).length === 0) {
        console.log('All parsing failed, distributing evenly...')
        
        // Split content into paragraphs and distribute
        const paragraphs = exampleContent
          .split(/\n\s*\n/)
          .filter(p => p.trim().length > 50)
        
        const paragraphsPerSection = Math.ceil(paragraphs.length / allSections.length)
        
        allSections.forEach((section: any, index: number) => {
          const startIdx = index * paragraphsPerSection
          const endIdx = Math.min(startIdx + paragraphsPerSection, paragraphs.length)
          const sectionParagraphs = paragraphs.slice(startIdx, endIdx)
          
          if (sectionParagraphs.length > 0) {
            parsedExample[section.id] = sectionParagraphs.join('\n\n').trim()
            console.log(`Distributed content to section "${section.title}"`)
          }
        })
      }
      
      console.log('Final parsed sections:', Object.keys(parsedExample).length)
    } else {
      parsedExample = {
        [currentSection.id]: exampleContent.trim()
      }
    }

    return NextResponse.json({
      success: true,
      scope,
      examples: parsedExample,
      metadata: {
        generatedAt: new Date().toISOString(),
        wordCount: exampleContent.length / 5, // Rough estimate
        sectionsGenerated: Object.keys(parsedExample).length
      }
    })

  } catch (error) {
    console.error('Error generating example:', error)
    return NextResponse.json(
      { 
        error: 'Er ging iets mis bij het genereren van het voorbeeld',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}