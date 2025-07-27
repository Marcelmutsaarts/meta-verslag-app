import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai'

export class GeminiService {
  private static instance: GeminiService
  private genAI: GoogleGenerativeAI
  
  private constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured')
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  
  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService()
    }
    return GeminiService.instance
  }
  
  public getModel(modelName: string = 'gemini-2.5-flash-preview-05-20'): GenerativeModel {
    return this.genAI.getGenerativeModel({ model: modelName })
  }
  
  public async generateContent(
    prompt: string,
    modelName?: string,
    timeoutMs: number = 30000
  ): Promise<string> {
    const model = this.getModel(modelName)
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const result = await model.generateContent(prompt)
      const response = await result.response
      return response.text()
    } finally {
      clearTimeout(timeoutId)
    }
  }
  
  public async generateContentWithHistory(
    messages: Array<{ role: 'user' | 'model', parts: Array<{ text: string }> }>,
    modelName?: string,
    timeoutMs: number = 30000
  ): Promise<string> {
    const model = this.getModel(modelName)
    const chat = model.startChat({ history: messages })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      const result = await chat.sendMessage('')
      const response = await result.response
      return response.text()
    } finally {
      clearTimeout(timeoutId)
    }
  }
  
  public isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY
  }
  
  public getKeyStatus(): { configured: boolean, keyLength?: number } {
    const key = process.env.GEMINI_API_KEY
    return {
      configured: !!key,
      keyLength: key ? key.length : undefined
    }
  }
}