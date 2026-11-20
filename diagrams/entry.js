// Browser entry bundled by render.mjs. It exposes one function that turns
// Excalidraw element skeletons into a finished SVG with embedded fonts.
import { convertToExcalidrawElements, exportToSvg } from "@excalidraw/excalidraw";

window.renderDiagram = async (skeleton, { dark = false } = {}) => {
  const elements = convertToExcalidrawElements(skeleton, { regenerateIds: false });
  const svg = await exportToSvg({
    elements,
    appState: {
      exportBackground: true,
      viewBackgroundColor: "#ffffff",
      exportWithDarkMode: dark,
      exportEmbedScene: false,
    },
    files: null,
    exportPadding: 28,
  });
  return { svg: svg.outerHTML, elements };
};

window.diagramReady = true;
