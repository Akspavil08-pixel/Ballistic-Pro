import { useEffect, useMemo, useState, useRef } from "react";
import { Field } from "./components/Field";
import { SelectField } from "./components/SelectField";
import { SectionCard } from "./components/SectionCard";
import { Toggle } from "./components/Toggle";
import { StatCard } from "./components/StatCard";
import { TrajectoryCharts } from "./graphs/TrajectoryCharts";
import { ReticleCanvas } from "./reticle/ReticleCanvas";
import { reticleProfiles } from "./reticle/reticleProfiles";
import { WindDial } from "./components/WindDial";
import {
  BulletIcon,
  DistanceIcon,
  InfoIcon,
  ResultIcon,
  ScopeIcon,
  SettingsIcon,
  TargetIcon,
  WeatherIcon,
  IconWrapper
} from "./components/icons";
import { solveBallistics } from "./utils/api";

const milFromRad = (rad: number) => rad * 1000.0;
const moaFromRad = (rad: number) => (rad * 180.0 * 60.0) / Math.PI;
const CACHE_KEY = "ballistics:last";
const CM_PER_M = 100;
const DEFAULT_MAGNIFICATION_RANGE = { min: 3, max: 18 };
const DEG_TO_RAD = Math.PI / 180;
const M_TO_YD = 1.0936133;
const M_TO_FT = 3.28084;
const HPA_TO_INHG = 0.0295299830714;
const MM_TO_IN = 1 / 25.4;
const CM_TO_IN = 1 / 2.54;
const J_TO_FTLB = 0.737562149;

const targetMotionTypes = [
  { id: "walk", label: "Человек (шаг ~1.5 м/с)", speed: 1.5 },
  { id: "run", label: "Человек (бег ~4 м/с)", speed: 4 },
  { id: "boar", label: "Кабан (рывок ~6 м/с)", speed: 6 },
  { id: "deer", label: "Олень (галоп ~6.5 м/с)", speed: 6.5 },
  { id: "moose", label: "Лось (галоп ~6 м/с)", speed: 6 },
  { id: "bear", label: "Медведь (быстро ~5 м/с)", speed: 5 },
  { id: "wolf", label: "Волк (рысь ~5 м/с)", speed: 5 },
  { id: "fox", label: "Лиса (быстро ~4 м/с)", speed: 4 },
  { id: "roe", label: "Косуля (галоп ~6 м/с)", speed: 6 },
  { id: "vehicle", label: "Авто медленно ~15 м/с", speed: 15 },
  { id: "custom", label: "Свой (ввести вручную)", speed: null }
];

const targetDirectionPresets = [
  { value: 90, label: "Слева направо (перпендикулярно)" },
  { value: 270, label: "Справа налево (перпендикулярно)" },
  { value: 0, label: "От вас (цель уходит)" },
  { value: 180, label: "К вам (цель приближается)" },
  { value: 45, label: "Уходит вправо (45°)" },
  { value: 135, label: "Уходит влево (135°)" },
  { value: 315, label: "Идёт справа (315°)" },
  { value: 225, label: "Идёт слева (225°)" }
];

const motionPatternOptions = [
  { value: "straight", label: "Прямолинейно" },
  { value: "arc", label: "Дуга (поворот)" },
  { value: "zigzag", label: "Зигзаг" }
];

const motionArcDirections = [
  { value: "right", label: "Поворот вправо" },
  { value: "left", label: "Поворот влево" }
];

const motionAnimationStyles = [
  { value: "smooth", label: "Плавно" },
  { value: "trot", label: "Рысь" },
  { value: "run", label: "Бег" }
];

const clampDistance = (value: number, max: number) => Math.max(0, Math.min(value, max));

const computeArcDisplacement = (
  timeS: number,
  speed: number,
  directionDeg: number,
  radiusM: number,
  turnDir: "left" | "right"
) => {
  const theta0 = directionDeg * DEG_TO_RAD;
  const vRad = speed * Math.cos(theta0);
  const vLat = speed * Math.sin(theta0);
  const safeRadius = Math.max(radiusM, 1);
  const turnSign = turnDir === "right" ? 1 : -1;
  const w = turnSign * speed / safeRadius;
  if (Math.abs(w) < 1e-6) {
    return { radial: vRad * timeS, lateral: vLat * timeS };
  }
  const wt = w * timeS;
  const sin = Math.sin(wt);
  const cos = Math.cos(wt);
  const radial = (vRad * sin + vLat * (cos - 1)) / w;
  const lateral = (vRad * (1 - cos) + vLat * sin) / w;
  return { radial, lateral };
};

const computeZigzagDisplacement = (
  timeS: number,
  speed: number,
  directionDeg: number,
  zigzagAngleDeg: number,
  periodS: number
) => {
  const baseTheta = directionDeg * DEG_TO_RAD;
  const zigzagAngle = Math.max(0, Math.min(zigzagAngleDeg, 75)) * DEG_TO_RAD;
  const halfPeriod = Math.max(periodS, 0.4) / 2;
  let remaining = timeS;
  let sign = 1;
  let radial = 0;
  let lateral = 0;
  while (remaining > 1e-6) {
    const dtSeg = Math.min(remaining, halfPeriod);
    const theta = baseTheta + sign * zigzagAngle;
    const vRad = speed * Math.cos(theta);
    const vLat = speed * Math.sin(theta);
    radial += vRad * dtSeg;
    lateral += vLat * dtSeg;
    remaining -= dtSeg;
    sign *= -1;
  }
  return { radial, lateral };
};

function parseMagnificationRange(label?: string | null) {
  if (!label) return null;
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×])?/i);
  if (!match) return null;
  const min = Number(match[1].replace(",", "."));
  const max = Number(match[2].replace(",", "."));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) {
    return null;
  }
  return { min, max };
}

const targetModels = [
  {
    id: "chest-50",
    name: "Грудная мишень 50×50 см",
    widthCm: 50,
    heightCm: 50,
    shape: "rect" as const,
    style: "chest" as const,
    sourceUrl: "local"
  },
  {
    id: "standing-50x150",
    name: "Ростовая мишень 50×150 см",
    widthCm: 50,
    heightCm: 150,
    shape: "rect" as const,
    style: "standing" as const,
    sourceUrl: "local"
  },
  {
    id: "circle-30",
    name: "Круг 30 см",
    widthCm: 30,
    heightCm: 30,
    shape: "circle" as const,
    style: "paper" as const,
    sourceUrl: "local"
  },
  {
    id: "mini-20",
    name: "Малый круг 20 см",
    widthCm: 20,
    heightCm: 20,
    shape: "circle" as const,
    style: "paper" as const,
    sourceUrl: "local"
  },
  {
    id: "ipsc-full",
    name: "IPSC/IDPA силуэт",
    widthCm: 46,
    heightCm: 76,
    shape: "rect" as const,
    style: "standing" as const,
    sourceUrl: "local"
  },
  {
    id: "steel-popper",
    name: "Стальной поппер IPSC",
    widthCm: 30,
    heightCm: 45,
    shape: "rect" as const,
    style: "steel-popper" as const,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:IPSC_Popper_steel_target.png"
  },
  {
    id: "steel-plate",
    name: "Стальная гонг-тарелка",
    widthCm: 30,
    heightCm: 30,
    shape: "circle" as const,
    style: "steel-plate" as const,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:A_single_steel_target_for_shooting.jpg"
  },
  {
    id: "deer-silhouette",
    name: "Силуэт оленя",
    widthCm: 160,
    heightCm: 110,
    shape: "rect" as const,
    style: "animal-deer" as const,
    imageSrc: "targets/animal-deer.svg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Deer_silhouette.svg"
  },
  {
    id: "boar-silhouette",
    name: "Силуэт кабана",
    widthCm: 150,
    heightCm: 85,
    shape: "rect" as const,
    style: "animal-boar" as const,
    imageSrc: "targets/animal-boar.svg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:202310_Wild_boar.svg"
  },
  {
    id: "moose-silhouette",
    name: "Силуэт лося",
    widthCm: 280,
    heightCm: 200,
    shape: "rect" as const,
    style: "animal-moose" as const,
    imageSrc: "targets/animal-moose.svg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Elk_siluette.svg"
  },
  {
    id: "bear-silhouette",
    name: "Силуэт медведя",
    widthCm: 200,
    heightCm: 105,
    shape: "rect" as const,
    style: "animal-bear" as const,
    imageSrc: "targets/animal-bear.svg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Silhouette_of_a_Bear.svg"
  },
  {
    id: "fox-silhouette",
    name: "Силуэт лисы",
    widthCm: 110,
    heightCm: 45,
    shape: "rect" as const,
    style: "animal-fox" as const,
    imageSrc: "targets/animal-fox.svg",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Fox_Silhouette_(NIH_BioArt_164_-_629964).svg"
  },
  {
    id: "wolf-silhouette",
    name: "Силуэт волка",
    widthCm: 150,
    heightCm: 85,
    shape: "rect" as const,
    style: "animal-wolf" as const,
    imageSrc: "targets/animal-wolf.svg",
    sourceUrl: "local"
  },
  {
    id: "roe-silhouette",
    name: "Силуэт косули",
    widthCm: 120,
    heightCm: 85,
    shape: "rect" as const,
    style: "animal-roe" as const,
    imageSrc: "targets/animal-roe.svg",
    sourceUrl: "local"
  },
  {
    id: "human-silhouette",
    name: "Силуэт человека",
    widthCm: 45,
    heightCm: 170,
    shape: "rect" as const,
    style: "animal-human" as const,
    imageSrc: "targets/animal-human.svg",
    sourceUrl: "local"
  }
];

