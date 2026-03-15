import type { ReticleProfile } from "../types";

const VECTOR_COLLECTION_URL = "https://www.vectoroptics.com/Reticle-Collection";

function makeVectorReticle(
  id: string,
  name: string,
  unit: "MIL" | "MOA",
  focalPlane: "FFP" | "SFP",
  pattern: ReticleProfile["pattern"],
  note: string,
  overrides: Partial<ReticleProfile> = {}
): ReticleProfile {
  return {
    id,
    name,
    unit,
    focalPlane,
    pattern,
    sourceUrl: VECTOR_COLLECTION_URL,
    note,
    ...overrides
  };
}

const vectorDetailedReticles: ReticleProfile[] = [
  makeVectorReticle(
    "vector-constantine-1-10x24-ffp-vco2-mil",
    "Vector Optics Constantine 1-10x24 FFP (VCO-2 MIL)",
    "MIL",
    "FFP",
    "mil-grid",
    "Официально указан ретикл VCO-2 MIL и FFP. Изображение из коллекции ретиклов Vector Optics.",
    {
      majorStep: 1,
      minorStep: 0.2,
      vectorStyle: "vector-vco2-mil",
      imageSrc: "/reticles/vector-vco-2-mil.webp",
      imageSourceUrl: VECTOR_COLLECTION_URL,
      sourceUrl:
        "https://vectoroptics.com/products/vector-optics-constantine-1-10x24-ffp-riflescope.html"
    }
  ),
  makeVectorReticle(
    "vector-constantine-1-10x24-sfp-vos-tmoa",
    "Vector Optics Constantine 1-10x24 SFP (VOS-TMOA)",
    "MOA",
    "SFP",
    "bdc",
    "Официальная сетка Vector Optics VOS-TMOA для SCOC-31: USPSA ranging, BDC-метки и subtensions валидны на 10x.",
    {
      majorStep: 1,
      minorStep: 0.2,
      vectorStyle: "vector-vos-tmoa",
      holdMarks: [2, 8, 9],
      subtensions: [
        { label: "Center scale fine hash", value: 0.2, unit: "MOA" },
        { label: "Center scale minor hash", value: 0.5, unit: "MOA" },
        { label: "Center scale major hash", value: 1.0, unit: "MOA" },
        { label: "BDC hold mark", value: 2.0, unit: "MOA" },
        { label: "BDC hold mark", value: 8.0, unit: "MOA" },
        { label: "BDC hold mark", value: 9.0, unit: "MOA" }
      ],
      imageSrc: "/reticles/vector-vos-tmoa-hq.png",
      imageSourceUrl: "https://www.vectoroptics.com/Reticle-Collection",
      opticFov: {
        minMagnification: 1,
        maxMagnification: 10,
        minMetersAt100m: 41.71,
        maxMetersAt100m: 6.95,
        sourceUrl:
          "https://www.vectoroptics.com/rifle-scopes/Constantine-1-10x24-Riflescope-SCOC-31.html"
      },
      sourceUrl:
        "https://www.vectoroptics.com/public/uploads/files/20250729/b4928c5cd113d9e585de847c9804fa9a.pdf"
    }
  ),
  makeVectorReticle(
    "vector-constantine-1-6x24i-sfp-fiber-dot",
    "Vector Optics Constantine 1-6x24i SFP (Fiber Dot)",
    "MOA",
    "SFP",
    "simple",
    "Официально указан Fiber Center Dot и SFP. Субтензии не опубликованы.",
    {
      sourceUrl:
        "https://vector2007.com/products/constantine-1-6x24i-riflescope-fiber-center-dot-reticle-scoc-39"
    }
  ),
  makeVectorReticle(
    "vector-constantine-1-10x24-sfp-fiber-dot",
    "Vector Optics Constantine 1-10x24 SFP (Fiber Dot)",
    "MOA",
    "SFP",
    "simple",
    "Официально указан Fiber Center Dot и SFP. Субтензии не опубликованы.",
    {
      sourceUrl:
        "https://vector2007.com/products/constantine-1-10x24-riflescope-fiber-dot-reticle-scoc-35"
    }
  )
];

