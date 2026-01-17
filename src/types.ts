// Type definitions for the Nota plugin

import Konva from 'konva';

export type ToolType = 'hand' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'select';

export type PageSize = 'A4' | 'A5' | 'Letter' | 'Legal' | 'Square';

export type BackgroundType = 'solid' | 'grid' | 'ruled' | 'dotted';

export interface PenSettings {
    color: string;
    thickness: number;
    opacity: number;
}

export interface HighlighterSettings {
    color: string;
    thickness: number;
    opacity: number;
}

export interface EraserSettings {
    thickness: number;
}

export interface TextSettings {
    fontSize: number;
    fontFamily: string;
    color: string;
}

export interface ToolSettings {
    pen: PenSettings;
    highlighter: HighlighterSettings;
    eraser: EraserSettings;
    text: TextSettings;
}

export interface BackgroundSettings {
    type: BackgroundType;
    color: string;
    gridSize?: number;
    lineSpacing?: number;
}

export interface SerializedStroke {
    type: 'pen' | 'highlighter';
    points: number[];
    color: string;
    thickness: number;
    opacity: number;
    pressure?: number[];
}

export interface SerializedShape {
    type: 'line' | 'rectangle' | 'circle' | 'arrow' | 'triangle';
    points?: number[];
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
    color: string;
    thickness: number;
    opacity: number;
}

export interface SerializedText {
    type: 'text';
    id: string;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    width?: number;
    height?: number;
}

export interface SerializedImage {
    type: 'image';
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    data: string; // base64 encoded
}

export interface SerializedPage {
    id: string;
    strokes: SerializedStroke[];
    shapes: SerializedShape[];
    textElements: SerializedText[];
    images: SerializedImage[];
    width: number;
    height: number;
    background: BackgroundSettings;
}

export interface NotaFileData {
    version: string;
    pages: SerializedPage[];
    settings: ToolSettings;
    pageSize: PageSize;
    viewState?: {
        scrollTop: number;
        scrollLeft: number;
        scale: number;
    };
}

export interface Page {
    id: string;
    layer?: Konva.Layer;
    container?: HTMLDivElement;
    content: {
        strokes: Konva.Line[];
        shapes: Konva.Shape[];
        texts: Konva.Text[];
        images: Konva.Image[];
    };
    width: number;
    height: number;
    isLoaded: boolean;
    yOffset: number; // Position in the document
    background: BackgroundSettings;
}

export interface DrawingState {
    isDrawing: boolean;
    currentTool: ToolType;
    currentLine?: Konva.Line;
    currentShape?: Konva.Shape;
    shapeStartTime?: number;
    selectedObjects: Konva.Node[];
    selectionBox?: Konva.Rect;
    clipboard: Konva.Node[];
    history: HistoryEntry[];
    historyIndex: number;
}

export interface HistoryEntry {
    pageId: string;
    action: 'add' | 'remove' | 'modify';
    data: any;
}

export interface ViewportState {
    scale: number;
    offsetX: number;
    offsetY: number;
    containerWidth: number;
    containerHeight: number;
}

export function getPageDimensions(pageSize: PageSize): { width: number; height: number } {
    const DPI = 96; // Standard screen DPI
    const MM_TO_INCH = 1 / 25.4;
    
    switch (pageSize) {
        case 'A4':
            return { 
                width: Math.round(210 * MM_TO_INCH * DPI),  // 794px
                height: Math.round(297 * MM_TO_INCH * DPI)  // 1123px
            };
        case 'A5':
            return { 
                width: Math.round(148 * MM_TO_INCH * DPI),  // 559px
                height: Math.round(210 * MM_TO_INCH * DPI)  // 794px
            };
        case 'Letter':
            return { 
                width: Math.round(8.5 * DPI),   // 816px
                height: Math.round(11 * DPI)    // 1056px
            };
        case 'Legal':
            return { 
                width: Math.round(8.5 * DPI),   // 816px
                height: Math.round(14 * DPI)    // 1344px
            };
        case 'Square':
            return { 
                width: 800, 
                height: 800 
            };
        default:
            return { 
                width: Math.round(210 * MM_TO_INCH * DPI), 
                height: Math.round(297 * MM_TO_INCH * DPI) 
            };
    }
}

export function createEmptyPage(id: string, pageSize: PageSize, background: BackgroundSettings): SerializedPage {
    const { width, height } = getPageDimensions(pageSize);
    return {
        id,
        strokes: [],
        shapes: [],
        textElements: [],
        images: [],
        width,
        height,
        background
    };
}

export function createDefaultNotaFile(pageSize: PageSize = 'A4'): NotaFileData {
    const background: BackgroundSettings = {
        type: 'solid',
        color: '#ffffff'
    };
    
    return {
        version: '1.0.0',
        pages: [
            createEmptyPage('page-1', pageSize, background),
            createEmptyPage('page-2', pageSize, background)
        ],
        settings: {
            pen: {
                color: '#000000',
                thickness: 2,
                opacity: 1
            },
            highlighter: {
                color: '#ffff00',
                thickness: 20,
                opacity: 0.3
            },
            eraser: {
                thickness: 20
            },
            text: {
                fontSize: 16,
                fontFamily: 'Arial',
                color: '#000000'
            }
        },
        pageSize
    };
}
