import type { ReticleProfile } from "../types";

export const genericReticles: ReticleProfile[] = [
  {
    id: "generic-mil-grid",
    name: "Generic MIL Grid",
    unit: "MIL",
    focalPlane: "FFP",
    pattern: "mil-grid",
    majorStep: 1,
    minorStep: 0.2,
    note: "Универсальная MIL сетка без привязки к бренду."
  },
  {
    id: "generic-moa-hash",
    name: "Generic MOA Hash",
    unit: "MOA",
    focalPlane: "SFP",
    pattern: "moa-hash",
    majorStep: 1,
    minorStep: 0.5,
    note: "Универсальная MOA сетка без привязки к бренду."
  },
  {
    id: "vortex-dead-hold-bdc-moa",
    name: "Vortex Dead-Hold BDC (MOA)",
    unit: "MOA",
    focalPlane: "SFP",
    pattern: "bdc",
    holdMarks: [1.5, 4.5, 7.5, 11],
    subtensions: [
      { label: "1st hashmark", value: 1.5, unit: "MOA" },
      { label: "2nd hashmark", value: 4.5, unit: "MOA" },
      { label: "3rd hashmark", value: 7.5, unit: "MOA" },
      { label: "Top of bottom post", value: 11, unit: "MOA" }
    ],
    sourceUrl: "https://manuals.plus/m/1f630366574351a44de2f90a99a1a2bb41446f18111e5afe7723098e21e4e508",
    note: "Субтензии калиброваны для максимальной кратности (SFP)."
  }
];
