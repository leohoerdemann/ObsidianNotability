// Import and export functionality for Nota files
import { Notice } from 'obsidian';
import { NotaFileData, SerializedPage } from './types';
import { PDFDocument, rgb } from 'pdf-lib';
import { saveAs } from 'file-saver';

export class ImportExport {
    
    /**
     * Export nota to PDF
     */
    static async exportToPDF(notaData: NotaFileData, fileName: string): Promise<void> {
        try {
            const pdfDoc = await PDFDocument.create();
            
            for (const page of notaData.pages) {
                const pdfPage = pdfDoc.addPage([page.width, page.height]);
                
                // Draw background
                const bgColor = this.hexToRgb(page.background.color);
                pdfPage.drawRectangle({
                    x: 0,
                    y: 0,
                    width: page.width,
                    height: page.height,
                    color: rgb(bgColor.r, bgColor.g, bgColor.b),
                });
                
                // Draw strokes
                // Note: PDF-lib doesn't have direct line drawing, so we'd need to use SVG or images
                // This is a placeholder - in production, you'd convert the canvas to an image
                
                // Draw text elements
                page.textElements.forEach(text => {
                    const textColor = this.hexToRgb(text.color);
                    pdfPage.drawText(text.text, {
                        x: text.x,
                        y: page.height - text.y - text.fontSize, // PDF coordinates are bottom-up
                        size: text.fontSize,
                        color: rgb(textColor.r, textColor.g, textColor.b),
                    });
                });
            }
            
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            saveAs(blob, fileName.replace('.nota', '.pdf'));
            
            new Notice('Exported to PDF successfully');
        } catch (error) {
            console.error('Export to PDF failed:', error);
            new Notice('Failed to export to PDF: ' + error.message);
        }
    }
    
    /**
     * Export nota pages as images
     */
    static async exportToImages(pages: HTMLCanvasElement[], fileName: string): Promise<void> {
        try {
            for (let i = 0; i < pages.length; i++) {
                const canvas = pages[i];
                canvas.toBlob((blob) => {
                    if (blob) {
                        saveAs(blob, `${fileName.replace('.nota', '')}_page_${i + 1}.png`);
                    }
                });
            }
            new Notice('Exported pages as images');
        } catch (error) {
            console.error('Export to images failed:', error);
            new Notice('Failed to export images: ' + error.message);
        }
    }
    
    /**
     * Export to markdown (text only)
     */
    static async exportToMarkdown(notaData: NotaFileData, fileName: string): Promise<string> {
        let markdown = `# ${fileName.replace('.nota', '')}\n\n`;
        
        notaData.pages.forEach((page, index) => {
            markdown += `## Page ${index + 1}\n\n`;
            
            page.textElements.forEach(text => {
                markdown += `${text.text}\n\n`;
            });
        });
        
        return markdown;
    }
    
    /**
     * Import PDF to nota
     */
    static async importPDF(pdfFile: ArrayBuffer): Promise<NotaFileData | null> {
        try {
            // This is a placeholder - actual PDF import would require:
            // 1. PDF parsing to extract pages as images
            // 2. Converting each page to a Nota page
            // 3. Optional OCR for text extraction
            
            new Notice('PDF import - feature in development');
            return null;
        } catch (error) {
            console.error('PDF import failed:', error);
            new Notice('Failed to import PDF: ' + error.message);
            return null;
        }
    }
    
    /**
     * Import images to nota
     */
    static async importImage(imageFile: File): Promise<SerializedPage | null> {
        try {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        const page: SerializedPage = {
                            id: `page-${Date.now()}`,
                            strokes: [],
                            shapes: [],
                            textElements: [],
                            images: [{
                                type: 'image',
                                id: `img-${Date.now()}`,
                                x: 0,
                                y: 0,
                                width: img.width,
                                height: img.height,
                                data: e.target?.result as string,
                            }],
                            width: img.width,
                            height: img.height,
                            background: {
                                type: 'solid',
                                color: '#ffffff',
                            },
                        };
                        resolve(page);
                    };
                    img.onerror = reject;
                    img.src = e.target?.result as string;
                };
                reader.onerror = reject;
                reader.readAsDataURL(imageFile);
            });
        } catch (error) {
            console.error('Image import failed:', error);
            new Notice('Failed to import image: ' + error.message);
            return null;
        }
    }
    
    /**
     * Import Notability .note file
     */
    static async importNotabilityNote(noteFile: ArrayBuffer): Promise<NotaFileData | null> {
        try {
            // Notability files are actually ZIP archives containing JSON and images
            // This would require parsing the .note format
            // Reference: https://jvns.ca/blog/2018/03/31/reverse-engineering-notability-format/
            
            new Notice('Notability import - feature in development');
            return null;
        } catch (error) {
            console.error('Notability import failed:', error);
            new Notice('Failed to import Notability file: ' + error.message);
            return null;
        }
    }
    
    /**
     * Export to PowerPoint
     */
    static async exportToPowerPoint(notaData: NotaFileData, fileName: string): Promise<void> {
        try {
            // This would use pptxgenjs to create a PowerPoint file
            // Each nota page would become a slide
            
            new Notice('PowerPoint export - feature in development');
        } catch (error) {
            console.error('PowerPoint export failed:', error);
            new Notice('Failed to export to PowerPoint: ' + error.message);
        }
    }
    
    /**
     * Helper: Convert hex color to RGB
     */
    private static hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255,
        } : { r: 0, g: 0, b: 0 };
    }
    
    /**
     * Perform OCR on nota pages
     */
    static async performOCR(imageData: string): Promise<string> {
        try {
            // This would use Tesseract.js for OCR
            // const { createWorker } = require('tesseract.js');
            // const worker = await createWorker();
            // await worker.loadLanguage('eng');
            // await worker.initialize('eng');
            // const { data: { text } } = await worker.recognize(imageData);
            // await worker.terminate();
            // return text;
            
            new Notice('OCR - feature in development');
            return '';
        } catch (error) {
            console.error('OCR failed:', error);
            new Notice('Failed to perform OCR: ' + error.message);
            return '';
        }
    }
}
