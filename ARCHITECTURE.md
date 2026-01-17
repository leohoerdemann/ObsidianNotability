# Nota Plugin Architecture

## Overview
The Nota plugin implements a complete note-taking and drawing system within Obsidian, similar to Notability or GoodNotes. The architecture is designed for performance, extensibility, and maintainability.

## Core Components

### 1. Main Plugin (`main.ts`)
- **Responsibility**: Plugin lifecycle, settings management, command registration
- **Key Features**:
  - Registers the .nota file extension
  - Creates ribbon icon and commands
  - Manages plugin settings
  - Handles file conversion from other formats

### 2. Drawing View (`view.ts`)
- **Responsibility**: Main UI and interaction handling
- **Key Features**:
  - Extends `TextFileView` for Obsidian integration
  - Manages toolbar and tool selection
  - Coordinates page manager and drawing tools
  - Handles zoom, pan, and viewport management
  - Implements auto-save functionality
  - Provides export menu integration

### 3. Types (`types.ts`)
- **Responsibility**: TypeScript type definitions
- **Defines**:
  - Tool types and settings
  - Page structures and serialization formats
  - File format specification
  - Helper functions for page dimensions

### 4. Drawing Tools (`tools.ts`)
- **Responsibility**: Implements all drawing tools
- **Tools Implemented**:
  - **Pen**: Pressure-sensitive drawing with configurable color/thickness
  - **Highlighter**: Semi-transparent marking
  - **Eraser**: Destination-out compositing for removal
  - **Text**: Konva.Text with inline editing
  - **Selection**: Lasso selection with transformer
  - **Hand**: Implemented in view for panning

- **Advanced Features**:
  - **Shape Recognition**: Analyzes drawn strokes to detect geometric shapes
  - **Smart Snapping**: Converts freehand to perfect shapes after hold delay
  - **Text Editing**: Creates editable textarea overlays

### 5. Page Manager (`pageManager.ts`)
- **Responsibility**: Page lifecycle and streaming
- **Key Features**:
  - **Dynamic Loading**: Only loads visible pages
  - **Memory Management**: Unloads off-screen pages
  - **Background Rendering**: Generates grid/ruled/dotted patterns
  - **Serialization**: Converts between runtime and storage formats
  - **Performance**: Handles documents with many pages efficiently

### 6. Import/Export (`importExport.ts`)
- **Responsibility**: File format conversion
- **Formats Supported**:
  - PDF export using pdf-lib
  - Image export from canvas
  - Markdown export (text extraction)
  - Notability .note import (planned)
  - PowerPoint/Word import (planned)
  - OCR integration (planned)

## Data Flow

### File Loading
```
.nota file → JSON parse → NotaFileData → 
  → Pages created → Konva layers initialized →
  → Drawing tools attached → Content rendered
```

### Drawing Interaction
```
User input → Tool handler → Konva shape creation →
  → Layer update → Auto-save trigger → 
  → Serialize to JSON → Save to vault
```

### Page Streaming
```
Scroll event → Calculate visible range →
  → Load new pages → Unload hidden pages →
  → Update viewport → Render changes
```

## Performance Optimizations

### 1. Page Streaming
- Only 2-3 pages loaded at a time
- Lazy loading on scroll
- Automatic unloading of off-screen content

### 2. Konva Layer Management
- Each page has its own layer
- Efficient rendering with requestAnimationFrame
- Batch updates for multiple strokes

### 3. Serialization
- Incremental saves only for modified pages
- Debounced auto-save (5 second intervals)
- Compressed JSON storage

### 4. Event Handling
- Passive event listeners where possible
- Throttled scroll handlers
- Efficient pointer event processing

## File Format Specification

### Nota File Structure
```typescript
{
  version: string,           // Semantic version
  pageSize: PageSize,        // Default page size
  settings: ToolSettings,    // Tool configurations
  pages: SerializedPage[]    // Array of pages
}
```

### Serialized Page
```typescript
{
  id: string,                // Unique page identifier
  width: number,             // Page width in pixels
  height: number,            // Page height in pixels
  background: {
    type: BackgroundType,    // solid, grid, ruled, dotted
    color: string,           // Hex color
    gridSize?: number,       // For grid/dotted
    lineSpacing?: number     // For ruled
  },
  strokes: SerializedStroke[],
  shapes: SerializedShape[],
  textElements: SerializedText[],
  images: SerializedImage[]
}
```

## Extension Points

### Adding New Tools
1. Define tool type in `types.ts`
2. Add settings interface
3. Implement handler in `tools.ts`
4. Add toolbar button in `view.ts`
5. Add settings UI in `main.ts`

### Adding New Export Formats
1. Create export function in `importExport.ts`
2. Add menu item in `view.ts`
3. Handle format-specific serialization

### Adding Background Patterns
1. Define type in `types.ts`
2. Implement renderer in `pageManager.ts`
3. Add settings option in `main.ts`

## Best Practices

### TypeScript
- Use strict type checking
- Define interfaces for all data structures
- Avoid `any` types except for external libraries

### Konva Usage
- Always use layers for organization
- Destroy nodes when removing
- Use caching for complex shapes
- Batch updates when possible

### Obsidian Integration
- Use Obsidian's Notice for user feedback
- Follow Obsidian's settings patterns
- Register all resources for cleanup
- Handle file lifecycle properly

### Performance
- Debounce expensive operations
- Use virtualization for long lists
- Minimize re-renders
- Profile with Chrome DevTools

## Security Considerations

- Sanitize user input for text elements
- Validate file format before parsing
- Limit file size for imports
- Handle malformed .nota files gracefully

## Future Architecture Improvements

1. **Undo/Redo System**
   - Command pattern implementation
   - History stack management
   - Memory-efficient snapshots

2. **Layer System**
   - Multiple layers per page
   - Layer visibility toggles
   - Layer blending modes

3. **Collaborative Editing**
   - CRDT-based sync
   - Real-time updates
   - Conflict resolution

4. **Plugin System**
   - Allow third-party tools
   - Custom export formats
   - Extensible templates

## Testing Strategy

### Unit Tests
- Tool behavior
- Serialization/deserialization
- Shape recognition algorithms

### Integration Tests
- File loading/saving
- Tool switching
- Export functionality

### E2E Tests
- Complete workflows
- Performance benchmarks
- Cross-browser compatibility

## Dependencies

### Runtime
- `konva`: Canvas rendering
- `pdf-lib`: PDF generation
- `file-saver`: File downloads

### Development (Future)
- `tesseract.js`: OCR
- `pptxgenjs`: PowerPoint
- `jszip`: Archive handling

## Deployment

### Build Process
```bash
npm run dev     # Development with watch
npm run build   # Production build
```

### Output Files
- `main.js`: Compiled plugin code
- `styles.css`: Plugin styles
- `manifest.json`: Plugin metadata

### Distribution
- GitHub releases
- Obsidian community plugins (pending)

## Maintenance

### Code Quality
- ESLint for linting
- Prettier for formatting
- TypeScript for type safety

### Monitoring
- Error logging to console
- User feedback via Notices
- GitHub Issues tracking

---

Last Updated: January 16, 2026
