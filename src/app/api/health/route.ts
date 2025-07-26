import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const hasGeminiKey = !!process.env.GEMINI_API_KEY
    const keyLength = process.env.GEMINI_API_KEY?.length || 0
    
    return NextResponse.json({
      status: 'ok',
      geminiKeyConfigured: hasGeminiKey,
      geminiKeyLength: keyLength,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}