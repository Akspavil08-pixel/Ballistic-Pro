import { nightforceReticles } from "./catalog/nightforce";
import { vectorOpticsReticles } from "./catalog/vectorOptics";

export type { ReticleProfile, ReticleUnit, ReticleVariant, SubtensionEntry } from "./types";

export const reticleProfiles = [
  ...nightforceReticles,
  ...vectorOpticsReticles
];
