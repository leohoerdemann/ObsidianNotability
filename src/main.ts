import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { DrawingView } from './view';
import Konva from 'konva';

// Remember to rename these classes and interfaces!

interface DrawingPluginSettings {
	defaultPagesize: "A4" | "A5" | "Square";
	defaultBackground: "grid" | "lines" | "color";
	gridFrequency: number;
	lineFrequency: number;
	color: string;
	useApplePencil: boolean;

	// settings for the tools
	pencilColor: string;
	pencilWidth: number;
	eraserWidth: number;
	highlighterColor: string;
	highlighterWidth: number;
}

const DEFAULT_SETTINGS: DrawingPluginSettings = {
	defaultPagesize: "A4",
	defaultBackground: "grid",
	gridFrequency: 10,
	lineFrequency: 10,
	color: "black",
	useApplePencil: true,

	pencilColor: "black",
	pencilWidth: 30,
	eraserWidth: 10,
	highlighterColor: "yellow",
	highlighterWidth: 10,
}

export default class DrawingPlugin extends Plugin {
	settings: DrawingPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerView('DrawingView', (leaf) => new DrawingView(leaf, this));

		this.registerExtensions(['nota'], 'DrawingView');

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('pen', 'Create New Nota', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.createNewDrawing();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Add command for creating a new drawing
		this.addCommand({
			id: "new-nota",
			name: "Create New nota",
			callback: () => this.createNewDrawing(),
		});

		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			menu.addItem((item) => {
				item
					.setTitle('New Nota')
					.setIcon('pen')
					.onClick(() => {
						this.createNewDrawing();
					});
			});
		}));

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new DrawingPluginSettingsTab(this.app, this));
	

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType('DrawingView');

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	createNewDrawing() {
		const date = new Date();
		const hours = date.getHours() % 12 || 12;
		const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
		const fileName = `Note-${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${hours}-${date.getMinutes()}-${date.getSeconds()}-${ampm}.nota`;
		
		const path = this.app.workspace.getActiveFile()?.parent?.path || '/';
		const fullPath = `${path}/${fileName}`;
		
		this.app.vault.create(fullPath, '');
		
		// open the new file in the editor
		const file = this.app.vault.getFileByPath(fullPath);
		if (file && file) {
			this.app.workspace.getLeaf().openFile(file);
		}
	}
}

class DrawingPluginSettingsTab extends PluginSettingTab {
	plugin: DrawingPlugin;

	constructor(app: App, plugin: DrawingPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

	new Setting(containerEl)
      .setName("Default Background")
      .setDesc("Set the default background type for new drawings.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("grid", "Grid")
          .addOption("lines", "Lines")
          .addOption("color", "Solid Color")
          .setValue(this.plugin.settings.defaultBackground)
          .onChange(async (value) => {
            this.plugin.settings.defaultBackground = value as any;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Grid Frequency")
      .setDesc("Set the frequency of grid lines.")
      .addSlider((slider) =>
        slider
          .setLimits(5, 50, 1)
          .setValue(this.plugin.settings.gridFrequency)
          .onChange(async (value) => {
            this.plugin.settings.gridFrequency = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Line Frequency")
      .setDesc("Set the frequency of line backgrounds.")
      .addSlider((slider) =>
        slider
          .setLimits(5, 50, 1)
          .setValue(this.plugin.settings.lineFrequency)
          .onChange(async (value) => {
            this.plugin.settings.lineFrequency = value;
            await this.plugin.saveSettings();
          })
      );

	new Setting(containerEl)
	  .setName("Default Color")
	  .setDesc("Set the default color for new drawings.")
	  .addText((text) =>
		text
		  .setPlaceholder("Color")
		  .setValue(this.plugin.settings.color)
		  .onChange(async (value) => {
			this.plugin.settings.color = value;
			await this.plugin.saveSettings();
		  })
	  );

    new Setting(containerEl)
      .setName("Use Apple Pencil")
      .setDesc("Enable Apple Pencil-specific features.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useApplePencil)
          .onChange(async (value) => {
            this.plugin.settings.useApplePencil = value;
            await this.plugin.saveSettings();
          })
      );


	new Setting(containerEl)
	  .setName("Default Pagesize")
	  .setDesc("Set the default pagesize for new drawings.")
	  .addDropdown((dropdown) =>
		dropdown
		  .addOption("A4", "A4")
		  .addOption("A5", "A5")
		  .addOption("Square", "Square")
		  .setValue(this.plugin.settings.defaultPagesize)
		  .onChange(async (value) => {
			this.plugin.settings.defaultPagesize = value as any;
			await this.plugin.saveSettings();
		  })
	  );  		
	}
}
