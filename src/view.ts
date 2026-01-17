import { TextFileView, WorkspaceLeaf, TFile, Menu, Notice } from 'obsidian';
import Konva from 'konva';
import { 
    NotaFileData, 
    ToolType, 
    createDefaultNotaFile, 
    SerializedPage,
    Page,
    createEmptyPage,
    getPageDimensions,
    PageSize,
    BackgroundSettings
} from './types';
import { DrawingTools } from './tools';
import { PageManager } from './pageManager';
import { ImportExport } from './importExport';

export const DRAWING_VIEW_TYPE = "DrawingView";

export class DrawingView extends TextFileView {
    private plugin: any;
    private saveInterval: NodeJS.Timeout | null = null;
    private saveDebounceTimer: NodeJS.Timeout | null = null;
    private pageCheckTimer: NodeJS.Timeout | null = null;
    private isDirty: boolean = false;
    private isSaving: boolean = false;
    private pageManager: PageManager | null = null;
    private currentTools: DrawingTools | null = null;
    private pageTools: Map<string, DrawingTools> = new Map();
    private pageStages: Map<string, Konva.Stage> = new Map();
    private currentTool: ToolType = 'pen';
    private notaData: NotaFileData | null = null;
    private notaContainerEl: HTMLDivElement | null = null;
    private currentPageId: string | null = null;
    private viewportState = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    };
    private isPanning = false;
    private lastPanPosition = { x: 0, y: 0 };
    private panVelocity = { x: 0, y: 0 };
    private lastPanTime = 0;
    private momentumAnimationId: number | null = null;
    private panHistory: Array<{ x: number; y: number; time: number }> = [];
    
    // Pinch zoom state
    private lastPinchDistance: number = 0;
    private isPinching: boolean = false;
    
    // Undo/Redo state
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private isUndoRedoing: boolean = false;
    private undoDebounceTimer: NodeJS.Timeout | null = null;
    private maxUndoSteps: number = 50;

    constructor(leaf: WorkspaceLeaf, plugin: any) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return DRAWING_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.file?.basename || "Nota";
    }

    // Public getters for export functionality
    getNotaData(): NotaFileData | null {
        return this.notaData;
    }

    getPageManager(): PageManager | null {
        return this.pageManager;
    }

    getViewData(): string {
        if (!this.notaData) return '';
        return JSON.stringify(this.notaData, null, 2);
    }

    setViewData(data: string, clear: boolean): void {
        // Skip re-render if we're the ones who triggered the save
        if (this.isSaving) {
            return;
        }
        
        if (clear) {
            this.notaData = null;
        }

        if (!data || data.trim() === '') {
            // Create new nota file
            this.notaData = createDefaultNotaFile(this.plugin.settings.defaultPagesize || 'A4');
        } else {
            try {
                this.notaData = JSON.parse(data);
                
                // Validate and ensure at least one page exists
                if (this.notaData && (!this.notaData.pages || this.notaData.pages.length === 0)) {
                    const background: BackgroundSettings = {
                        type: this.plugin.settings.defaultBackground || 'solid',
                        color: this.plugin.settings.color || '#ffffff',
                    };
                    this.notaData.pages = [
                        createEmptyPage('page-1', this.notaData.pageSize || 'A4', background)
                    ];
                }
            } catch (e) {
                console.error('Failed to parse nota file:', e);
                this.notaData = createDefaultNotaFile(this.plugin.settings.defaultPagesize || 'A4');
            }
        }

        // Trigger render if container is ready
        if (this.notaContainerEl) {
            this.renderNota();
        }
    }

    clear(): void {
        if (this.pageManager) {
            this.pageManager.destroy();
            this.pageManager = null;
        }
        if (this.notaContainerEl) {
            this.notaContainerEl.empty();
        }
    }

    async onOpen() {
        const container = this.contentEl;
        container.empty();
        container.addClass('nota-view');

        // Create main container
        this.notaContainerEl = container.createDiv({ cls: 'nota-container' });
        
        // Setup toolbar actions
        this.setupToolbar();

        // Render nota if data is loaded
        if (this.notaData) {
            this.renderNota();
        }

        // Start autosave (every 40 seconds, only if dirty)
        this.saveInterval = setInterval(async () => {
            if (this.isDirty) {
                await this.saveDrawing();
            }
        }, 40000); // Save every 40 seconds if dirty
    }

    private setupToolbar() {
        // Hand tool
        this.addAction('hand-metal', 'Hand', (evt) => {
            if (this.currentTool === 'hand') {
                this.showToolOptions('hand');
            } else {
                this.setTool('hand');
            }
        });

        // Pen tool
        this.addAction('pencil', 'Pen', (evt) => {
            if (this.currentTool === 'pen') {
                this.showToolOptions('pen');
            } else {
                this.setTool('pen');
            }
        });

        // Highlighter tool
        this.addAction('highlighter', 'Highlighter', (evt) => {
            if (this.currentTool === 'highlighter') {
                this.showToolOptions('highlighter');
            } else {
                this.setTool('highlighter');
            }
        });

        // Eraser tool
        this.addAction('eraser', 'Eraser', (evt) => {
            if (this.currentTool === 'eraser') {
                this.showToolOptions('eraser');
            } else {
                this.setTool('eraser');
            }
        });

        // Text tool
        this.addAction('text', 'Text', (evt) => {
            if (this.currentTool === 'text') {
                this.showToolOptions('text');
            } else {
                this.setTool('text');
            }
        });

        // Selection tool
        this.addAction('lasso-select', 'Select', (evt) => {
            if (this.currentTool === 'select') {
                this.showToolOptions('select');
            } else {
                this.setTool('select');
            }
        });

        // Spacer
        this.addAction('separator', '', () => {});

        // Redo
        this.addAction('redo', 'Redo', () => {
            this.redo();
        });

        // Undo
        this.addAction('undo', 'Undo', () => {
            this.undo();
        });

        // Set default tool after a short delay to ensure buttons are in DOM
        setTimeout(() => {
            this.setTool('pen');
        }, 100);
    }

    private setTool(tool: ToolType) {
        this.currentTool = tool;
        
        // Update tool on ALL pages so switching pages works correctly
        this.pageTools.forEach((tools) => {
            tools.setTool(tool);
        });
        
        this.highlightToolButton(tool);
        
        // Add data attribute to container for cursor styling
        if (this.notaContainerEl) {
            this.notaContainerEl.setAttribute('data-tool', tool);
        }
    }

    private highlightToolButton(tool: ToolType) {
        // Use the leaf's view-actions container
        const viewActionsContainer = this.leaf.view.containerEl.querySelector('.view-actions');
        if (!viewActionsContainer) {
            console.warn('View actions container not found');
            return;
        }

        // Remove active class from all tool buttons
        const actionButtons = viewActionsContainer.querySelectorAll('.view-action, .clickable-icon');
        actionButtons.forEach(btn => {
            btn.classList.remove('is-active');
            btn.removeAttribute('data-active');
            (btn as HTMLElement).style.backgroundColor = '';
            (btn as HTMLElement).style.color = '';
        });

        const toolNameMap: Record<ToolType, string> = {
            'hand': 'Hand',
            'pen': 'Pen',
            'highlighter': 'Highlighter',
            'eraser': 'Eraser',
            'text': 'Text',
            'select': 'Select',
        };

        const toolName = toolNameMap[tool];
        
        // Debug: log all available buttons
        console.log('Available buttons:', Array.from(actionButtons).map(b => b.getAttribute('aria-label')));
        
        // Find the button by aria-label
        const actionButton = Array.from(actionButtons).find(
            btn => btn.getAttribute('aria-label') === toolName
        ) as HTMLElement;
        
        if (actionButton) {
            actionButton.classList.add('is-active');
            actionButton.setAttribute('data-active', 'true');
            actionButton.style.backgroundColor = 'var(--interactive-accent)';
            actionButton.style.color = 'var(--text-on-accent)';
            
            // Force repaint
            void actionButton.offsetHeight;
            
            console.log(`Tool "${tool}" activated, button classes:`, actionButton.className);
        } else {
            console.warn(`Tool button not found for: ${toolName}`);
            console.warn('Tried to find among:', Array.from(actionButtons).map(b => b.getAttribute('aria-label')));
        }
    }

    private showToolOptions(tool: ToolType) {
        // TODO: Implement tool options panel
        new Notice(`${tool} options - coming soon`);
    }

    private renderNota() {
        if (!this.notaContainerEl || !this.notaData) return;

        this.notaContainerEl.empty();

        // Create scroll container
        const scrollContainer = this.notaContainerEl.createDiv({ cls: 'nota-scroll-container' });
        
        // Create page manager
        this.pageManager = new PageManager(
            scrollContainer,
            this.notaData.pageSize,
            () => this.onContentChange()
        );

        // Clear previous page tools
        this.pageTools.clear();
        this.pageStages.clear();

        // Load pages
        this.notaData.pages.forEach((serializedPage, index) => {
            const page = this.pageManager!.addPage(serializedPage);
            
            // Create Konva stage for this page
            const stage = new Konva.Stage({
                container: page.container!,
                width: page.width,
                height: page.height,
            });

            // Add layer to stage
            if (page.layer) {
                stage.add(page.layer);
            }

            // Initialize drawing tools for this page
            const tools = new DrawingTools(
                page.layer!,
                this.notaData!.settings,
                () => this.onContentChange()
            );
            this.pageTools.set(page.id, tools);
            
            // Set current tools to the first page's tools
            if (index === 0) {
                this.currentTools = tools;
                this.currentTools.setTool(this.currentTool);
            }

            // Load page content
            this.pageManager!.loadPage(page.id, serializedPage, tools);

            // Setup event handlers
            this.setupStageEvents(stage, page.id, tools);
            this.pageStages.set(page.id, stage);
        });

        // Ensure there's always a blank page at the end
        this.ensureBlankLastPage();
        
        // Capture initial state for undo
        this.undoStack = [];
        this.redoStack = [];
        this.captureUndoState();

        // Setup scroll handler
        scrollContainer.addEventListener('scroll', () => {
            this.pageManager?.updateVisiblePages();
        });

        // Setup wheel zoom
        this.setupZoomHandlers(scrollContainer);

        // Restore viewport state after DOM is ready
        // Use requestAnimationFrame to ensure layout is complete
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.notaData?.viewState) {
                    // Restore saved viewport state
                    const viewState = this.notaData.viewState;
                    
                    // Restore zoom level first
                    if (viewState.scale && viewState.scale !== 1) {
                        this.viewportState.scale = viewState.scale;
                        this.applyZoom();
                    }
                    
                    // Restore scroll position
                    scrollContainer.scrollTop = viewState.scrollTop || 0;
                    scrollContainer.scrollLeft = viewState.scrollLeft || 0;
                    console.log('Restored view state:', viewState);
                } else {
                    // New file or no saved state - center the first page horizontally
                    this.centerViewHorizontally(scrollContainer);
                }
                
                // Reveal the container with fade-in
                scrollContainer.classList.add('nota-ready');
            });
        });
    }

    private centerViewHorizontally(scrollContainer: HTMLElement) {
        // Center the scroll container horizontally on the page content
        const contentWidth = scrollContainer.scrollWidth;
        const viewWidth = scrollContainer.clientWidth;
        
        if (contentWidth > viewWidth) {
            scrollContainer.scrollLeft = (contentWidth - viewWidth) / 2;
        }
    }

    private setupStageEvents(stage: Konva.Stage, pageId: string, tools: DrawingTools) {
        // Prevent default touch behavior to stop scroll jumping
        const container = stage.container();
        container.style.touchAction = 'none';
        
        // Mouse/touch down
        stage.on('mousedown touchstart', (e) => {
            // Prevent any scroll behavior
            e.evt.preventDefault();
            
            // Switch to this page's tools and update current page
            this.currentPageId = pageId;
            this.currentTools = this.pageTools.get(pageId) || tools;
            
            // Ensure this page's tools have the correct tool selected
            if (this.currentTools) {
                this.currentTools.setTool(this.currentTool);
            }
            
            if (this.currentTool === 'hand') {
                this.startPanning(e.evt);
            } else if (this.currentTools) {
                this.currentTools.handlePointerDown(e, stage);
            }
        });

        // Mouse/touch move
        stage.on('mousemove touchmove', (e) => {
            // Prevent any scroll behavior during drawing
            if (this.currentTools?.getIsDrawing() || this.isPanning) {
                e.evt.preventDefault();
            }
            
            if (this.isPanning && this.currentTool === 'hand') {
                this.continuePanning(e.evt);
            } else if (this.currentTools) {
                this.currentTools.handlePointerMove(e, stage);
            }
        });

        // Mouse/touch up
        stage.on('mouseup touchend', (e) => {
            e.evt.preventDefault();
            
            if (this.isPanning) {
                this.endPanning();
            } else if (this.currentTools) {
                this.currentTools.handlePointerUp(e, stage);
            }
        });
    }
    
    private getEventPosition(e: MouseEvent | TouchEvent): { x: number; y: number } {
        if (e instanceof TouchEvent && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e instanceof TouchEvent && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        } else if (e instanceof MouseEvent) {
            return { x: e.clientX, y: e.clientY };
        }
        return { x: 0, y: 0 };
    }
    
    private startPanning(e: MouseEvent | TouchEvent) {
        // Cancel any ongoing momentum animation
        if (this.momentumAnimationId) {
            cancelAnimationFrame(this.momentumAnimationId);
            this.momentumAnimationId = null;
        }
        
        this.isPanning = true;
        const pos = this.getEventPosition(e);
        this.lastPanPosition = pos;
        this.lastPanTime = performance.now();
        this.panHistory = [{ ...pos, time: this.lastPanTime }];
        this.panVelocity = { x: 0, y: 0 };
    }
    
    private continuePanning(e: MouseEvent | TouchEvent) {
        if (!this.isPanning || !this.notaContainerEl) return;
        
        const pos = this.getEventPosition(e);
        const now = performance.now();
        
        const dx = this.lastPanPosition.x - pos.x;
        const dy = this.lastPanPosition.y - pos.y;
        
        const scrollContainer = this.notaContainerEl.querySelector('.nota-scroll-container') as HTMLElement;
        if (scrollContainer) {
            scrollContainer.scrollLeft += dx;
            scrollContainer.scrollTop += dy;
        }
        
        // Track history for momentum calculation (keep last 100ms)
        this.panHistory.push({ ...pos, time: now });
        this.panHistory = this.panHistory.filter(p => now - p.time < 100);
        
        this.lastPanPosition = pos;
        this.lastPanTime = now;
    }
    
    private endPanning() {
        if (!this.isPanning) return;
        
        this.isPanning = false;
        
        // Calculate velocity from recent history
        const now = performance.now();
        const recentHistory = this.panHistory.filter(p => now - p.time < 100);
        
        if (recentHistory.length >= 2) {
            const oldest = recentHistory[0];
            const newest = recentHistory[recentHistory.length - 1];
            const dt = (newest.time - oldest.time) / 1000; // Convert to seconds
            
            if (dt > 0) {
                // Velocity in pixels per second
                this.panVelocity = {
                    x: (oldest.x - newest.x) / dt,
                    y: (oldest.y - newest.y) / dt
                };
                
                // Only start momentum if velocity is significant
                const speed = Math.sqrt(this.panVelocity.x ** 2 + this.panVelocity.y ** 2);
                if (speed > 50) {
                    this.startMomentumScroll();
                }
            }
        }
    }
    
    private startMomentumScroll() {
        if (!this.notaContainerEl) return;
        
        const scrollContainer = this.notaContainerEl.querySelector('.nota-scroll-container') as HTMLElement;
        if (!scrollContainer) return;
        
        const friction = 0.95; // Deceleration factor (lower = more friction)
        const bounceStiffness = 0.1; // How strongly it bounces back
        const minVelocity = 0.5; // Stop when velocity is this low
        
        let lastTime = performance.now();
        
        const animate = () => {
            const now = performance.now();
            const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap dt to prevent jumps
            lastTime = now;
            
            // Apply velocity
            scrollContainer.scrollLeft += this.panVelocity.x * dt;
            scrollContainer.scrollTop += this.panVelocity.y * dt;
            
            // Check for bounce at edges
            const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
            const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
            
            // Bounce effect at edges
            if (scrollContainer.scrollLeft <= 0) {
                this.panVelocity.x = Math.abs(this.panVelocity.x) * bounceStiffness;
                scrollContainer.scrollLeft = 0;
            } else if (scrollContainer.scrollLeft >= maxScrollLeft) {
                this.panVelocity.x = -Math.abs(this.panVelocity.x) * bounceStiffness;
                scrollContainer.scrollLeft = maxScrollLeft;
            }
            
            if (scrollContainer.scrollTop <= 0) {
                this.panVelocity.y = Math.abs(this.panVelocity.y) * bounceStiffness;
                scrollContainer.scrollTop = 0;
            } else if (scrollContainer.scrollTop >= maxScrollTop) {
                this.panVelocity.y = -Math.abs(this.panVelocity.y) * bounceStiffness;
                scrollContainer.scrollTop = maxScrollTop;
            }
            
            // Apply friction
            this.panVelocity.x *= friction;
            this.panVelocity.y *= friction;
            
            // Continue animation if still moving
            const speed = Math.sqrt(this.panVelocity.x ** 2 + this.panVelocity.y ** 2);
            if (speed > minVelocity) {
                this.momentumAnimationId = requestAnimationFrame(animate);
            } else {
                this.momentumAnimationId = null;
            }
        };
        
        this.momentumAnimationId = requestAnimationFrame(animate);
    }

    private setupZoomHandlers(container: HTMLElement) {
        container.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                
                // Get mouse position relative to container
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top + container.scrollTop;
                
                // Check if current tool has an active selection and mouse is within it
                if (this.currentTool === 'select' && this.currentTools) {
                    // Convert mouse position to stage coordinates
                    const scale = this.viewportState.scale;
                    const stageX = mouseX / scale;
                    const stageY = mouseY / scale;
                    
                    if (this.currentTools.isPointInSelection(stageX, stageY)) {
                        // Scale the selection instead of zooming
                        const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
                        this.currentTools.scaleSelection(scaleFactor);
                        return;
                    }
                }
                
                // Calculate new scale
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const oldScale = this.viewportState.scale;
                const newScale = Math.max(0.25, Math.min(3, oldScale * delta));
                
                if (newScale === oldScale) return;
                
                this.viewportState.scale = newScale;
                
                // Apply zoom to all pages
                this.applyZoom();
                
                // Adjust scroll to zoom toward mouse position
                const scaleRatio = newScale / oldScale;
                const newScrollTop = mouseY * scaleRatio - (e.clientY - rect.top);
                container.scrollTop = Math.max(0, newScrollTop);
            }
        }, { passive: false });
        
        // Pinch zoom for touch devices
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                this.isPinching = true;
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                this.lastPinchDistance = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: false });
        
        container.addEventListener('touchmove', (e) => {
            if (this.isPinching && e.touches.length === 2) {
                e.preventDefault();
                
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (this.lastPinchDistance > 0) {
                    const scaleFactor = distance / this.lastPinchDistance;
                    
                    // Get pinch center
                    const rect = container.getBoundingClientRect();
                    const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top + container.scrollTop;
                    
                    // Check if select tool has active selection and pinch center is within it
                    if (this.currentTool === 'select' && this.currentTools) {
                        const scale = this.viewportState.scale;
                        const stageX = centerX / scale;
                        const stageY = centerY / scale;
                        
                        if (this.currentTools.isPointInSelection(stageX, stageY)) {
                            // Scale the selection
                            this.currentTools.scaleSelection(scaleFactor);
                            this.lastPinchDistance = distance;
                            return;
                        }
                    }
                    
                    // Regular zoom
                    const oldScale = this.viewportState.scale;
                    const newScale = Math.max(0.25, Math.min(3, oldScale * scaleFactor));
                    
                    if (newScale !== oldScale) {
                        this.viewportState.scale = newScale;
                        this.applyZoom();
                        
                        const scaleRatio = newScale / oldScale;
                        const newScrollTop = centerY * scaleRatio - (centerY - container.scrollTop);
                        container.scrollTop = Math.max(0, newScrollTop);
                    }
                }
                
                this.lastPinchDistance = distance;
            }
        }, { passive: false });
        
        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.isPinching = false;
                this.lastPinchDistance = 0;
            }
        }, { passive: false });
    }
    
    private applyZoom() {
        const scale = this.viewportState.scale;
        
        // Scale each page using Konva stage scale for proper rendering
        this.pageStages.forEach((stage, pageId) => {
            stage.scale({ x: scale, y: scale });
            
            // Update stage size to match scaled dimensions
            const page = this.pageManager?.getAllPages().find(p => p.id === pageId);
            if (page) {
                stage.width(page.width * scale);
                stage.height(page.height * scale);
                
                // Update container size
                if (page.container) {
                    page.container.style.width = `${page.width * scale}px`;
                    page.container.style.height = `${page.height * scale}px`;
                }
            }
            
            stage.batchDraw();
        });
    }

    private ensureBlankLastPage() {
        if (!this.notaData || !this.pageManager || !this.notaContainerEl) return;

        const pages = this.pageManager.getAllPages();
        if (pages.length === 0) return;
        
        const lastPage = pages[pages.length - 1];
        
        // Check if the last page has any content in the layer
        let hasContent = false;
        if (lastPage.layer) {
            const children = lastPage.layer.getChildren();
            for (const child of children) {
                if (child.name() !== 'background') {
                    hasContent = true;
                    break;
                }
            }
        }

        if (hasContent) {
            // Save current scroll position
            const scrollContainer = this.notaContainerEl.querySelector('.nota-scroll-container') as HTMLElement;
            const scrollTop = scrollContainer?.scrollTop || 0;
            const scrollLeft = scrollContainer?.scrollLeft || 0;
            
            // Add a new blank page with full initialization
            const newPageId = `page-${Date.now()}`;
            const background: BackgroundSettings = {
                type: this.plugin.settings.defaultBackground || 'solid',
                color: this.plugin.settings.backgroundColor || '#ffffff',
            };
            
            const newSerializedPage = createEmptyPage(newPageId, this.notaData.pageSize, background);
            this.notaData.pages.push(newSerializedPage);
            
            // Add page and fully initialize it
            const newPage = this.pageManager.addPage(newSerializedPage);
            this.initializePage(newPage, newSerializedPage);
            
            // Restore scroll position after a brief delay
            if (scrollContainer) {
                requestAnimationFrame(() => {
                    scrollContainer.scrollTop = scrollTop;
                    scrollContainer.scrollLeft = scrollLeft;
                });
            }
        }
    }

    private initializePage(page: Page, serializedPage: SerializedPage) {
        if (!page.container || !this.pageManager || !this.notaData) return;

        console.log('initializePage:', page.id, 'background:', serializedPage.background);

        // Create Konva stage for this page
        const stage = new Konva.Stage({
            container: page.container,
            width: page.width,
            height: page.height,
        });

        // Ensure layer exists
        if (!page.layer) {
            page.layer = new Konva.Layer();
        }
        
        // Add layer to stage
        stage.add(page.layer);

        // Initialize drawing tools for this page
        const tools = new DrawingTools(
            page.layer,
            this.notaData.settings,
            () => this.onContentChange()
        );
        this.pageTools.set(page.id, tools);
        tools.setTool(this.currentTool);

        // Load page content (creates background)
        this.pageManager.loadPage(page.id, serializedPage, tools);
        
        // Force redraw
        page.layer.batchDraw();

        // Setup event handlers
        this.setupStageEvents(stage, page.id, tools);
        this.pageStages.set(page.id, stage);
        
        // Apply current zoom level
        this.applyZoom();
    }

    private onContentChange() {
        // Mark content as changed
        this.isDirty = true;
        
        // Capture state for undo (debounced to batch rapid changes)
        if (!this.isUndoRedoing) {
            if (this.undoDebounceTimer) {
                clearTimeout(this.undoDebounceTimer);
            }
            this.undoDebounceTimer = setTimeout(() => {
                this.captureUndoState();
            }, 300); // Capture state 300ms after last change
        }
        
        // Debounce page check - only check for new page after drawing stops
        if (this.pageCheckTimer) {
            clearTimeout(this.pageCheckTimer);
        }
        this.pageCheckTimer = setTimeout(() => {
            this.ensureBlankLastPage();
        }, 1000); // Wait 1 second after last change
        
        // Debounce save - save 500ms after last change (pen up)
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(async () => {
            if (this.isDirty) {
                await this.saveDrawing();
            }
        }, 500);
    }

    private captureUndoState() {
        if (!this.pageManager || !this.notaData) return;
        
        // Serialize current state
        const pages = this.pageManager.getAllPages();
        const serializedPages = pages
            .map(page => this.pageManager!.serializePage(page.id))
            .filter(page => page !== null) as SerializedPage[];
        
        const stateSnapshot = JSON.stringify(serializedPages);
        
        // Only add if different from last state
        if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== stateSnapshot) {
            this.undoStack.push(stateSnapshot);
            
            // Limit stack size
            if (this.undoStack.length > this.maxUndoSteps) {
                this.undoStack.shift();
            }
            
            // Clear redo stack on new action
            this.redoStack = [];
            
            console.log('Captured undo state, stack size:', this.undoStack.length);
        }
    }

    private undo() {
        if (this.undoStack.length <= 1) {
            new Notice('Nothing to undo');
            return;
        }
        
        // Save current state to redo stack
        const currentState = this.undoStack.pop()!;
        this.redoStack.push(currentState);
        
        // Get previous state
        const previousState = this.undoStack[this.undoStack.length - 1];
        this.restoreState(previousState);
        
        console.log('Undo - stack sizes:', this.undoStack.length, this.redoStack.length);
    }

    private redo() {
        if (this.redoStack.length === 0) {
            new Notice('Nothing to redo');
            return;
        }
        
        // Get next state from redo stack
        const nextState = this.redoStack.pop()!;
        this.undoStack.push(nextState);
        this.restoreState(nextState);
        
        console.log('Redo - stack sizes:', this.undoStack.length, this.redoStack.length);
    }

    private restoreState(stateJson: string) {
        if (!this.pageManager || !this.notaData) return;
        
        this.isUndoRedoing = true;
        
        try {
            const serializedPages: SerializedPage[] = JSON.parse(stateJson);
            
            // Clear all current page content
            const pages = this.pageManager.getAllPages();
            pages.forEach(page => {
                if (page.layer) {
                    // Remove all children except background
                    const children = page.layer.getChildren();
                    children.forEach(child => {
                        if (child.name() !== 'background') {
                            child.destroy();
                        }
                    });
                }
            });
            
            // Restore content for each page
            serializedPages.forEach((serializedPage, index) => {
                if (index < pages.length) {
                    const page = pages[index];
                    const tools = this.pageTools.get(page.id);
                    if (tools && page.layer) {
                        // Reload the page content
                        this.pageManager!.loadPageContent(page.id, serializedPage, tools);
                        page.layer.batchDraw();
                    }
                }
            });
            
            this.isDirty = true;
            new Notice('Undo/Redo applied');
        } catch (e) {
            console.error('Failed to restore state:', e);
            new Notice('Failed to undo/redo');
        }
        
        this.isUndoRedoing = false;
    }

    async saveDrawing() {
        if (!this.notaData || !this.pageManager || !this.file) {
            console.warn('Cannot save: missing data', {
                hasNotaData: !!this.notaData,
                hasPageManager: !!this.pageManager,
                hasFile: !!this.file
            });
            return;
        }

        console.log('Saving drawing...');

        // Serialize all pages
        const pages = this.pageManager.getAllPages();
        console.log('Pages to serialize:', pages.length);
        
        this.notaData.pages = pages
            .map(page => this.pageManager!.serializePage(page.id))
            .filter(page => page !== null) as SerializedPage[];
        
        console.log('Serialized pages:', this.notaData.pages.length);

        // Remove the last blank page from saves (it's for UX only)
        if (this.notaData.pages.length > 1) {
            const lastPage = this.notaData.pages[this.notaData.pages.length - 1];
            const hasContent = lastPage.strokes.length > 0 || 
                              lastPage.shapes.length > 0 || 
                              lastPage.textElements.length > 0 ||
                              lastPage.images.length > 0;
            
            if (!hasContent) {
                this.notaData.pages.pop();
            }
        }

        // Save viewport state (scroll position and zoom)
        const scrollContainer = this.notaContainerEl?.querySelector('.nota-scroll-container') as HTMLElement;
        if (scrollContainer) {
            this.notaData.viewState = {
                scrollTop: scrollContainer.scrollTop,
                scrollLeft: scrollContainer.scrollLeft,
                scale: this.viewportState.scale
            };
            console.log('Saved view state:', this.notaData.viewState);
        }

        const data = JSON.stringify(this.notaData, null, 2);
        
        // Set flag to prevent setViewData from re-rendering
        this.isSaving = true;
        await this.app.vault.modify(this.file, data);
        this.isSaving = false;
        
        this.isDirty = false;
        console.log('Save complete');
    }

    async onClose() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }
        if (this.pageCheckTimer) {
            clearTimeout(this.pageCheckTimer);
        }
        await this.saveDrawing();
        
        if (this.pageManager) {
            this.pageManager.destroy();
        }
    }

    async onLoadFile(file: TFile): Promise<void> {
        await super.onLoadFile(file);
    }

    async onUnloadFile(file: TFile): Promise<void> {
        await this.saveDrawing();
        await super.onUnloadFile(file);
    }
}

export function registerContextMenu(view: DrawingView, menu: Menu) {
    menu.addItem((item) => {
        item
            .setTitle('Add Page')
            .setIcon('plus')
            .onClick(() => {
                new Notice('Add page - coming soon');
            });
    });

    menu.addSeparator();

    menu.addItem((item) => {
        item
            .setTitle('Export as PDF')
            .setIcon('file-text')
            .onClick(async () => {
                const notaData = view.getNotaData();
                if (notaData && view.file) {
                    await ImportExport.exportToPDF(notaData, view.file.name);
                }
            });
    });

    menu.addItem((item) => {
        item
            .setTitle('Export as Images')
            .setIcon('image')
            .onClick(() => {
                new Notice('Export images - coming soon');
            });
    });

    menu.addItem((item) => {
        item
            .setTitle('Export as Markdown')
            .setIcon('document')
            .onClick(async () => {
                const notaData = view.getNotaData();
                if (notaData && view.file) {
                    const markdown = await ImportExport.exportToMarkdown(notaData, view.file.name);
                    console.log(markdown);
                    new Notice('Markdown exported to console');
                }
            });
    });
}

