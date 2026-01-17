import { App, Plugin, PluginSettingTab, Setting, Notice, TFile, Menu } from 'obsidian';
import { DrawingView, DRAWING_VIEW_TYPE } from './view';
import { PageSize, BackgroundType } from './types';

interface DrawingPluginSettings {
    defaultPagesize: PageSize;
    defaultBackground: BackgroundType;
    gridSize: number;
    lineSpacing: number;
    backgroundColor: string;
    useApplePencil: boolean;

    // Tool settings
    penColor: string;
    penThickness: number;
    penOpacity: number;
    
    highlighterColor: string;
    highlighterThickness: number;
    highlighterOpacity: number;
    
    eraserThickness: number;
    
    textFontSize: number;
    textFontFamily: string;
    textColor: string;
}

const DEFAULT_SETTINGS: DrawingPluginSettings = {
    defaultPagesize: "A4",
    defaultBackground: "solid",
    gridSize: 20,
    lineSpacing: 30,
    backgroundColor: "#ffffff",
    useApplePencil: true,

    penColor: "#000000",
    penThickness: 2,
    penOpacity: 1,
    
    highlighterColor: "#ffff00",
    highlighterThickness: 20,
    highlighterOpacity: 0.3,
    
    eraserThickness: 20,
    
    textFontSize: 16,
    textFontFamily: "Arial",
    textColor: "#000000",
}

export default class NotaPlugin extends Plugin {
    settings: DrawingPluginSettings;

    async onload() {
        await this.loadSettings();

        // Register the nota view
        this.registerView(DRAWING_VIEW_TYPE, (leaf) => new DrawingView(leaf, this));

        // Register .nota extension
        this.registerExtensions(['nota'], DRAWING_VIEW_TYPE);

        // Add ribbon icon
        this.addRibbonIcon('pen', 'Create New Nota', (evt: MouseEvent) => {
            this.createNewNota();
        });

        // Add command for creating a new nota
        this.addCommand({
            id: "new-nota",
            name: "Create New Nota",
            callback: () => this.createNewNota(),
        });

        // Add command to convert current file to nota
        this.addCommand({
            id: "convert-to-nota",
            name: "Convert current file to Nota",
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file && !file.path.endsWith('.nota')) {
                    if (!checking) {
                        this.convertFileToNota(file);
                    }
                    return true;
                }
                return false;
            },
        });

        // Register file menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile) {
                    // Add convert to nota option for compatible files
                    if (file.extension === 'md' || 
                        file.extension === 'pdf' || 
                        file.extension === 'note' ||
                        file.extension === 'docx' ||
                        file.extension === 'pptx') {
                        menu.addItem((item) => {
                            item
                                .setTitle('Convert to Nota')
                                .setIcon('pen')
                                .onClick(() => {
                                    this.convertFileToNota(file);
                                });
                        });
                    }
                }
            })
        );

        // Add settings tab
        this.addSettingTab(new NotaSettingsTab(this.app, this));
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(DRAWING_VIEW_TYPE);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async createNewNota() {
        const date = new Date();
        const hours = date.getHours() % 12 || 12;
        const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
        const fileName = `Note-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(hours).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}-${ampm}.nota`;
        
        const activeFile = this.app.workspace.getActiveFile();
        const path = activeFile?.parent?.path || '/';
        const fullPath = path === '/' ? fileName : `${path}/${fileName}`;
        
        try {
            await this.app.vault.create(fullPath, '');
            
            const file = this.app.vault.getAbstractFileByPath(fullPath);
            if (file instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(file);
            }
        } catch (error) {
            new Notice('Failed to create nota file: ' + error.message);
        }
    }

    async convertFileToNota(file: TFile) {
        const notaPath = file.path.replace(/\.[^/.]+$/, '.nota');
        
        try {
            // Read source file
            const content = await this.app.vault.read(file);
            
            // Create basic nota structure
            // TODO: Implement proper conversion for different file types
            const notaContent = this.convertContentToNota(content, file.extension);
            
            // Create nota file
            await this.app.vault.create(notaPath, JSON.stringify(notaContent, null, 2));
            
            // Open the new nota file
            const notaFile = this.app.vault.getAbstractFileByPath(notaPath);
            if (notaFile instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                await leaf.openFile(notaFile);
            }
            
            new Notice(`Converted ${file.name} to nota format`);
        } catch (error) {
            new Notice('Failed to convert file: ' + error.message);
        }
    }

    private convertContentToNota(content: string, extension: string): any {
        // Basic conversion - create empty nota with default settings
        // TODO: Implement proper conversion logic for each file type
        const { createDefaultNotaFile } = require('./types');
        return createDefaultNotaFile(this.settings.defaultPagesize);
    }
}

class NotaSettingsTab extends PluginSettingTab {
    plugin: NotaPlugin;

