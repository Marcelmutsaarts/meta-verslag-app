import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, HeadingLevel, AlignmentType, NumberFormat } from 'docx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface AssignmentData {
  title: string
  sections: Array<{
    id: string
    title: string
    content: string
  }>
  metadata?: {
    teacherName: string | null
    assignmentTitle: string | null
    educationLevelInfo: {
      name: string
      ageRange: string
    }
    createdAt: string
  }
}

// Convert HTML content to Word paragraphs with proper list support
function processHtmlToWordParagraphs(html: string): Paragraph[] {
  if (!html) return []
  
  // Debug logging - enhanced to see what HTML is being processed
  console.log('=== WORD EXPORT DEBUG ===')
  console.log('Full HTML being processed:', html)
  console.log('Contains <li:', html.includes('<li'))
  console.log('Contains <ul:', html.includes('<ul'))
  console.log('Contains <ol:', html.includes('<ol'))
  console.log('Contains bullet •:', html.includes('•'))
  console.log('HTML length:', html.length)
  
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  const paragraphs: Paragraph[] = []
  let currentListType: 'ul' | 'ol' | null = null
  let listItemIndex = 0
  let listInstance = Math.floor(Math.random() * 1000) // Generate unique instance for each list
  
  // Extract all text content from a node, preserving formatting
  function extractAllContent(node: Node, parentFormatting: { bold?: boolean, italics?: boolean, underline?: boolean } = {}): TextRun[] {
    const runs: TextRun[] = []
    
    function processNodeContent(n: Node, formatting: { bold?: boolean, italics?: boolean, underline?: boolean }): void {
      if (n.nodeType === Node.TEXT_NODE) {
        const text = n.textContent || ''
        if (text) {
          runs.push(new TextRun({ 
            text, 
            size: 24,
            bold: formatting.bold,
            italics: formatting.italics,
            underline: formatting.underline ? {} : undefined
          }))
        }
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const element = n as Element
        const tagName = element.tagName.toLowerCase()
        
        const newFormatting = { ...formatting }
        
        switch (tagName) {
          case 'strong':
          case 'b':
            newFormatting.bold = true
            break
          case 'em':
          case 'i':
            newFormatting.italics = true
            break
          case 'u':
            newFormatting.underline = true
            break
          case 'br':
            runs.push(new TextRun({ text: '\n', size: 24 }))
            return
        }
        
        // Process all child nodes recursively
        n.childNodes.forEach(child => processNodeContent(child, newFormatting))
      }
    }
    
    processNodeContent(node, parentFormatting)
    return runs
  }
  
  function processNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      console.log(`Processing element: ${tagName}`)
      
      switch (tagName) {
        case 'p':
        case 'div':
          console.log(`Processing ${tagName}, checking if contains lists...`)
          // Check if this div/p contains list elements
          const containsLists = element.querySelector('ul, ol')
          if (containsLists) {
            console.log(`${tagName} contains lists, processing children directly`)
            // If it contains lists, just process children (don't create text content)
            node.childNodes.forEach(processNode)
          } else if (!element.closest('li')) {
            // Check if this div/p is inside a list item - if so, don't create a separate paragraph
            const textRuns = extractAllContent(node)
            if (textRuns.length > 0) {
              console.log(`Creating paragraph from ${tagName} content`)
              paragraphs.push(new Paragraph({
                children: textRuns,
                spacing: { after: 200 }
              }))
            }
          } else {
            // If inside a list item, just process children
            console.log(`${tagName} inside list item, processing children`)
            node.childNodes.forEach(processNode)
          }
          break
          
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          const headingRuns = extractAllContent(node)
          if (headingRuns.length > 0) {
            const level = parseInt(tagName.charAt(1))
            paragraphs.push(new Paragraph({
              children: headingRuns,
              heading: level <= 3 ? HeadingLevel[`HEADING_${level}` as keyof typeof HeadingLevel] : HeadingLevel.HEADING_3,
              spacing: { before: 240, after: 120 }
            }))
          }
          break
          
        case 'ul':
          console.log('Processing UL element')
          currentListType = 'ul'
          listItemIndex = 0
          node.childNodes.forEach(processNode)
          currentListType = null
          break
          
        case 'ol':
          console.log('Processing OL element')
          currentListType = 'ol'
          listItemIndex = 1
          listInstance = Math.floor(Math.random() * 1000) // New instance for each list
          node.childNodes.forEach(processNode)
          currentListType = null
          break
          
        case 'li':
          // Extract ALL content from the list item, including nested elements
          const listRuns = extractAllContent(node)
          const textContent = node.textContent?.trim() || ''
          console.log(`Processing LI element. Text: "${textContent}", Runs: ${listRuns.length}, List type: ${currentListType}`)
          
          if (listRuns.length > 0 || textContent) {
            // If no runs but has text content, create a run for it
            const finalRuns = listRuns.length > 0 ? listRuns : [new TextRun({ text: textContent, size: 24 })]
            
            if (currentListType === 'ul') {
              console.log('Creating bullet list item')
              paragraphs.push(new Paragraph({
                children: finalRuns,
                bullet: { level: 0 },
                spacing: { after: 100 }
              }))
            } else if (currentListType === 'ol') {
              console.log('Creating numbered list item')
              paragraphs.push(new Paragraph({
                children: finalRuns,
                numbering: {
                  reference: 'default-numbering',
                  level: 0,
                  instance: listInstance
                },
                spacing: { after: 100 }
              }))
              listItemIndex++
            } else {
              console.log('Creating fallback list item (no list context)')
              // Fallback for li outside of ul/ol
              paragraphs.push(new Paragraph({
                children: [new TextRun({ text: '• ', size: 24 }), ...finalRuns],
                spacing: { after: 100 }
              }))
            }
          }
          break
          
        default:
          // For other elements, just process their children
          node.childNodes.forEach(processNode)
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      // Handle text nodes that are direct children of the container
      const text = node.textContent?.trim()
      if (text && !node.parentElement?.closest('li')) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text, size: 24 })],
          spacing: { after: 200 }
        }))
      }
    }
  }
  
  tempDiv.childNodes.forEach(processNode)
  
  console.log(`Processed ${paragraphs.length} paragraphs from HTML parsing`)
  
  // Fallback: If no lists were found but the text suggests lists, try text-based detection
  if (paragraphs.length === 0 || (!html.includes('<ul') && !html.includes('<ol') && (html.includes('•') || html.match(/^\s*\d+\./m)))) {
    console.log('No HTML lists found, trying text-based list detection')
    const textBasedResult = processTextBasedLists(html)
    console.log(`Text-based processing returned ${textBasedResult.length} paragraphs`)
    return textBasedResult
  }
  
  // If we got paragraphs but they seem like they should contain lists, let's also try text-based
  if (paragraphs.length > 0 && (html.includes('•') || html.match(/^\s*\d+\./m)) && !html.includes('<ul') && !html.includes('<ol')) {
    console.log('HTML paragraphs found but no list tags, trying text-based approach as well')
    const textBasedResult = processTextBasedLists(html)
    if (textBasedResult.length > paragraphs.length) {
      console.log('Text-based approach found more structure, using that instead')
      return textBasedResult
    }
  }
  
  console.log(`Final result: ${paragraphs.length} paragraphs for Word export`)
  
  return paragraphs
}

