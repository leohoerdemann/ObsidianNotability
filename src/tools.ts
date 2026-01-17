// Drawing tools implementation
import Konva from 'konva';
import { ToolType, ToolSettings, SerializedStroke, SerializedShape } from './types';

export class DrawingTools {
    private layer: Konva.Layer;
    private settings: ToolSettings;
    private currentTool: ToolType = 'pen';
    private isDrawing = false;
    private currentLine: Konva.Line | null = null;
    private currentShape: Konva.Shape | null = null;
    private shapeStartTime: number = 0;
    private shapeStartPoints: number[] = [];
    private onContentChange: () => void;
    private lastEraserPos: { x: number; y: number } | null = null;
    private eraserTrail: Konva.Line | null = null;
    private markedForDeletion: Set<Konva.Shape> = new Set();
    private originalOpacities: Map<Konva.Shape, number> = new Map();
    
    // Shape hold detection
    private lastMovePos: { x: number; y: number } | null = null;
    private lastMoveTime: number = 0;
    private shapeHoldTimer: ReturnType<typeof setTimeout> | null = null;
    private isInShapeMode: boolean = false;
    private detectedShapeType: 'circle' | 'oval' | 'rectangle' | 'triangle' | 'line' | null = null;
    private shapeAnchor: { x: number; y: number } | null = null;
    private shapeBounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

    constructor(layer: Konva.Layer, settings: ToolSettings, onContentChange: () => void) {
        this.layer = layer;
        this.settings = settings;
        this.onContentChange = onContentChange;
    }

    setTool(tool: ToolType) {
        this.currentTool = tool;
    }

    getCurrentTool(): ToolType {
        return this.currentTool;
    }

    getIsDrawing(): boolean {
        return this.isDrawing;
    }

    updateSettings(settings: Partial<ToolSettings>) {
        this.settings = { ...this.settings, ...settings };
    }

    getSettings(): ToolSettings {
        return this.settings;
    }

    // Get pointer position adjusted for stage scale
    private getScaledPointerPosition(stage: Konva.Stage): { x: number; y: number } | null {
        const pos = stage.getPointerPosition();
        if (!pos) return null;
        
        const scale = stage.scaleX(); // Assuming uniform scale
        return {
            x: pos.x / scale,
            y: pos.y / scale
        };
    }

    handlePointerDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, stage: Konva.Stage) {
        if (this.currentTool === 'hand') return;

        this.isDrawing = true;
        const pos = this.getScaledPointerPosition(stage);
        if (!pos) return;

        switch (this.currentTool) {
            case 'pen':
            case 'highlighter':
                this.startDrawing(pos);
                break;
            case 'eraser':
                this.startErasing(pos);
                break;
            case 'text':
                this.createTextBox(pos);
                break;
            case 'select':
                this.startSelection(pos);
                break;
        }
    }

    handlePointerMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, stage: Konva.Stage) {
        if (!this.isDrawing || this.currentTool === 'hand') return;

        const pos = this.getScaledPointerPosition(stage);
        if (!pos) return;

        switch (this.currentTool) {
            case 'pen':
            case 'highlighter':
                if (this.isInShapeMode) {
                    this.resizeShape(pos);
                } else {
                    this.continueDrawing(pos);
                    this.checkForShapeHold(pos);
                }
                break;
            case 'eraser':
                this.eraseAtPosition(pos);
                break;
            case 'select':
                this.continueSelection(pos);
                break;
        }
    }

    handlePointerUp(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>, stage: Konva.Stage) {
        if (!this.isDrawing || this.currentTool === 'hand') return;

        this.isDrawing = false;
        const pos = this.getScaledPointerPosition(stage);
        if (!pos) return;

        // Clear shape hold timer
        if (this.shapeHoldTimer) {
            clearTimeout(this.shapeHoldTimer);
            this.shapeHoldTimer = null;
        }

        switch (this.currentTool) {
            case 'pen':
                if (this.isInShapeMode) {
                    this.finishShapeMode();
                } else {
                    this.finishDrawing();
                }
                break;
            case 'highlighter':
                this.finishDrawing();
                break;
            case 'eraser':
                this.finishErasing();
                break;
            case 'select':
                this.finishSelection();
                break;
        }

        this.currentLine = null;
        this.currentShape = null;
        this.isInShapeMode = false;
        this.detectedShapeType = null;
        this.shapeAnchor = null;
        this.shapeBounds = null;
        this.lastMovePos = null;
        this.onContentChange();
    }

    private startDrawing(pos: { x: number; y: number }) {
        const isPen = this.currentTool === 'pen';
        const isHighlighter = this.currentTool === 'highlighter';
        
        const settings = isPen ? this.settings.pen : this.settings.highlighter;

        console.log('startDrawing:', this.currentTool, 'at', pos, 'color:', settings.color);

        this.currentLine = new Konva.Line({
            stroke: settings.color,
            strokeWidth: settings.thickness,
            globalCompositeOperation: 'source-over',
            lineCap: 'round',
            lineJoin: 'round',
            points: [pos.x, pos.y],
            opacity: settings.opacity,
            tension: 0.5,
            name: 'stroke', // Mark as user stroke
        });

        this.shapeStartTime = Date.now();
        this.shapeStartPoints = [pos.x, pos.y];

        this.layer.add(this.currentLine);
        console.log('Added stroke to layer, layer now has', this.layer.getChildren().length, 'children');
    }

    private startErasing(pos: { x: number; y: number }) {
        this.lastEraserPos = pos;
        this.markedForDeletion.clear();
        this.originalOpacities.clear();
        
        // Create eraser trail (white line)
        this.eraserTrail = new Konva.Line({
            stroke: '#ffffff',
            strokeWidth: this.settings.eraser.thickness,
            lineCap: 'round',
            lineJoin: 'round',
            points: [pos.x, pos.y],
            name: 'eraser-trail',
            listening: false,
        });
        this.layer.add(this.eraserTrail);
        
        this.checkEraserIntersections(pos);
    }

    private eraseAtPosition(pos: { x: number; y: number }) {
        // Extend eraser trail
        if (this.eraserTrail) {
            const points = this.eraserTrail.points().concat([pos.x, pos.y]);
            this.eraserTrail.points(points);
        }
        
        this.checkEraserIntersections(pos);
        this.lastEraserPos = pos;
    }

    private checkEraserIntersections(pos: { x: number; y: number }) {
        const eraserRadius = this.settings.eraser.thickness / 2;
        const children = this.layer.getChildren();

        children.forEach((child) => {
            // Check any shape with name 'stroke'
            if (child.name() === 'stroke' && !this.markedForDeletion.has(child as Konva.Shape)) {
                let intersects = false;
                
                if (child instanceof Konva.Line) {
                    intersects = this.lineIntersectsEraser(child, pos, eraserRadius);
                } else if (child instanceof Konva.Circle) {
                    intersects = this.circleIntersectsEraser(child, pos, eraserRadius);
                } else if (child instanceof Konva.Ellipse) {
                    intersects = this.ellipseIntersectsEraser(child, pos, eraserRadius);
                } else if (child instanceof Konva.Rect) {
                    intersects = this.rectIntersectsEraser(child, pos, eraserRadius);
                }
                
                if (intersects) {
                    const shape = child as Konva.Shape;
                    this.markedForDeletion.add(shape);
                    this.originalOpacities.set(shape, shape.opacity());
                    shape.opacity(0.3);
                    if (shape.stroke) {
                        shape.stroke('#888888');
                    }
                }
            }
        });

        this.layer.batchDraw();
    }

    private finishErasing() {
        // Remove eraser trail
        if (this.eraserTrail) {
            this.eraserTrail.destroy();
            this.eraserTrail = null;
        }

        // Delete all marked shapes
        this.markedForDeletion.forEach((shape) => {
            shape.destroy();
        });

        this.markedForDeletion.clear();
        this.originalOpacities.clear();
        this.lastEraserPos = null;
        this.layer.batchDraw();
    }

    private lineIntersectsEraser(line: Konva.Line, eraserPos: { x: number; y: number }, radius: number): boolean {
        const points = line.points();
        
        // Check each segment of the line
        for (let i = 0; i < points.length - 2; i += 2) {
            const x1 = points[i];
            const y1 = points[i + 1];
            const x2 = points[i + 2];
            const y2 = points[i + 3];

            // Check if eraser circle intersects with this line segment
            if (this.pointToSegmentDistance(eraserPos.x, eraserPos.y, x1, y1, x2, y2) <= radius + (line.strokeWidth() / 2)) {
                return true;
            }
        }

        return false;
    }

    private circleIntersectsEraser(circle: Konva.Circle, eraserPos: { x: number; y: number }, eraserRadius: number): boolean {
        const cx = circle.x();
        const cy = circle.y();
        const r = circle.radius();
        const strokeWidth = circle.strokeWidth() / 2;
        
        const dist = Math.sqrt((eraserPos.x - cx) ** 2 + (eraserPos.y - cy) ** 2);
        
        // Check if eraser touches the circle's stroke (inside or outside edge)
        return Math.abs(dist - r) <= eraserRadius + strokeWidth;
    }

    private ellipseIntersectsEraser(ellipse: Konva.Ellipse, eraserPos: { x: number; y: number }, eraserRadius: number): boolean {
        const cx = ellipse.x();
        const cy = ellipse.y();
        const rx = ellipse.radiusX();
        const ry = ellipse.radiusY();
        const strokeWidth = ellipse.strokeWidth() / 2;
        
        // Normalize point to unit circle space
        const nx = (eraserPos.x - cx) / rx;
        const ny = (eraserPos.y - cy) / ry;
        const normalizedDist = Math.sqrt(nx * nx + ny * ny);
        
        // Check if eraser touches the ellipse's stroke
        const avgRadius = (rx + ry) / 2;
        return Math.abs(normalizedDist - 1) * avgRadius <= eraserRadius + strokeWidth;
    }

    private rectIntersectsEraser(rect: Konva.Rect, eraserPos: { x: number; y: number }, eraserRadius: number): boolean {
        const x = rect.x();
        const y = rect.y();
        const w = rect.width();
        const h = rect.height();
        const strokeWidth = rect.strokeWidth() / 2;
        const threshold = eraserRadius + strokeWidth;
        
        // Check each edge of the rectangle
        // Top edge
        if (this.pointToSegmentDistance(eraserPos.x, eraserPos.y, x, y, x + w, y) <= threshold) return true;
        // Bottom edge
        if (this.pointToSegmentDistance(eraserPos.x, eraserPos.y, x, y + h, x + w, y + h) <= threshold) return true;
        // Left edge
        if (this.pointToSegmentDistance(eraserPos.x, eraserPos.y, x, y, x, y + h) <= threshold) return true;
        // Right edge
        if (this.pointToSegmentDistance(eraserPos.x, eraserPos.y, x + w, y, x + w, y + h) <= threshold) return true;
        
        return false;
    }

    private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // Segment is a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Project point onto line segment
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const nearestX = x1 + t * dx;
        const nearestY = y1 + t * dy;

        return Math.sqrt((px - nearestX) * (px - nearestX) + (py - nearestY) * (py - nearestY));
    }

    private continueDrawing(pos: { x: number; y: number }) {
        if (!this.currentLine) return;

        const newPoints = this.currentLine.points().concat([pos.x, pos.y]);
        this.currentLine.points(newPoints);
    }

    private checkForShapeHold(pos: { x: number; y: number }) {
        const now = Date.now();
        const moveThreshold = 5; // pixels - movement less than this is considered "still"
        
        if (this.lastMovePos) {
            const dx = pos.x - this.lastMovePos.x;
            const dy = pos.y - this.lastMovePos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > moveThreshold) {
                // User moved significantly, reset the timer
                this.lastMoveTime = now;
                if (this.shapeHoldTimer) {
                    clearTimeout(this.shapeHoldTimer);
                    this.shapeHoldTimer = null;
                }
            }
        } else {
            this.lastMoveTime = now;
        }
        
        this.lastMovePos = pos;
        
        // Start hold timer if not already running
        if (!this.shapeHoldTimer && this.currentLine) {
            this.shapeHoldTimer = setTimeout(() => {
                this.triggerShapeDetection();
            }, 1000); // 1 second hold
        }
    }

    private triggerShapeDetection() {
        if (!this.currentLine || this.isInShapeMode) return;
        
        const points = this.currentLine.points();
        if (points.length < 6) return; // Need at least 3 points
        
        // Analyze the stroke to detect shape type
        const shapeType = this.analyzeStrokeForShape(points);
        if (!shapeType) return;
        
        this.detectedShapeType = shapeType;
        this.isInShapeMode = true;
        
        // Calculate bounds from the stroke
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
            xs.push(points[i]);
            ys.push(points[i + 1]);
        }
        
        this.shapeBounds = {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        };
        
        // Use the center of the bounds as anchor for resizing
        this.shapeAnchor = {
            x: (this.shapeBounds.minX + this.shapeBounds.maxX) / 2,
            y: (this.shapeBounds.minY + this.shapeBounds.maxY) / 2
        };
        
        // Remove the stroke and create the shape
        this.currentLine.destroy();
        this.currentLine = null;
        
        this.createDetectedShape();
        this.layer.batchDraw();
    }

    private analyzeStrokeForShape(points: number[]): 'circle' | 'oval' | 'rectangle' | 'triangle' | 'line' | null {
        if (points.length < 4) return null;

        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
            xs.push(points[i]);
            ys.push(points[i + 1]);
        }

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;

        // Check if it's a line (very narrow in one dimension)
        if (width > height * 3.5 || height > width * 3.5) {
            return 'line';
        }

        // Find significant corners
        const corners = this.findSignificantCorners(points, width, height);
        
        console.log('Shape detection - corners found:', corners.length);

        // Triangle: 3 corners
        if (corners.length === 3) {
            return 'triangle';
        }

        // Rectangle: 4 corners
        if (corners.length >= 4) {
            return 'rectangle';
        }
        
        // If we found 2 corners, check if there might be a third at the start/end
        // (common for hand-drawn triangles where start/end meet at a corner)
        if (corners.length === 2) {
            const startX = xs[0];
            const startY = ys[0];
            const endX = xs[xs.length - 1];
            const endY = ys[ys.length - 1];
            const closedThreshold = Math.max(width, height) * 0.25;
            const isClosed = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2) < closedThreshold;
            
            if (isClosed) {
                return 'triangle';
            }
        }

        // No clear corners = circle or oval
        const aspectRatio = Math.max(width, height) / Math.min(width, height);
        if (aspectRatio < 1.3) {
            return 'circle';
        } else {
            return 'oval';
        }
    }

    private findSignificantCorners(points: number[], width: number, height: number): { x: number; y: number }[] {
        const corners: { x: number; y: number }[] = [];
        const angleThreshold = 25; // degrees - more lenient for better triangle detection
        const minDistance = Math.min(width, height) * 0.15; // smaller distance to catch triangle corners
        
        if (points.length < 12) return corners;
        
        // Use smaller step for better corner detection
        const step = Math.max(4, Math.floor(points.length / 40));
        
        // Collect all corner candidates with their angles
        const candidates: { point: { x: number; y: number }, angle: number }[] = [];
        
        for (let i = step * 2; i < points.length - step * 2 - 1; i += 2) {
            const prevIdx = Math.max(0, i - step * 2);
            const nextIdx = Math.min(points.length - 2, i + step * 2);
            
            const prev = { x: points[prevIdx], y: points[prevIdx + 1] };
            const curr = { x: points[i], y: points[i + 1] };
            const next = { x: points[nextIdx], y: points[nextIdx + 1] };
            
            const angle = this.getAngle(prev, curr, next);
            
            // Collect potential corners
            if (angle < 180 - angleThreshold && angle > 15) {
                candidates.push({ point: curr, angle: angle });
            }
        }
        
        // Sort by sharpest angle first (lowest = sharpest)
        candidates.sort((a, b) => a.angle - b.angle);
        
        // Pick corners that are far enough apart, prioritizing sharpest angles
        for (const candidate of candidates) {
            let tooClose = false;
            for (const corner of corners) {
                const dist = Math.sqrt((candidate.point.x - corner.x) ** 2 + (candidate.point.y - corner.y) ** 2);
                if (dist < minDistance) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                corners.push(candidate.point);
            }
        }
        
        return corners;
    }

    private createDetectedShape() {
        if (!this.shapeBounds || !this.detectedShapeType) return;
        
        const { minX, minY, maxX, maxY } = this.shapeBounds;
        const width = maxX - minX;
        const height = maxY - minY;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        const strokeColor = this.settings.pen.color;
        const strokeWidth = this.settings.pen.thickness;
        
        switch (this.detectedShapeType) {
            case 'circle':
                const radius = Math.min(width, height) / 2;
                this.currentShape = new Konva.Circle({
                    x: centerX,
                    y: centerY,
                    radius: radius,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    name: 'stroke',
                });
                break;
                
            case 'oval':
                this.currentShape = new Konva.Ellipse({
                    x: centerX,
                    y: centerY,
                    radiusX: width / 2,
                    radiusY: height / 2,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    name: 'stroke',
                });
                break;
                
            case 'rectangle':
                this.currentShape = new Konva.Rect({
                    x: minX,
                    y: minY,
                    width: width,
                    height: height,
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    name: 'stroke',
                });
                break;
                
            case 'triangle':
                this.currentShape = new Konva.Line({
                    points: [
                        centerX, minY,           // top
                        minX, maxY,              // bottom left  
                        maxX, maxY,              // bottom right
                        centerX, minY            // close
                    ],
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    closed: true,
                    name: 'stroke',
                });
                break;
                
            case 'line':
                const points = this.currentLine?.points() || [];
                const startX = points[0] || minX;
                const startY = points[1] || minY;
                const endX = points[points.length - 2] || maxX;
                const endY = points[points.length - 1] || maxY;
                
                this.currentShape = new Konva.Line({
                    points: [startX, startY, endX, endY],
                    stroke: strokeColor,
                    strokeWidth: strokeWidth,
                    lineCap: 'round',
                    name: 'stroke',
                });
                // For line, use start point as anchor
                this.shapeAnchor = { x: startX, y: startY };
                break;
        }
        
        if (this.currentShape) {
            this.layer.add(this.currentShape);
        }
    }

    private resizeShape(pos: { x: number; y: number }) {
        if (!this.currentShape || !this.shapeAnchor) return;
        
        const dx = pos.x - this.shapeAnchor.x;
        const dy = pos.y - this.shapeAnchor.y;
        
        switch (this.detectedShapeType) {
            case 'circle':
                const circle = this.currentShape as Konva.Circle;
                const radius = Math.sqrt(dx * dx + dy * dy);
                circle.radius(Math.max(5, radius));
                break;
                
            case 'oval':
                const ellipse = this.currentShape as Konva.Ellipse;
                ellipse.radiusX(Math.max(5, Math.abs(dx)));
                ellipse.radiusY(Math.max(5, Math.abs(dy)));
                break;
                
            case 'rectangle':
                const rect = this.currentShape as Konva.Rect;
                const newX = dx < 0 ? pos.x : this.shapeAnchor.x - Math.abs(dx);
                const newY = dy < 0 ? pos.y : this.shapeAnchor.y - Math.abs(dy);
                rect.x(newX);
                rect.y(newY);
                rect.width(Math.abs(dx) * 2);
                rect.height(Math.abs(dy) * 2);
                break;
                
            case 'triangle':
                const tri = this.currentShape as Konva.Line;
                const triWidth = Math.abs(dx) * 2;
                const triHeight = Math.abs(dy) * 2;
                const topY = this.shapeAnchor.y - triHeight / 2;
                const bottomY = this.shapeAnchor.y + triHeight / 2;
                const leftX = this.shapeAnchor.x - triWidth / 2;
                const rightX = this.shapeAnchor.x + triWidth / 2;
                tri.points([
                    this.shapeAnchor.x, topY,
                    leftX, bottomY,
                    rightX, bottomY,
                    this.shapeAnchor.x, topY
                ]);
                break;
                
            case 'line':
                const line = this.currentShape as Konva.Line;
                line.points([this.shapeAnchor.x, this.shapeAnchor.y, pos.x, pos.y]);
                break;
        }
        
        this.layer.batchDraw();
    }

    private finishShapeMode() {
        // Shape is already on the layer, just clean up
        this.currentShape = null;
    }

    private finishDrawing() {
        // Drawing is complete, line is already on layer
    }

    private detectShape() {
        if (!this.currentLine) return;
        
        const holdDuration = Date.now() - this.shapeStartTime;
        if (holdDuration < 500) return; // Must hold for at least 500ms

        const points = this.currentLine.points();
        if (points.length < 10) return; // Need enough points

        const shape = this.recognizeShape(points);
        if (shape) {
            this.currentLine.remove();
            this.layer.add(shape);
            this.currentShape = shape;
        }
    }

    private recognizeShape(points: number[]): Konva.Shape | null {
        if (points.length < 4) return null;

        // Extract x and y coordinates
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
            xs.push(points[i]);
            ys.push(points[i + 1]);
        }

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const width = maxX - minX;
        const height = maxY - minY;

        // Check if it's a line (very narrow in one dimension)
        if (this.isLine(points)) {
            return new Konva.Line({
                points: [xs[0], ys[0], xs[xs.length - 1], ys[ys.length - 1]],
                stroke: this.settings.pen.color,
                strokeWidth: this.settings.pen.thickness,
                lineCap: 'round',
            });
        }

        // Check if it's a circle
        if (this.isCircle(points, width, height)) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const radius = Math.min(width, height) / 2;

            return new Konva.Circle({
                x: centerX,
                y: centerY,
                radius: radius,
                stroke: this.settings.pen.color,
                strokeWidth: this.settings.pen.thickness,
            });
        }

        // Check if it's a rectangle
        if (this.isRectangle(points)) {
            return new Konva.Rect({
                x: minX,
                y: minY,
                width: width,
                height: height,
                stroke: this.settings.pen.color,
                strokeWidth: this.settings.pen.thickness,
            });
        }

        // Check if it's a triangle
        if (this.isTriangle(points)) {
            const topPoint = this.findTopPoint(points);
            const bottomLeft = { x: minX, y: maxY };
            const bottomRight = { x: maxX, y: maxY };

            return new Konva.Line({
                points: [
                    topPoint.x, topPoint.y,
                    bottomLeft.x, bottomLeft.y,
                    bottomRight.x, bottomRight.y,
                    topPoint.x, topPoint.y
                ],
                stroke: this.settings.pen.color,
                strokeWidth: this.settings.pen.thickness,
                closed: true,
            });
        }

        return null;
    }

    private isLine(points: number[]): boolean {
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
            xs.push(points[i]);
            ys.push(points[i + 1]);
        }

        const width = Math.max(...xs) - Math.min(...xs);
        const height = Math.max(...ys) - Math.min(...ys);

        return (width > height * 3 || height > width * 3);
    }

    private isCircle(points: number[], width: number, height: number): boolean {
        // Circle if width and height are similar
        const aspectRatio = Math.max(width, height) / Math.min(width, height);
        return aspectRatio < 1.3;
    }

    private isRectangle(points: number[]): boolean {
        // Check for 4 corners
        const corners = this.findCorners(points);
        return corners.length === 4;
    }

    private isTriangle(points: number[]): boolean {
        const corners = this.findCorners(points);
        return corners.length === 3;
    }

    private findCorners(points: number[]): { x: number; y: number }[] {
        // Simplified corner detection
        const corners: { x: number; y: number }[] = [];
        const threshold = 20; // degrees

        for (let i = 2; i < points.length - 2; i += 2) {
            const prev = { x: points[i - 2], y: points[i - 1] };
            const curr = { x: points[i], y: points[i + 1] };
            const next = { x: points[i + 2], y: points[i + 3] };

            const angle = this.getAngle(prev, curr, next);
            if (angle < 180 - threshold) {
                corners.push(curr);
            }
        }

        return corners;
    }

    private getAngle(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): number {
        const a = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        const b = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        return Math.abs(a - b) * (180 / Math.PI);
    }

    private findTopPoint(points: number[]): { x: number; y: number } {
        let topY = Infinity;
        let topX = 0;

        for (let i = 0; i < points.length; i += 2) {
            if (points[i + 1] < topY) {
                topY = points[i + 1];
                topX = points[i];
            }
        }

        return { x: topX, y: topY };
    }

    private createTextBox(pos: { x: number; y: number }) {
        const textNode = new Konva.Text({
            x: pos.x,
            y: pos.y,
            text: 'Double click to edit',
            fontSize: this.settings.text.fontSize,
            fontFamily: this.settings.text.fontFamily,
            fill: this.settings.text.color,
            draggable: true,
        });

        this.layer.add(textNode);

        // Enable text editing on double click
        textNode.on('dblclick dbltap', () => {
            this.editText(textNode);
        });

        this.onContentChange();
    }

    private editText(textNode: Konva.Text) {
        // Create textarea for editing
        const textPosition = textNode.getAbsolutePosition();
        const stage = textNode.getStage();
        if (!stage) return;

        const stageBox = stage.container().getBoundingClientRect();
        const areaPosition = {
            x: stageBox.left + textPosition.x,
            y: stageBox.top + textPosition.y,
        };

        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);

        textarea.value = textNode.text();
        textarea.style.position = 'absolute';
        textarea.style.top = areaPosition.y + 'px';
        textarea.style.left = areaPosition.x + 'px';
        textarea.style.fontSize = textNode.fontSize() + 'px';
        textarea.style.fontFamily = textNode.fontFamily();
        textarea.style.border = 'none';
        textarea.style.padding = '0px';
        textarea.style.margin = '0px';
        textarea.style.overflow = 'hidden';
        textarea.style.background = 'none';
        textarea.style.outline = 'none';
        textarea.style.resize = 'none';
        textarea.style.lineHeight = textNode.lineHeight().toString();
        textarea.style.transformOrigin = 'left top';
        textarea.style.textAlign = textNode.align();
        const fill = textNode.fill();
        textarea.style.color = typeof fill === 'string' ? fill : '#000000';

        textarea.focus();

        const removeTextarea = () => {
            textarea.parentNode?.removeChild(textarea);
            window.removeEventListener('click', handleOutsideClick);
            textNode.text(textarea.value);
            this.onContentChange();
        };

        const handleOutsideClick = (e: MouseEvent) => {
            if (e.target !== textarea) {
                removeTextarea();
            }
        };

        setTimeout(() => {
            window.addEventListener('click', handleOutsideClick);
        });

        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                removeTextarea();
            }
        });
    }

    private createTransformer(nodes: Konva.Shape[]) {
        const transformer = new Konva.Transformer({
            nodes: nodes,
            keepRatio: false,
            enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
        });

        this.layer.add(transformer);

        // Remove transformer when clicking outside
        const stage = this.layer.getStage();
        if (stage) {
            stage.on('click tap', (e) => {
                if (e.target === stage) {
                    transformer.remove();
                }
            });
        }
    }

    // Lasso selection state
    private lassoLine: Konva.Line | null = null;
    private lassoPoints: number[] = [];
    private selectedShapes: Konva.Shape[] = [];
    private selectionGroup: Konva.Group | null = null;
    private isDraggingSelection: boolean = false;
    private dragStartPos: { x: number; y: number } | null = null;
    private lassoPath: Konva.Line | null = null; // The visible lasso outline after selection
    private marchingAntsAnimationId: number | null = null;
    private selectionCenter: { x: number; y: number } = { x: 0, y: 0 };

    private startSelection(pos: { x: number; y: number }) {
        // Check if clicking inside existing selection to drag
        if (this.lassoPath && this.selectedShapes.length > 0) {
            if (this.isPointInLasso(pos.x, pos.y)) {
                this.isDraggingSelection = true;
                this.dragStartPos = pos;
                return;
            } else {
                // Clicking outside - clear selection
                this.clearSelection();
            }
        }

        // Start new lasso
        this.lassoPoints = [pos.x, pos.y];
        this.lassoLine = new Konva.Line({
            points: this.lassoPoints,
            stroke: '#888888',
            strokeWidth: 1.5,
            dash: [6, 4],
            opacity: 0.7,
            lineCap: 'round',
            lineJoin: 'round',
            closed: false,
            name: 'lasso-drawing',
        });

        this.layer.add(this.lassoLine);
    }

    private continueSelection(pos: { x: number; y: number }) {
        // Handle dragging selected items
        if (this.isDraggingSelection && this.dragStartPos) {
            const dx = pos.x - this.dragStartPos.x;
            const dy = pos.y - this.dragStartPos.y;

            // Move all selected shapes
            this.selectedShapes.forEach(shape => {
                shape.x(shape.x() + dx);
                shape.y(shape.y() + dy);
            });

            // Move the lasso path
            if (this.lassoPath) {
                const points = this.lassoPath.points();
                const newPoints: number[] = [];
                for (let i = 0; i < points.length; i += 2) {
                    newPoints.push(points[i] + dx);
                    newPoints.push(points[i + 1] + dy);
                }
                this.lassoPath.points(newPoints);
                // Update the stored lasso points too
                this.lassoPoints = newPoints;
            }

            this.dragStartPos = pos;
            this.layer.batchDraw();
            return;
        }

        // Continue drawing lasso
        if (!this.lassoLine) return;

        this.lassoPoints.push(pos.x, pos.y);
        this.lassoLine.points(this.lassoPoints);
        this.layer.batchDraw();
    }

    private finishSelection() {
        // Handle end of drag
        if (this.isDraggingSelection) {
            this.isDraggingSelection = false;
            this.dragStartPos = null;
            this.onContentChange();
            return;
        }

        if (!this.lassoLine || this.lassoPoints.length < 6) {
            // Not enough points for a selection
            if (this.lassoLine) {
                this.lassoLine.destroy();
                this.lassoLine = null;
            }
            this.lassoPoints = [];
            return;
        }

        // Close the lasso path by adding start point to end
        this.lassoPoints.push(this.lassoPoints[0], this.lassoPoints[1]);
        
        // Remove the drawing line
        this.lassoLine.destroy();
        this.lassoLine = null;

        // Find all shapes that intersect with lasso
        this.selectedShapes = [];
        this.layer.children.forEach((child) => {
            if (child.name() === 'stroke' || child.name() === 'shape') {
                if (this.shapeIntersectsLasso(child as Konva.Shape)) {
                    this.selectedShapes.push(child as Konva.Shape);
                }
            }
        });

        // Create visual feedback
        if (this.selectedShapes.length > 0) {
            // Calculate selection center for scaling
            this.calculateSelectionCenter();
            
            // Active selection - show solid colored lasso
            this.lassoPath = new Konva.Line({
                points: this.lassoPoints,
                stroke: '#0066ff',
                strokeWidth: 2,
                dash: [6, 4],
                dashOffset: 0,
                opacity: 1,
                lineCap: 'round',
                lineJoin: 'round',
                closed: true,
                name: 'lasso-path',
            });
            this.layer.add(this.lassoPath);

            // Start marching ants animation
            this.startMarchingAnts();

            // Highlight selected shapes
            this.selectedShapes.forEach(shape => {
                shape.opacity(shape.opacity() * 0.8);
            });
        } else {
            // No selection - clear
            this.lassoPoints = [];
        }

        this.layer.batchDraw();
    }

    private calculateSelectionCenter() {
        if (this.lassoPoints.length < 2) return;
        
        let sumX = 0, sumY = 0;
        const numPoints = this.lassoPoints.length / 2;
        for (let i = 0; i < this.lassoPoints.length; i += 2) {
            sumX += this.lassoPoints[i];
            sumY += this.lassoPoints[i + 1];
        }
        this.selectionCenter = {
            x: sumX / numPoints,
            y: sumY / numPoints
        };
    }

    private startMarchingAnts() {
        if (this.marchingAntsAnimationId) {
            cancelAnimationFrame(this.marchingAntsAnimationId);
        }

        let offset = 0;
        const animate = () => {
            if (!this.lassoPath) return;
            
            offset -= 0.5;
            if (offset < -20) offset = 0;
            
            this.lassoPath.dashOffset(offset);
            this.layer.batchDraw();
            
            this.marchingAntsAnimationId = requestAnimationFrame(animate);
        };
        
        this.marchingAntsAnimationId = requestAnimationFrame(animate);
    }

    private clearSelection() {
        // Stop marching ants animation
        if (this.marchingAntsAnimationId) {
            cancelAnimationFrame(this.marchingAntsAnimationId);
            this.marchingAntsAnimationId = null;
        }

        // Restore opacity of selected shapes
        this.selectedShapes.forEach(shape => {
            // Restore original opacity (inverse of 0.8 multiplication)
            shape.opacity(shape.opacity() / 0.8);
        });

        // Remove lasso path
        if (this.lassoPath) {
            this.lassoPath.destroy();
            this.lassoPath = null;
        }

        this.selectedShapes = [];
        this.lassoPoints = [];
        this.isDraggingSelection = false;
        this.dragStartPos = null;
        this.layer.batchDraw();
    }

    // Check if there's an active selection
    hasActiveSelection(): boolean {
        return this.selectedShapes.length > 0 && this.lassoPath !== null;
    }

    // Check if a point is within the selection area
    isPointInSelection(x: number, y: number): boolean {
        return this.hasActiveSelection() && this.isPointInLasso(x, y);
    }

    // Scale the selection by a factor around its center
    scaleSelection(scaleFactor: number) {
        if (!this.hasActiveSelection()) return;

        const cx = this.selectionCenter.x;
        const cy = this.selectionCenter.y;

        // Scale each selected shape around the center
        this.selectedShapes.forEach(shape => {
            if (shape instanceof Konva.Line) {
                // Scale line points
                const points = shape.points();
                const newPoints: number[] = [];
                for (let i = 0; i < points.length; i += 2) {
                    const px = points[i];
                    const py = points[i + 1];
                    newPoints.push(cx + (px - cx) * scaleFactor);
                    newPoints.push(cy + (py - cy) * scaleFactor);
                }
                shape.points(newPoints);
                // Also scale stroke width
                shape.strokeWidth(shape.strokeWidth() * scaleFactor);
            } else {
                // Scale position
                const sx = shape.x();
                const sy = shape.y();
                shape.x(cx + (sx - cx) * scaleFactor);
                shape.y(cy + (sy - cy) * scaleFactor);
                
                // Scale size based on shape type
                if (shape instanceof Konva.Circle) {
                    shape.radius(shape.radius() * scaleFactor);
                } else if (shape instanceof Konva.Ellipse) {
                    shape.radiusX(shape.radiusX() * scaleFactor);
                    shape.radiusY(shape.radiusY() * scaleFactor);
                } else if (shape instanceof Konva.Rect) {
                    shape.width(shape.width() * scaleFactor);
                    shape.height(shape.height() * scaleFactor);
                }
                shape.strokeWidth(shape.strokeWidth() * scaleFactor);
            }
        });

        // Scale the lasso path
        if (this.lassoPath) {
            const newLassoPoints: number[] = [];
            for (let i = 0; i < this.lassoPoints.length; i += 2) {
                const px = this.lassoPoints[i];
                const py = this.lassoPoints[i + 1];
                newLassoPoints.push(cx + (px - cx) * scaleFactor);
                newLassoPoints.push(cy + (py - cy) * scaleFactor);
            }
            this.lassoPoints = newLassoPoints;
            this.lassoPath.points(newLassoPoints);
            this.lassoPath.strokeWidth(this.lassoPath.strokeWidth() * scaleFactor);
        }

        this.layer.batchDraw();
        this.onContentChange();
    }

    private isPointInLasso(x: number, y: number): boolean {
        if (this.lassoPoints.length < 6) return false;

        // Ray casting algorithm for point in polygon
        let inside = false;
        const points = this.lassoPoints;
        
        for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
            const xi = points[i], yi = points[i + 1];
            const xj = points[j], yj = points[j + 1];

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    private shapeIntersectsLasso(shape: Konva.Shape): boolean {
        // Get shape bounding box or points
        if (shape instanceof Konva.Line) {
            const points = shape.points();
            // Check if any point of the stroke is inside the lasso
            for (let i = 0; i < points.length; i += 2) {
                if (this.isPointInLasso(points[i], points[i + 1])) {
                    return true;
                }
            }
            return false;
        } else if (shape instanceof Konva.Circle) {
            // Check center and cardinal points
            const cx = shape.x(), cy = shape.y(), r = shape.radius();
            return this.isPointInLasso(cx, cy) ||
                   this.isPointInLasso(cx + r, cy) ||
                   this.isPointInLasso(cx - r, cy) ||
                   this.isPointInLasso(cx, cy + r) ||
                   this.isPointInLasso(cx, cy - r);
        } else if (shape instanceof Konva.Ellipse) {
            const cx = shape.x(), cy = shape.y();
            const rx = shape.radiusX(), ry = shape.radiusY();
            return this.isPointInLasso(cx, cy) ||
                   this.isPointInLasso(cx + rx, cy) ||
                   this.isPointInLasso(cx - rx, cy) ||
                   this.isPointInLasso(cx, cy + ry) ||
                   this.isPointInLasso(cx, cy - ry);
        } else if (shape instanceof Konva.Rect) {
            const x = shape.x(), y = shape.y();
            const w = shape.width(), h = shape.height();
            // Check corners and center
            return this.isPointInLasso(x, y) ||
                   this.isPointInLasso(x + w, y) ||
                   this.isPointInLasso(x, y + h) ||
                   this.isPointInLasso(x + w, y + h) ||
                   this.isPointInLasso(x + w/2, y + h/2);
        }
        
        // Fallback: check bounding box center
        const box = shape.getClientRect();
        return this.isPointInLasso(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Serialization methods
    serializeStrokes(): SerializedStroke[] {
        const strokes: SerializedStroke[] = [];

        this.layer.children.forEach((child) => {
            if (child instanceof Konva.Line && 
                child.attrs.globalCompositeOperation !== 'destination-out' &&
                child.name() !== 'lasso-drawing' && 
                child.name() !== 'lasso-path') {
                const isHighlighter = (child.attrs.opacity || 1) < 1;
                
                const strokeColor = child.stroke();
                strokes.push({
                    type: isHighlighter ? 'highlighter' : 'pen',
                    points: child.points(),
                    color: typeof strokeColor === 'string' ? strokeColor : '#000000',
                    thickness: child.strokeWidth() || 1,
                    opacity: child.opacity() || 1,
                });
            }
        });

        return strokes;
    }

    serializeShapes(): SerializedShape[] {
        const shapes: SerializedShape[] = [];

        this.layer.children.forEach((child) => {
            if (child instanceof Konva.Rect && !(child instanceof Konva.Transformer) && child.name() !== 'lasso-path') {
                const strokeColor = child.stroke();
                shapes.push({
                    type: 'rectangle',
                    x: child.x(),
                    y: child.y(),
                    width: child.width(),
                    height: child.height(),
                    color: typeof strokeColor === 'string' ? strokeColor : '#000000',
                    thickness: child.strokeWidth() || 1,
                    opacity: child.opacity() || 1,
                });
            } else if (child instanceof Konva.Circle) {
                const strokeColor = child.stroke();
                shapes.push({
                    type: 'circle',
                    x: child.x(),
                    y: child.y(),
                    radius: child.radius(),
                    color: typeof strokeColor === 'string' ? strokeColor : '#000000',
                    thickness: child.strokeWidth() || 1,
                    opacity: child.opacity() || 1,
                });
            }
        });

        return shapes;
    }
}