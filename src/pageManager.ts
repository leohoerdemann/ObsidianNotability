// Page management and streaming system
import Konva from 'konva';
import { Page, SerializedPage, BackgroundSettings, PageSize, getPageDimensions } from './types';
import { DrawingTools } from './tools';

export class PageManager {
    private pages: Page[] = [];
    private container: HTMLDivElement;
    private mainStage: Konva.Stage;
    private visiblePages: Set<string> = new Set();
    private pageGap = 20; // Gap between pages in pixels
    private pageSize: PageSize;
    private onContentChange: () => void;

    constructor(container: HTMLDivElement, pageSize: PageSize, onContentChange: () => void) {
        this.container = container;
        this.pageSize = pageSize;
        this.onContentChange = onContentChange;

        const { width } = getPageDimensions(pageSize);
        
        // Create main stage
        this.mainStage = new Konva.Stage({
            container: container,
            width: container.clientWidth,
            height: container.clientHeight,
        });

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    private handleResize() {
        this.mainStage.width(this.container.clientWidth);
        this.mainStage.height(this.container.clientHeight);
        this.updateVisiblePages();
    }

    addPage(serializedPage: SerializedPage): Page {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'nota-page';
        pageDiv.style.width = `${serializedPage.width}px`;
        pageDiv.style.height = `${serializedPage.height}px`;

        this.container.appendChild(pageDiv);

        const layer = new Konva.Layer();
        
        const yOffset = this.calculateYOffset(this.pages.length);
        
        const page: Page = {
            id: serializedPage.id,
            layer: layer,
            container: pageDiv,
            content: {
                strokes: [],
                shapes: [],
                texts: [],
                images: [],
            },
            width: serializedPage.width,
            height: serializedPage.height,
            isLoaded: false,
            yOffset: yOffset,
            background: serializedPage.background,
        };

        this.pages.push(page);
        return page;
    }

    private calculateYOffset(pageIndex: number): number {
        let offset = 0;
        for (let i = 0; i < pageIndex; i++) {
            offset += this.pages[i].height + this.pageGap;
        }
        return offset;
    }

    loadPage(pageId: string, serializedPage: SerializedPage, tools: DrawingTools): void {
        const page = this.pages.find(p => p.id === pageId);
        if (!page || page.isLoaded) return;

        if (!page.layer) {
            page.layer = new Konva.Layer();
        }

        // Create background
        this.createBackground(page);

        // Load strokes
        serializedPage.strokes.forEach(stroke => {
            const line = new Konva.Line({
                points: stroke.points,
                stroke: stroke.color,
                strokeWidth: stroke.thickness,
                opacity: stroke.opacity,
                lineCap: 'round',
                lineJoin: 'round',
                tension: 0.5,
                name: 'stroke', // Mark as user stroke for eraser detection
            });
            page.layer!.add(line);
            page.content.strokes.push(line);
        });

        // Load shapes
        serializedPage.shapes?.forEach(shape => {
            let konvaShape: Konva.Shape;

            switch (shape.type) {
                case 'rectangle':
                    konvaShape = new Konva.Rect({
                        x: shape.x || 0,
                        y: shape.y || 0,
                        width: shape.width || 0,
                        height: shape.height || 0,
                        stroke: shape.color,
                        strokeWidth: shape.thickness,
                        opacity: shape.opacity,
                        name: 'stroke',
                    });
                    break;
                case 'circle':
                    konvaShape = new Konva.Circle({
                        x: shape.x || 0,
                        y: shape.y || 0,
                        radius: shape.radius || 0,
                        stroke: shape.color,
                        strokeWidth: shape.thickness,
                        opacity: shape.opacity,
                        name: 'stroke',
                    });
                    break;
                case 'line':
                    konvaShape = new Konva.Line({
                        points: shape.points || [],
                        stroke: shape.color,
                        strokeWidth: shape.thickness,
                        opacity: shape.opacity,
                        lineCap: 'round',
                        name: 'stroke',
                    });
                    break;
                default:
                    return;
            }

            page.layer!.add(konvaShape);
            page.content.shapes.push(konvaShape);
        });

        // Load text elements
        serializedPage.textElements?.forEach(textEl => {
            const text = new Konva.Text({
                x: textEl.x,
                y: textEl.y,
                text: textEl.text,
                fontSize: textEl.fontSize,
                fontFamily: textEl.fontFamily,
                fill: textEl.color,
                draggable: true,
            });
            page.layer!.add(text);
            page.content.texts.push(text);
        });

        // Load images
        serializedPage.images?.forEach(imageEl => {
            const imageObj = new Image();
            imageObj.onload = () => {
                const image = new Konva.Image({
                    x: imageEl.x,
                    y: imageEl.y,
                    image: imageObj,
                    width: imageEl.width,
                    height: imageEl.height,
                    draggable: true,
                });
                page.layer!.add(image);
                page.content.images.push(image);
            };
            imageObj.src = imageEl.data;
        });

        page.isLoaded = true;
        this.visiblePages.add(pageId);
    }

    // Reload page content for undo/redo (preserves background)
    loadPageContent(pageId: string, serializedPage: SerializedPage, tools: DrawingTools): void {
        const page = this.pages.find(p => p.id === pageId);
        if (!page || !page.layer) return;

        // Clear existing content (but not background)
        page.content.strokes.forEach(s => s.destroy());
        page.content.shapes.forEach(s => s.destroy());
        page.content.texts.forEach(t => t.destroy());
        page.content.images.forEach(i => i.destroy());
        
        page.content = {
            strokes: [],
            shapes: [],
            texts: [],
            images: [],
        };

        // Load strokes
        serializedPage.strokes.forEach(stroke => {
            const line = new Konva.Line({
                points: stroke.points,
                stroke: stroke.color,
                strokeWidth: stroke.thickness,
                opacity: stroke.opacity,
                lineCap: 'round',
                lineJoin: 'round',
                tension: 0.5,
                name: 'stroke',
            });
            page.layer!.add(line);
            page.content.strokes.push(line);
        });

        // Load shapes
        serializedPage.shapes?.forEach(shape => {
            let konvaShape: Konva.Shape;

            switch (shape.type) {
                case 'rectangle':
                    konvaShape = new Konva.Rect({
                        x: shape.x || 0,
                        y: shape.y || 0,
                        width: shape.width || 0,
                        height: shape.height || 0,
                        stroke: shape.color,
                        strokeWidth: shape.thickness,
                        opacity: shape.opacity,
                        name: 'stroke',
                    });
                    break;
                case 'circle':
                    konvaShape = new Konva.Circle({
                        x: shape.x || 0,
                        y: shape.y || 0,
                        radius: shape.radius || 0,
                        stroke: shape.color,
                        strokeWidth: shape.thickness,
                        opacity: shape.opacity,
                        name: 'stroke',
                    });
                    break;
                case 'line':
                    konvaShape = new Konva.Line({
                        points: shape.points || [],
                        stroke: shape.color,
                        strokeWidth: shape.thickness,
                        opacity: shape.opacity,
                        lineCap: 'round',
                        name: 'stroke',
                    });
                    break;
                default:
                    return;
            }

            page.layer!.add(konvaShape);
            page.content.shapes.push(konvaShape);
        });

        // Load text elements
        serializedPage.textElements?.forEach(textEl => {
            const text = new Konva.Text({
                x: textEl.x,
                y: textEl.y,
                text: textEl.text,
                fontSize: textEl.fontSize,
                fontFamily: textEl.fontFamily,
                fill: textEl.color,
                draggable: true,
            });
            page.layer!.add(text);
            page.content.texts.push(text);
        });

        // Load images
        serializedPage.images?.forEach(imageEl => {
            const imageObj = new Image();
            imageObj.onload = () => {
                const image = new Konva.Image({
                    x: imageEl.x,
                    y: imageEl.y,
                    image: imageObj,
                    width: imageEl.width,
                    height: imageEl.height,
                    draggable: true,
                });
                page.layer!.add(image);
                page.content.images.push(image);
            };
            imageObj.src = imageEl.data;
        });

        page.layer.batchDraw();
    }

    private createBackground(page: Page): void {
        const bg = page.background;
        console.log('createBackground:', page.id, 'color:', bg.color, 'type:', bg.type);
        
        const bgRect = new Konva.Rect({
            x: 0,
            y: 0,
            width: page.width,
            height: page.height,
            fill: bg.color || '#ffffff',
            name: 'background',
        });
        page.layer!.add(bgRect);
        bgRect.moveToBottom();

        switch (bg.type) {
            case 'grid':
                this.createGrid(page, bg.gridSize || 20);
                break;
            case 'ruled':
                this.createRuledLines(page, bg.lineSpacing || 30);
                break;
            case 'dotted':
                this.createDots(page, bg.gridSize || 20);
                break;
        }
    }

    private createGrid(page: Page, gridSize: number): void {
        const layer = page.layer!;
        const width = page.width;
        const height = page.height;

        // Vertical lines
        for (let x = 0; x <= width; x += gridSize) {
            const line = new Konva.Line({
                points: [x, 0, x, height],
                stroke: '#e0e0e0',
                strokeWidth: 0.5,
                name: 'background',
            });
            layer.add(line);
            line.moveToBottom();
        }

        // Horizontal lines
        for (let y = 0; y <= height; y += gridSize) {
            const line = new Konva.Line({
                points: [0, y, width, y],
                stroke: '#e0e0e0',
                strokeWidth: 0.5,
                name: 'background',
            });
            layer.add(line);
            line.moveToBottom();
        }
    }

    private createRuledLines(page: Page, spacing: number): void {
        const layer = page.layer!;
        const width = page.width;
        const height = page.height;

        for (let y = spacing; y <= height; y += spacing) {
            const line = new Konva.Line({
                points: [0, y, width, y],
                stroke: '#e0e0e0',
                strokeWidth: 1,
                name: 'background',
            });
            layer.add(line);
            line.moveToBottom();
        }
    }

    private createDots(page: Page, gridSize: number): void {
        const layer = page.layer!;
        const width = page.width;
        const height = page.height;

        for (let x = 0; x <= width; x += gridSize) {
            for (let y = 0; y <= height; y += gridSize) {
                const dot = new Konva.Circle({
                    x: x,
                    y: y,
                    radius: 1,
                    fill: '#c0c0c0',
                    name: 'background',
                });
                layer.add(dot);
                dot.moveToBottom();
            }
        }
    }

    unloadPage(pageId: string): void {
        const page = this.pages.find(p => p.id === pageId);
        if (!page || !page.isLoaded) return;

        page.layer?.destroy();
        page.layer = new Konva.Layer();
        page.content = {
            strokes: [],
            shapes: [],
            texts: [],
            images: [],
        };
        page.isLoaded = false;
        this.visiblePages.delete(pageId);
    }

    updateVisiblePages(): void {
        // Determine which pages should be visible based on scroll position
        const scrollTop = this.container.scrollTop || 0;
        const viewportHeight = this.container.clientHeight;

        this.pages.forEach(page => {
            const pageTop = page.yOffset;
            const pageBottom = pageTop + page.height;

            const isVisible = (
                (pageTop >= scrollTop - page.height && pageTop <= scrollTop + viewportHeight + page.height) ||
                (pageBottom >= scrollTop - page.height && pageBottom <= scrollTop + viewportHeight + page.height)
            );

            if (isVisible && !this.visiblePages.has(page.id)) {
                // Load this page
                this.visiblePages.add(page.id);
            } else if (!isVisible && this.visiblePages.has(page.id)) {
                // Unload this page
                this.visiblePages.delete(page.id);
            }
        });
    }

    getPageAtPosition(y: number): Page | null {
        for (const page of this.pages) {
            if (y >= page.yOffset && y <= page.yOffset + page.height) {
                return page;
            }
        }
        return null;
    }

    getAllPages(): Page[] {
        return this.pages;
    }

    getPage(pageId: string): Page | null {
        return this.pages.find(p => p.id === pageId) || null;
    }

    removePage(pageId: string): void {
        const index = this.pages.findIndex(p => p.id === pageId);
        if (index === -1) return;

        const page = this.pages[index];
        page.layer?.destroy();
        page.container?.remove();
        
        this.pages.splice(index, 1);
        this.visiblePages.delete(pageId);

        // Recalculate offsets for remaining pages
        this.recalculateOffsets();
    }

    private recalculateOffsets(): void {
        let currentOffset = 0;
        this.pages.forEach((page, index) => {
            page.yOffset = currentOffset;
            // No need to set position - flexbox handles it
            currentOffset += page.height + this.pageGap;
        });
    }

    serializePage(pageId: string): SerializedPage | null {
        const page = this.pages.find(p => p.id === pageId);
        if (!page || !page.layer) {
            console.warn('serializePage: page or layer not found', pageId);
            return null;
        }

        const strokes: any[] = [];
        const shapes: any[] = [];
        const textElements: any[] = [];
        const images: any[] = [];
        
        console.log('serializePage: layer children count:', page.layer.getChildren().length);

        // Iterate through all children in the layer
        page.layer.getChildren().forEach(child => {
            // Skip background elements
            if (child.name() === 'background') return;

            // Check if it's a stroke (Line with points)
            if (child instanceof Konva.Line && child.points().length > 0) {
                const stroke = child.stroke();
                const isEraser = child.globalCompositeOperation() === 'destination-out';
                
                // Skip eraser strokes
                if (isEraser) return;
                
                console.log('Found stroke with', child.points().length, 'points, color:', stroke);
                strokes.push({
                    type: (child.opacity() || 1) < 1 ? 'highlighter' : 'pen',
                    points: child.points(),
                    color: typeof stroke === 'string' ? stroke : '#000000',
                    thickness: child.strokeWidth() || 1,
                    opacity: child.opacity() || 1,
                });
            }
            // Check if it's a shape (Rect, Circle, etc.)
            else if (child instanceof Konva.Rect && !child.name()?.includes('background')) {
                const stroke = child.stroke();
                shapes.push({
                    type: 'rectangle' as const,
                    x: child.x(),
                    y: child.y(),
                    width: child.width(),
                    height: child.height(),
                    color: typeof stroke === 'string' ? stroke : '#000000',
                    thickness: child.strokeWidth() || 1,
                    opacity: child.opacity() || 1,
                });
            }
            else if (child instanceof Konva.Circle) {
                const stroke = child.stroke();
                shapes.push({
                    type: 'circle' as const,
                    x: child.x(),
                    y: child.y(),
                    radius: child.radius(),
                    color: typeof stroke === 'string' ? stroke : '#000000',
                    thickness: child.strokeWidth() || 1,
                    opacity: child.opacity() || 1,
                });
            }
            // Check if it's a text element
            else if (child instanceof Konva.Text) {
                const fill = child.fill();
                textElements.push({
                    type: 'text' as const,
                    id: child.id(),
                    x: child.x(),
                    y: child.y(),
                    text: child.text(),
                    fontSize: child.fontSize(),
                    fontFamily: child.fontFamily(),
                    color: typeof fill === 'string' ? fill : '#000000',
                    width: child.width(),
                    height: child.height(),
                });
            }
            // Check if it's an image
            else if (child instanceof Konva.Image) {
                const image = child.image() as HTMLImageElement;
                if (image && image.src) {
                    images.push({
                        type: 'image' as const,
                        id: child.id(),
                        x: child.x(),
                        y: child.y(),
                        width: child.width(),
                        height: child.height(),
                        data: image.src,
                    });
                }
            }
        });

        console.log('serializePage result:', {
            id: page.id,
            strokesCount: strokes.length,
            shapesCount: shapes.length,
            textsCount: textElements.length,
            imagesCount: images.length
        });

        return {
            id: page.id,
            strokes: strokes,
            shapes: shapes,
            textElements: textElements,
            images: images,
            width: page.width,
            height: page.height,
            background: page.background,
        };
    }

    destroy(): void {
        this.pages.forEach(page => {
            page.layer?.destroy();
            page.container?.remove();
        });
        this.mainStage.destroy();
        this.pages = [];
        this.visiblePages.clear();
    }
}
