import { NextRequest } from 'next/server'
import { 
  validateGeminiKey, 
  createErrorResponse, 
  safeParseJSON,
  validateRequestMethod,
  logApiRequest
} from '@/utils/api-helpers'
import { GeminiService } from '@/services/gemini-service'
import { validateRequest, ChatRequestSchema, type ChatRequest } from '@/utils/validation-schemas'

// Helper function to convert base64 to buffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

// Google Search tool configuratie
const googleSearchTool = {
  googleSearch: {}
}

export async function POST(request: NextRequest) {
  logApiRequest('/api/chat-stream', 'POST')
  
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

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let result;
          
          // Helper function to generate content with fallback
          const generateStreamWithFallback = async (requestConfig: any) => {
            try {
              return await model.generateContentStream(requestConfig)
            } catch (error: any) {
              // If grounding fails, retry without tools
              if (useGrounding && (error.message?.includes('Search Grounding is not supported') || 
                                  error.message?.includes('google_search_retrieval is not supported'))) {
                console.log('Grounding not supported, retrying streaming without grounding...')
                const { tools, ...configWithoutTools } = requestConfig
                return await model.generateContentStream(configWithoutTools)
              }
              throw error
            }
          }
          
          if (images && images.length > 0) {
            // Multiple images - use new images array
            const imageParts = images.map((imageData: string) => {
              const imageBuffer = base64ToBuffer(imageData)
              return {
                inlineData: {
                  data: imageBuffer.toString('base64'),
                  mimeType: 'image/jpeg'
                }
              }
            })
            
            result = await generateStreamWithFallback({
              contents: [{ role: 'user', parts: [{ text: message }, ...imageParts] }],
              tools: tools
            })
          } else if (image) {
            // Backward compatibility - single image (legacy)
            const imageBuffer = base64ToBuffer(image)
            
            const imagePart = {
              inlineData: {
                data: imageBuffer.toString('base64'),
                mimeType: 'image/jpeg'
              }
            }
            
            result = await generateStreamWithFallback({
              contents: [{ role: 'user', parts: [{ text: message }, imagePart] }],
              tools: tools
            })
          } else {
            // Text only
            result = await generateStreamWithFallback({
              contents: [{ role: 'user', parts: [{ text: message }] }],
              tools: tools
            })
          }

          // Stream the response token by token
          for await (const chunk of result.stream) {
            const chunkText = chunk.text()
            
            if (chunkText) {
              // Check if controller is still open before sending
              try {
                const data = JSON.stringify({ 
                  token: chunkText,
                  timestamp: new Date().toISOString()
                })
                
                controller.enqueue(
                  new TextEncoder().encode(`data: ${data}\n\n`)
                )
              } catch (error) {
                console.log('Controller already closed, stopping stream')
                break
              }
            }
          }

          // Send completion signal only if controller is still open
          try {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`)
            )
            
            controller.close()
          } catch (error) {
            console.log('Controller already closed during completion')
          }

        } catch (error) {
          console.error('Streaming error:', error)
          
          // Send error to client
          const errorData = JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : 'Streaming error occurred'
          })
          
          controller.enqueue(
            new TextEncoder().encode(`data: ${errorData}\n\n`)
          )
          
          controller.close()
        }
      }
    })

    // Return streaming response with proper headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Streaming API error:', error)
    
    return createErrorResponse(
      'Er is een fout opgetreden bij het verwerken van je bericht',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
} 