    constructor(app: App, plugin: NotaPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Nota Settings' });

        // Page Settings
        containerEl.createEl('h3', { text: 'Page Settings' });

        new Setting(containerEl)
            .setName('Default Page Size')
            .setDesc('Set the default page size for new notas.')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('A4', 'A4')
                    .addOption('A5', 'A5')
                    .addOption('Letter', 'Letter')
                    .addOption('Legal', 'Legal')
                    .addOption('Square', 'Square')
                    .setValue(this.plugin.settings.defaultPagesize)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultPagesize = value as PageSize;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Default Background')
            .setDesc('Set the default background type for new pages.')
            .addDropdown((dropdown) =>
                dropdown
                    .addOption('solid', 'Solid Color')
                    .addOption('grid', 'Grid')
                    .addOption('ruled', 'Ruled Lines')
                    .addOption('dotted', 'Dotted')
                    .setValue(this.plugin.settings.defaultBackground)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultBackground = value as BackgroundType;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Background Color')
            .setDesc('Set the default background color.')
            .addColorPicker((text) =>
                text
                    .setValue('#ffffff')
                    .setValue(this.plugin.settings.backgroundColor)
                    .onChange(async (value) => {
                        this.plugin.settings.backgroundColor = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Grid Size')
            .setDesc('Set the size of grid cells (in pixels).')
            .addSlider((slider) =>
                slider
                    .setLimits(10, 50, 5)
                    .setValue(this.plugin.settings.gridSize)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.gridSize = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Line Spacing')
            .setDesc('Set the spacing between ruled lines (in pixels).')
            .addSlider((slider) =>
                slider
                    .setLimits(20, 50, 5)
                    .setValue(this.plugin.settings.lineSpacing)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.lineSpacing = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Tool Settings
        containerEl.createEl('h3', { text: 'Tool Settings' });

        // Pen settings
        containerEl.createEl('h4', { text: 'Pen' });

        new Setting(containerEl)
            .setName('Pen Color')
            .setDesc('Default pen color.')
            .addColorPicker((text) =>
                text
                    .setValue('#000000')
                    .setValue(this.plugin.settings.penColor)
                    .onChange(async (value) => {
                        this.plugin.settings.penColor = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Pen Thickness')
            .setDesc('Default pen thickness.')
            .addSlider((slider) =>
                slider
                    .setLimits(1, 10, 0.5)
                    .setValue(this.plugin.settings.penThickness)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.penThickness = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Highlighter settings
        containerEl.createEl('h4', { text: 'Highlighter' });

        new Setting(containerEl)
            .setName('Highlighter Color')
            .setDesc('Default highlighter color.')
            .addColorPicker((picker) =>
                picker
                    .setValue(this.plugin.settings.highlighterColor)
                    .onChange(async (value) => {
                        this.plugin.settings.highlighterColor = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Highlighter Thickness')
            .setDesc('Default highlighter thickness.')
            .addSlider((slider) =>
                slider
                    .setLimits(10, 40, 5)
                    .setValue(this.plugin.settings.highlighterThickness)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.highlighterThickness = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Eraser settings
        containerEl.createEl('h4', { text: 'Eraser' });

        new Setting(containerEl)
            .setName('Eraser Thickness')
            .setDesc('Default eraser thickness.')
            .addSlider((slider) =>
                slider
                    .setLimits(10, 50, 5)
                    .setValue(this.plugin.settings.eraserThickness)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.eraserThickness = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Text settings
        containerEl.createEl('h4', { text: 'Text' });

        new Setting(containerEl)
            .setName('Text Font Size')
            .setDesc('Default text font size.')
            .addSlider((slider) =>
                slider
                    .setLimits(10, 48, 2)
                    .setValue(this.plugin.settings.textFontSize)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.textFontSize = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Text Font Family')
            .setDesc('Default text font family.')
            .addText((text) =>
                text
                    .setPlaceholder('Arial')
                    .setValue(this.plugin.settings.textFontFamily)
                    .onChange(async (value) => {
                        this.plugin.settings.textFontFamily = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName('Text Color')
            .setDesc('Default text color.')
            .addColorPicker((text) =>
                text
                    .setValue(this.plugin.settings.textColor)
                    .onChange(async (value) => {
                        this.plugin.settings.textColor = value;
                        await this.plugin.saveSettings();
                    })
            );

        // Input Settings
        containerEl.createEl('h3', { text: 'Input Settings' });

        new Setting(containerEl)
            .setName('Use Apple Pencil')
            .setDesc('Enable Apple Pencil-specific features (hand tool when not using pencil).')
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useApplePencil)
                    .onChange(async (value) => {
                        this.plugin.settings.useApplePencil = value;
                        await this.plugin.saveSettings();
                    })
            );
    }
}