// Fallback function to detect lists from plain text patterns
function processTextBasedLists(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []
  
  console.log('=== TEXT-BASED LIST DETECTION ===')
  
  // First strip HTML tags to get plain text, but keep some structure
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  const textContent = tempDiv.textContent || tempDiv.innerText || ''
  
  console.log('Extracted text content:', textContent)
  
  // Split into lines and process each line
  const lines = textContent.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  console.log('Lines to process:', lines)
  
  let currentNumberedInstance = Math.floor(Math.random() * 1000)
  
  for (const line of lines) {
    console.log(`Processing line: "${line}"`)
    
    // Check for bullet list patterns - more comprehensive
    if (line.match(/^[•·▪▫◦‣⁃]\s+/) || line.match(/^[-*]\s+/) || line.match(/^[\u2022\u2023\u25E6\u2043\u2219]\s+/)) {
      const text = line.replace(/^[•·▪▫◦‣⁃\-*\u2022\u2023\u25E6\u2043\u2219]\s*/, '')
      console.log(`Found bullet item: "${text}"`)
      if (text.trim()) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: text.trim(), size: 24 })],
          bullet: { level: 0 },
          spacing: { after: 100 }
        }))
      }
    }
    // Check for numbered list patterns
    else if (line.match(/^\d+[\.)]\s+/)) {
      const text = line.replace(/^\d+[\.)]\s*/, '')
      console.log(`Found numbered item: "${text}"`)
      if (text.trim()) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: text.trim(), size: 24 })],
          numbering: {
            reference: 'default-numbering',
            level: 0,
            instance: currentNumberedInstance
          },
          spacing: { after: 100 }
        }))
      }
    }
    // Regular paragraph
    else if (line.trim()) {
      console.log(`Found regular paragraph: "${line.trim()}"`)
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: line.trim(), size: 24 })],
        spacing: { after: 200 }
      }))
    }
  }
  
  console.log(`Text-based processing created ${paragraphs.length} paragraphs`)
  return paragraphs
}

