# Obsidian Nota Plugin

A comprehensive note-taking plugin for Obsidian that recreates the functionality of Notability, GoodNotes, and other PDF annotation apps directly within Obsidian.

## ✨ Features

### Core Drawing Tools
- ✏️ **Pen** - Draw with customizable colors and thickness
- 🖍️ **Highlighter** - Semi-transparent highlighting with adjustable opacity
- 🧹 **Eraser** - Remove unwanted strokes
- ✋ **Hand** - Pan and navigate around the document
- 📝 **Text** - Add and edit text boxes with markdown support
- 🎯 **Selection** - Select, move, and resize drawn content

### Advanced Features
- 🔷 **Shape Recognition** - Automatically snap hand-drawn shapes to perfect geometric forms (lines, rectangles, circles, triangles)
- 📄 **Multi-page Support** - Create documents with multiple pages, just like a real notebook
- 🎨 **Page Backgrounds** - Choose from solid colors, grid patterns, ruled lines, or dotted grids
- 📏 **Multiple Page Sizes** - A4, A5, Letter, Legal, or Square formats
- 🔍 **Zoom & Pan** - Smooth zooming with Ctrl+scroll and panning with the hand tool
- 💾 **Auto-save** - Changes automatically saved every 5 seconds
- 📱 **Touch Support** - Full support for touch input, including Apple Pencil
- ⚡ **Performance Optimized** - Page streaming ensures smooth performance even with large documents

## 🚀 Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Settings → Community Plugins
2. Search for "Nota"
3. Click Install
4. Enable the plugin

### Manual Installation
1. Download the latest release from [Releases](https://github.com/yourusername/obsidian-nota/releases)
2. Extract to `<vault>/.obsidian/plugins/ObsidianNotability/`
3. Reload Obsidian
4. Enable "Nota" in Settings → Community Plugins

### Development Installation
```bash
cd <vault>/.obsidian/plugins
git clone https://github.com/yourusername/obsidian-nota.git ObsidianNotability
cd ObsidianNotability
npm install
npm run dev  # or npm run build for production
```

## 📖 Usage

### Creating a New Nota
- Click the **pen icon** in the left ribbon
- Use Command Palette: **"Create New Nota"**
- Right-click in file explorer → **New Nota**

### Drawing Tools
1. Select a tool from the toolbar at the top of the view
2. Click the tool icon again to access settings (color, thickness, etc.)
3. Draw on the canvas:
   - **Pen/Highlighter**: Click and drag to draw
   - **Eraser**: Click and drag to erase
   - **Text**: Click to place a text box, double-click existing text to edit
   - **Selection**: Draw a lasso around objects to select them
   - **Hand**: Click and drag to pan the view

### Shape Recognition
1. Select the **Pen** tool
2. Draw a shape (line, rectangle, circle, or triangle)
3. **Hold** for ~0.5 seconds after finishing
4. The shape will automatically snap to a perfect geometric form

### Page Management
- The last page is always blank and automatically creates a new one when you add content
- Scroll naturally through pages
- Pages dynamically load/unload for optimal performance

### Keyboard Shortcuts
- **Ctrl + Scroll** - Zoom in/out
- **Ctrl + Z** - Undo (coming soon)
- **Ctrl + Y** - Redo (coming soon)

### Export Options
1. Click the **three dots** (⋮) in the top-right
2. Choose export format:
   - Export as PDF
   - Export as Images
   - Export as Markdown (text only)

## ⚙️ Settings

Access settings via **Settings → Nota**

### Page Settings
- **Default Page Size**: Choose from A4, A5, Letter, Legal, or Square
- **Default Background**: Solid, Grid, Ruled Lines, or Dotted
- **Background Color**: Custom hex color for pages
- **Grid Size**: Spacing for grid pattern (10-50px)
- **Line Spacing**: Spacing for ruled lines (20-50px)

### Tool Settings

**Pen**
- Color (hex value)
- Thickness (1-10px)

**Highlighter**
- Color (hex value)
- Thickness (10-40px)

**Eraser**
- Thickness (10-50px)

**Text**
- Font Size (10-48pt)
- Font Family
- Color (hex value)

### Input
- **Use Apple Pencil**: Enable special Apple Pencil features (hand tool activates when not using pencil)

## 🗂️ File Format

Nota files use the `.nota` extension and are stored as human-readable JSON:

```json
{
  "version": "1.0.0",
  "pageSize": "A4",
  "pages": [
    {
      "id": "page-1",
      "width": 794,
      "height": 1123,
      "background": {
        "type": "solid",
        "color": "#ffffff"
      },
      "strokes": [],
      "shapes": [],
      "textElements": [],
      "images": []
    }
  ],
  "settings": {
    "pen": {...},
    "highlighter": {...},
    "eraser": {...},
    "text": {...}
  }
}
```

## 🛠️ Development

### Tech Stack
- **Konva.js** - High-performance canvas rendering
- **pdf-lib** - PDF generation and parsing
- **Tesseract.js** - OCR capabilities
- **pptxgenjs** - PowerPoint file handling
- **TypeScript** - Type-safe development

### Building
```bash
npm install          # Install dependencies
npm run dev          # Development with auto-rebuild
npm run build        # Production build
```

### Project Structure
```
src/
├── main.ts          # Plugin entry and settings
├── view.ts          # Main view and UI
├── types.ts         # TypeScript definitions
├── tools.ts         # Drawing tools implementation
├── pageManager.ts   # Page streaming system
└── importExport.ts  # Import/export handlers
```

## 🐛 Troubleshooting

**Plugin won't load**
- Update to the latest Obsidian version
- Verify all files are in the plugin folder
- Disable and re-enable the plugin

**Drawing is laggy**
- Reduce zoom level
- Close resource-intensive plugins
- Restart Obsidian

**Can't export to PDF**
- Check browser console for errors
- Ensure npm dependencies are installed
- Try exporting as images instead

## 🗺️ Roadmap

### ✅ Completed
- Core drawing functionality
- Multiple tools with customization
- Shape recognition
- Page management with streaming
- Auto-save
- Settings panel
- Basic export (PDF, Markdown)

### 🚧 In Progress
- Full PDF import/export with annotations
- Enhanced image export
- OCR integration
- PowerPoint/Word import

### 📋 Planned
- Complete undo/redo system
- Layer support
- Audio recording
- Collaborative editing
- Note templates
- Custom brush styles
- Enhanced pressure sensitivity
- Improved stylus support

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

- Inspired by [Notability](https://notability.com/) and [GoodNotes](https://www.goodnotes.com/)
- Notability .note format: [Julia Evans' reverse engineering](https://jvns.ca/blog/2018/03/31/reverse-engineering-notability-format/)
- Built with the [Obsidian API](https://github.com/obsidianmd/obsidian-api)

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/obsidian-nota/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/obsidian-nota/discussions)

---

Made with ❤️ for the Obsidian community
