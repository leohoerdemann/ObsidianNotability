import { TextFileView, WorkspaceLeaf, TFile, Modal} from 'obsidian';
import { initializeKonva } from './initKonva';
import Konva from 'konva';

export const DRAWING_VIEW_TYPE = "DrawingView";

export class DrawingView extends TextFileView {
  private saveInterval: NodeJS.Timeout;
  private stages: Konva.Stage[] = [];
  private curentStage: Konva.Stage;

  constructor(leaf: WorkspaceLeaf, private plugin: any) {
    super(leaf);
  }

  getViewType(): string {
    return DRAWING_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.file?.basename || "Drawing";
  }
  getViewData(): string {
    return "";
  }
  clear(): void {
    // todo
  }

  setViewData(data: string, clear: boolean): void {
    if(data === "") {
      // create a basic Konva interface
      const a4Width = 595; // A4 width in pixels at 72 DPI
      const a4Height = 842; // A4 height in pixels at 72 DPI
      const width = a4Width;
      const height = a4Height;
    
      let stage = new Konva.Stage({
      container: "drawing-container",
      width: width,
      height: height,
      });
    
      const layer = new Konva.Layer();
      stage.add(layer);


      // save the drawing to the file
      const drawingData = stage.toJSON();
      console.log(drawingData);
      const outputjson = 
      {
        stages: [drawingData]
      }
      console.log(outputjson);
      this.plugin.app.vault.modify(this.file, JSON.stringify(outputjson));
    }
    else{
      // load the drawing from the file
      const datajson = JSON.parse(data);
      for (const stage of datajson.stages){
        let stageindex = Konva.Node.create(stage, "drawing-container");
        this.stages.push(stageindex);
      }
    }
  }

  async onOpen() {
    const container = this.contentEl;

    container.empty();
    container.createEl("div", { attr: { id: "drawing-container" } });

    // Load Konva drawing interface
    this.loadKonvaInterface();

    // Start autosave every 30 seconds
    this.saveInterval = setInterval(async () => {
      //await this.saveDrawing();
    }, 3000);
  }

  async saveDrawing() {
    if (this.stages.length === 0) return;
    const drawingData = 
    {
      stages: this.stages.map((stage) => stage.toJSON()),
    }
    if (this.file && drawingData) {
      await this.plugin.app.vault.modify(this.file, JSON.stringify(drawingData));
    }
  }

  loadKonvaInterface() {
    // Load the Konva drawing script
    const script = document.createElement("script");
    script.src = "https://unpkg.com/konva@9.3.18/konva.min.js";
    script.onload = () => {
      this.initializeKonva();
    };
    document.head.appendChild(script);
  }

  async onClose() {
    clearInterval(this.saveInterval);
    await this.saveDrawing();
  }

  initailizeKonva() {
  }

  
}

function highlightButton(button: string) {
  const actionButtons = document.querySelectorAll('.view-action');
  actionButtons.forEach(btn => btn.classList.remove('highlighted'));

  const actionButton = document.querySelector(`.view-action[aria-label="${button}"]`);
  if (actionButton) {
    console.log(actionButton);
    actionButton.classList.add('highlighted');
  }
}

