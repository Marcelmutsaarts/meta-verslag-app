import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, HeadingLevel, AlignmentType } from 'docx'

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

// Convert HTML content to Word TextRun elements with formatting
export function htmlToWordElements(html: string): TextRun[] {
  if (!html) return [new TextRun({ text: '' })]
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html
  
  const elements: TextRun[] = []
  
  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text.trim()) {
        elements.push(new TextRun({ text, size: 24 }))
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()
      const textContent = element.textContent || ''
      
      switch (tagName) {
        case 'strong':
        case 'b':
          elements.push(new TextRun({ text: textContent, bold: true, size: 24 }))
          break
        case 'em':
        case 'i':
          elements.push(new TextRun({ text: textContent, italics: true, size: 24 }))
          break
        case 'u':
          elements.push(new TextRun({ text: textContent, underline: {}, size: 24 }))
          break
        case 'br':
          elements.push(new TextRun({ text: '\n', size: 24 }))
          break
        case 'p':
          if (node.childNodes.length > 0) {
            node.childNodes.forEach(child => processNode(child))
            elements.push(new TextRun({ text: '\n', size: 24 }))
          }
          break
        default:
          // For other elements, process their children
          node.childNodes.forEach(child => processNode(child))
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
  const doc = new Document({
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
          
          // Process HTML content directly
          const contentParts = splitHtmlByTables(section.content)
          
          contentParts.forEach(part => {
            if (part.type === 'text') {
              const htmlContent = part.content as string
              if (htmlContent.trim()) {
                // Parse HTML content and convert to Word elements
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = htmlContent
                
                // Process each child element
                tempDiv.childNodes.forEach(node => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element
                    const tagName = element.tagName.toLowerCase()
                    const textContent = element.textContent || ''
                    
                    switch (tagName) {
                      case 'h1':
                        elements.push(
                          new Paragraph({
                            children: [new TextRun({ text: textContent, bold: true, size: 26 })],
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 }
                          })
                        )
                        break
                      case 'h2':
                        elements.push(
                          new Paragraph({
                            children: [new TextRun({ text: textContent, bold: true, size: 24 })],
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 200, after: 100 }
                          })
                        )
                        break
                      case 'h3':
                        elements.push(
                          new Paragraph({
                            children: [new TextRun({ text: textContent, bold: true, size: 22 })],
                            heading: HeadingLevel.HEADING_4,
                            spacing: { before: 150, after: 75 }
                          })
                        )
                        break
                      case 'ul':
                        const listItems = element.querySelectorAll('li')
                        listItems.forEach(li => {
                          elements.push(
                            new Paragraph({
                              children: htmlToWordElements(li.innerHTML),
                              bullet: { level: 0 },
                              spacing: { after: 100 }
                            })
                          )
                        })
                        break
                      case 'ol':
                        const numberedItems = element.querySelectorAll('li')
                        numberedItems.forEach((li) => {
                          elements.push(
                            new Paragraph({
                              children: htmlToWordElements(li.innerHTML),
                              numbering: { reference: 'numbering', level: 0 },
                              spacing: { after: 100 }
                            })
                          )
                        })
                        break
                      case 'p':
                        if (textContent.trim()) {
                          elements.push(
                            new Paragraph({
                              children: htmlToWordElements(element.innerHTML),
                              spacing: { after: 200 }
                            })
                          )
                        }
                        break
                      default:
                        // Handle other elements as paragraphs
                        if (textContent.trim()) {
                          elements.push(
                            new Paragraph({
                              children: htmlToWordElements(element.innerHTML),
                              spacing: { after: 200 }
                            })
                          )
                        }
                    }
                  } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                    // Handle loose text nodes
                    elements.push(
                      new Paragraph({
                        children: [new TextRun({ text: node.textContent, size: 24 })],
                        spacing: { after: 200 }
                      })
                    )
                  }
                })
              }
            } else if (part.type === 'table') {
              // Add table
              const tableData = part.content as string[][]
              if (tableData.length > 0) {
                const tableRows = tableData.map((row) => 
                  new TableRow({
                    children: row.map(cell => 
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: htmlToWordElements(cell)
                          })
                        ]
                      })
                    )
                  })
                )
                
                elements.push(
                  new Table({
                    rows: tableRows,
                    width: {
                      size: 100,
                      type: 'pct'
                    }
                  })
                )
                
                elements.push(
                  new Paragraph({
                    children: [new TextRun({ text: '' })],
                    spacing: { after: 200 }
                  })
                )
              }
            }
          })
          
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
  sectionContents: Record<string, string>
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
    
    const fileName = assignmentData.metadata?.assignmentTitle 
      ? `${assignmentData.metadata.assignmentTitle}.docx`
      : `${assignmentData.title}.docx`
    
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