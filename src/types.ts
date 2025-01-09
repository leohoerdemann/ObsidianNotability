// defining the types for the application

import Konva from 'konva';

type PageContent = {
    strokes: any[];
    text: any[];
};

interface ToolSettings {
    pen: {
        color: string;
        thickness: number;
        opacity: number;
    };
    highlighter: {
        color: string;
        thickness: number;
        opacity: number;
    };
    eraser: {
        thickness: number;
    };
}

interface Page {
    id: string;
    stage?: Konva.Stage;
    content: PageContent;
    height: number;
    isLoaded: boolean;
    thumbnail?: string;
}


interface SerializedStroke {
    type: 'pen' | 'highlighter' | 'eraser';
    points: number[];
    color: string;
    thickness: number;
    opacity: number;
    pressure: number[];
}

interface SerializedText {
    type: 'text';
    x: number;
    y: number;
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
}

interface SerializedPage {
    id: string;
    strokes: SerializedStroke[];
    textElements: SerializedText[];
    width: number;
    height: number;
}

interface NotaFileData {
    version: string;
    pages: SerializedPage[];
    settings: ToolSettings;
}

export function pagesize(page: string): [number, number] {
    if (page === "A4") {
        return [210, 297]; // A4 size in mm
    } else if (page === "A5") {
        return [210, 148]; // A5 size in mm
    } else if (page === "Square") {
        return [420, 420]; // square
    } else {
        return [420, 420]; // Default to A4 size in mm
    }
}