// Convert HTML content to Word TextRun elements with formatting
export function htmlToWordElements(html: string): TextRun[] {
  if (!html) return [new TextRun({ text: '' })]
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  const elements: TextRun[] = []
  
  function processNode(node: Node, parentFormatting: { bold?: boolean, italics?: boolean, underline?: boolean } = {}): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text.trim()) {
        elements.push(new TextRun({ 
          text, 
          size: 24,
          bold: parentFormatting.bold,
          italics: parentFormatting.italics,
          underline: parentFormatting.underline ? {} : undefined
        }))
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      
      const formatting = { ...parentFormatting }
      
      switch (tagName) {
        case 'strong':
        case 'b':
          formatting.bold = true
          node.childNodes.forEach(child => processNode(child, formatting))
          break
        case 'em':
        case 'i':
          formatting.italics = true
          node.childNodes.forEach(child => processNode(child, formatting))
          break
        case 'u':
          formatting.underline = true
          node.childNodes.forEach(child => processNode(child, formatting))
          break
        case 'br':
          elements.push(new TextRun({ text: '\n', size: 24 }))
          break
        case 'p':
          node.childNodes.forEach(child => processNode(child, formatting))
          if (elements.length > 0 && (elements[elements.length - 1] as any).text !== '\n') {
            elements.push(new TextRun({ text: '\n', size: 24 }))
          }
          break
        default:
          // For other elements, process their children with current formatting
          node.childNodes.forEach(child => processNode(child, formatting))
      }
    }
  }
  
  tempDiv.childNodes.forEach(child => processNode(child))
  
  return elements.length > 0 ? elements : [new TextRun({ text: '', size: 24 })]
}

// Extract HTML tables and convert to Word table format
export function extractHtmlTables(html: string): Array<{ table: string[][], position: number }> {
  const tables: Array<{ table: string[][], position: number }> = []
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  const tableTags = tempDiv.querySelectorAll('table')
  
  tableTags.forEach((table, index) => {
    const rows = table.querySelectorAll('tr')
    const tableData: string[][] = []
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td')
      const rowData: string[] = []
      cells.forEach(cell => {
        rowData.push(cell.textContent || '')
      })
      if (rowData.length > 0) {
        tableData.push(rowData)
      }
    })
    
    if (tableData.length > 0) {
      tables.push({ table: tableData, position: index })
    }
  })
  
  return tables
}

