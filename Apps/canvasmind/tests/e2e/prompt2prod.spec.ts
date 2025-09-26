import { parseCanvasScript } from "../../apps/demo-web/src/canvasmind/compiler/canvascript/parser";
import { astToActions } from "../../apps/demo-web/src/canvasmind/compiler/canvascript/to-actions";

test("CanvasScript → Actions → Skybox + Mesh", () => {
  const src = `
    scene {
      sky "nebula"
      spawn rock count=2
    }
  `;
  const ast = parseCanvasScript(src);
  const actions = astToActions(ast);
  expect(actions.some(a => a.op === "skybox.generate")).toBe(true);
  expect(actions.some(a => a.op === "spawn")).toBe(true);
});
