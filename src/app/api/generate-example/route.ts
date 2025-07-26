import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper function to calculate text similarity using Levenshtein distance
function calculateTextSimilarity(text1: string, text2: string): number {
  const longer = text1.length > text2.length ? text1 : text2
  const shorter = text1.length > text2.length ? text2 : text1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

// Helper function to extract keywords from section title and description
function extractKeywords(title: string, description: string): string[] {
  const stopWords = new Set(['de', 'het', 'een', 'en', 'van', 'voor', 'in', 'op', 'met', 'aan', 'bij', 'te', 'is', 'zijn', 'was', 'waren', 'heeft', 'hebben', 'had', 'hadden'])
  
  const text = `${title} ${description || ''}`.toLowerCase()
  const words = text.match(/\b\w{3,}\b/g) || []
  
  return words.filter(word => !stopWords.has(word))
}

// Helper function to find content boundaries based on keyword density
function findContentBoundaries(content: string, keywords: string[], nextSection: any): { start: number, end: number } {
  if (keywords.length === 0) return { start: -1, end: -1 }
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20)
  let bestStart = -1
  let bestEnd = -1
  let maxDensity = 0
  
  // Find the span of sentences with highest keyword density
  for (let start = 0; start < sentences.length; start++) {
    for (let end = start + 1; end <= sentences.length; end++) {
      const span = sentences.slice(start, end).join(' ').toLowerCase()
      const keywordCount = keywords.reduce((count, keyword) => {
        return count + (span.match(new RegExp(keyword, 'g')) || []).length
      }, 0)
      
      const density = keywordCount / (end - start)
      
      if (density > maxDensity) {
        maxDensity = density
        bestStart = content.indexOf(sentences[start])
        bestEnd = end < sentences.length ? content.indexOf(sentences[end]) : content.length
      }
    }
  }
  
  return { start: bestStart, end: bestEnd }
}

