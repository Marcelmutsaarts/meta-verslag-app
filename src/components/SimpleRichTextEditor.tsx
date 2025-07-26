'use client'

import { useState, useEffect, useRef } from 'react'

interface SimpleRichTextEditorProps {
  value: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

export default function SimpleRichTextEditor({ value, onChange, placeholder, className }: SimpleRichTextEditorProps) {
  const [showHelp, setShowHelp] = useState(false)
  const [toolbarState, setToolbarState] = useState({})
  const editorRef = useRef<HTMLDivElement>(null)

  // Update content when value prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  // Update toolbar state when selection changes
  useEffect(() => {
    const updateToolbarState = () => {
      setToolbarState({})  // Force re-render to update button states
    }

    const editor = editorRef.current
    if (editor) {
      editor.addEventListener('keyup', updateToolbarState)
      editor.addEventListener('mouseup', updateToolbarState)
      editor.addEventListener('focus', updateToolbarState)
      
      return () => {
        editor.removeEventListener('keyup', updateToolbarState)
        editor.removeEventListener('mouseup', updateToolbarState)  
        editor.removeEventListener('focus', updateToolbarState)
      }
    }
  }, [])

  const handleInput = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML
      onChange(newContent)
    }
  }


  const insertTable = (rows: number, cols: number) => {
    if (!editorRef.current) return

    // Create HTML table with purple theme
    let tableHtml = '<table style="border-collapse: collapse; border: 1px solid rgba(162, 93, 248, 0.3); width: 100%; margin: 1rem 0;">'
    
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>'
      for (let j = 0; j < cols; j++) {
        if (i === 0) {
          tableHtml += `<th style="border: 1px solid rgba(162, 93, 248, 0.3); padding: 0.75rem; background-color: rgba(162, 93, 248, 0.1); font-weight: 600; text-align: left; color: var(--fg-base);">Header ${j + 1}</th>`
        } else {
          tableHtml += `<td style="border: 1px solid rgba(162, 93, 248, 0.3); padding: 0.75rem; color: var(--fg-base);">Cel ${i},${j + 1}</td>`
        }
      }
      tableHtml += '</tr>'
    }
    tableHtml += '</table><p><br></p>'

    // Insert table at cursor position
    document.execCommand('insertHTML', false, tableHtml)
    handleInput()
  }

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    handleInput()
  }

  const toggleFormat = (command: string) => {
    document.execCommand(command, false)
    handleInput()
  }

  const insertHeading = (level: number) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer as Element
      
      // Check if we're already in this heading level
      const currentHeading = element?.closest(`h${level}`)
      if (currentHeading) {
        // Convert back to paragraph
        document.execCommand('formatBlock', false, 'p')
      } else {
        // Convert to heading
        document.execCommand('formatBlock', false, `h${level}`)
      }
      handleInput()
    }
  }

  const toggleList = (listType: 'ul' | 'ol') => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer as Element
      
      // Check if we're already in a list
      const currentList = element?.closest('ul, ol')
      if (currentList) {
        // Remove list formatting
        if (listType === 'ul') {
          document.execCommand('insertUnorderedList', false)
        } else {
          document.execCommand('insertOrderedList', false)
        }
      } else {
        // Add list formatting
        if (listType === 'ul') {
          document.execCommand('insertUnorderedList', false)
        } else {
          document.execCommand('insertOrderedList', false)
        }
      }
      handleInput()
    }
  }

  const isFormatActive = (command: string): boolean => {
    return document.queryCommandState(command)
  }

  const isHeadingActive = (level: number): boolean => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer as Element
      return !!element?.closest(`h${level}`)
    }
    return false
  }

  const isListActive = (listType: 'ul' | 'ol'): boolean => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer as Element
      return !!element?.closest(listType)
    }
    return false
  }

  const getWordCount = (): number => {
    if (!editorRef.current) return 0
    const text = editorRef.current.textContent || ''
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  return (
    <div className={`simple-rich-editor ${className || ''}`}>
      {/* Toolbar */}
      <div 
        className="border-b-0 rounded-t-lg p-3"
        style={{
          backgroundColor: 'rgba(162, 93, 248, 0.1)',
          border: '1px solid rgba(162, 93, 248, 0.3)',
          borderBottom: 'none'
        }}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => toggleFormat('bold')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isFormatActive('bold') 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isFormatActive('bold') ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isFormatActive('bold') ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Vet"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => toggleFormat('italic')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isFormatActive('italic') 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isFormatActive('italic') ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isFormatActive('italic') ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Cursief"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => toggleFormat('underline')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isFormatActive('underline') 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isFormatActive('underline') ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isFormatActive('underline') ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Onderstreept"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            onClick={() => insertHeading(1)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isHeadingActive(1) 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isHeadingActive(1) ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isHeadingActive(1) ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Grote kop (klik opnieuw voor normaal)"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => insertHeading(2)}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isHeadingActive(2) 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isHeadingActive(2) ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isHeadingActive(2) ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Middelgrote kop (klik opnieuw voor normaal)"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => toggleList('ul')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isListActive('ul') 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isListActive('ul') ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isListActive('ul') ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Lijst (klik opnieuw om uit te schakelen)"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => toggleList('ol')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              isListActive('ol') 
                ? 'text-white border-accent' 
                : 'text-body border-muted hover:border-accent'
            }`}
            style={{
              backgroundColor: isListActive('ol') ? 'var(--accent)' : 'var(--bg-card)',
              border: `1px solid ${isListActive('ol') ? 'var(--accent)' : 'rgba(162, 93, 248, 0.3)'}`
            }}
            title="Genummerde lijst (klik opnieuw om uit te schakelen)"
          >
            1. List
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder || 'Begin hier met schrijven...'}
        className="p-4 rounded-b-lg focus:outline-none min-h-[400px] wysiwyg-editor text-body"
        style={{ 
          fontFamily: 'var(--font-body)',
          lineHeight: '1.7',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid rgba(162, 93, 248, 0.3)',
          color: 'var(--fg-base)'
        }}
        suppressContentEditableWarning={true}
      />

      {/* Controls */}
      <div className="mt-2 flex justify-between items-center">
        <span className="text-sm text-muted">
          Aantal woorden: {getWordCount()}
        </span>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-sm transition-colors"
          style={{ color: 'var(--accent)' }}
          onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-soft)'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--accent)'}
        >
          {showHelp ? 'Verberg hulp' : 'Toon hulp'}
        </button>
      </div>

      {/* Help Section */}
      {showHelp && (
        <div 
          className="mt-3 p-4 rounded-lg"
          style={{
            backgroundColor: 'rgba(162, 93, 248, 0.1)',
            border: '1px solid rgba(162, 93, 248, 0.3)'
          }}
        >
          <h4 className="font-semibold mb-3 text-heading">📝 Opmaak Hulp</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium mb-2 text-body">Tekst opmaak:</h5>
              <ul className="space-y-1 text-muted">
                <li>Selecteer tekst en klik op <strong>B</strong> voor vet</li>
                <li>Selecteer tekst en klik op <em>I</em> voor cursief</li>
                <li>Klik op H1 of H2 voor koppen</li>
                <li>Klik op • List voor lijsten</li>
                <li>Klik op 1. List voor genummerde lijsten</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2 text-body">Snelle tabellen:</h5>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => insertTable(2, 2)}
                  className="px-2 py-1 text-white text-xs rounded transition-colors"
                  style={{ backgroundColor: 'var(--accent)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-soft)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                >
                  2×2
                </button>
                <button
                  type="button"
                  onClick={() => insertTable(3, 3)}
                  className="px-2 py-1 text-white text-xs rounded transition-colors"
                  style={{ backgroundColor: 'var(--accent)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-soft)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                >
                  3×3
                </button>
                <button
                  type="button"
                  onClick={() => insertTable(4, 3)}
                  className="px-2 py-1 text-white text-xs rounded transition-colors"
                  style={{ backgroundColor: 'var(--accent)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-soft)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                >
                  4×3
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted">
            💡 Tip: Dit is een WYSIWYG editor - wat je ziet is wat je krijgt!
          </div>
        </div>
      )}
    </div>
  )
}