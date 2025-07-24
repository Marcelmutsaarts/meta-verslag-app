import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, HeadingLevel, AlignmentType, LevelFormat } from 'docx'
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
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "my-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 260 },
                },
              },
            },
          ],
        },
        {
          reference: "my-bullet-points",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 260 },
                },
              },
            },
          ],
        },
      ],
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
          
          // Process HTML content directly
          const contentParts = splitHtmlByTables(section.content)
          
          contentParts.forEach(part => {
            if (part.type === 'text') {
              const htmlContent = part.content as string
              if (htmlContent.trim()) {
                // Parse HTML content and convert to Word elements
                const tempDiv = document.createElement('div')
                tempDiv.innerHTML = htmlContent
                
                // Process HTML content more robustly
                const processHtmlElement = (node: Node): void => {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as Element
                    const tagName = element.tagName.toLowerCase()
                    const textContent = element.textContent || ''
                    
                    switch (tagName) {
                      case 'h1':
                        elements.push(
                          new Paragraph({
                            children: htmlToWordElements(element.innerHTML),
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 }
                          })
                        )
                        break
                      case 'h2':
                        elements.push(
                          new Paragraph({
                            children: htmlToWordElements(element.innerHTML),
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 200, after: 100 }
                          })
                        )
                        break
                      case 'h3':
                        elements.push(
                          new Paragraph({
                            children: htmlToWordElements(element.innerHTML),
                            heading: HeadingLevel.HEADING_4,
                            spacing: { before: 150, after: 75 }
                          })
                        )
                        break
                      case 'ul':
                        const listItems = element.querySelectorAll('li')
                        listItems.forEach(li => {
                          const listContent = htmlToWordElements(li.innerHTML)
                          if (listContent.some(item => item.text.trim())) {
                            elements.push(
                              new Paragraph({
                                children: listContent,
                                numbering: { reference: 'my-bullet-points', level: 0 },
                                spacing: { after: 100 }
                              })
                            )
                          }
                        })
                        break
                      case 'ol':
                        const numberedItems = element.querySelectorAll('li')
                        numberedItems.forEach((li) => {
                          const listContent = htmlToWordElements(li.innerHTML)
                          if (listContent.some(item => item.text.trim())) {
                            elements.push(
                              new Paragraph({
                                children: listContent,
                                numbering: { reference: 'my-numbering', level: 0 },
                                spacing: { after: 100 }
                              })
                            )
                          }
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
                      case 'div':
                        // Process div content recursively
                        if (element.childNodes.length > 0) {
                          element.childNodes.forEach(child => processHtmlElement(child))
                        } else if (textContent.trim()) {
                          elements.push(
                            new Paragraph({
                              children: htmlToWordElements(element.innerHTML),
                              spacing: { after: 200 }
                            })
                          )
                        }
                        break
                      default:
                        // Handle other elements by processing their children or as paragraphs
                        if (element.childNodes.length > 0) {
                          element.childNodes.forEach(child => processHtmlElement(child))
                        } else if (textContent.trim()) {
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
                }
                
                // Process each child element
                tempDiv.childNodes.forEach(processHtmlElement)
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

// Export assignment to PDF
export async function exportAssignmentToPDF(
  assignmentData: ExportAssignmentData,
  sectionContents: Record<string, string>
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
    const fileName = assignmentData.metadata?.assignmentTitle 
      ? `${assignmentData.metadata.assignmentTitle}.pdf`
      : `${assignmentData.title}.pdf`
    
    pdf.save(fileName)
  } catch (error) {
    console.error('PDF export failed:', error)
    throw new Error('Kon PDF niet exporteren')
  }
}