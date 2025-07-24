'use client'

import { useState, useEffect, useRef } from 'react'

interface SimpleRichTextEditorProps {
  value: string
  onChange: (content: string) => void
  placeholder?: string
}

export default function SimpleRichTextEditor({ value, onChange, placeholder }: SimpleRichTextEditorProps) {
  const [showHelp, setShowHelp] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  // Set initial content only once when component mounts
  useEffect(() => {
    if (editorRef.current && value && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value
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

    // Create HTML table
    let tableHtml = '<table class="border-collapse border border-gray-300 w-full my-4">'
    
    for (let i = 0; i < rows; i++) {
      tableHtml += '<tr>'
      for (let j = 0; j < cols; j++) {
        if (i === 0) {
          tableHtml += `<th class="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">Header ${j + 1}</th>`
        } else {
          tableHtml += `<td class="border border-gray-300 px-3 py-2">Cel ${i},${j + 1}</td>`
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

  const insertHeading = (level: number) => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
        ? range.commonAncestorContainer.parentElement 
        : range.commonAncestorContainer as Element
      
      // If we're already in a heading, convert back to paragraph
      const currentHeading = element?.closest('h1, h2, h3, h4, h5, h6')
      if (currentHeading) {
        document.execCommand('formatBlock', false, 'p')
      } else {
        document.execCommand('formatBlock', false, `h${level}`)
      }
      handleInput()
    }
  }

  const getWordCount = (): number => {
    if (!editorRef.current) return 0
    const text = editorRef.current.textContent || ''
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  return (
    <div className="simple-rich-editor">
      {/* Toolbar */}
      <div className="border border-gray-300 border-b-0 rounded-t-lg bg-gray-50 p-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => executeCommand('bold')}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Vet"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('italic')}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Cursief"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => executeCommand('underline')}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Onderstreept"
          >
            <u>U</u>
          </button>
          <button
            type="button"
            onClick={() => insertHeading(1)}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Grote kop"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => insertHeading(2)}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Middelgrote kop"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Lijst"
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="px-3 py-1 bg-white border border-gray-300 rounded text-sm hover:bg-gray-100"
            title="Genummerde lijst"
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
        className="p-4 border border-gray-300 rounded-b-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[400px] wysiwyg-editor"
        style={{ 
          fontFamily: 'inherit',
          lineHeight: '1.6'
        }}
        suppressContentEditableWarning={true}
      />


      {/* Controls */}
      <div className="mt-2 flex justify-between items-center">
        <span className="text-sm text-gray-500">
          Aantal woorden: {getWordCount()}
        </span>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          {showHelp ? 'Verberg hulp' : 'Toon hulp'}
        </button>
      </div>

      {/* Help Section */}
      {showHelp && (
        <div className="mt-3 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-blue-800 mb-3">📝 Opmaak Hulp</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-blue-700 mb-2">Tekst opmaak:</h5>
              <ul className="space-y-1 text-blue-600">
                <li>Selecteer tekst en klik op <strong>B</strong> voor vet</li>
                <li>Selecteer tekst en klik op <em>I</em> voor cursief</li>
                <li>Klik op H1 of H2 voor koppen</li>
                <li>Klik op • List voor lijsten</li>
                <li>Klik op 1. List voor genummerde lijsten</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-blue-700 mb-2">Snelle tabellen:</h5>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => insertTable(2, 2)}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  2×2
                </button>
                <button
                  type="button"
                  onClick={() => insertTable(3, 3)}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  3×3
                </button>
                <button
                  type="button"
                  onClick={() => insertTable(4, 3)}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                >
                  4×3
                </button>
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-600">
            💡 Tip: Dit is een WYSIWYG editor - wat je ziet is wat je krijgt!
          </div>
        </div>
      )}
    </div>
  )
}