// Split HTML content around tables
export function splitHtmlByTables(html: string): Array<{ type: 'text' | 'table', content: string | string[][] }> {
  const parts: Array<{ type: 'text' | 'table', content: string | string[][] }> = []
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  const tables = extractHtmlTables(html)
  
  if (tables.length === 0) {
    return [{ type: 'text', content: html }]
  }
  
  // For now, we'll process content sequentially
  // In a more complex implementation, we'd track table positions more precisely
  
  tables.forEach(({ table }) => {
    parts.push({ type: 'table', content: table })
  })
  
  // Remove table HTML and add remaining text
  const htmlWithoutTables = html.replace(/<table[^>]*>[\s\S]*?<\/table>/g, '')
  if (htmlWithoutTables.trim()) {
    parts.unshift({ type: 'text', content: htmlWithoutTables })
  }
  
  return parts
}


// Create Word document with rich content
export async function createWordDocument(assignmentData: AssignmentData): Promise<Blob> {
  console.log('Creating Word document with sections:', assignmentData.sections.length)
  
  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: NumberFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              spacing: { after: 100 },
              indent: { left: 720, hanging: 360 }
            }
          }
        }]
      }]
    },
    sections: [{
      properties: {},
      children: [
        // Title page
        new Paragraph({
          children: [
            new TextRun({
              text: assignmentData.metadata?.assignmentTitle || assignmentData.title,
              bold: true,
              size: 32,
            }),
          ],
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 }
        }),
        
        // Metadata
        ...(assignmentData.metadata?.teacherName ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `Docent: ${assignmentData.metadata.teacherName}`,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        ] : []),
        
        ...(assignmentData.metadata?.educationLevelInfo ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `Niveau: ${assignmentData.metadata.educationLevelInfo.name}`,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 }
          })
        ] : []),
        
        ...(assignmentData.metadata?.createdAt ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `Datum: ${new Date(assignmentData.metadata.createdAt).toLocaleDateString('nl-NL')}`,
                size: 24,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 }
          })
        ] : []),
        
        // Sections content
        ...assignmentData.sections.flatMap(section => {
          const elements = []
          
          // Section title
          elements.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: section.title,
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            })
          )
          
          // Process section content
          if (section.content && section.content.trim()) {
            console.log(`Processing content for section: ${section.title}`)
            const contentElements = processHtmlToWordParagraphs(section.content)
            console.log(`Generated ${contentElements.length} elements for section: ${section.title}`)
            elements.push(...contentElements)
          } else {
            console.log(`No content for section: ${section.title}`)
          }
          
          return elements
        })
      ]
    }]
  })
  
  const buffer = await Packer.toBlob(doc)
  return buffer
}

interface ExportAssignmentData {
  title: string
  sections: Array<{
    id: string
    title: string
  }>
  metadata?: {
    teacherName: string | null
    assignmentTitle: string | null
    educationLevelInfo: {
      name: string
      ageRange: string
    }
    createdAt: string
  }
}

// Export function for workspace data
export async function exportAssignmentToWord(
  assignmentData: ExportAssignmentData,
  sectionContents: Record<string, string>,
  studentData?: { name: string; email?: string }
): Promise<void> {
  const exportData = {
    title: assignmentData.title,
    sections: assignmentData.sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: sectionContents[section.id] || ''
    })),
    metadata: assignmentData.metadata
  }
  
  try {
    const blob = await createWordDocument(exportData)
    
    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    const baseFileName = assignmentData.metadata?.assignmentTitle || assignmentData.title
    const fileName = studentData 
      ? `${studentData.name}_${baseFileName}.docx`
      : `${baseFileName}.docx`
    
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Export failed:', error)
    throw new Error('Kon document niet exporteren')
  }
}

