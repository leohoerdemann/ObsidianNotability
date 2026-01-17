# Obsidian Nota
This is an Obsidian plugin to recreate the basic functionality of the Notability app on iOS.
It allows you to create and manage notes with a focus on handwriting and drawing, similar to Notability, goodnotes, or any other PDF editor.
theres a canvas that takes up the view in which the pages of the file are displayed you can scroll through, zoom, pan, and draw on pages

## Features
- Create and edit notes with handwriting and drawing capabilities.
    - Pen with multiple colors and thicknesses.
    - Shape Drawing when holding the pen tool.
    - Text tool for adding text as markdown.
    - Selection tool for selecting, moving, and resizing content.
    - Highlighter
    - Eraser
    - change page background color/ pattern (solid color, grid, ruled, dotted).
- Import and export notes in various formats.
    - PDF import and export.
    - Image import and export.
    - Markdown import and export.
    - Notability .note import (big thanks to https://jvns.ca/blog/2018/03/31/reverse-engineering-notability-format/ for reverse enginering the .note format)
    - Microsoft office (powerpoint and word) import and export.
- Files are stored in obsidian vaults as a .nota file.
- Supports multiple pages in a single note.
    - Supports multiple page sizes (standard, A4, letter, etc.).
    - if you want an infinite canvas use Excalidraw, this plugin is meant for an experiance similar to a notebook with pages.
- Supports multiple note templates. 
- Supports OCR for text recognition.
- Suports both mouse and touch input as well as Apple Pencil.
- Suports Linking notes in Obsidian
- pages are streamed in from the file dynamically for better performance
- last page of the doc will always be blank, once there is something added to the last page a new blank page will be added to the doc. (this last blank page will not show up in exports)

## Installation

1. Download the latest release from the [Releases](https://github.com/yourusername/obsidian-nota/releases) page.
2. Extract the contents of the zip file into your Obsidian plugins folder.
3. Enable the plugin in Obsidian's settings.
4. Configure the plugin settings to your liking.


## Usage
- Create a new note by clicking the "New Nota" button in the sidebar.
- Use the toolbar (the top bar in obsidian) to select the hand, pen, text, selection, highlighter, or eraser tool.
- the pages are organized as a single column going down in the center. A gray line indicates the page seperatestions, if you zoom out beyond the page you will see start to gray sidebars on either side, you cannot draw or edit in these areas as they are not part of the doc
- standard use of the scoll wheel will scroll thorugh docs
- Click on a tool icon again after it's already selected to oepn a ribbon segment below it with option for that tool. tap the selected tool icon again to close the ribbon segment
- Use the hand tool to pan, zoom, and scroll around the document. Supports ctrl + scroll wheel to zoom on desktop or pinch to zoom. if apple pencil use is enabled this will be the deufault behavior when interacting without the pencil
- Use the shape drawing feature by holding drawing the shape with the pen tool, holding down, and then the shape should snap into place.
- Use the text tool to add or edit textblocks on your note, text supoports markdown formatting.
- Use the selection tool to free hand draw around objects and select them tp move content around and resize.
- Use the highlighter to highlight text or drawings.
- Use the eraser to erase content.
- Change the page background color or pattern in the settings of the document by clicking the standard obsidian 3 dots in the top right.
- Export notes using the export buttons in the settings of the document by clicking the standard obsidian file menu in the top right.
- right click a file (markdown, .note, pdf, wordx, pptx) in your vault to convert to a nota
- Use the OCR feature to recognize text in your handwritten notes for easy searching and editing.

## Contributing
Contributions are welcome! If you have any ideas for new features or improvements, please submit a pull request on the GitHub repository. I can't garantee that I will be able to implement new features or fix bugs, but I will do my best to review and merge pull requests in a timely manner.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details


## Technical Details
- This plugin uses the canvas library konva.js for rendering and manipulating the canvas elements.
- each page is stored as a separate JSON object in the .nota file and streamed in and out of the canvas as needed to maintain performance.
- The plugin uses the Obsidian API to integrate with the Obsidian app and access the vault.
- The plugin uses the Tesseract.js library for OCR functionality to recognize text in handwritten notes for things like omnisearch.
- The plugin supports both mouse and touch input, including Apple Pencil for iOS devices.
- This plugin is able to open PowerPoints via the library pptxgenjs, which allows for the import and export of PowerPoint files.
- The tool selections are added to the top bar in obsidian via the itemview.addAction() method
- you can tweak the default settings in the plugin settings to change the default pen color, thickness, and other options.
- you can also click on an already selected tool icon in the view actions to open more options for that tool.
- you can click the the file menu (the three dots in the top right of obsidian) to configure page options for that page as well as open the export tools.