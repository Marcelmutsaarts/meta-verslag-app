import { z } from 'zod'

// Common validation rules
const MAX_TEXT_LENGTH = 100000
const MAX_MESSAGE_LENGTH = 32000
const MAX_TITLE_LENGTH = 500
const MAX_URL_LENGTH = 2000

// File validation
export const FileTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg'
])

// Base schemas
export const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(MAX_TITLE_LENGTH),
  description: z.string().optional(),
  guideQuestions: z.array(z.string()).optional(),
  order: z.number().min(0).optional()
})

export const StudentSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional()
})

export const MetadataSchema = z.object({
  formativeAssessment: z.object({
    enabled: z.boolean(),
    strategies: z.object({
      personalLearningGoals: z.object({
        enabled: z.boolean()
      }).optional(),
      exampleBasedLearning: z.object({
        enabled: z.boolean()
      }).optional(),
      diagnosticQuiz: z.object({
        enabled: z.boolean()
      }).optional()
    }).optional()
  }).optional()
})

// API Request Schemas

// Chat APIs
export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  image: z.string().optional(),
  images: z.array(z.string()).optional(),
  useGrounding: z.boolean().default(true),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional()
})

export const SocraticChatRequestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  currentSection: SectionSchema,
  currentContent: z.string().max(MAX_TEXT_LENGTH).optional(),
  assignmentContext: z.object({
    title: z.string(),
    sections: z.array(SectionSchema),
    instructions: z.string().optional()
  }),
  studentContext: z.object({
    sectionContents: z.record(z.string(), z.string()),
    learningGoals: z.object({
      sections: z.record(z.string(), z.object({
        content: z.string(),
        status: z.enum(['draft', 'final']),
        updatedAt: z.string()
      })),
      wholeAssignment: z.object({
        content: z.string(),
        status: z.enum(['draft', 'final']),
        updatedAt: z.string()
      }).optional()
    }),
    examples: z.object({
      data: z.record(z.string(), z.object({
        content: z.string(),
        generatedAt: z.string()
      })),
      reflections: z.record(z.string(), z.string())
    })
  }).optional(),
  metadata: MetadataSchema.optional()
})

// Example Generation
export const GenerateExampleRequestSchema = z.object({
  assignmentData: z.object({
    title: z.string(),
    sections: z.array(SectionSchema),
    instructions: z.string().optional()
  }),
  sectionId: z.string().min(1).optional(),
  scope: z.enum(['section', 'whole-assignment']),
  context: z.string().max(MAX_TEXT_LENGTH).optional(),
  learningGoals: z.string().max(MAX_TEXT_LENGTH).optional(),
  studentWriting: z.string().max(MAX_TEXT_LENGTH).optional()
})

// Quiz Generation
export const GenerateQuizRequestSchema = z.object({
  assignmentData: z.object({
    title: z.string(),
    sections: z.array(SectionSchema)
  }),
  sectionId: z.string().min(1),
  studentContent: z.string().max(MAX_TEXT_LENGTH).optional(),
  learningGoals: z.string().max(MAX_TEXT_LENGTH).optional()
})

// Text-to-Speech
export const GenerateTTSRequestSchema = z.object({
  text: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  voice: z.string().optional(),
  speed: z.number().min(0.25).max(4.0).optional()
})

// File Upload (for analyze-assignment)
export const AnalyzeAssignmentFormSchema = z.object({
  teacherInstructions: z.string().max(MAX_TEXT_LENGTH).optional(),
  enableFormativeAssessment: z.boolean().optional(),
  enablePersonalLearningGoals: z.boolean().optional(),
  enableExampleBasedLearning: z.boolean().optional(),
  enableDiagnosticQuiz: z.boolean().optional(),
  exampleContext: z.string().max(MAX_TEXT_LENGTH).optional()
})

// Audio Transcription
export const TranscribeAudioRequestSchema = z.object({
  audioData: z.string(), // base64 encoded
  mimeType: z.string().regex(/^audio\//),
  fileName: z.string().optional()
})

// Health Check
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  timestamp: z.string(),
  geminiConfigured: z.boolean(),
  version: z.string().optional()
})

// Validation helper function
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: string[] } {
  try {
    const validatedData = schema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.issues.map(err => `${err.path.join('.')}: ${err.message}`)
      }
    }
    return {
      success: false,
      error: 'Unknown validation error',
      details: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

// File validation helper
export function validateFileSize(file: File, maxSizeBytes: number = 10 * 1024 * 1024): string | null {
  if (file.size > maxSizeBytes) {
    return `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxSizeBytes / 1024 / 1024)}MB)`
  }
  return null
}

export function validateFileType(file: File, allowedTypes: string[]): string | null {
  if (!allowedTypes.includes(file.type)) {
    return `File type '${file.type}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`
  }
  return null
}

// Export individual schemas for type inference
export type ChatRequest = z.infer<typeof ChatRequestSchema>
export type SocraticChatRequest = z.infer<typeof SocraticChatRequestSchema>
export type GenerateExampleRequest = z.infer<typeof GenerateExampleRequestSchema>
export type GenerateQuizRequest = z.infer<typeof GenerateQuizRequestSchema>
export type GenerateTTSRequest = z.infer<typeof GenerateTTSRequestSchema>
export type AnalyzeAssignmentForm = z.infer<typeof AnalyzeAssignmentFormSchema>
export type TranscribeAudioRequest = z.infer<typeof TranscribeAudioRequestSchema>
export type Section = z.infer<typeof SectionSchema>
export type Student = z.infer<typeof StudentSchema>
export type Metadata = z.infer<typeof MetadataSchema>