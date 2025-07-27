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
- **Universal JSON Export**: Students can export their work to JSON whether logged in or not (fallback to "Anonieme Student")
- **JSON Import**: Students can restore their complete work sessions from exported files
- **Cross-Session Continuity**: Resume work on any device with saved JSON files

### Advanced Formative Assessment System
- **Personal Learning Goals**: Students set section-specific or assignment-wide learning objectives
- **In-Modal Socratic Feedback**: Dedicated feedback modal with AI-powered Socratic guidance on learning goals
- **Example-Based Learning**: AI-generated or teacher-provided examples with reflection workflows
- **Socratic Reflection Dialogue**: Integrated chat system that challenges students to think deeper
- **Context-Aware Examples**: Teachers can provide specific context for targeted example generation
- **Multi-Section Example Distribution**: Examples for all sections are correctly parsed and distributed
- **Comprehensive Context Integration**: Chatbot has access to all learning goals, reflections, and examples

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

### Modern Three-Column Layout Architecture
- **Left Sidebar**: Compact section navigation with progress indicators, collapsible student info, work management, and formative assessment indicators
- **Center**: Focus-first writing interface with maximized SimpleRichTextEditor and floating action buttons
- **Right Panel**: Collapsible Socratic chat assistant with smooth animations
- **Floating Action Buttons**: Context-aware buttons for learning goals, examples, quiz, help, theme toggle, and focus mode

## Environment Configuration

**Required:**
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Get API key from: https://makersuite.google.com/app/apikey

## API Architecture

### Core Educational APIs
- `/api/analyze-assignment`: Document → structured learning environment
- `/api/socratic-chat`: Context-aware educational guidance with comprehensive formative assessment integration
- `/api/generate-example`: Context-aware example generation with multi-section parsing and distribution

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
- **NEW**: Integrate with formative assessment data (learning goals, reflections, examples)
- **NEW**: Provide reflection-deepening dialogue within the same modal interface
- **NEW**: Access comprehensive student context across all sections and formative activities
- **NEW**: Specialized learning goal feedback with context-aware SMART criteria prompting

### Enhanced Data Flow for Student Work
1. **Session Management**: Assignment data stored in sessionStorage after analysis
2. **Progress Persistence**: Student writing auto-saved to localStorage per section
3. **Formative State Management**: Learning goals, reflections, and examples persisted in localStorage
4. **Comprehensive Context Awareness**: Chat bot receives:
   - Current section content and progress
   - All finalized and draft learning goals (per-section or whole-assignment)
   - All student reflections on examples across sections
   - Available examples and their content
   - Cross-section progress and content awareness
5. **Integrated Reflection Workflow**: Reflection dialogue happens within the same modal as reflection input

## File Processing Capabilities

**Supported Formats:**
- **Documents**: PDF (pdf-parse), DOCX (mammoth), TXT, CSV, JSON
- **Images**: JPG, PNG, GIF, WebP, BMP (inherited from template)
- **Audio**: MP3, WAV, OGG, M4A, AAC, FLAC, MP4, WebM (inherited)

**Processing Flow:** File → Buffer → Type-specific parser → Text extraction → Gemini analysis

## UI/UX Design Principles

### Focus-First Interface Design
- **Maximized Writing Area**: SimpleRichTextEditor takes full central space for distraction-free writing
- **Collapsible Sidebars**: Information panels collapse to minimize cognitive load
- **Floating Action Buttons**: Essential functions accessible via hover-activated buttons with emoji tooltips
- **Modal-Based Interactions**: Complex features (learning goals, examples) contained in dedicated modals
- **Focus Mode**: Full-screen writing experience with dual exit methods (ESC key and visual X button)

### Enhanced User Experience
- **Hover Tooltips**: All floating buttons show descriptive tooltips with emoji indicators
- **Visual Feedback**: Progress indicators, status badges, and state-aware styling
- **Smooth Animations**: Transitions for chat panel, modals, and button interactions
- **Responsive Design**: Adaptive layout for different screen sizes and orientations
- **Accessibility**: Keyboard navigation, screen reader support, and clear visual hierarchy

### Feedback Modal System
- **In-Modal Chatbot**: Dedicated feedback interface that keeps users in context
- **Auto-initiated Conversations**: Automatic prompting with hidden technical messages
- **Context-Aware Prompting**: Learning goal feedback includes full assignment and section context
- **SMART Criteria Focus**: Specialized prompts for Specificity, Measurability, Achievability, Relevance, Time-bound goals