export default function App() {
  const [weapon, setWeapon] = useState({
    name: "Моя винтовка",
    weapon_type: "rifle",
    caliber_mm: 7.62,
    barrel_length_mm: 610,
    twist_rate_in: 10,
    rifling_step_mm: 254,
    sight_height_mm: 50,
    zero_distance_m: 100,
    weapon_mass_kg: 4.2
  });

  const [ammo, setAmmo] = useState({
    name: "Match 168gr",
    bullet_weight_grains: 168,
    muzzle_velocity_mps: 820,
    ballistic_coefficient: 0.47,
    drag_model: "G1",
    powder_temp_c: 20,
    muzzle_velocity_temp_coeff: 0.002,
    bullet_length_mm: 28
  });

  const [optic, setOptic] = useState({
    name: "Tactical MIL",
    unit: "MIL",
    click_value: 0.1
  });

  const [reticleId, setReticleId] = useState(reticleProfiles[0]?.id ?? "generic-mil-grid");
  const [reticleVariantId, setReticleVariantId] = useState<string | null>(
    reticleProfiles[0]?.variants?.[0]?.id ?? null
  );
  const [magnification, setMagnification] = useState(DEFAULT_MAGNIFICATION_RANGE.min);
  const [reticleViewMode, setReticleViewMode] = useState<"hold" | "shift-target">("hold");

  const [weather, setWeather] = useState({
    temperature_c: 15,
    pressure_hpa: 1013.25,
    humidity_percent: 50,
    altitude_m: 200,
    wind_speed_mps: 3,
    wind_direction_deg: 90
  });

  const [geometry, setGeometry] = useState({
    distance_m: 300,
    shot_angle_deg: 0,
    azimuth_deg: 0,
    latitude_deg: 55
  });

  const [settings, setSettings] = useState({
    max_range_m: 1000,
    step_m: 10,
    time_step_s: 0.002,
    mode: "basic"
  });
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [targetId, setTargetId] = useState(targetModels[0].id);
  const [targetSizeOverride, setTargetSizeOverride] = useState({
    enabled: false,
    widthCm: targetModels[0].widthCm,
    heightCm: targetModels[0].heightCm
  });
  const [movingTarget, setMovingTarget] = useState({
    enabled: false,
    type: "walk",
    speed_mps: 1.5,
    direction_deg: 90,
    vertical_speed_mps: 0,
    pattern: "straight",
    arc_radius_m: 60,
    arc_direction: "right",
    zigzag_angle_deg: 25,
    zigzag_period_s: 2.4,
    animation_style: "smooth"
  });

  const [training, setTraining] = useState(true);
  const [activeSection, setActiveSection] = useState<"weapon" | "ammo" | "optic" | "weather" | "geometry">("weapon");
  const [rightTab, setRightTab] = useState<"results" | "reticle" | "graphs" | "table">("results");
  const [mobilePane, setMobilePane] = useState<"input" | "output">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const isPro = settings.mode === "pro";
  const unitOptions = [
    { value: "metric", label: "Метрическая (м, °C, м/с)" },
    { value: "imperial", label: "Имперская (yd, °F, ft/s)" }
  ];
  const unitLabels =
    unitSystem === "metric"
      ? {
          distance: "м",
          speed: "м/с",
          temp: "°C",
          pressure: "гПа",
          altitude: "м",
          length: "мм",
          smallLength: "см",
          energy: "Дж",
          drop: "см"
        }
      : {
          distance: "yd",
          speed: "ft/s",
          temp: "°F",
          pressure: "inHg",
          altitude: "ft",
          length: "in",
          smallLength: "in",
          energy: "ft·lb",
          drop: "in"
        };

  const displayDistance = (meters: number) =>
    unitSystem === "metric" ? meters : meters * M_TO_YD;
  const parseDistance = (value: number) =>
    unitSystem === "metric" ? value : value / M_TO_YD;
  const displaySpeed = (mps: number) =>
    unitSystem === "metric" ? mps : mps * M_TO_FT;
  const parseSpeed = (value: number) =>
    unitSystem === "metric" ? value : value / M_TO_FT;
  const displayTemp = (celsius: number) =>
    unitSystem === "metric" ? celsius : celsius * (9 / 5) + 32;
  const parseTemp = (value: number) =>
    unitSystem === "metric" ? value : (value - 32) * (5 / 9);
  const displayPressure = (hpa: number) =>
    unitSystem === "metric" ? hpa : hpa * HPA_TO_INHG;
  const parsePressure = (value: number) =>
    unitSystem === "metric" ? value : value / HPA_TO_INHG;
  const displayAltitude = (meters: number) =>
    unitSystem === "metric" ? meters : meters * M_TO_FT;
  const parseAltitude = (value: number) =>
    unitSystem === "metric" ? value : value / M_TO_FT;
  const displayLength = (mm: number) =>
    unitSystem === "metric" ? mm : mm * MM_TO_IN;
  const parseLength = (value: number) =>
    unitSystem === "metric" ? value : value / MM_TO_IN;
  const displayTempCoeff = (perC: number) =>
    unitSystem === "metric" ? perC : perC / 1.8;
  const parseTempCoeff = (value: number) =>
    unitSystem === "metric" ? value : value * 1.8;
  const displaySmallLength = (cm: number) =>
    unitSystem === "metric" ? cm : cm * CM_TO_IN;
  const parseSmallLength = (value: number) =>
    unitSystem === "metric" ? value : value / CM_TO_IN;
  const displayDrop = (meters: number) =>
    unitSystem === "metric" ? meters * CM_PER_M : meters * CM_PER_M * CM_TO_IN;
  const displayEnergy = (joules: number) =>
    unitSystem === "metric" ? joules : joules * J_TO_FTLB;

  const activeReticle =
    reticleProfiles.find((reticle) => reticle.id === reticleId) ?? reticleProfiles[0];
  const activeVariant =
    activeReticle?.variants?.find((variant) => variant.id === reticleVariantId) ??
    activeReticle?.variants?.[0] ??
    null;
  const activeSubtensions = activeVariant?.subtensions ?? activeReticle?.subtensions ?? [];
  const activeReticleImage = activeReticle?.imageSrc;
  const activeReticleImageAlt = activeReticle?.name;
  const magnificationRange =
    activeReticle?.opticFov
      ? {
          min: activeReticle.opticFov.minMagnification,
          max: activeReticle.opticFov.maxMagnification
        }
      : parseMagnificationRange(activeVariant?.name) ??
        parseMagnificationRange(activeReticle?.name) ??
        DEFAULT_MAGNIFICATION_RANGE;
  const reticlePattern = activeReticle
    ? {
        type: activeReticle.pattern,
        majorStep: activeReticle.majorStep,
        minorStep: activeReticle.minorStep,
        holdMarks: activeReticle.holdMarks
      }
    : undefined;

  useEffect(() => {
    setMagnification((current) => {
      if (current < magnificationRange.min || current > magnificationRange.max) {
        return magnificationRange.min;
      }
      return current;
    });
  }, [magnificationRange.min, magnificationRange.max]);

  const handleCalc = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        weapon,
        ammo,
        optic,
        weather,
        geometry,
        settings
      };
      const data = await solveBallistics(payload);
      setResult(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      setRightTab("results");
      setMobilePane("output");
    } catch (err: any) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setResult(JSON.parse(cached));
        setError("Ошибка расчета. Показаны последние сохраненные результаты.");
      } else {
        setError(err.message || "Ошибка расчета");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReticleChange = (id: string) => {
    const reticle = reticleProfiles.find((r) => r.id === id);
    setReticleId(id);
    setReticleVariantId(reticle?.variants?.[0]?.id ?? null);
    if (reticle && reticle.unit !== optic.unit) {
      setOptic((o) => ({ ...o, unit: reticle.unit }));
    }
  };

  const currentRow = useMemo(() => {
    if (!result?.table?.length) return null;
    let best = result.table[0];
    let bestDiff = Math.abs(best.distance_m - geometry.distance_m);
    for (const row of result.table) {
      const diff = Math.abs(row.distance_m - geometry.distance_m);
      if (diff < bestDiff) {
        best = row;
        bestDiff = diff;
      }
    }
    return best;
  }, [result, geometry.distance_m]);

  const interpolateRow = (distance: number) => {
    if (!result?.trajectory?.distance_m?.length) return null;
    const dist = result.trajectory.distance_m as number[];
    const clampDistance = Math.max(0, Math.min(distance, dist[dist.length - 1]));
    let idx = dist.findIndex((d) => d >= clampDistance);
    if (idx === -1) idx = dist.length - 1;
    if (idx === 0) idx = 1;
    const d0 = dist[idx - 1];
    const d1 = dist[idx];
    const t = d1 === d0 ? 0 : (clampDistance - d0) / (d1 - d0);
    const lerp = (arr: number[]) => arr[idx - 1] + (arr[idx] - arr[idx - 1]) * t;
    const drop = lerp(result.trajectory.drop_m);
    const drift = lerp(result.trajectory.drift_m);
    const time = lerp(result.trajectory.time_s);
    const velocity = lerp(result.trajectory.velocity_mps);
    const energy = lerp(result.trajectory.energy_j);
    const angleRad = Math.atan2(drop, Math.max(clampDistance, 1e-6));
    const correction = optic.unit === "MOA" ? moaFromRad(angleRad) : milFromRad(angleRad);
    return {
      distance_m: clampDistance,
      drop_m: drop,
      drift_m: drift,
      time_s: time,
      velocity_mps: velocity,
      energy_j: energy,
      correction,
      holdover: correction
    };
  };

  const computeMovingDisplacement = (timeS: number, speed: number, direction: number) => {
    const pattern = movingTarget.pattern ?? "straight";
    if (pattern === "arc") {
      return computeArcDisplacement(
        timeS,
        speed,
        direction,
        movingTarget.arc_radius_m,
        movingTarget.arc_direction === "left" ? "left" : "right"
      );
    }
    if (pattern === "zigzag") {
      return computeZigzagDisplacement(
        timeS,
        speed,
        direction,
        movingTarget.zigzag_angle_deg,
        movingTarget.zigzag_period_s
      );
    }
    const theta = direction * DEG_TO_RAD;
    return { radial: speed * Math.cos(theta) * timeS, lateral: speed * Math.sin(theta) * timeS };
  };

  const movingTargetData = useMemo(() => {
    if (!movingTarget.enabled || !currentRow) return null;
    const speed = Math.max(movingTarget.speed_mps, 0);
    const direction = movingTarget.direction_deg ?? 0;
    const baseDistance = geometry.distance_m;
    const timeBase = currentRow.time_s ?? 0;
    let displacement = computeMovingDisplacement(timeBase, speed, direction);
    let adjustedDistance = clampDistance(baseDistance + displacement.radial, settings.max_range_m);
    let adjustedRow = interpolateRow(adjustedDistance) ?? currentRow;
    if (adjustedRow?.time_s) {
      displacement = computeMovingDisplacement(adjustedRow.time_s, speed, direction);
      adjustedDistance = clampDistance(baseDistance + displacement.radial, settings.max_range_m);
      adjustedRow = interpolateRow(adjustedDistance) ?? adjustedRow;
    }
    const timeUse = adjustedRow?.time_s ?? timeBase;
    const leadMeters = displacement.lateral;
    const verticalLeadMeters = (movingTarget.vertical_speed_mps ?? 0) * timeUse;
    const leadAngleRad = Math.atan2(leadMeters, Math.max(adjustedDistance, 1e-6));
    const verticalLeadAngleRad = Math.atan2(verticalLeadMeters, Math.max(adjustedDistance, 1e-6));
    const leadUnits = optic.unit === "MOA" ? moaFromRad(leadAngleRad) : milFromRad(leadAngleRad);
    const verticalLeadUnits =
      optic.unit === "MOA" ? moaFromRad(verticalLeadAngleRad) : milFromRad(verticalLeadAngleRad);
    const leadClicks = optic.click_value ? leadUnits / optic.click_value : 0;
    const verticalLeadClicks = optic.click_value ? verticalLeadUnits / optic.click_value : 0;
    const leadLabel =
      Math.abs(leadUnits) < 1e-4
        ? "0.0"
        : `${leadUnits > 0 ? "R" : "L"} ${Math.abs(leadUnits).toFixed(2)} ${optic.unit}`;
    const verticalLeadLabel =
      Math.abs(verticalLeadUnits) < 1e-4
        ? "0.0"
        : `${verticalLeadUnits > 0 ? "Up" : "Down"} ${Math.abs(verticalLeadUnits).toFixed(2)} ${optic.unit}`;
    return {
      leadMeters,
      leadUnits,
      leadClicks,
      leadLabel,
      verticalLeadMeters,
      verticalLeadUnits,
      verticalLeadClicks,
      verticalLeadLabel,
      adjustedDistance,
      adjustedRow,
      timeUse
    };
  }, [
    movingTarget.enabled,
    movingTarget.speed_mps,
    movingTarget.direction_deg,
    movingTarget.vertical_speed_mps,
    movingTarget.pattern,
    movingTarget.arc_radius_m,
    movingTarget.arc_direction,
    movingTarget.zigzag_angle_deg,
    movingTarget.zigzag_period_s,
    geometry.distance_m,
    currentRow,
    result,
    optic.unit,
    optic.click_value,
    settings.max_range_m
  ]);

  const horizontalCorrection = useMemo(() => {
    if (!currentRow) return 0;
    const angleRad = Math.atan2(currentRow.drift_m, Math.max(currentRow.distance_m, 1e-6));
    return optic.unit === "MOA" ? moaFromRad(angleRad) : milFromRad(angleRad);
  }, [currentRow, optic.unit]);

  const windClicks = useMemo(() => {
    if (!currentRow || !optic.click_value) return 0;
    return horizontalCorrection / optic.click_value;
  }, [currentRow, horizontalCorrection, optic.click_value]);

  const effectiveRow = movingTargetData?.adjustedRow ?? currentRow;
  const effectiveHoldY = (effectiveRow ? effectiveRow.correction : 0) + (movingTargetData?.verticalLeadUnits ?? 0);
  const elevationClicks = useMemo(() => {
    if (!effectiveRow || !optic.click_value) return 0;
    return effectiveRow.correction / optic.click_value;
  }, [effectiveRow, optic.click_value]);

  const elevationClickLabel = useMemo(() => {
    if (!effectiveRow) return "—";
    const absClicks = Math.abs(elevationClicks).toFixed(1);
    if (elevationClicks > 0) return `U ${absClicks}`;
    if (elevationClicks < 0) return `D ${absClicks}`;
    return "0.0";
  }, [effectiveRow, elevationClicks]);

  const windClickLabel = useMemo(() => {
    if (!currentRow) return "—";
    const absClicks = Math.abs(windClicks).toFixed(1);
    if (windClicks > 0) return `R ${absClicks}`;
    if (windClicks < 0) return `L ${absClicks}`;
    return "0.0";
  }, [currentRow, windClicks]);

  const target = useMemo(
    () => targetModels.find((item) => item.id === targetId) ?? targetModels[0],
    [targetId]
  );

  useEffect(() => {
    if (!targetSizeOverride.enabled) {
      setTargetSizeOverride((prev) => ({
        ...prev,
        widthCm: target.widthCm,
        heightCm: target.heightCm
      }));
    }
  }, [targetId, target.widthCm, target.heightCm, targetSizeOverride.enabled]);

  const tableRows = useMemo(() => {
    if (!result?.table) return [];
    return result.table.filter((row: any) => row.distance_m % 100 === 0 && row.distance_m > 0);
  }, [result]);

  const computeMovingLeadForDistance = (distance: number) => {
    if (!movingTarget.enabled) return null;
    const baseRow = interpolateRow(distance);
    if (!baseRow) return null;
    const speed = Math.max(movingTarget.speed_mps, 0);
    const direction = movingTarget.direction_deg ?? 0;
    let displacement = computeMovingDisplacement(baseRow.time_s ?? 0, speed, direction);
    let adjustedDistance = clampDistance(distance + displacement.radial, settings.max_range_m);
    let adjustedRow = interpolateRow(adjustedDistance) ?? baseRow;
    if (adjustedRow?.time_s) {
      displacement = computeMovingDisplacement(adjustedRow.time_s, speed, direction);
      adjustedDistance = clampDistance(distance + displacement.radial, settings.max_range_m);
      adjustedRow = interpolateRow(adjustedDistance) ?? adjustedRow;
    }
    const timeUse = adjustedRow?.time_s ?? baseRow.time_s ?? 0;
    const leadMeters = displacement.lateral;
    const verticalLeadMeters = (movingTarget.vertical_speed_mps ?? 0) * timeUse;
    const leadAngleRad = Math.atan2(leadMeters, Math.max(adjustedDistance, 1e-6));
    const verticalLeadAngleRad = Math.atan2(verticalLeadMeters, Math.max(adjustedDistance, 1e-6));
    const leadUnits = optic.unit === "MOA" ? moaFromRad(leadAngleRad) : milFromRad(leadAngleRad);
    const verticalLeadUnits =
      optic.unit === "MOA" ? moaFromRad(verticalLeadAngleRad) : milFromRad(verticalLeadAngleRad);
    const leadClicks = optic.click_value ? leadUnits / optic.click_value : 0;
    const verticalLeadClicks = optic.click_value ? verticalLeadUnits / optic.click_value : 0;
    return {
      distance_m: distance,
      leadUnits,
      verticalLeadUnits,
      leadClicks,
      verticalLeadClicks,
      leadMeters,
      verticalLeadMeters,
      adjustedDistance,
      timeUse
    };
  };

  const movingLeadRows = useMemo(() => {
    if (!movingTarget.enabled || !result?.trajectory) return [];
    const rows: any[] = [];
    const max = Math.min(settings.max_range_m ?? 1000, 1500);
    for (let d = 100; d <= max; d += 100) {
      const leadRow = computeMovingLeadForDistance(d);
      if (leadRow) rows.push(leadRow);
    }
    return rows;
  }, [
    movingTarget.enabled,
    movingTarget.speed_mps,
    movingTarget.direction_deg,
    movingTarget.vertical_speed_mps,
    movingTarget.pattern,
    movingTarget.arc_radius_m,
    movingTarget.arc_direction,
    movingTarget.zigzag_angle_deg,
    movingTarget.zigzag_period_s,
    result,
    optic.unit,
    optic.click_value,
    settings.max_range_m
  ]);

  const windClicksForRow = (row: any) => {
    if (!row || !optic.click_value) return 0;
    const angleRad = Math.atan2(row.drift_m, Math.max(row.distance_m, 1e-6));
    const correction = optic.unit === "MOA" ? moaFromRad(angleRad) : milFromRad(angleRad);
    return correction / optic.click_value;
  };

  return (
    <div className="min-h-screen app-shell strelok-ui" data-mobile-pane={mobilePane}>
      <div className="app-header">
        <div className="mx-auto mobile-shell px-4 py-4 flex flex-col gap-3">
          <div className="header-top">
            <div className="header-title">
              <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Ballistic Pro</p>
              <h1 className="font-display text-2xl text-white">Профессиональный баллистический калькулятор</h1>
              <p className="text-xs text-slate-300 mt-1">
                Быстрый ввод, точная физика, готовые поправки.
              </p>
            </div>
            <div className="header-actions">
              <button
                type="button"
                className="settings-button"
                onClick={() => setSettingsOpen((s) => !s)}
              >
                <SettingsIcon className="h-5 w-5" />
                <span>Единицы</span>
              </button>
              {settingsOpen ? (
                <div className="settings-popover">
                  <p className="settings-title">Единицы измерения</p>
                  <select
                    className="settings-select"
                    value={unitSystem}
                    onChange={(event) => setUnitSystem(event.target.value as "metric" | "imperial")}
                  >
                    {unitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-200">
            <Toggle label="Обучение" checked={training} onChange={setTraining} />
            <button
              className={`rounded-lg px-3 py-2 text-xs border transition ${
                isPro ? "bg-slate-900/70 border-slate-700/70 text-slate-200" : "bg-emerald-500/80 text-white border-emerald-400/60"
              }`}
              onClick={() => setSettings((s) => ({ ...s, mode: "basic" }))}
            >
              Базовый
            </button>
            <button
              className={`rounded-lg px-3 py-2 text-xs border transition ${
                isPro ? "bg-emerald-500/80 text-white border-emerald-400/60" : "bg-slate-900/70 border-slate-700/70 text-slate-200"
              }`}
              onClick={() => setSettings((s) => ({ ...s, mode: "pro" }))}
            >
              Профи
            </button>
          </div>
          <div className="segment-bar">
                {[
                  { id: "weapon", label: "Оружие", icon: <TargetIcon className="h-4 w-4" /> },
                  { id: "ammo", label: "Патрон", icon: <BulletIcon className="h-4 w-4" /> },
                  { id: "optic", label: "Прицел", icon: <ScopeIcon className="h-4 w-4" /> },
                  { id: "weather", label: "Погода", icon: <WeatherIcon className="h-4 w-4" /> },
                  { id: "geometry", label: "Дистанция", icon: <DistanceIcon className="h-4 w-4" /> }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id as typeof activeSection);
                      setMobilePane("input");
                    }}
                    className={`segment-pill segment-pill-icon ${activeSection === item.id ? "active" : ""}`}
                  >
                <span className="segment-icon">{item.icon}</span>
                <span className="segment-label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="app-body mx-auto desktop-shell px-4 py-4">
        <div className="dashboard-grid">
          <div className="panel left-panel">
            {training ? (
              <div className="training-card rounded-xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <InfoIcon className="h-6 w-6 text-ocean" />
                  <h2 className="font-display text-base text-white">Режим обучения</h2>
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Здесь короткие объяснения. Наведите курсор на ⓘ у параметров, чтобы увидеть подсказку.
                </p>
                <div className="grid gap-3 mt-4">
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3">
                    <p className="text-xs text-slate-300">BC</p>
                    <p className="text-xs text-slate-200">Чем выше BC, тем меньше падение и влияние ветра.</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3">
                    <p className="text-xs text-slate-300">MIL / MOA</p>
                    <p className="text-xs text-slate-200">Угловые единицы поправок. MIL удобен для метрики, MOA часто в дюймах.</p>
                  </div>
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3">
                    <p className="text-xs text-slate-300">Кориолис</p>
                    <p className="text-xs text-slate-200">Вращение Земли слегка уводит пулю, особенно на больших дистанциях.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="panel-content">
            {activeSection === "weapon" ? (
              <SectionCard title="1. Оружие" subtitle="Профиль оружия и параметры ствола">
            <Field
              id="weapon-name"
              label="Название"
              tooltipKey="mode"
              value={weapon.name}
              onChange={(v) => setWeapon((w) => ({ ...w, name: v }))}
              type="text"
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
            <SelectField
              id="weapon-type"
              label="Тип оружия"
              tooltipKey="mode"
              value={weapon.weapon_type}
              onChange={(v) => setWeapon((w) => ({ ...w, weapon_type: v }))}
              options={[
                { value: "rifle", label: "Винтовка" },
                { value: "carbine", label: "Карабин" },
                { value: "air", label: "Пневматика" },
                { value: "bow", label: "Лук" }
              ]}
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="caliber"
              label="Калибр"
              tooltipKey="caliber"
              value={Number(displayLength(weapon.caliber_mm).toFixed(unitSystem === "metric" ? 2 : 3))}
              onChange={(v) => setWeapon((w) => ({ ...w, caliber_mm: parseLength(Number(v)) }))}
              unit={unitLabels.length}
              step={0.01}
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="barrel"
              label="Длина ствола"
              tooltipKey="barrelLength"
              value={Number(displayLength(weapon.barrel_length_mm).toFixed(unitSystem === "metric" ? 0 : 2))}
              onChange={(v) => setWeapon((w) => ({ ...w, barrel_length_mm: parseLength(Number(v)) }))}
              unit={unitLabels.length}
              step={1}
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
            {isPro ? (
              <>
                <Field
                  id="twist"
                  label="Твист"
                  tooltipKey="twist"
                  value={weapon.twist_rate_in}
                  onChange={(v) => setWeapon((w) => ({ ...w, twist_rate_in: Number(v) }))}
                  unit="дюйм/оборот"
                  step={0.1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="rifling"
                  label="Шаг нарезов"
                  tooltipKey="twist"
                  value={Number(displayLength(weapon.rifling_step_mm).toFixed(unitSystem === "metric" ? 0 : 2))}
                  onChange={(v) => setWeapon((w) => ({ ...w, rifling_step_mm: parseLength(Number(v)) }))}
                  unit={unitSystem === "metric" ? "мм/оборот" : "in/оборот"}
                  step={1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
              </>
            ) : null}
            <Field
              id="sight-height"
              label="Высота прицела"
              tooltipKey="sightHeight"
              value={Number(displayLength(weapon.sight_height_mm).toFixed(unitSystem === "metric" ? 1 : 2))}
              onChange={(v) => setWeapon((w) => ({ ...w, sight_height_mm: parseLength(Number(v)) }))}
              unit={unitLabels.length}
              step={0.5}
              icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="zero"
              label="Дистанция пристрелки"
              tooltipKey="zeroDistance"
              value={Number(displayDistance(weapon.zero_distance_m).toFixed(unitSystem === "metric" ? 0 : 1))}
              onChange={(v) => setWeapon((w) => ({ ...w, zero_distance_m: parseDistance(Number(v)) }))}
              unit={unitLabels.distance}
              step={1}
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
              </SectionCard>
            ) : null}

            {activeSection === "ammo" ? (
              <SectionCard title="2. Патрон" subtitle="Параметры боеприпаса">
            <Field
              id="ammo-name"
              label="Название"
              tooltipKey="mode"
              value={ammo.name}
              onChange={(v) => setAmmo((a) => ({ ...a, name: v }))}
              type="text"
              icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="weight"
              label="Вес пули"
              tooltipKey="bulletWeight"
              value={ammo.bullet_weight_grains}
              onChange={(v) => setAmmo((a) => ({ ...a, bullet_weight_grains: Number(v) }))}
              unit="gr"
              step={0.1}
              icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="muzzle"
              label="Начальная скорость"
              tooltipKey="muzzleVelocity"
              value={Number(displaySpeed(ammo.muzzle_velocity_mps).toFixed(unitSystem === "metric" ? 0 : 1))}
              onChange={(v) => setAmmo((a) => ({ ...a, muzzle_velocity_mps: parseSpeed(Number(v)) }))}
              unit={unitLabels.speed}
              step={1}
              icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="bc"
              label="BC"
              tooltipKey="bc"
              value={ammo.ballistic_coefficient}
              onChange={(v) => setAmmo((a) => ({ ...a, ballistic_coefficient: Number(v) }))}
              step={0.01}
              icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
            />
            <SelectField
              id="drag"
              label="Модель сопротивления"
              tooltipKey="dragModel"
              value={ammo.drag_model}
              onChange={(v) => setAmmo((a) => ({ ...a, drag_model: v }))}
              options={[
                { value: "G1", label: "G1" },
                { value: "G7", label: "G7" }
              ]}
              icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
            />
            {isPro ? (
              <>
                <Field
                  id="powder"
                  label="Температура пороха"
                  tooltipKey="powderTemp"
                  value={Number(displayTemp(ammo.powder_temp_c).toFixed(unitSystem === "metric" ? 0 : 1))}
                  onChange={(v) => setAmmo((a) => ({ ...a, powder_temp_c: parseTemp(Number(v)) }))}
                  unit={unitLabels.temp}
                  step={1}
                  icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="temp-coeff"
                  label="Коэффициент скорости"
                  tooltipKey="powderTemp"
                  value={Number(displayTempCoeff(ammo.muzzle_velocity_temp_coeff).toFixed(3))}
                  onChange={(v) =>
                    setAmmo((a) => ({ ...a, muzzle_velocity_temp_coeff: parseTempCoeff(Number(v)) }))
                  }
                  unit={unitSystem === "metric" ? "1/°C" : "1/°F"}
                  step={0.001}
                  icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="bullet-length"
                  label="Длина пули"
                  tooltipKey="bulletLength"
                  value={Number(displayLength(ammo.bullet_length_mm).toFixed(unitSystem === "metric" ? 1 : 2))}
                  onChange={(v) => setAmmo((a) => ({ ...a, bullet_length_mm: parseLength(Number(v)) }))}
                  unit={unitLabels.length}
                  step={0.1}
                  icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
                />
              </>
            ) : null}
              </SectionCard>
            ) : null}

            {activeSection === "optic" ? (
              <SectionCard title="3. Прицел" subtitle="Система поправок">
            <Field
              id="optic-name"
              label="Название"
              tooltipKey="mode"
              value={optic.name}
              onChange={(v) => setOptic((o) => ({ ...o, name: v }))}
              type="text"
              icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
            />
            <SelectField
              id="unit"
              label="Система"
              tooltipKey="unit"
              value={optic.unit}
              onChange={(v) => setOptic((o) => ({ ...o, unit: v }))}
              options={[
                { value: "MIL", label: "MIL" },
                { value: "MOA", label: "MOA" }
              ]}
              icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="click"
              label="Шаг клика"
              tooltipKey="clickValue"
              value={optic.click_value}
              onChange={(v) => setOptic((o) => ({ ...o, click_value: Number(v) }))}
              step={0.01}
              icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
            />
            <SelectField
              id="reticle"
              label="Сетка прицела"
              tooltipKey="reticle"
              value={reticleId}
              onChange={handleReticleChange}
              options={reticleProfiles.map((reticle) => ({
                value: reticle.id,
                label: reticle.name
              }))}
              icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
            />
            {activeReticle?.variants?.length ? (
              <SelectField
                id="reticle-variant"
                label="Вариант сетки"
                tooltipKey="reticle"
                value={activeVariant?.id ?? ""}
                onChange={(v) => setReticleVariantId(v)}
                options={activeReticle.variants.map((variant) => ({
                  value: variant.id,
                  label: variant.name
                }))}
                icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
              />
            ) : null}
            {activeSubtensions.length ? (
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
                <p className="font-semibold text-sand">Субтензии</p>
                <div className="mt-2 grid gap-1">
                  {activeSubtensions.map((entry) => (
                    <div key={entry.label} className="flex items-center justify-between">
                      <span>{entry.label}</span>
                      <span className="font-semibold text-sand">
                        {entry.value} {entry.unit}
                      </span>
                    </div>
                  ))}
                </div>
                {activeReticle?.note ? (
                  <p className="mt-2 text-[11px] text-slate-300">{activeReticle.note}</p>
                ) : null}
              </div>
            ) : null}
              </SectionCard>
            ) : null}

            {activeSection === "weather" ? (
              <SectionCard title="4. Погода" subtitle="Текущие условия">
            <div className="weather-strelok">
              <div className="weather-readouts">
              <Field
                id="temp"
                label="Температура"
                tooltipKey="temperature"
                value={Number(displayTemp(weather.temperature_c).toFixed(1))}
                onChange={(v) => setWeather((w) => ({ ...w, temperature_c: parseTemp(Number(v)) }))}
                unit={unitLabels.temp}
                step={unitSystem === "metric" ? 1 : 1}
                icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
              />
              <Field
                id="pressure"
                label="Давление"
                tooltipKey="pressure"
                value={Number(displayPressure(weather.pressure_hpa).toFixed(unitSystem === "metric" ? 1 : 2))}
                onChange={(v) => setWeather((w) => ({ ...w, pressure_hpa: parsePressure(Number(v)) }))}
                unit={unitLabels.pressure}
                step={unitSystem === "metric" ? 1 : 0.01}
                icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
              />
              <Field
                id="humidity"
                label="Влажность"
                  tooltipKey="humidity"
                  value={weather.humidity_percent}
                  onChange={(v) => setWeather((w) => ({ ...w, humidity_percent: Number(v) }))}
                  unit="%"
                  step={1}
                  icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
                />
              <Field
                id="altitude"
                label="Высота"
                tooltipKey="altitude"
                value={Number(displayAltitude(weather.altitude_m).toFixed(unitSystem === "metric" ? 0 : 1))}
                onChange={(v) => setWeather((w) => ({ ...w, altitude_m: parseAltitude(Number(v)) }))}
                unit={unitLabels.altitude}
                step={unitSystem === "metric" ? 1 : 1}
                icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
              />
              </div>
              <div className="weather-dial">
                <WindDial
                  directionDeg={weather.wind_direction_deg}
                  speedMps={displaySpeed(weather.wind_speed_mps)}
                  unitLabel={unitLabels.speed}
                  onChange={(value) => setWeather((w) => ({ ...w, wind_direction_deg: value }))}
                />
                <Field
                  id="wind"
                  label="Скорость ветра"
                  tooltipKey="windSpeed"
                  value={Number(displaySpeed(weather.wind_speed_mps).toFixed(1))}
                  onChange={(v) =>
                    setWeather((w) => ({
                      ...w,
                      wind_speed_mps: Math.max(0, parseSpeed(Number(v)))
                    }))
                  }
                  unit={unitLabels.speed}
                  step={0.1}
                  min={0}
                  icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
                />
              </div>
            </div>
              </SectionCard>
            ) : null}

            {activeSection === "geometry" ? (
              <SectionCard title="5. Дистанция и геометрия" subtitle="Позиция цели и стрелка">
            <Field
              id="distance"
              label="Дистанция"
              tooltipKey="distance"
              value={Number(displayDistance(geometry.distance_m).toFixed(unitSystem === "metric" ? 0 : 1))}
              onChange={(v) => setGeometry((g) => ({ ...g, distance_m: parseDistance(Number(v)) }))}
              unit={unitLabels.distance}
              step={1}
              icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
            />
            <SelectField
              id="target-model"
              label="Модель мишени"
              tooltipKey="target"
              value={targetId}
              onChange={setTargetId}
              options={targetModels.map((item) => ({
                value: item.id,
                label: item.name
              }))}
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
            <div className="mt-2">
              <Toggle
                label="Свой размер цели"
                checked={targetSizeOverride.enabled}
                onChange={(value) =>
                  setTargetSizeOverride((prev) => ({
                    ...prev,
                    enabled: value,
                    widthCm: value ? prev.widthCm : target.widthCm,
                    heightCm: value ? prev.heightCm : target.heightCm
                  }))
                }
              />
            </div>
            {targetSizeOverride.enabled ? (
              <div className="grid gap-2">
                <Field
                  id="target-width-custom"
                  label="Ширина цели"
                  tooltipKey="target"
                  value={Number(displaySmallLength(targetSizeOverride.widthCm).toFixed(unitSystem === "metric" ? 0 : 1))}
                  onChange={(v) =>
                    setTargetSizeOverride((prev) => ({ ...prev, widthCm: parseSmallLength(Number(v)) }))
                  }
                  unit={unitLabels.smallLength}
                  step={1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="target-height-custom"
                  label="Высота цели"
                  tooltipKey="target"
                  value={Number(displaySmallLength(targetSizeOverride.heightCm).toFixed(unitSystem === "metric" ? 0 : 1))}
                  onChange={(v) =>
                    setTargetSizeOverride((prev) => ({ ...prev, heightCm: parseSmallLength(Number(v)) }))
                  }
                  unit={unitLabels.smallLength}
                  step={1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="font-semibold text-white">Размер мишени</p>
              <p className="mt-1 text-slate-200">
                {targetSizeOverride.enabled
                  ? `${displaySmallLength(targetSizeOverride.widthCm).toFixed(0)} × ${displaySmallLength(targetSizeOverride.heightCm).toFixed(0)}`
                  : `${displaySmallLength(target.widthCm).toFixed(0)} × ${displaySmallLength(target.heightCm).toFixed(0)}`} {unitLabels.smallLength}
              </p>
            </div>
            <Field
              id="shot-angle"
              label="Угол места цели"
              tooltipKey="shotAngle"
              value={geometry.shot_angle_deg}
              onChange={(v) => setGeometry((g) => ({ ...g, shot_angle_deg: Number(v) }))}
              unit="°"
              step={0.1}
              icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
            />
            <div className="mt-2">
              <Toggle
                label="Движущаяся цель"
                checked={movingTarget.enabled}
                onChange={(value) => setMovingTarget((m) => ({ ...m, enabled: value }))}
              />
            </div>
            {movingTarget.enabled ? (
              <div className="mt-3 grid gap-3">
                <SelectField
                  id="moving-target-type"
                  label="Тип цели"
                  tooltipKey="target"
                  value={movingTarget.type}
                  onChange={(v) => {
                    const nextType = v;
                    const preset = targetMotionTypes.find((item) => item.id === nextType);
                    const targetMap: Record<string, string> = {
                      boar: "boar-silhouette",
                      deer: "deer-silhouette",
                      moose: "moose-silhouette",
                      bear: "bear-silhouette",
                      fox: "fox-silhouette",
                      wolf: "wolf-silhouette",
                      roe: "roe-silhouette",
                      walk: "human-silhouette",
                      run: "human-silhouette"
                    };
                    if (targetMap[nextType]) {
                      setTargetId(targetMap[nextType]);
                    }
                    setMovingTarget((m) => ({
                      ...m,
                      type: nextType,
                      speed_mps: preset?.speed ?? m.speed_mps
                    }));
                  }}
                  options={targetMotionTypes.map((item) => ({ value: item.id, label: item.label }))}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="moving-target-speed"
                  label="Скорость цели"
                  tooltipKey="target"
                  value={Number(displaySpeed(movingTarget.speed_mps).toFixed(1))}
                  onChange={(v) =>
                    setMovingTarget((m) => ({ ...m, speed_mps: parseSpeed(Number(v)), type: "custom" }))
                  }
                  unit={unitLabels.speed}
                  step={0.1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="moving-target-vertical-speed"
                  label="Вертикальная скорость"
                  tooltipKey="target"
                  value={Number(displaySpeed(movingTarget.vertical_speed_mps).toFixed(1))}
                  onChange={(v) =>
                    setMovingTarget((m) => ({ ...m, vertical_speed_mps: parseSpeed(Number(v)) }))
                  }
                  unit={unitLabels.speed}
                  step={0.1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <SelectField
                  id="moving-target-direction"
                  label="Направление движения"
                  tooltipKey="target"
                  value={String(movingTarget.direction_deg)}
                  onChange={(v) => setMovingTarget((m) => ({ ...m, direction_deg: Number(v) }))}
                  options={targetDirectionPresets.map((item) => ({ value: String(item.value), label: item.label }))}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="moving-target-direction-custom"
                  label="Угол вручную"
                  tooltipKey="target"
                  value={movingTarget.direction_deg}
                  onChange={(v) => setMovingTarget((m) => ({ ...m, direction_deg: Number(v) }))}
                  unit="°"
                  step={1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <SelectField
                  id="moving-target-pattern"
                  label="Траектория цели"
                  tooltipKey="target"
                  value={movingTarget.pattern}
                  onChange={(v) => setMovingTarget((m) => ({ ...m, pattern: v }))}
                  options={motionPatternOptions}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                <SelectField
                  id="moving-target-animation"
                  label="Анимация движения"
                  tooltipKey="target"
                  value={movingTarget.animation_style}
                  onChange={(v) => setMovingTarget((m) => ({ ...m, animation_style: v }))}
                  options={motionAnimationStyles}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
                {movingTarget.pattern === "arc" ? (
                  <>
                    <Field
                      id="moving-target-arc-radius"
                      label="Радиус поворота"
                      tooltipKey="target"
                      value={Number(displayDistance(movingTarget.arc_radius_m).toFixed(unitSystem === "metric" ? 0 : 1))}
                      onChange={(v) =>
                        setMovingTarget((m) => ({ ...m, arc_radius_m: parseDistance(Number(v)) }))
                      }
                      unit={unitLabels.distance}
                      step={1}
                      icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                    />
                    <SelectField
                      id="moving-target-arc-direction"
                      label="Направление поворота"
                      tooltipKey="target"
                      value={movingTarget.arc_direction}
                      onChange={(v) => setMovingTarget((m) => ({ ...m, arc_direction: v }))}
                      options={motionArcDirections}
                      icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                    />
                  </>
                ) : null}
                {movingTarget.pattern === "zigzag" ? (
                  <>
                    <Field
                      id="moving-target-zigzag-angle"
                      label="Угол зигзага"
                      tooltipKey="target"
                      value={movingTarget.zigzag_angle_deg}
                      onChange={(v) => setMovingTarget((m) => ({ ...m, zigzag_angle_deg: Number(v) }))}
                      unit="°"
                      step={1}
                      icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                    />
                    <Field
                      id="moving-target-zigzag-period"
                      label="Период зигзага"
                      tooltipKey="target"
                      value={movingTarget.zigzag_period_s}
                      onChange={(v) => setMovingTarget((m) => ({ ...m, zigzag_period_s: Number(v) }))}
                      unit="с"
                      step={0.1}
                      icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                    />
                  </>
                ) : null}
                {movingTargetData ? (
                  <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
                    <p className="font-semibold text-white">Расчет упреждения</p>
                    <p className="mt-1">Упреждение: {movingTargetData.leadLabel}</p>
                    <p className="mt-1">Упреждение по высоте: {movingTargetData.verticalLeadLabel}</p>
                    <p className="mt-1">Эффективная дистанция: {movingTargetData.adjustedDistance.toFixed(0)} м</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isPro ? (
              <>
                <Field
                  id="azimuth"
                  label="Азимут"
                  tooltipKey="azimuth"
                  value={geometry.azimuth_deg}
                  onChange={(v) => setGeometry((g) => ({ ...g, azimuth_deg: Number(v) }))}
                  unit="°"
                  step={1}
                  icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="latitude"
                  label="Широта"
                  tooltipKey="latitude"
                  value={geometry.latitude_deg}
                  onChange={(v) => setGeometry((g) => ({ ...g, latitude_deg: Number(v) }))}
                  unit="°"
                  step={0.1}
                  icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="max-range"
                  label="Макс. дальность"
                  tooltipKey="maxRange"
                  value={Number(displayDistance(settings.max_range_m).toFixed(unitSystem === "metric" ? 0 : 1))}
                  onChange={(v) => setSettings((s) => ({ ...s, max_range_m: parseDistance(Number(v)) }))}
                  unit={unitLabels.distance}
                  step={10}
                  icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="step"
                  label="Шаг таблицы"
                  tooltipKey="step"
                  value={Number(displayDistance(settings.step_m).toFixed(unitSystem === "metric" ? 0 : 1))}
                  onChange={(v) => setSettings((s) => ({ ...s, step_m: parseDistance(Number(v)) }))}
                  unit={unitLabels.distance}
                  step={1}
                  icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="time-step"
                  label="Шаг интеграции"
                  tooltipKey="step"
                  value={settings.time_step_s}
                  onChange={(v) => setSettings((s) => ({ ...s, time_step_s: Number(v) }))}
                  unit="с"
                  step={0.001}
                  icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
                />
              </>
            ) : null}
              </SectionCard>
            ) : null}
            </div>
          </div>

          <div
            className="panel right-panel"
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              touchStartRef.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const touch = event.changedTouches[0];
              if (!touch || !touchStartRef.current) return;
              const dx = touch.clientX - touchStartRef.current.x;
              const dy = touch.clientY - touchStartRef.current.y;
              touchStartRef.current = null;
              if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
              const order: Array<typeof rightTab> = ["results", "reticle", "graphs", "table"];
              const currentIndex = order.indexOf(rightTab);
              if (currentIndex === -1) return;
              const nextIndex = dx < 0 ? Math.min(order.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
              if (nextIndex !== currentIndex) {
                setRightTab(order[nextIndex]);
              }
            }}
          >
            <div className="panel-toolbar">
              <div className="segment-bar desktop-only">
                {[
                  { id: "results", label: "Результаты" },
                  { id: "reticle", label: "Прицел" },
                  { id: "graphs", label: "Графики" },
                  { id: "table", label: "Таблица" }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRightTab(item.id as typeof rightTab)}
                    className={`segment-pill ${rightTab === item.id ? "active" : ""}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                className="rounded-full bg-emerald-500/90 px-5 py-2 text-white text-sm shadow-glow"
                onClick={handleCalc}
              >
                {loading ? "Расчет..." : "Рассчитать"}
              </button>
            </div>

            <div className="panel-content">
            {rightTab === "results" ? (
            <SectionCard title="6. Результаты" subtitle="Поправки, клики и траектория">
              <div className="grid gap-3 grid-cols-2">
              <StatCard
                label="Вертикальная поправка"
                value={effectiveRow ? `${effectiveRow.correction.toFixed(2)} ${optic.unit}` : "—"}
                highlight
              />
              <StatCard
                label="Клики по высоте"
                value={elevationClickLabel}
              />
              <StatCard
                label="Горизонтальная поправка"
                value={currentRow ? `${horizontalCorrection.toFixed(2)} ${optic.unit}` : "—"}
              />
              <StatCard
                label="Клики по ветру"
                value={windClickLabel}
              />
              <StatCard
                label="Время полета"
                value={currentRow ? `${currentRow.time_s.toFixed(2)} c` : "—"}
              />
              <StatCard
                label="Скорость"
                value={effectiveRow ? `${displaySpeed(effectiveRow.velocity_mps).toFixed(1)} ${unitLabels.speed}` : "—"}
              />
              <StatCard
                label="Энергия"
                value={effectiveRow ? `${displayEnergy(effectiveRow.energy_j).toFixed(0)} ${unitLabels.energy}` : "—"}
              />
              <StatCard
                label="Падение"
                value={effectiveRow ? `${displayDrop(effectiveRow.drop_m).toFixed(1)} ${unitLabels.drop}` : "—"}
              />
              <StatCard
                label="Снос ветром"
                value={effectiveRow ? `${displayDrop(effectiveRow.drift_m).toFixed(1)} ${unitLabels.drop}` : "—"}
              />
              {movingTargetData ? (
                <>
                  <StatCard
                    label="Упреждение цели"
                    value={movingTargetData.leadLabel}
                  />
                  <StatCard
                    label="Упреждение (клики)"
                    value={
                      optic.click_value
                        ? `${movingTargetData.leadClicks > 0 ? "R" : movingTargetData.leadClicks < 0 ? "L" : ""} ${Math.abs(movingTargetData.leadClicks).toFixed(1)}`
                        : "—"
                    }
                  />
                  <StatCard
                    label="Упреждение по высоте"
                    value={movingTargetData.verticalLeadLabel}
                  />
                  <StatCard
                    label="Упреждение (клики, высота)"
                    value={
                      optic.click_value
                        ? `${movingTargetData.verticalLeadClicks > 0 ? "U" : movingTargetData.verticalLeadClicks < 0 ? "D" : ""} ${Math.abs(movingTargetData.verticalLeadClicks).toFixed(1)}`
                        : "—"
                    }
                  />
                  <StatCard
                    label="Итог по высоте"
                    value={`${effectiveHoldY.toFixed(2)} ${optic.unit}`}
                  />
                  <StatCard
                    label="Эфф. дистанция"
                    value={`${displayDistance(movingTargetData.adjustedDistance).toFixed(unitSystem === "metric" ? 0 : 1)} ${unitLabels.distance}`}
                  />
                  <StatCard
                    label={`Упреждение (${unitLabels.drop})`}
                    value={`${displayDrop(movingTargetData.leadMeters).toFixed(1)} ${unitLabels.drop}`}
                  />
                  <StatCard
                    label={`Упреждение (${unitLabels.drop}, высота)`}
                    value={`${displayDrop(movingTargetData.verticalLeadMeters).toFixed(1)} ${unitLabels.drop}`}
                  />
                </>
              ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
              <StatCard
                label="Плотность воздуха"
                value={result ? `${result.summary.air_density.toFixed(3)} кг/м³` : "—"}
              />
              <StatCard
                label="Скорость звука"
                value={
                  result
                    ? `${displaySpeed(result.summary.speed_of_sound_mps).toFixed(1)} ${unitLabels.speed}`
                    : "—"
                }
              />
              <StatCard
                label="Стабильность (SG)"
                value={result?.summary?.stability_sg ? result.summary.stability_sg.toFixed(2) : "—"}
              />
              </div>
              {error ? <p className="text-sm text-ember mt-3">{error}</p> : null}
            </SectionCard>
            ) : null}

            {rightTab === "reticle" ? (
            <div className="reticle-panel space-y-3">
              <div className="reticle-header flex items-center justify-between">
                <div className="reticle-title">
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Reticle</p>
                  <p className="text-sm text-white">Симуляция прицела</p>
                </div>
                <div className="reticle-mode">
                  <span className="text-xs text-slate-400">
                    {optic.unit} · {activeReticle?.focalPlane === "FFP" ? "FFP" : "SFP"}
                  </span>
                </div>
              </div>

              <div className="reticle-controls">
                <div className="reticle-zoom">
                  <span className="text-xs text-slate-400">Кратность</span>
                  <span className="text-lg text-white font-semibold">{magnification.toFixed(1)}x</span>
                  <span className="text-[11px] text-slate-500">
                    {magnificationRange.min.toFixed(1)}x - {magnificationRange.max.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={magnificationRange.min}
                  max={magnificationRange.max}
                  step={0.1}
                  value={magnification}
                  onChange={(event) => setMagnification(Number(event.target.value))}
                  className="scope-slider reticle-slider"
                />
                <div className="reticle-toggle">
                  <button
                    type="button"
                    onClick={() => setReticleViewMode("hold")}
                    className={`reticle-pill ${reticleViewMode === "hold" ? "active" : ""}`}
                  >
                    Вынос
                  </button>
                  <button
                    type="button"
                    onClick={() => setReticleViewMode("shift-target")}
                    className={`reticle-pill ${reticleViewMode === "shift-target" ? "active" : ""}`}
                  >
                    Смещение
                  </button>
                </div>
              </div>

              <div className="reticle-frame">
                <ReticleCanvas
                  holdX={horizontalCorrection}
                  leadX={movingTargetData?.leadUnits ?? 0}
                  leadY={movingTargetData?.verticalLeadUnits ?? 0}
                  holdY={effectiveRow ? effectiveRow.correction : 0}
                  unit={optic.unit as "MIL" | "MOA"}
                  pattern={reticlePattern}
                  imageSrc={activeReticleImage}
                  imageAlt={activeReticleImageAlt}
                  vectorStyle={activeReticle?.vectorStyle}
                  focalPlane={activeReticle?.focalPlane}
                  magnification={magnification}
                  minMagnification={magnificationRange.min}
                  maxMagnification={magnificationRange.max}
                  distanceMeters={geometry.distance_m}
                  targetWidthCm={targetSizeOverride.enabled ? targetSizeOverride.widthCm : target.widthCm}
                  targetHeightCm={targetSizeOverride.enabled ? targetSizeOverride.heightCm : target.heightCm}
                  targetShape={target.shape}
                  targetStyle={target.style}
                  targetImageSrc={target.imageSrc}
                  targetMotion={
                    movingTarget.enabled
                      ? {
                          enabled: movingTarget.enabled,
                          speedMps: movingTarget.speed_mps,
                          directionDeg: movingTarget.direction_deg,
                          verticalSpeedMps: movingTarget.vertical_speed_mps,
                          pattern: movingTarget.pattern,
                          arcRadiusM: movingTarget.arc_radius_m,
                          arcDirection: movingTarget.arc_direction,
                          zigzagAngleDeg: movingTarget.zigzag_angle_deg,
                          zigzagPeriodS: movingTarget.zigzag_period_s,
                          animationStyle: movingTarget.animation_style
                        }
                      : undefined
                  }
                  viewMode={reticleViewMode}
                  opticFov={activeReticle?.opticFov}
                />
              </div>
            </div>
            ) : null}

            {rightTab === "graphs" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-ocean" />
                <h2 className="font-display text-base text-white">Графики</h2>
              </div>
              {result ? (
                <TrajectoryCharts
                  distance={result.trajectory.distance_m}
                  drop={result.trajectory.drop_m}
                  drift={result.trajectory.drift_m}
                  velocity={result.trajectory.velocity_mps}
                  energy={result.trajectory.energy_j}
                />
              ) : (
                <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-4 text-xs text-slate-300">
                  Сначала выполните расчет.
                </div>
              )}
            </div>
            ) : null}

            {rightTab === "table" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ResultIcon className="h-5 w-5 text-ocean" />
                <h2 className="font-display text-base text-white">Таблица стрельбы</h2>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-900/80">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/90 text-slate-200 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Distance ({unitLabels.distance})</th>
                      <th className="px-4 py-3 text-left">Drop ({unitLabels.drop})</th>
                      <th className="px-4 py-3 text-left">Wind drift ({unitLabels.drop})</th>
                      <th className="px-4 py-3 text-left">Clicks (R/L)</th>
                      <th className="px-4 py-3 text-left">Holdover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length ? (
                      tableRows.map((row: any) => (
                        <tr key={row.distance_m} className="border-t border-slate-700/70 text-slate-200">
                          <td className="px-4 py-3">
                            {displayDistance(row.distance_m).toFixed(unitSystem === "metric" ? 0 : 1)} {unitLabels.distance}
                          </td>
                          <td className="px-4 py-3">{displayDrop(row.drop_m).toFixed(1)}</td>
                          <td className="px-4 py-3">{displayDrop(row.drift_m).toFixed(1)}</td>
                          <td className="px-4 py-3">
                            {(() => {
                              const clicks = windClicksForRow(row);
                              if (clicks === 0) return "0.0";
                              const abs = Math.abs(clicks).toFixed(1);
                              return clicks > 0 ? `R ${abs}` : `L ${abs}`;
                            })()}
                          </td>
                          <td className="px-4 py-3">{row.holdover.toFixed(2)} {optic.unit}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="px-4 py-3 text-slate-300" colSpan={5}>
                          Нет данных. Выполните расчет.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}

            {rightTab === "table" && movingTarget.enabled ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ResultIcon className="h-5 w-5 text-ocean" />
                  <h2 className="font-display text-base text-white">Упреждение по движущейся цели</h2>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-900/80">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900/90 text-slate-200 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 text-left">Distance ({unitLabels.distance})</th>
                        <th className="px-4 py-3 text-left">Lead (L/R)</th>
                        <th className="px-4 py-3 text-left">Lead (Up/Down)</th>
                        <th className="px-4 py-3 text-left">Clicks (L/R)</th>
                        <th className="px-4 py-3 text-left">Clicks (U/D)</th>
                        <th className="px-4 py-3 text-left">Lead ({unitLabels.drop})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movingLeadRows.length ? (
                        movingLeadRows.map((row) => (
                        <tr key={`lead-${row.distance_m}`} className="border-t border-slate-700/70 text-slate-200">
                          <td className="px-4 py-3">
                            {displayDistance(row.distance_m).toFixed(unitSystem === "metric" ? 0 : 1)} {unitLabels.distance}
                          </td>
                            <td className="px-4 py-3">
                              {row.leadUnits === 0
                                ? "0.0"
                                : `${row.leadUnits > 0 ? "R" : "L"} ${Math.abs(row.leadUnits).toFixed(2)} ${optic.unit}`}
                            </td>
                            <td className="px-4 py-3">
                              {row.verticalLeadUnits === 0
                                ? "0.0"
                                : `${row.verticalLeadUnits > 0 ? "Up" : "Down"} ${Math.abs(row.verticalLeadUnits).toFixed(2)} ${optic.unit}`}
                            </td>
                            <td className="px-4 py-3">
                              {optic.click_value
                                ? `${row.leadClicks > 0 ? "R" : row.leadClicks < 0 ? "L" : ""} ${Math.abs(row.leadClicks).toFixed(1)}`
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {optic.click_value
                                ? `${row.verticalLeadClicks > 0 ? "U" : row.verticalLeadClicks < 0 ? "D" : ""} ${Math.abs(row.verticalLeadClicks).toFixed(1)}`
                                : "—"}
                            </td>
                          <td className="px-4 py-3">
                            {`${displayDrop(row.leadMeters).toFixed(1)} / ${displayDrop(row.verticalLeadMeters).toFixed(1)}`}
                          </td>
                        </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-4 py-3 text-slate-300" colSpan={6}>
                            Нет данных. Выполните расчет.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>

        <footer className="mt-4 text-xs text-slate-500">
          Ballistic Pro — PWA с офлайн режимом, расчетами RK4 и поддержкой G1/G7.
        </footer>
      </div>
      <div className="mobile-bottom-nav mobile-only">
        <button
          type="button"
          className={`nav-item ${mobilePane === "input" ? "active" : ""}`}
          onClick={() => setMobilePane("input")}
        >
          <TargetIcon className="h-5 w-5" />
          <span>Ввод</span>
        </button>
        <button
          type="button"
          className={`nav-item ${mobilePane === "output" && rightTab === "results" ? "active" : ""}`}
          onClick={() => {
            setMobilePane("output");
            setRightTab("results");
          }}
        >
          <ResultIcon className="h-5 w-5" />
          <span>Результ</span>
        </button>
        <button
          type="button"
          className={`nav-item ${mobilePane === "output" && rightTab === "reticle" ? "active" : ""}`}
          onClick={() => {
            setMobilePane("output");
            setRightTab("reticle");
          }}
        >
          <ScopeIcon className="h-5 w-5" />
          <span>Прицел</span>
        </button>
        <button
          type="button"
          className={`nav-item ${mobilePane === "output" && rightTab === "graphs" ? "active" : ""}`}
          onClick={() => {
            setMobilePane("output");
            setRightTab("graphs");
          }}
        >
          <SettingsIcon className="h-5 w-5" />
          <span>График</span>
        </button>
        <button
          type="button"
          className={`nav-item ${mobilePane === "output" && rightTab === "table" ? "active" : ""}`}
          onClick={() => {
            setMobilePane("output");
            setRightTab("table");
          }}
        >
          <DistanceIcon className="h-5 w-5" />
          <span>Табл</span>
        </button>
      </div>
    </div>
  );
}
