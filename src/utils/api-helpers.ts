import { NextResponse } from 'next/server'

// Standardized API Response Type
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: string
  timestamp: string
}

// Gemini API Validation
export function validateGeminiKey(): NextResponse | null {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables')
    return createErrorResponse(
      'API configuratie fout. Controleer de environment variabelen.',
      'GEMINI_API_KEY ontbreekt',
      500
    )
  }
  return null
}

// Standardized Error Response Creator
export function createErrorResponse(
  message: string, 
  details?: string, 
  status: number = 500
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: message,
    details,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(response, { status })
}

// Standardized Success Response Creator
export function createSuccessResponse<T>(
  data: T, 
  status: number = 200
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  }
  
  return NextResponse.json(response, { status })
}

// Request Method Validation
export function validateRequestMethod(
  request: Request, 
  allowedMethods: string[]
): NextResponse | null {
  if (!allowedMethods.includes(request.method)) {
    return createErrorResponse(
      `Method ${request.method} Not Allowed`,
      `Allowed methods: ${allowedMethods.join(', ')}`,
      405
    )
  }
  return null
}

// Safe JSON Parse with Error Handling
export async function safeParseJSON<T>(request: Request): Promise<{
  data: T | null
  error: NextResponse | null
}> {
  try {
    const body = await request.json()
    return { data: body as T, error: null }
  } catch (error) {
    return {
      data: null,
      error: createErrorResponse(
        'Invalid JSON in request body',
        error instanceof Error ? error.message : 'Unknown parsing error',
        400
      )
    }
  }
}

// Request Size Validation
export function validateRequestSize(
  contentLength: string | null,
  maxSizeBytes: number = 10 * 1024 * 1024 // 10MB default
): NextResponse | null {
  if (contentLength && parseInt(contentLength) > maxSizeBytes) {
    return createErrorResponse(
      'Request body too large',
      `Maximum size: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
      413
    )
  }
  return null
}

// Text Length Validation
export function validateTextLength(
  text: string,
  minLength: number = 1,
  maxLength: number = 100000,
  fieldName: string = 'text'
): string | null {
  if (text.length < minLength) {
    return `${fieldName} moet minimaal ${minLength} karakters bevatten`
  }
  if (text.length > maxLength) {
    return `${fieldName} mag maximaal ${maxLength} karakters bevatten`
  }
  return null
}

// CORS Headers for API Routes
export function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}

// Handle OPTIONS Requests for CORS
export function handleOptions(): NextResponse {
  const response = new NextResponse(null, { status: 200 })
  return addCorsHeaders(response)
}

// Timeout Wrapper for Async Operations
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })
  
  return Promise.race([promise, timeoutPromise])
}

// Sanitize Input Text (Basic XSS Prevention)
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

// Log API Request (Development Helper)
export function logApiRequest(
  endpoint: string,
  method: string,
  additionalInfo?: Record<string, any>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API] ${method} ${endpoint}`, {
      timestamp: new Date().toISOString(),
      ...additionalInfo
    })
  }
}

// Extract File from FormData with Validation
export async function extractFileFromFormData(
  formData: FormData,
  fieldName: string,
  allowedTypes?: string[],
  maxSizeBytes?: number
): Promise<{
  file: File | null
  error: NextResponse | null
}> {
  try {
    const file = formData.get(fieldName) as File | null
    
    if (!file) {
      return {
        file: null,
        error: createErrorResponse(
          `Missing file in field: ${fieldName}`,
          'No file uploaded',
          400
        )
      }
    }
    
    // Validate file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return {
        file: null,
        error: createErrorResponse(
          'Invalid file type',
          `Allowed types: ${allowedTypes.join(', ')}`,
          400
        )
      }
    }
    
    // Validate file size
    if (maxSizeBytes && file.size > maxSizeBytes) {
      return {
        file: null,
        error: createErrorResponse(
          'File too large',
          `Maximum size: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
          413
        )
      }
    }
    
    return { file, error: null }
    
  } catch (error) {
    return {
      file: null,
      error: createErrorResponse(
        'Failed to process uploaded file',
        error instanceof Error ? error.message : 'Unknown file processing error',
        400
      )
    }
  }
}