import { NextRequest } from 'next/server'
import { 
  validateGeminiKey, 
  createErrorResponse, 
  createSuccessResponse, 
  safeParseJSON,
  validateRequestMethod,
  logApiRequest,
  validateTextLength
} from '@/utils/api-helpers'
import { GeminiService } from '@/services/gemini-service'
import { validateRequest, ChatRequestSchema, type ChatRequest } from '@/utils/validation-schemas'

// Helper functie om base64 naar buffer te converteren
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

// Google Search tool configuratie
const googleSearchTool = {
  googleSearch: {}
}

export async function POST(request: NextRequest) {
  logApiRequest('/api/chat', 'POST')
  
  // Validate request method
  const methodError = validateRequestMethod(request, ['POST'])
  if (methodError) return methodError
  
  // Validate Gemini API key
  const keyError = validateGeminiKey()
  if (keyError) return keyError
  
  try {
    // Parse and validate request body
    const { data: body, error: parseError } = await safeParseJSON<ChatRequest>(request)
    if (parseError) return parseError
    
    const validation = validateRequest(ChatRequestSchema, body)
    if (!validation.success) {
      return createErrorResponse(validation.error, validation.details.join(', '), 400)
    }
    
    const { message, image, images, useGrounding = true } = validation.data

    // Get Gemini service instance
    const geminiService = GeminiService.getInstance()
    const model = geminiService.getModel()

    // Configureer tools array - grounding alleen voor specifieke gevallen
    const tools = useGrounding ? [googleSearchTool] : []
    
    // Helper function to generate content with fallback
    const generateWithFallback = async (requestConfig: any) => {
      try {
        return await model.generateContent(requestConfig)
      } catch (error: any) {
        // If grounding fails, retry without tools
        if (useGrounding && (error.message?.includes('Search Grounding is not supported') || 
                            error.message?.includes('google_search_retrieval is not supported'))) {
          console.log('Grounding not supported, retrying without grounding...')
          const { tools, ...configWithoutTools } = requestConfig
          return await model.generateContent(configWithoutTools)
        }
        throw error
      }
    }
    
    let result;
    
    if (images && images.length > 0) {
      // Meerdere afbeeldingen - gebruik nieuwe images array
      const imageParts = images.map((imageData: string) => {
        const imageBuffer = base64ToBuffer(imageData)
        return {
          inlineData: {
            data: imageBuffer.toString('base64'),
            mimeType: 'image/jpeg'
          }
        }
      })
      
      result = await generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: message }, ...imageParts] }],
        tools: tools
      })
    } else if (image) {
      // Backward compatibility - één afbeelding (legacy)
      const imageBuffer = base64ToBuffer(image)
      
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg'
        }
      }
      
      result = await generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: message }, imagePart] }],
        tools: tools
      })
    } else {
      // Alleen tekst
      result = await generateWithFallback({
        contents: [{ role: 'user', parts: [{ text: message }] }],
        tools: tools
      })
    }

    const response = await result.response
    const text = response.text()

    // Extract grounding metadata if available
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata || null
    const searchQueries = groundingMetadata?.webSearchQueries || []
    const groundingChuncks = groundingMetadata?.groundingChuncks || []

    const responseData = { 
      response: text,
      grounding: {
        isGrounded: !!groundingMetadata,
        searchQueries: searchQueries,
        sources: groundingChuncks.map((chunk: any) => ({
          title: chunk.web?.title || 'Unknown',
          uri: chunk.web?.uri || '',
          snippet: chunk.web?.snippet || ''
        }))
      }
    }

    return createSuccessResponse(responseData)

  } catch (error) {
    console.error('Chat API Error:', error)
    
    return createErrorResponse(
      'Er is een fout opgetreden bij het verwerken van je bericht',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
} 