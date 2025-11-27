import type { WaveSystemOptions } from '../WaveSystem';
import { DEFAULT_WATER_PROFILE } from '../OceanConfig';

export type OceanNodeType =
  | 'WaterProfile'
  | 'WindField'
  | 'GerstnerLayer'
  | 'SpectralLayer'
  | 'ColorGrading'
  | 'FoamSettings';

export interface OceanNode {
  id: string;
  type: OceanNodeType;
  inputs: string[];
  params: Record<string, unknown>;
}

export interface OceanGraph {
  nodes: OceanNode[];
  outputNodeId: string | null;
}

// Tiny stub – later we’ll actually walk the graph and build layers.
export function compileOceanGraph(graph: OceanGraph): WaveSystemOptions {
  void graph;

  return {
    appearance: DEFAULT_WATER_PROFILE,
    layers: [] // OceanPlugin will fall back to defaults if empty
  };
}
