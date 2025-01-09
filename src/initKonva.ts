export function initializeKonva() {
    // Wait for Konva to load in
    if (this.stages.length === 0) {
      setTimeout(() => this.initializeKonva(), 100);
      return;
    }

    const container = document.getElementById("drawing-container");
    let isPaint = false;
    let mode: "brush" | "eraser" | "select" | "highlight" | "text" = "brush";
    let lastLine: Konva.Line | null = null;

    if (!container) return;

    for (const stage of this.stages) {
      const layer = stage.getLayers()[0];
      stage.on("mousedown touchstart", () => {
        isPaint = true;
        switch (mode) {
          case "brush":
            //todo
            break;
          case "eraser":
            //todo
            break;
          case "select":
            //todo
            break;
          case "highlight":
            //todo
            break;
          case "text":
            //todo
            break;
          default:
            break;
        }
        layer.add(lastLine);
      });

      stage.on("mouseup touchend", () => {
        isPaint = false;
      });

      stage.on("mousemove touchmove", () => {
        if (!isPaint || !lastLine) return;

        const pos = stage.getPointerPosition();
        lastLine.points(lastLine.points().concat([pos.x, pos.y]));
      });
    }
    

    // add action buttons for the tools
    this.addAction("pencil", "Pen", () => {
      if (mode === "brush") {
        
      }
      else{
        mode = "brush";
        highlightButton("Pen");
      }      
    });

    highlightButton("Pen");

    this.addAction("eraser", "Eraser", () => {
        mode = "eraser";
        highlightButton("Eraser");
    });

    this.addAction("lasso-select", "Select", () => {
        mode = "select";
        highlightButton("Select");
    });

    this.addAction("highlighter", "Highlight", () => {
        mode = "highlight";
        highlightButton("Highlight");
    });

    this.addAction("text", "Text", () => {
        mode = "text";
        highlightButton("Text");
    });

    // space out the buttons
    this.addAction("blank", "" , () => {});
    this.addAction("blank", "" , () => {});

    // undo redo buttons
    this.addAction("redo", "Redo", () => {
        // TODO
    });

    this.addAction("undo", "Undo", () => {
        // TODO
    });

  }






handlePen() {
    // TODO
    const pos = stage.getPointerPosition();
    lastLine = new Konva.Line({
      stroke: mode === "brush" ? this.pencilColor : "#ffffff",
      tension: 1,
      strokeWidth: mode === "brush" ? this.pencilWidth : this.eraserWidth,
      globalCompositeOperation:
        mode === "brush" ? "source-over" : "destination-out",
      lineCap: "round",
      lineJoin: "round",
      points: [pos.x, pos.y],
    });
  }

  handleEraser() {
    // TODO
  }

  handleSelect() {
    // TODO
  }

  handleHighlight() {
    // TODO
  }

  handleText() {
    // TODO
  }