## Component Architecture

### Educational Components
- **Workspace Page**: Main student interface with modern three-column layout
- **Section Navigation**: Progress tracking and section switching with visual indicators
- **SimpleRichTextEditor**: Full-featured WYSIWYG editor with rich text formatting, lists, tables, and styling
- **Floating Action Buttons**: Hover-activated tooltips with emoji labels for intuitive navigation
- **Modal System**: Dedicated modals for learning goals, examples, feedback, and help
- **Socratic Chat**: Collapsible AI assistant panel with smooth animations
- **Feedback Modal**: In-modal Socratic feedback system with dedicated chatbot interface
- **ThemeToggle**: Light/dark mode switch integrated into both homepage and workspace floating buttons
- **Focus Mode Controls**: Visual exit indicators with ESC key instructions and clickable X button

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
  - Enhanced debugging and error handling for complex HTML structures
- **PDF Export**: HTML to PDF conversion with CSS styling for lists
- **JSON Export**: Complete work session export including student data, assignment context, and formative state

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

## Recent Bug Fixes and Improvements

### Workspace Loading & Navigation Fixes (Latest)
- **White Screen Issue**: Fixed workspace page returning null instead of loading indicator, preventing blank screens
- **SessionStorage Handling**: Enhanced sessionStorage reliability with timeout delays and verification
- **Loading States**: Replaced null returns with proper loading spinner and error messages
- **Redirect Timing**: Fixed race conditions between sessionStorage writes and page redirects
- **Debug Logging**: Comprehensive logging throughout workspace loading process

### Example Generation System Fixes (Latest)
- **API Structure Mismatch**: Fixed frontend expecting `data.example` vs backend returning `data.examples[sectionId]`
- **Section ID Handling**: Added explicit `sectionId` parameter to requests and improved ID resolution
- **Defensive Programming**: Protected against undefined `guideQuestions` with optional chaining
- **Error Handling**: Enhanced error logging and user feedback for example generation failures
- **Gemini API Safety**: Added comprehensive error handling for Gemini API calls

### Quiz Modal System (Latest)
- **Separate Quiz Interface**: Created dedicated quiz modal instead of integrating with main chat
- **Context-Aware Quizzes**: Enhanced quiz generation with student writing content and learning goals
- **Modal State Management**: Proper quiz modal with chat interface and typing indicators
- **API Data Alignment**: Fixed quiz API data structure to match frontend expectations

### Tooltip System Overhaul (Latest)
- **JavaScript-Based Tooltips**: Replaced CSS-only tooltips with React state-managed system
- **Guaranteed Visibility**: Ensured tooltips appear with high z-index and proper positioning
- **Hover State Management**: Improved tooltip positioning and edge case handling
- **Visual Enhancement**: Added proper styling with borders, shadows, and animations

### Export System Enhancements
- **Universal JSON Export**: Fixed export functionality to work without login requirement, with fallback to "Anonieme Student"
- **Word Export Lists**: Resolved HTML list processing issues with enhanced detection for DIV containers and fallback text-based parsing
- **Comprehensive Debugging**: Added extensive console logging for Word export troubleshooting

### User Interface Improvements
- **Floating Button Tooltips**: Enhanced hover states with immediate tooltip display and better positioning
- **Icon Visibility**: Improved floating button icon contrast and visual feedback
- **Smooth Animations**: Added scale and translate effects on hover for better user experience
- **JSX Structure Fixes**: Resolved JSX syntax errors with proper element wrapping

### Feedback Modal System
- **In-Modal Feedback**: Learning goal feedback now stays within popup modal instead of redirecting to main chatbot
- **Hidden Auto-Prompts**: Automatic feedback prompts are hidden from users, showing only AI responses
- **Context-Aware Prompting**: Full assignment and section context included in feedback requests
- **SMART Criteria Integration**: Specialized prompting for learning goal improvement

### Technical Stability Improvements
- **Runtime Error Prevention**: Fixed undefined content.split() errors in example modal
- **API Error Logging**: Enhanced error logging in all API endpoints with detailed debugging
- **TypeScript Type Safety**: Improved type definitions and error handling throughout
- **Build Process**: Resolved compilation errors and improved development workflow

### Code Quality & Debugging
- **Comprehensive Logging**: Added extensive debug logging to frontend and backend
- **Error Boundaries**: Better error handling and user feedback mechanisms
- **Performance**: Optimized API calls and reduced unnecessary re-renders
- **Maintainability**: Improved code structure and documentation

