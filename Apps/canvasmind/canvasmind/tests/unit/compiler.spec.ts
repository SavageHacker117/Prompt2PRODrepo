import { parseCanvasScript } from "../../apps/demo-web/src/canvasmind/compiler/canvascript/parser";
import { astToActions } from "../../apps/demo-web/src/canvasmind/compiler/canvascript/to-actions";

test("budget + policy passes allow simple scene", () => {
  const src = `spawn rock count=1`;
  const ast = parseCanvasScript(src);
  const acts = astToActions(ast);
  expect(acts[0].op).toBe("spawn");
});
