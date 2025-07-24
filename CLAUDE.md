# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meta-Verslag-App is an AI-powered educational tool that transforms assignment documents into interactive learning environments with Socratic guidance. Teachers upload assignment documents (PDF/DOCX), and the system generates structured learning environments where students can write section-by-section with AI assistance that follows Socratic methodology.

## Key Features

### Multi-Document Upload
- **Multiple File Support**: Upload PDF, DOCX, and TXT files simultaneously
- **Token Counting**: Real-time token estimation with visual feedback
- **20k Token Limit**: Built-in safeguards with color-coded warnings
- **File Management**: Individual file removal and progress tracking

### Student Authentication & Work Management
- **Simple Login System**: Students can login with name/email for personalized experience
- **Work Persistence**: All student work is automatically saved to localStorage
- **JSON Export/Import**: Students can save and restore their complete work sessions
- **Cross-Session Continuity**: Resume work on any device with saved JSON files

## Development Commands

```bash
# Development
npm run dev                 # Start development server at http://localhost:3000
npm run build              # Production build
npm run start              # Start production server
npm run lint               # ESLint code linting
npm run netlify-build      # Netlify-specific build command
```

**Requirements:** Node.js >= 18.0.0

## Core Architecture

### Application Flow
1. **Teacher Interface (`/`)**: Upload assignment document + optional instructions
2. **Document Analysis (`/api/analyze-assignment`)**: Gemini AI extracts structure and creates sections
3. **Student Workspace (`/workspace`)**: Three-column layout with sections, writing area, and Socratic chat
4. **AI Assistance (`/api/socratic-chat`)**: Context-aware educational guidance that never provides direct answers

### Key Technical Patterns

**Next.js 15 App Router**: All pages use the app directory structure with TypeScript
**Server Components vs Client Components**: API routes are server-side, UI components use 'use client' directive
**State Management**: React useState for local state, sessionStorage for assignment data persistence, localStorage for student work
**File Processing Pipeline**: Upload → Buffer extraction → Mammoth (DOCX) or pdf-parse (PDF) → Gemini analysis

### Three-Column Layout Architecture
- **Left Sidebar**: Section navigation with progress indicators
- **Center**: Main writing interface with guide questions and word count
- **Right Panel**: Collapsible Socratic chat assistant

## Environment Configuration

**Required:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get API key from: https://makersuite.google.com/app/apikey

## API Architecture

### Core Educational APIs
- `/api/analyze-assignment`: Document → structured learning environment
- `/api/socratic-chat`: Context-aware educational guidance

### Inherited Multi-Modal Features (from template)
- `/api/chat`: Multi-modal AI conversations
- `/api/chat-stream`: Real-time streaming responses  
- `/api/upload-docx`: Document processing (PDF, DOCX, CSV, TXT)
- `/api/transcribe-audio`: Audio → text transcription
- `/api/generate-tts`: Text-to-speech with 30+ voices

### Gemini Model Usage
- **Analysis**: `gemini-2.5-flash-preview-05-20` for document structure analysis
- **Chat**: `gemini-2.5-flash-preview-05-20` for Socratic conversations
- **Multi-modal**: `gemini-2.5-flash-preview-05-20` for all API features

## Critical Educational Principles

### Socratic Methodology Implementation
The `/api/socratic-chat` endpoint is meta-prompted to:
- Never provide direct answers or complete student work
- Ask thoughtful questions that promote critical thinking
- Reference section-specific guide questions when relevant
- Maintain context awareness of current section and student progress
- Encourage self-discovery through questioning

### Data Flow for Student Work
1. **Session Management**: Assignment data stored in sessionStorage after analysis
2. **Progress Persistence**: Student writing auto-saved to localStorage per section
3. **Context Awareness**: Chat bot receives current section content for personalized guidance

## File Processing Capabilities

**Supported Formats:**
- **Documents**: PDF (pdf-parse), DOCX (mammoth), TXT, CSV, JSON
- **Images**: JPG, PNG, GIF, WebP, BMP (inherited from template)
- **Audio**: MP3, WAV, OGG, M4A, AAC, FLAC, MP4, WebM (inherited)

**Processing Flow:** File → Buffer → Type-specific parser → Text extraction → Gemini analysis

## Component Architecture

### Educational Components
- **Workspace Page**: Main student interface with three-column layout
- **Section Navigation**: Progress tracking and section switching
- **Writing Interface**: Text areas with word count and guide questions
- **Socratic Chat**: Collapsible AI assistant panel

### Inherited Template Components
- **TestChatBot**: Advanced multi-modal chat interface
- **ResponseActions**: TTS, copy, Word export functionality
- **CameraCapture**: Browser camera integration
- **FileUpload**: Multi-file upload handling
- **VoiceInput**: Speech recognition
- **MarkdownRenderer**: AI response formatting

### Export Functionality
- **Word Export**: Full support for rich text formatting including:
  - Bullet points (unordered lists) with HTML and text-based fallback detection
  - Numbered lists (ordered lists) with HTML and text-based fallback detection
  - Bold, italic, and underline text
  - Headings (H1-H6)
  - Paragraphs and line breaks
  - Tables (preserved from HTML)
  - Robust list detection that works regardless of browser HTML generation
- **PDF Export**: HTML to PDF conversion with CSS styling for lists

## Debugging Tools

- `/test`: API testing interface with sessionStorage management
- `/debug`: Development debugging utilities
- Console logging enabled in both frontend and API endpoints

## Deployment Configuration

**Netlify Optimized**: 
- `netlify.toml` configured for Next.js deployment
- `@netlify/plugin-nextjs` for optimal performance
- Environment variables must be set in Netlify dashboard

**Build Process**: Standard Next.js build with TypeScript compilation and ESLint checking

## Security Considerations

- All API keys remain server-side only
- File uploads validated for type and size (max 10MB for documents)
- Input sanitization in chat endpoints
- No permanent file storage - temporary processing only

## Development Notes

**TypeScript**: Fully typed codebase with strict configuration
**Styling**: Tailwind CSS with responsive design patterns
**Error Handling**: Comprehensive try-catch blocks in all API routes
**Logging**: Console logging for debugging in both development and production

When working on this codebase, prioritize the educational methodology - the Socratic principle is fundamental to the application's purpose. Always ensure AI assistance guides through questions rather than providing direct answers.