### Enhanced Example Generation System (Latest)
- **Streamlined UX**: Redesigned Examples Modal with direct action buttons for single-click generation
- **Automatic Text Placement**: Implemented `handleGenerateAndPlaceExample` function for seamless content integration
- **Intelligent Content Distribution**: Enhanced API parsing with 3-tier strategy (markdown headers, keyword-based, proportional distribution)
- **Markdown to HTML Conversion**: Added `convertMarkdownToHtml()` function to convert AI-generated markdown to rich text formatting
- **Rich Text Integration**: Examples now display with proper bold, italic, headers, and lists in SimpleRichTextEditor
- **Cross-Section Awareness**: Whole-assignment examples intelligently distributed across all sections with section-specific content matching
- **Toast Notification System**: Replaced alerts with user-friendly toast notifications for better UX
- **Helper Functions**: Added text similarity calculations and keyword extraction for improved content parsing

### PDF Upload Stability Improvements (Latest)
- **Next.js 15 Compatibility**: Updated `next.config.js` with proper webpack configuration for canvas dependencies
- **Server External Packages**: Configured `serverExternalPackages` for pdf-parse and canvas to prevent build issues
- **Enhanced PDF Error Handling**: Comprehensive error categorization with user-friendly feedback for:
  - Canvas/rendering engine problems
  - Password-protected PDFs
  - Corrupted or invalid files
  - Import failures with fallback suggestions
- **Canvas-Free PDF Parsing**: Added `max: 0` option to disable image rendering and prevent canvas errors
- **Multi-Strategy Parsing**: Implemented fallback mechanisms with normalized whitespace for better text extraction
- **Frontend Error Enhancement**: Improved file upload error messages with specific tips per file type
- **Progressive Error Details**: Structured error feedback with emojis, solutions, and technical details
- **Webpack Configuration**: Added canvas alias fixes and native module loaders to prevent compilation issues

### Development Configuration Updates
- **Next.js 15 Migration**: Updated configuration syntax from `experimental.serverComponentsExternalPackages` to `serverExternalPackages`
- **Webpack Enhancements**: Added ignore-loader for .node files and external package handling
- **Canvas Dependency Resolution**: Prevented canvas-related build failures with proper aliasing
- **Development Server Stability**: Improved startup reliability with proper dependency management

### Light/Dark Theme System Implementation (Latest)
- **Global Theme Toggle**: Implemented comprehensive light/dark mode system with CSS custom properties
- **Startpage Theme Control**: Added theme toggle button on homepage with sun/moon icons and sliding indicator
- **Workspace Theme Integration**: Integrated theme toggle into floating action buttons for student control
- **Theme Persistence**: Complete localStorage integration for cross-session theme preferences
- **CSS Variable Architecture**: Extended design system with light mode color palette:
  - Inverted foreground/background colors (white backgrounds, dark text in light mode)
  - Maintained accent colors and semantic color consistency
  - Theme-aware shadows and visual effects
- **Component Styling**: Custom CSS overrides for ThemeToggle integration with floating button system
- **Hydration Safety**: Prevented client/server mismatch with mounted state checks
- **Visual Consistency**: Ensured theme toggle matches existing design patterns and hover effects

### Focus Mode Enhancement (Latest)
- **Exit Control Issues**: Resolved confusion where focus mode had no visible exit method
- **Dual Exit Methods**: Implemented both ESC key and visual exit button for better UX
- **Exit Control UI**: Added professional exit controls with:
  - ESC indicator with styled `<kbd>` tag and clear instructions
  - Floating X button with consistent design system styling
  - Top-right positioning with proper z-index management
  - Fade-in animations for smooth visual transitions
- **Accessibility Improvements**: Enhanced keyboard navigation and screen reader support
- **Visual Feedback**: Professional styling with backdrop blur, shadows, and hover effects

### Runtime Error Resolution (Latest)
- **Webpack Bundling Fixes**: Resolved "Cannot find module './548.js'" webpack runtime errors
- **Cache Management**: Implemented comprehensive cache clearing strategy:
  - Complete `.next` build directory removal
  - Node modules cache clearing
  - Fresh rebuild process for clean dependency resolution
- **Development Server Stability**: Improved server startup with proper port management
- **Build Process Enhancement**: Streamlined development workflow with reliable build processes

When working on this codebase, prioritize the educational methodology - the Socratic principle is fundamental to the application's purpose. Always ensure AI assistance guides through questions rather than providing direct answers.