const vectorFamilyReticles: ReticleProfile[] = [
  ["continental-benchrest-shooting", "Continental Benchrest Shooting", "MOA", "SFP", "simple"],
  ["continental-prs", "Continental PRS", "MIL", "FFP", "grid"],
  ["continental-field-target-shooting", "Continental Field Target Shooting", "MOA", "SFP", "simple"],
  ["continental-long-range", "Continental Long-Range", "MIL", "FFP", "grid"],
  ["continental-mountain-hunting", "Continental Mountain Hunting", "MOA", "SFP", "simple"],
  ["continental-small-game-hunting", "Continental Small Game Hunting", "MOA", "SFP", "simple"],
  ["continental-varmint-hunting", "Continental Varmint Hunting", "MOA", "SFP", "moa-hash"],
  ["continental-driving-hunting", "Continental Driving Hunting", "MOA", "SFP", "simple"],
  ["continental-plain-game-hunting", "Continental Plain Game Hunting", "MOA", "SFP", "simple"],
  ["continental-big-game-hunting", "Continental Big Game Hunting", "MOA", "SFP", "simple"],
  ["continental-dangerous-game-hunting", "Continental Dangerous Game Hunting", "MOA", "SFP", "simple"],
  ["continental-3-gun", "Continental 3-Gun", "MOA", "SFP", "moa-hash"],
  ["continental-ipsc-rifle", "Continental IPSC-Rifle", "MOA", "SFP", "moa-hash"],
  ["continental-target-shooting", "Continental Target Shooting", "MOA", "SFP", "simple"],
  ["continental-x10-ed-ffp", "Continental X10 ED FFP", "MIL", "FFP", "grid"],
  ["continental-x10-ed-sfp", "Continental X10 ED SFP", "MOA", "SFP", "simple"],
  ["continental-x8-ed-sfp-hunting", "Continental X8 ED SFP Hunting", "MOA", "SFP", "simple"],
  ["continental-x8-ed-sfp-tactical", "Continental X8 ED SFP Tactical", "MIL", "SFP", "mil-grid"],
  ["continental-x6-hd-sfp-tactical", "Continental X6 HD SFP Tactical", "MIL", "SFP", "mil-grid"],
  ["continental-x6-hd-sfp-hunting", "Continental X6 HD SFP Hunting", "MOA", "SFP", "simple"],
  ["continental-x6-hd-ffp-34mm", "Continental X6 HD FFP 34mm", "MIL", "FFP", "grid"],
  ["tauron-long-range", "Tauron Long Range", "MIL", "FFP", "grid"],
  ["tauron-prs", "Tauron PRS", "MIL", "FFP", "grid"],
  ["tauron-mountain-hunting", "Tauron Mountain Hunting", "MOA", "SFP", "simple"],
  ["tauron-varmint-hunting", "Tauron Varmint Hunting", "MOA", "SFP", "moa-hash"],
  ["tauron-small-game-hunting", "Tauron Small Game Hunting", "MOA", "SFP", "simple"],
  ["tauron-target-shooting", "Tauron Target Shooting", "MOA", "SFP", "simple"],
  ["paragon-small-game-hunting", "Paragon Small Game Hunting", "MOA", "SFP", "simple"],
  ["paragon-varmint-hunting", "Paragon Varmint Hunting", "MOA", "SFP", "moa-hash"],
  ["paragon-ipsc-rifle", "Paragon IPSC-Rifle", "MOA", "SFP", "moa-hash"],
  ["paragon-3-gun", "Paragon 3-Gun", "MOA", "SFP", "moa-hash"],
  ["paragon-cqb", "Paragon CQB", "MOA", "SFP", "simple"],
  ["paragon-ipsc-shotgun", "Paragon IPSC-Shotgun", "MOA", "SFP", "simple"],
  ["paragon-ipsc-pcc", "Paragon IPSC-PCC", "MOA", "SFP", "simple"],
  ["tauron-4x-hd-sfp", "Tauron 4x HD SFP", "MOA", "SFP", "simple"],
  ["tauron-4x-hd-ffp", "Tauron 4x HD FFP", "MIL", "FFP", "grid"],
  ["tauron-genii-8x-ed", "Tauron GenII 8x ED", "MIL", "FFP", "grid"],
  ["tauron-6x-hd-sfp", "Tauron 6x HD SFP", "MOA", "SFP", "simple"],
  ["tauron-6x-hd-ffp", "Tauron 6x HD FFP", "MIL", "FFP", "grid"],
  ["paragon-5x-sfp-30mm", "Paragon 5x SFP 30mm", "MOA", "SFP", "simple"],
  ["paragon-5x-sfp-1inch", "Paragon 5x SFP 1inch", "MOA", "SFP", "simple"],
  ["paragon-mini-prism", "Paragon Mini Prism", "MOA", "SFP", "simple"],
  ["veyron-sfp-ultra-compact", "Veyron SFP Ultra Compact", "MOA", "SFP", "simple"],
  ["veyron-ffp-ultra-compact", "Veyron FFP Ultra Compact", "MIL", "FFP", "grid"],
  ["minotaur-5x-extreme-high", "Minotaur 5x Extreme High", "MOA", "SFP", "simple"],
  ["constantine-lpvo", "Constantine LPVO", "MOA", "SFP", "moa-hash"],
  ["matiz-3x-1inch", "Matiz 3x 1inch", "MOA", "SFP", "simple"],
  ["hugo-4x-1inch", "Hugo 4x 1inch", "MOA", "SFP", "simple"],
  ["orion-hd-sfp", "Orion HD SFP", "MOA", "SFP", "simple"],
  ["orion-hd-ffp", "Orion HD FFP", "MIL", "FFP", "grid"],
  ["grimlock-lpvo", "Grimlock LPVO", "MOA", "SFP", "moa-hash"],
  ["mustang-lpvo", "Mustang LPVO", "MOA", "SFP", "moa-hash"],
  ["sentinel", "Sentinel", "MOA", "SFP", "simple"],
  ["forester", "Forester", "MOA", "SFP", "simple"],
  ["grizzly", "Grizzly", "MOA", "SFP", "simple"],
  ["frenzy-fa", "Frenzy FA", "MOA", "SFP", "simple"],
  ["frenzy-flex", "Frenzy FLEX", "MOA", "SFP", "simple"],
  ["frenzy-fm", "Frenzy FM", "MOA", "SFP", "simple"],
  ["frenzy-f3", "Frenzy F3", "MOA", "SFP", "simple"],
  ["frenzy-x-tek", "Frenzy-X TEK", "MOA", "SFP", "simple"],
  ["frenzy-x-moj", "Frenzy-X MOJ", "MOA", "SFP", "simple"],
  ["frenzy-s-mgt", "Frenzy-S MGT", "MOA", "SFP", "simple"],
  ["frenzy-plus-open", "Frenzy Plus-Open", "MOA", "SFP", "simple"],
  ["frenzy-plus-enclosed-pistol", "Frenzy Plus-Enclosed (Pistol)", "MOA", "SFP", "simple"],
  ["frenzy-plus-enclosed-rifle", "Frenzy Plus-Enclosed (Rifle)", "MOA", "SFP", "simple"],
  ["scrapper", "Scrapper", "MOA", "SFP", "simple"],
  ["maverick-genii", "Maverick GenII", "MOA", "SFP", "simple"],
  ["maverick-geniii", "Maverick GenIII", "MOA", "SFP", "simple"],
  ["maverick-geniv", "Maverick GenIV", "MOA", "SFP", "simple"],
  ["omega", "Omega", "MOA", "SFP", "simple"],
  ["centurion", "Centurion", "MOA", "SFP", "simple"],
  ["nautilus", "Nautilus", "MOA", "SFP", "simple"]
].map(([id, name, unit, focalPlane, pattern]) =>
  makeVectorReticle(
    id,
    name,
    unit as "MIL" | "MOA",
    focalPlane as "FFP" | "SFP",
    pattern as ReticleProfile["pattern"],
    "Семейство ретиклов из официальной Vector Optics Reticle Collection. Для части линеек точная сетка зависит от конкретной модели прицела."
  )
);

export const vectorOpticsReticles: ReticleProfile[] = [...vectorDetailedReticles];
