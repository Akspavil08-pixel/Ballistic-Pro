export type ReticleUnit = "MIL" | "MOA";

export interface SubtensionEntry {
  label: string;
  value: number;
  unit: ReticleUnit;
}

export interface ReticleVariant {
  id: string;
  name: string;
  subtensions: SubtensionEntry[];
}

export interface ReticleProfile {
  id: string;
  name: string;
  unit: ReticleUnit;
  focalPlane: "FFP" | "SFP";
  pattern: "mil-grid" | "moa-hash" | "bdc" | "simple" | "grid";
  majorStep?: number;
  minorStep?: number;
  holdMarks?: number[];
  subtensions?: SubtensionEntry[];
  variants?: ReticleVariant[];
  imageSrc?: string;
  imageSourceUrl?: string;
  vectorStyle?:
    | "nightforce-4a-i"
    | "nightforce-moa-c"
    | "nightforce-mil-c"
    | "nightforce-mil-xt"
    | "nightforce-mil-r"
    | "nightforce-fc-dmx"
    | "vector-vco2-mil"
    | "vector-vos-tmoa";
  opticFov?: {
    minMagnification: number;
    maxMagnification: number;
    minMetersAt100m: number;
    maxMetersAt100m: number;
    sourceUrl?: string;
  };
  sourceUrl?: string;
  note?: string;
}
