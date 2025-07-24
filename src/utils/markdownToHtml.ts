// Simple markdown to HTML converter for basic formatting
export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''
  
  let html = markdown
  
  // First handle headers (before line break processing)
  html = html
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
  
  // Handle blockquotes (before line break processing)
  html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-2">$1</blockquote>')
  
  // Handle lists (before line break processing)
  const lines = html.split('\n')
  const processedLines = []
  let inList = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('- ')) {
      if (!inList) {
        processedLines.push('<ul class="list-disc pl-6 my-2">')
        inList = true
      }
      processedLines.push(`<li class="mb-1">${line.substring(2)}</li>`)
    } else {
      if (inList) {
        processedLines.push('</ul>')
        inList = false
      }
      processedLines.push(line)
    }
  }
  
  if (inList) {
    processedLines.push('</ul>')
  }
  
  html = processedLines.join('\n')
  
  // Handle bold and italic
  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
  
  // Split into paragraphs
  const paragraphs = html.split('\n\n').filter(p => p.trim())
  
  // Process each paragraph
  const processedParagraphs = paragraphs.map(paragraph => {
    const trimmed = paragraph.trim()
    
    // Skip if it's already a HTML element
    if (trimmed.startsWith('<h') || 
        trimmed.startsWith('<ul') || 
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<table')) {
      return trimmed
    }
    
    // Convert single line breaks to <br> within paragraphs
    const withBreaks = trimmed.replace(/\n/g, '<br>')
    
    // Wrap in paragraph if it's not empty
    if (withBreaks && !withBreaks.startsWith('<')) {
      return `<p class="mb-3">${withBreaks}</p>`
    }
    
    return withBreaks
  })
  
  return processedParagraphs.join('\n')
}

// Convert markdown tables to HTML tables
export function convertMarkdownTables(content: string): string {
  const lines = content.split('\n')
  const result = []
  let i = 0
  
  while (i < lines.length) {
    const line = lines[i].trim()
    
    // Check if this line starts a table (contains |)
    if (line.includes('|') && !line.includes('---')) {
      const tableLines = []
      let j = i
      
      // Collect all table lines
      while (j < lines.length && lines[j].includes('|')) {
        const tableLine = lines[j].trim()
        if (!tableLine.includes('---')) { // Skip separator lines
          tableLines.push(tableLine)
        }
        j++
      }
      
      if (tableLines.length > 0) {
        // Convert to HTML table
        let tableHtml = '<table class="border-collapse border border-gray-300 w-full my-4">\n'
        
        tableLines.forEach((tableLine, index) => {
          const cells = tableLine.split('|').filter(cell => cell.trim()).map(cell => cell.trim())
          
          if (cells.length > 0) {
            tableHtml += '  <tr>\n'
            cells.forEach(cell => {
              if (index === 0) {
                // Header row
                tableHtml += `    <th class="border border-gray-300 px-3 py-2 bg-gray-100 font-semibold text-left">${cell}</th>\n`
              } else {
                // Body row
                tableHtml += `    <td class="border border-gray-300 px-3 py-2">${cell}</td>\n`
              }
            })
            tableHtml += '  </tr>\n'
          }
        })
        
        tableHtml += '</table>'
        result.push(tableHtml)
        i = j
        continue
      }
    }
    
    result.push(lines[i])
    i++
  }
  
  return result.join('\n')
}

// Full conversion function
export function convertMarkdownToHtml(markdown: string): string {
  // First convert tables
  let html = convertMarkdownTables(markdown)
  
  // Then convert other markdown
  html = markdownToHtml(html)
  
  return html
}