// Export assignment to PDF
export async function exportAssignmentToPDF(
  assignmentData: ExportAssignmentData,
  sectionContents: Record<string, string>,
  studentData?: { name: string; email?: string }
): Promise<void> {
  try {
    // Create a temporary container to render HTML content
    const tempDiv = document.createElement('div')
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = '-9999px'
    tempDiv.style.top = '0'
    tempDiv.style.width = '800px'
    tempDiv.style.padding = '40px'
    tempDiv.style.fontFamily = 'Arial, sans-serif'
    tempDiv.style.fontSize = '12px'
    tempDiv.style.lineHeight = '1.6'
    tempDiv.style.color = '#000'
    tempDiv.style.backgroundColor = '#fff'
    
    // Add CSS styles for WYSIWYG formatting
    const styleElement = document.createElement('style')
    styleElement.textContent = `
      .pdf-export-content ul {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
        list-style-type: disc;
      }
      .pdf-export-content ol {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
        list-style-type: decimal;
      }
      .pdf-export-content li {
        margin: 0.25rem 0;
        display: list-item;
      }
      .pdf-export-content h1 {
        font-size: 1.5rem;
        font-weight: bold;
        margin: 1rem 0 0.5rem 0;
        color: #1f2937;
      }
      .pdf-export-content h2 {
        font-size: 1.25rem;
        font-weight: bold;
        margin: 0.75rem 0 0.375rem 0;
        color: #1f2937;
      }
      .pdf-export-content h3 {
        font-size: 1.125rem;
        font-weight: bold;
        margin: 0.625rem 0 0.3125rem 0;
        color: #1f2937;
      }
      .pdf-export-content p {
        margin: 0.5rem 0;
        line-height: 1.6;
        min-height: 1.2em;
      }
      .pdf-export-content strong {
        font-weight: bold;
      }
      .pdf-export-content em {
        font-style: italic;
      }
      .pdf-export-content u {
        text-decoration: underline;
      }
      .pdf-export-content table {
        border-collapse: collapse;
        width: 100%;
        margin: 1rem 0;
        border: 1px solid #d1d5db;
      }
      .pdf-export-content th,
      .pdf-export-content td {
        border: 1px solid #d1d5db;
        padding: 0.75rem;
        text-align: left;
        min-width: 50px;
        min-height: 1.2em;
      }
      .pdf-export-content th {
        background-color: #f3f4f6;
        font-weight: 600;
      }
    `
    document.head.appendChild(styleElement)
    tempDiv.className = 'pdf-export-content'

    // Build HTML content
    let htmlContent = `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">
          ${assignmentData.metadata?.assignmentTitle || assignmentData.title}
        </h1>
        ${assignmentData.metadata?.teacherName ? `<p style="margin: 5px 0;">Docent: ${assignmentData.metadata.teacherName}</p>` : ''}
        ${assignmentData.metadata?.educationLevelInfo ? `<p style="margin: 5px 0;">Niveau: ${assignmentData.metadata.educationLevelInfo.name}</p>` : ''}
        ${assignmentData.metadata?.createdAt ? `<p style="margin: 5px 0;">Datum: ${new Date(assignmentData.metadata.createdAt).toLocaleDateString('nl-NL')}</p>` : ''}
      </div>
    `

    // Add sections
    assignmentData.sections.forEach(section => {
      const content = sectionContents[section.id] || ''
      htmlContent += `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1f2937;">
            ${section.title}
          </h2>
          <div style="margin-left: 10px;">
            ${content}
          </div>
        </div>
      `
    })

    tempDiv.innerHTML = htmlContent
    document.body.appendChild(tempDiv)

    // Convert to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    })

    // Remove temporary div and style element
    document.body.removeChild(tempDiv)
    document.head.removeChild(styleElement)

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgWidth = 210 // A4 width in mm
    const pageHeight = 295 // A4 height in mm  
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = 0

    // Add first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    // Download PDF
    const baseFileName = assignmentData.metadata?.assignmentTitle || assignmentData.title
    const fileName = studentData 
      ? `${studentData.name}_${baseFileName}.pdf`
      : `${baseFileName}.pdf`
    
    pdf.save(fileName)
  } catch (error) {
    console.error('PDF export failed:', error)
    throw new Error('Kon PDF niet exporteren')
  }
}