export async function POST(request: NextRequest) {
  console.log('=== GENERATE EXAMPLE API CALLED ===')
  console.log('Request method:', request.method)
  console.log('Request URL:', request.url)
  console.log('Timestamp:', new Date().toISOString())
  
  try {
    console.log('Parsing request body...')
    const body = await request.json()
    console.log('Request body parsed successfully')
    
    const { 
      scope, // 'current-section' | 'all-sections'
      sectionId, // Section ID for current section
      currentSection,
      allSections,
      assignmentContext,
      metadata,
      formativeAssessment,
      customContext
    } = body
    
    console.log('Request parameters:', {
      scope,
      sectionId,
      hasCurrentSection: !!currentSection,
      currentSectionId: currentSection?.id,
      currentSectionTitle: currentSection?.title,
      allSectionsCount: allSections?.length || 0,
      hasAssignmentContext: !!assignmentContext,
      hasMetadata: !!metadata,
      hasFormativeAssessment: !!formativeAssessment,
      customContextLength: customContext?.length || 0
    })

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
- Hulpvragen: ${currentSection.guideQuestions?.join(', ') || 'Geen hulpvragen'}

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
   - Hulpvragen: ${section.guideQuestions?.join(', ') || 'Geen hulpvragen'}
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

    console.log('=== SENDING REQUEST TO GEMINI API ===')
    console.log('Scope:', scope)
    console.log('Prompt length:', prompt.length)
    console.log('Model being used: gemini-2.5-flash-preview-05-20')
    
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
    const exampleContent = result.response.text()
    console.log('Generated example length:', exampleContent.length)
    console.log('Example content preview:', exampleContent.substring(0, 200) + '...')

    // Enhanced parsing for multi-section content
    let parsedExample
    if (scope === 'all-sections') {
      parsedExample = {} as Record<string, string>
      
      console.log('=== ENHANCED MULTI-SECTION PARSING ===')
      console.log('Content length:', exampleContent.length)
      console.log('Number of sections expected:', allSections.length)
      
      // Strategy 1: Advanced markdown header parsing with flexible matching
      const enhancedHeaderParsing = () => {
        console.log('Strategy 1: Enhanced header parsing...')
        
        // Split by various header patterns
        const headerPatterns = [
          /^#{1,3}\s+(.+?)$/gm,  // Standard markdown headers
          /^(.+?)\n[=-]{3,}$/gm,  // Underlined headers
          /^\d+\.\s+(.+?)$/gm,    // Numbered headers
        ]
        
        let bestMatch: Record<string, string> = {}
        let bestScore = 0
        
        headerPatterns.forEach(pattern => {
          const matches: RegExpExecArray[] = []
          let match: RegExpExecArray | null
          while ((match = pattern.exec(exampleContent)) !== null) {
            matches.push(match)
            if (!pattern.global) break
          }
          pattern.lastIndex = 0 // Reset for next use
          console.log(`Pattern matches found:`, matches.length)
          
          if (matches.length > 0) {
            const tempParsed: Record<string, string> = {}
            let score = 0
            
            matches.forEach((match, index) => {
              const headerText = match[1].trim()
              const startPos = match.index!
              const nextMatch = matches[index + 1]
              const endPos = nextMatch ? nextMatch.index! : exampleContent.length
              
              // Extract content between headers
              let content = exampleContent.substring(startPos, endPos)
              content = content.replace(match[0], '').trim() // Remove header itself
              
              // Find best matching section
              const matchingSection = allSections.find((section: any) => {
                const similarity = calculateTextSimilarity(headerText.toLowerCase(), section.title.toLowerCase())
                return similarity > 0.6 // 60% similarity threshold
              })
              
              if (matchingSection && content.length > 50) {
                tempParsed[matchingSection.id] = content
                score += content.length
                console.log(`Matched "${headerText}" → "${matchingSection.title}"`)
              }
            })
            
            if (score > bestScore) {
              bestMatch = tempParsed
              bestScore = score
            }
          }
        })
        
        return Object.keys(bestMatch).length >= allSections.length * 0.6 ? bestMatch : {}
      }
      
      // Strategy 2: Smart content segmentation based on section keywords
      const keywordBasedParsing = () => {
        console.log('Strategy 2: Keyword-based parsing...')
        
        const segments: Record<string, string> = {}
        const processedContent = exampleContent
        
        // Create keyword clusters for each section
        allSections.forEach((section: any, index: number) => {
          const keywords = extractKeywords(section.title, section.description)
          const nextSection = allSections[index + 1]
          
          // Find content boundaries using keyword density
          const boundaries = findContentBoundaries(processedContent, keywords, nextSection)
          
          if (boundaries.start !== -1 && boundaries.end !== -1) {
            const content = processedContent.substring(boundaries.start, boundaries.end).trim()
            if (content.length > 50) {
              segments[section.id] = content
              console.log(`Segmented content for "${section.title}": ${content.length} chars`)
            }
          }
        })
        
        return segments
      }
      
      // Strategy 3: Improved proportional distribution
      const intelligentDistribution = () => {
        console.log('Strategy 3: Intelligent distribution...')
        
        // Clean and segment content
        const cleanedContent = exampleContent
          .replace(/^#+\s+.*$/gm, '') // Remove headers
          .replace(/\n{3,}/g, '\n\n') // Normalize spacing
          .trim()
        
        // Split into meaningful chunks (sentences/paragraphs)
        const sentences = cleanedContent
          .split(/[.!?]+\s+/)
          .filter(s => s.trim().length > 20)
        
        const paragraphs = cleanedContent
          .split(/\n\s*\n/)
          .filter(p => p.trim().length > 50)
        
        // Use the more appropriate segmentation
        const chunks = paragraphs.length >= allSections.length ? paragraphs : sentences
        console.log(`Using ${chunks.length} ${paragraphs.length >= allSections.length ? 'paragraphs' : 'sentences'} for distribution`)
        
        const distribution: Record<string, string> = {}
        
        // Calculate target lengths based on section word counts
        const totalWordCount = chunks.join(' ').split(/\s+/).length
        const sectionWeights = allSections.map((section: any) => {
          const targetWords = section.wordCount || Math.floor(totalWordCount / allSections.length)
          return Math.max(targetWords, 100) // Minimum 100 words per section
        })
        
        const totalWeight = sectionWeights.reduce((sum: number, weight: number) => sum + weight, 0)
        
        let chunkIndex = 0
        allSections.forEach((section: any, sectionIndex: number) => {
          const targetRatio = sectionWeights[sectionIndex] / totalWeight
          const targetChunks = Math.max(1, Math.round(chunks.length * targetRatio))
          
          const sectionChunks = chunks.slice(chunkIndex, chunkIndex + targetChunks)
          chunkIndex += targetChunks
          
          if (sectionChunks.length > 0) {
            distribution[section.id] = sectionChunks.join('\n\n').trim()
            console.log(`Distributed ${sectionChunks.length} chunks to "${section.title}"`)
          }
        })
        
        return distribution
      }
      
      // Apply parsing strategies in order of sophistication
      parsedExample = enhancedHeaderParsing()
      
      if (Object.keys(parsedExample).length < allSections.length * 0.6) {
        console.log('Header parsing insufficient, trying keyword-based parsing...')
        const keywordResult = keywordBasedParsing()
        if (Object.keys(keywordResult).length > Object.keys(parsedExample).length) {
          parsedExample = keywordResult
        }
      }
      
      if (Object.keys(parsedExample).length < allSections.length * 0.6) {
        console.log('Advanced parsing failed, using intelligent distribution...')
        parsedExample = intelligentDistribution()
      }
      
      console.log('=== PARSING COMPLETE ===')
      console.log('Successfully parsed sections:', Object.keys(parsedExample).length)
      console.log('Target sections:', allSections.length)
      console.log('Success rate:', `${Math.round((Object.keys(parsedExample).length / allSections.length) * 100)}%`)
    } else {
      const actualSectionId = currentSection?.id || sectionId || 'unknown-section'
      parsedExample = {
        [actualSectionId]: exampleContent.trim()
      }
    }

    const responseData = {
      success: true,
      scope,
      examples: parsedExample,
      metadata: {
        generatedAt: new Date().toISOString(),
        wordCount: exampleContent.length / 5, // Rough estimate
        sectionsGenerated: Object.keys(parsedExample).length
      }
    }
    
    console.log('=== EXAMPLE GENERATION SUCCESSFUL ===')
    console.log('Response data:', {
      success: responseData.success,
      scope: responseData.scope,
      sectionsGenerated: responseData.metadata.sectionsGenerated,
      exampleKeys: Object.keys(parsedExample)
    })
    
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('=== EXAMPLE GENERATION ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('Full error object:', error)
    
    return NextResponse.json(
      { 
        error: 'Er ging iets mis bij het genereren van het voorbeeld',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}