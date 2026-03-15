import type { ReticleProfile } from "../types";

export const nightforceReticles: ReticleProfile[] = [
  {
    id: "nightforce-4a-i",
    name: "Nightforce 4A-i",
    unit: "MOA",
    focalPlane: "SFP",
    pattern: "simple",
    vectorStyle: "nightforce-4a-i",
    imageSrc: "/reticles/nightforce-4a-i.png",
    imageSourceUrl: "https://www.nightforceoptics.com/4a-i/",
    variants: [
      {
        id: "4a-i-1-6x24",
        name: "1-6x24",
        subtensions: [
          { label: "A", value: 2.8, unit: "MOA" },
          { label: "B", value: 44, unit: "MOA" },
          { label: "C", value: 0.28, unit: "MOA" },
          { label: "D", value: 0.7, unit: "MOA" },
          { label: "E", value: 22, unit: "MOA" }
        ]
      },
      {
        id: "4a-i-2-12x42",
        name: "2-12x42",
        subtensions: [
          { label: "A", value: 2, unit: "MOA" },
          { label: "B", value: 30, unit: "MOA" },
          { label: "C", value: 0.2, unit: "MOA" },
          { label: "D", value: 0.5, unit: "MOA" },
          { label: "E", value: 15, unit: "MOA" }
        ]
      },
      {
        id: "4a-i-3-18x50",
        name: "3-18x50",
        subtensions: [
          { label: "A", value: 1.2, unit: "MOA" },
          { label: "B", value: 28, unit: "MOA" },
          { label: "C", value: 0.15, unit: "MOA" },
          { label: "D", value: 0.3, unit: "MOA" },
          { label: "E", value: 14, unit: "MOA" }
        ]
      },
      {
        id: "4a-i-4-24x50",
        name: "4-24x50",
        subtensions: [
          { label: "A", value: 0.8, unit: "MOA" },
          { label: "B", value: 20, unit: "MOA" },
          { label: "C", value: 0.11, unit: "MOA" },
          { label: "D", value: 0.2, unit: "MOA" },
          { label: "E", value: 10, unit: "MOA" }
        ]
      }
    ],
    sourceUrl: "https://www.nightforceoptics.com/content/files/products/4A-i_specifications.html",
    note: "Субтензии зависят от модели прицела. Изображение взято со страницы Nightforce."
  },
  {
    id: "nightforce-moa-c",
    name: "Nightforce MOA-C",
    unit: "MOA",
    focalPlane: "FFP",
    pattern: "grid",
    vectorStyle: "nightforce-moa-c",
    imageSrc: "/reticles/nightforce-moa-c.png",
    imageSourceUrl: "https://www.nightforceoptics.com/moa-c/",
    variants: [
      {
        id: "moa-c-nx6-3-18x50",
        name: "NX6 3-18x50 F1",
        subtensions: [
          { label: "A", value: 0.14, unit: "MOA" },
          { label: "B (dot dia)", value: 0.14, unit: "MOA" },
          { label: "G", value: 0.95, unit: "MOA" },
          { label: "C", value: 0.5, unit: "MOA" },
          { label: "D", value: 2, unit: "MOA" },
          { label: "E", value: 1, unit: "MOA" },
          { label: "F", value: 1, unit: "MOA" },
          { label: "H", value: 2, unit: "MOA" }
        ]
      },
      {
        id: "moa-c-nx6-5-30x56",
        name: "NX6 5-30x56 F1",
        subtensions: [
          { label: "A", value: 0.12, unit: "MOA" },
          { label: "B (dot dia)", value: 0.12, unit: "MOA" },
          { label: "G", value: 0.81, unit: "MOA" },
          { label: "C", value: 0.5, unit: "MOA" },
          { label: "D", value: 2, unit: "MOA" },
          { label: "E", value: 1, unit: "MOA" },
          { label: "F", value: 1, unit: "MOA" },
          { label: "H", value: 2, unit: "MOA" }
        ]
      },
      {
        id: "moa-c-nx6-6-36x56",
        name: "NX6 6-36x56 F1",
        subtensions: [
          { label: "A", value: 0.11, unit: "MOA" },
          { label: "B (dot dia)", value: 0.11, unit: "MOA" },
          { label: "G", value: 0.75, unit: "MOA" },
          { label: "C", value: 0.5, unit: "MOA" },
          { label: "D", value: 2, unit: "MOA" },
          { label: "E", value: 1, unit: "MOA" },
          { label: "F", value: 1, unit: "MOA" },
          { label: "H", value: 2, unit: "MOA" }
        ]
      }
    ],
    sourceUrl: "https://www.nightforceoptics.com/content/files/products/MOA-C_specifications.html",
    note: "Субтензии зависят от модели прицела. Изображение взято со страницы Nightforce."
  },
  {
    id: "nightforce-mil-c-f1",
    name: "Nightforce MIL-C F1",
    unit: "MIL",
    focalPlane: "FFP",
    pattern: "grid",
    vectorStyle: "nightforce-mil-c",
    majorStep: 1,
    minorStep: 0.2,
    imageSrc: "/reticles/nightforce-mil-c-f1.png",
    imageSourceUrl: "https://www.nightforceoptics.com/reticles/mil-c-f1",
    sourceUrl: "https://www.nightforceoptics.com/reticles/mil-c-f1",
    note: "Официальная Nightforce FFP MIL-сетка с .2 MRAD делениями."
  },
  {
    id: "nightforce-mil-xt",
    name: "Nightforce MIL-XT",
    unit: "MIL",
    focalPlane: "FFP",
    pattern: "grid",
    vectorStyle: "nightforce-mil-xt",
    majorStep: 1,
    minorStep: 0.2,
    imageSrc: "/reticles/nightforce-mil-xt.png",
    imageSourceUrl: "https://www.nightforceoptics.com/reticles/mil-xt",
    sourceUrl: "https://www.nightforceoptics.com/reticles/mil-xt",
    note: "Официальная Nightforce FFP MIL-сетка для точных удержаний и чтения по .2 MRAD."
  },
  {
    id: "nightforce-mil-r-5",
    name: "Nightforce MIL-R 5 Mils",
    unit: "MIL",
    focalPlane: "SFP",
    pattern: "grid",
    vectorStyle: "nightforce-mil-r",
    majorStep: 1,
    minorStep: 0.2,
    imageSrc: "/reticles/nightforce-mil-r-5.png",
    imageSourceUrl: "https://www.nightforceoptics.com/reticles/mil-r-5-mils",
    sourceUrl: "https://www.nightforceoptics.com/reticles/mil-r-5-mils",
    note: "SFP версия MIL-R; Nightforce публикует 5 и 10 MIL варианты с одинаковой логикой шкалы."
  },
  {
    id: "nightforce-fc-dmx",
    name: "Nightforce FC-DMx",
    unit: "MIL",
    focalPlane: "FFP",
    pattern: "grid",
    vectorStyle: "nightforce-fc-dmx",
    majorStep: 1,
    minorStep: 0.2,
    imageSrc: "/reticles/nightforce-fc-dmx.png",
    imageSourceUrl: "https://www.nightforceoptics.com/reticles/fc-dmx",
    sourceUrl: "https://www.nightforceoptics.com/content/files/products/FC-DMx-MRAD-MOA-Reticle-Sheet-2025.pdf",
    note: "LPVO FFP-сетка Nightforce с крупным кольцом и удержаниями по MIL."
  },
  {
    id: "nightforce-fc-dmx-moa",
    name: "Nightforce FC-DMx (MOA)",
    unit: "MOA",
    focalPlane: "FFP",
    pattern: "grid",
    majorStep: 1,
    minorStep: 0.5,
    sourceUrl: "https://www.nightforceoptics.com/content/files/products/FC-DMx-MRAD-MOA-Reticle-Sheet-2025.pdf",
    imageSourceUrl: "https://www.nightforceoptics.com/fc-dmx-moa/",
    note: "Официальная MOA-версия FC-DMx; subtensions доступны в reticle sheet Nightforce."
  },
  {
    id: "nightforce-moa-xt",
    name: "Nightforce MOA-XT",
    unit: "MOA",
    focalPlane: "FFP",
    pattern: "grid",
    majorStep: 1,
    minorStep: 0.5,
    sourceUrl: "https://www.nightforceoptics.com/content/files/downloads/0323_NF_MOAXT_Reticle-Sheet.pdf",
    note: "Официальный Nightforce reticle sheet публикует subtensions MOA-XT."
  }
];
