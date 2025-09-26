import type { ASTNode } from "./parser";

export type JsonAction = { op: string; [k: string]: any };

export function astToActions(ast: ASTNode[]): JsonAction[] {
  const out: JsonAction[] = [];
  for (const n of ast) emit(n, out);
  return out;
}

function emit(n: ASTNode, out: JsonAction[]) {
  switch (n.type) {
    case "SceneBlock":
      n.body.forEach((c) => emit(c, out));
      break;
    case "Sky":
      out.push({ op: "skybox.generate", prompt: n.label, seed: 42, resolution: 2048 });
      break;
    case "Spawn":
      out.push({
        op: "spawn",
        kind: n.kind,
        count: n.count ?? 1,
        props: n.props
      });
      break;
    case "Water":
      out.push({ op: "worldfield.setParams", intensity: n.wavesIntensity });
      break;
    case "LightingSun":
      out.push({ op: "lighting.set", sunAngle: n.angle });
      break;
  }
}
