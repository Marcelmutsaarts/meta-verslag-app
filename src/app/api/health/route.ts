import { NextRequest } from 'next/server'
import { createSuccessResponse, createErrorResponse, logApiRequest } from '@/utils/api-helpers'
import { GeminiService } from '@/services/gemini-service'

export async function GET(request: NextRequest) {
  logApiRequest('/api/health', 'GET')
  
  try {
    const geminiService = GeminiService.getInstance()
    const keyStatus = geminiService.getKeyStatus()
    
    const healthData = {
      status: 'healthy' as const,
      geminiConfigured: keyStatus.configured,
      version: process.env.npm_package_version || '0.1.0'
    }
    
    return createSuccessResponse(healthData)
  } catch (error) {
    return createErrorResponse(
      'Health check failed',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}