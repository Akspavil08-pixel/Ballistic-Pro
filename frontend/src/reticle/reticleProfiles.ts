import { genericReticles } from "./catalog/generic";
import { nightforceReticles } from "./catalog/nightforce";
import { vectorOpticsReticles } from "./catalog/vectorOptics";

export type { ReticleProfile, ReticleUnit, ReticleVariant, SubtensionEntry } from "./types";

export const reticleProfiles = [
  ...genericReticles,
  ...nightforceReticles,
  ...vectorOpticsReticles
];
