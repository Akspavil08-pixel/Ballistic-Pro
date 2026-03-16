import { useEffect, useRef, useState } from "react";

interface ReticlePattern {
  type: "mil-grid" | "moa-hash" | "bdc" | "simple" | "grid";
  majorStep?: number;
  minorStep?: number;
  holdMarks?: number[];
}

interface ReticleProps {
  holdX: number;
  leadX?: number;
  leadY?: number;
  holdY: number;
  unit: "MIL" | "MOA";
  pattern?: ReticlePattern;
  imageSrc?: string;
  imageAlt?: string;
  vectorStyle?:
    | "nightforce-4a-i"
    | "nightforce-moa-c"
    | "nightforce-mil-c"
    | "nightforce-mil-xt"
    | "nightforce-mil-r"
    | "nightforce-fc-dmx"
    | "vector-vco2-mil"
    | "vector-vos-tmoa";
  focalPlane?: "FFP" | "SFP";
  magnification?: number;
  minMagnification?: number;
  maxMagnification?: number;
  distanceMeters?: number;
  targetWidthCm?: number;
  targetHeightCm?: number;
  targetShape?: "rect" | "circle";
  targetStyle?:
    | "paper"
    | "chest"
    | "standing"
    | "steel-plate"
    | "steel-popper"
    | "animal-deer"
    | "animal-boar"
    | "animal-moose"
    | "animal-bear"
    | "animal-fox";
  targetImageSrc?: string;
  viewMode?: "hold" | "shift-target";
  opticFov?: {
    minMagnification: number;
    maxMagnification: number;
    minMetersAt100m: number;
    maxMetersAt100m: number;
    sourceUrl?: string;
  };
}

const radToMil = (rad: number) => rad * 1000;
const radToMoa = (rad: number) => (rad * 180 * 60) / Math.PI;

function useAnimatedNumber(target: number, speed = 0.22, epsilon = 0.0005) {
  const [value, setValue] = useState(target);
  const valueRef = useRef(target);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    let frame = 0;

    const tick = () => {
      const current = valueRef.current;
      const delta = target - current;

      if (Math.abs(delta) < epsilon) {
        valueRef.current = target;
        setValue(target);
        return;
      }

      const next = current + delta * speed;
      valueRef.current = next;
      setValue(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, speed, epsilon]);

  return value;
}

function angularSizeToUnit(sizeCm: number, distanceMeters: number, unit: "MIL" | "MOA") {
  if (sizeCm <= 0 || distanceMeters <= 0) return 0;
  const sizeMeters = sizeCm / 100;
  const angle = 2 * Math.atan2(sizeMeters / 2, distanceMeters);
  return unit === "MOA" ? radToMoa(angle) : radToMil(angle);
}

export function ReticleCanvas({
  holdX,
  leadX = 0,
  leadY = 0,
  holdY,
  unit,
  pattern,
  imageSrc,
  imageAlt,
  vectorStyle,
  magnification = 1,
  minMagnification = 1,
  maxMagnification = 1,
  distanceMeters = 100,
  targetWidthCm = 50,
  targetHeightCm = 50,
  targetShape = "rect",
  targetStyle = "paper",
  focalPlane = "SFP",
  targetImageSrc,
  viewMode = "hold",
  opticFov
}: ReticleProps) {
  const reticleFrameRef = useRef<HTMLDivElement>(null);
  const reticleCanvasRef = useRef<HTMLCanvasElement>(null);
  const [reticleFrameSize, setReticleFrameSize] = useState(0);
  const [reticleBitmap, setReticleBitmap] = useState<HTMLImageElement | null>(null);
  const resolveAsset = (path?: string) => {
    if (!path) return path;
    if (path.startsWith("http")) return path;
    if (path.startsWith(import.meta.env.BASE_URL)) return path;
    if (path.startsWith("/")) return `${import.meta.env.BASE_URL}${path.slice(1)}`;
    return `${import.meta.env.BASE_URL}${path}`;
  };

  const resolvedReticleImage = resolveAsset(imageSrc);
  const resolvedTargetImage = resolveAsset(targetImageSrc);
  const [targetImageError, setTargetImageError] = useState(false);
  const [reticleImageError, setReticleImageError] = useState(false);

  useEffect(() => {
    setTargetImageError(false);
  }, [resolvedTargetImage]);

  useEffect(() => {
    setReticleImageError(false);
  }, [resolvedReticleImage]);

  useEffect(() => {
    if (!resolvedReticleImage) {
      setReticleBitmap(null);
      return;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => setReticleBitmap(img);
    img.onerror = () => {
      setReticleBitmap(null);
      setReticleImageError(true);
    };
    img.src = resolvedReticleImage;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [resolvedReticleImage]);

  useEffect(() => {
    if (!reticleFrameRef.current) return;
    const updateSize = () => {
      const width = reticleFrameRef.current?.clientWidth ?? 0;
      setReticleFrameSize(width);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(reticleFrameRef.current);
    return () => observer.disconnect();
  }, []);

  const extent = unit === "MOA" ? 20 : 6;
  const viewBox = `${-extent} ${-extent} ${extent * 2} ${extent * 2}`;
  const reticlePattern: ReticlePattern = pattern ?? {
    type: unit === "MOA" ? "moa-hash" : "mil-grid",
    majorStep: 1,
    minorStep: unit === "MOA" ? 0.5 : 0.2
  };

  const major = reticlePattern.majorStep ?? 1;
  const minor = reticlePattern.minorStep ?? (unit === "MOA" ? 0.5 : 0.2);

  const ticks: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const addTick = (x: number, y: number, size: number, horizontal: boolean) => {
    if (horizontal) {
      ticks.push({ x1: x - size, y1: y, x2: x + size, y2: y });
    } else {
      ticks.push({ x1: x, y1: y - size, x2: x, y2: y + size });
    }
  };

  if (reticlePattern.type === "mil-grid" || reticlePattern.type === "moa-hash" || reticlePattern.type === "grid") {
    for (let i = -extent; i <= extent; i += major) {
      if (Math.abs(i) < 1e-6) continue;
      addTick(i, 0, 0.12, false);
      addTick(0, i, 0.12, true);
    }
    for (let i = -extent; i <= extent; i += minor) {
      if (Math.abs(i) < 1e-6) continue;
      const onMajor = Math.abs((i / major) - Math.round(i / major)) < 1e-6;
      if (onMajor) continue;
      addTick(i, 0, 0.06, false);
      addTick(0, i, 0.06, true);
    }
  }

  const bdcMarks = reticlePattern.type === "bdc" ? reticlePattern.holdMarks ?? [] : [];
  const targetWidthUnits = angularSizeToUnit(targetWidthCm, distanceMeters, unit);
  const targetHeightUnits = angularSizeToUnit(targetHeightCm, distanceMeters, unit);
  const safeMinMagnification = Math.max(minMagnification, 0.1);
  const clampedMagnification = Math.min(Math.max(magnification, safeMinMagnification), Math.max(maxMagnification, safeMinMagnification));
  const sceneScaleTarget = clampedMagnification / safeMinMagnification;
  const targetScaleInReticle =
    focalPlane === "SFP" ? clampedMagnification / Math.max(maxMagnification, safeMinMagnification) : 1;
  const minTargetHalf = 0.03;
  const targetHalfWidth = Math.max((targetWidthUnits * targetScaleInReticle) / 2, minTargetHalf);
  const targetHalfHeight = Math.max((targetHeightUnits * targetScaleInReticle) / 2, minTargetHalf);
  const bullseyeRadius = Math.max(Math.min(targetHalfWidth, targetHalfHeight) * 0.4, 0.08);
  const sceneSuffix = unit.toLowerCase();
  const sfpScale = focalPlane === "SFP" ? clampedMagnification / Math.max(maxMagnification, safeMinMagnification) : 1;
  const displayHoldX = holdX * sfpScale;
  const displayLeadX = leadX * sfpScale;
  const displayHoldY = holdY * sfpScale;
  const displayLeadY = leadY * sfpScale;
  const targetCenterRadius = Math.max(extent * 0.018, 0.08);
  const combinedAimX = displayHoldX + displayLeadX;
  const combinedAimY = displayHoldY + displayLeadY;
  const aimMarkerXTarget = Math.max(-extent, Math.min(extent, combinedAimX));
  const aimMarkerYTarget = Math.max(-extent, Math.min(extent, -combinedAimY));
  const targetOffsetXTarget = viewMode === "shift-target" ? -aimMarkerXTarget : 0;
  const targetOffsetYTarget = viewMode === "shift-target" ? -aimMarkerYTarget : 0;
  const reticleScaleTarget = focalPlane === "FFP" ? sceneScaleTarget : 1;
  const animatedSceneScale = useAnimatedNumber(sceneScaleTarget);
  const animatedReticleScale = useAnimatedNumber(reticleScaleTarget);
  const animatedAimMarkerX = useAnimatedNumber(aimMarkerXTarget);
  const animatedAimMarkerY = useAnimatedNumber(aimMarkerYTarget);
  const animatedTargetOffsetX = useAnimatedNumber(targetOffsetXTarget);
  const animatedTargetOffsetY = useAnimatedNumber(targetOffsetYTarget);
  const animatedLeadX = useAnimatedNumber(displayLeadX);
  const animatedLeadY = useAnimatedNumber(displayLeadY);
  const holdLabelX =
    Math.abs(holdX) < 0.05 ? "0.0" : `${Math.abs(holdX).toFixed(2)} ${unit} ${holdX >= 0 ? "R" : "L"}`;
  const leadLabel =
    Math.abs(leadX) < 0.05 ? "0.0" : `${Math.abs(leadX).toFixed(2)} ${unit} ${leadX >= 0 ? "R" : "L"}`;
  const leadLabelY =
    Math.abs(leadY) < 0.05 ? "0.0" : `${Math.abs(leadY).toFixed(2)} ${unit} ${leadY >= 0 ? "Up" : "Down"}`;
  const holdLabelY =
    Math.abs(holdY) < 0.05 ? "0.0" : `${Math.abs(holdY).toFixed(2)} ${unit} ${holdY >= 0 ? "Up" : "Down"}`;
  const displayLabelX =
    Math.abs(displayHoldX) < 0.05
      ? "0.0"
      : `${Math.abs(displayHoldX).toFixed(2)} ${unit} ${displayHoldX >= 0 ? "R" : "L"}`;
  const displayLabelY =
    Math.abs(displayHoldY) < 0.05
      ? "0.0"
      : `${Math.abs(displayHoldY).toFixed(2)} ${unit} ${displayHoldY >= 0 ? "Up" : "Down"}`;

  const targetImageLeftPercent = 50 + (animatedTargetOffsetX / (extent * 2)) * 100;
  const targetImageTopPercent = 50 + (animatedTargetOffsetY / (extent * 2)) * 100;
  const targetImageWidthPercent = (targetHalfWidth * 2 / (extent * 2)) * 100;
  const targetImageHeightPercent = (targetHalfHeight * 2 / (extent * 2)) * 100;
  const scaledTargetImageWidthPercent = targetImageWidthPercent * (focalPlane === "FFP" ? animatedSceneScale : 1);
  const scaledTargetImageHeightPercent = targetImageHeightPercent * (focalPlane === "FFP" ? animatedSceneScale : 1);
  const reticleImageSizePercent = animatedReticleScale * 100;
  const reticleImageSizePx = reticleFrameSize > 0 ? reticleFrameSize * (reticleImageSizePercent / 100) : 0;
  const apparentDistanceMeters = distanceMeters / Math.max(clampedMagnification, 1e-6);
  const normalizedMagnificationForFov =
    opticFov && opticFov.maxMagnification > opticFov.minMagnification
      ? Math.max(0, Math.min(1, (clampedMagnification - opticFov.minMagnification) / (opticFov.maxMagnification - opticFov.minMagnification)))
      : null;
  const currentFovAt100m =
    opticFov && normalizedMagnificationForFov !== null
      ? opticFov.minMetersAt100m + (opticFov.maxMetersAt100m - opticFov.minMetersAt100m) * normalizedMagnificationForFov
      : null;

  useEffect(() => {
    if (!reticleBitmap || !reticleCanvasRef.current || !reticleImageSizePx) return;
    const canvas = reticleCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const sizePx = Math.max(1, Math.round(reticleImageSizePx));
    canvas.width = Math.round(sizePx * dpr);
    canvas.height = Math.round(sizePx * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sizePx, sizePx);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(reticleBitmap, 0, 0, sizePx, sizePx);
  }, [reticleBitmap, reticleImageSizePx]);

  const renderTarget = () => {
    if (targetStyle === "steel-plate") {
      return (
        <>
          <circle cx={0} cy={0} r={Math.max(targetHalfWidth, targetHalfHeight)} fill="#6b7280" />
          <circle cx={0} cy={0} r={Math.max(targetHalfWidth, targetHalfHeight) * 0.86} fill="#94a3b8" />
          <path
            d={`M ${-targetHalfWidth * 0.72} ${-targetHalfHeight * 0.38} Q 0 ${-targetHalfHeight * 0.9} ${targetHalfWidth * 0.7} ${-targetHalfHeight * 0.26}`}
            stroke="#e2e8f0"
            strokeWidth={0.12}
            opacity={0.65}
            fill="none"
          />
          <circle cx={0} cy={0} r={bullseyeRadius * 0.34} fill="#334155" opacity={0.85} />
        </>
      );
    }

    if (targetStyle === "steel-popper") {
      return (
        <>
          <path
            d={`
              M ${-targetHalfWidth * 0.22} ${-targetHalfHeight * 0.44}
              Q 0 ${-targetHalfHeight * 0.62} ${targetHalfWidth * 0.22} ${-targetHalfHeight * 0.44}
              L ${targetHalfWidth * 0.34} ${targetHalfHeight * 0.16}
              Q 0 ${targetHalfHeight * 0.52} ${-targetHalfWidth * 0.34} ${targetHalfHeight * 0.16}
              Z
            `}
            fill="#94a3b8"
            stroke="#475569"
            strokeWidth={0.08}
          />
          <path
            d={`M ${-targetHalfWidth * 0.12} ${-targetHalfHeight * 0.28} Q 0 ${-targetHalfHeight * 0.42} ${targetHalfWidth * 0.12} ${-targetHalfHeight * 0.22}`}
            stroke="#e2e8f0"
            strokeWidth={0.08}
            opacity={0.7}
            fill="none"
          />
        </>
      );
    }

    if (targetStyle === "animal-deer") {
      const bodyRx = targetHalfWidth * 0.58;
      const bodyRy = targetHalfHeight * 0.26;
      return (
        <>
          <ellipse cx={0} cy={0} rx={bodyRx} ry={bodyRy} fill="#111827" />
          <rect x={bodyRx * 0.45} y={-bodyRy * 0.55} width={bodyRx * 0.3} height={bodyRy * 0.45} fill="#111827" />
          <circle cx={bodyRx * 0.85} cy={-bodyRy * 0.55} r={bodyRy * 0.32} fill="#111827" />
          <rect x={-bodyRx * 0.5} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.42} fill="#0f172a" />
          <rect x={-bodyRx * 0.15} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.42} fill="#0f172a" />
          <rect x={bodyRx * 0.2} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.42} fill="#0f172a" />
          <rect x={bodyRx * 0.45} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.42} fill="#0f172a" />
          <path
            d={`M ${bodyRx * 0.88} ${-bodyRy * 0.9} l ${bodyRx * 0.15} ${-bodyRy * 0.35} m ${-bodyRx * 0.08} ${bodyRy * 0.1} l ${bodyRx * 0.18} ${-bodyRy * 0.25}`}
            stroke="#111827"
            strokeWidth={0.12}
            strokeLinecap="round"
          />
        </>
      );
    }

    if (targetStyle === "animal-moose") {
      const bodyRx = targetHalfWidth * 0.62;
      const bodyRy = targetHalfHeight * 0.26;
      return (
        <>
          <ellipse cx={0} cy={0} rx={bodyRx} ry={bodyRy} fill="#111827" />
          <rect x={bodyRx * 0.42} y={-bodyRy * 0.62} width={bodyRx * 0.34} height={bodyRy * 0.52} fill="#111827" />
          <circle cx={bodyRx * 0.9} cy={-bodyRy * 0.62} r={bodyRy * 0.34} fill="#111827" />
          <rect x={-bodyRx * 0.48} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.5} fill="#0f172a" />
          <rect x={-bodyRx * 0.12} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.5} fill="#0f172a" />
          <rect x={bodyRx * 0.2} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.5} fill="#0f172a" />
          <rect x={bodyRx * 0.5} y={bodyRy * 0.6} width={bodyRx * 0.16} height={targetHalfHeight * 0.5} fill="#0f172a" />
          <path
            d={`M ${bodyRx * 0.92} ${-bodyRy * 1.05} l ${bodyRx * 0.2} ${-bodyRy * 0.4} m ${-bodyRx * 0.15} ${bodyRy * 0.1} l ${bodyRx * 0.28} ${-bodyRy * 0.25}`}
            stroke="#111827"
            strokeWidth={0.14}
            strokeLinecap="round"
          />
          <path
            d={`M ${bodyRx * 0.88} ${-bodyRy * 1.0} l ${-bodyRx * 0.2} ${-bodyRy * 0.45} m ${bodyRx * 0.1} ${bodyRy * 0.12} l ${-bodyRx * 0.28} ${-bodyRy * 0.3}`}
            stroke="#111827"
            strokeWidth={0.14}
            strokeLinecap="round"
          />
        </>
      );
    }

    if (targetStyle === "animal-bear") {
      const bodyRx = targetHalfWidth * 0.62;
      const bodyRy = targetHalfHeight * 0.32;
      return (
        <>
          <ellipse cx={0} cy={0} rx={bodyRx} ry={bodyRy} fill="#111827" />
          <circle cx={bodyRx * 0.85} cy={-bodyRy * 0.3} r={bodyRy * 0.38} fill="#111827" />
          <rect x={-bodyRx * 0.55} y={bodyRy * 0.55} width={bodyRx * 0.2} height={targetHalfHeight * 0.4} fill="#0f172a" />
          <rect x={-bodyRx * 0.2} y={bodyRy * 0.55} width={bodyRx * 0.2} height={targetHalfHeight * 0.4} fill="#0f172a" />
          <rect x={bodyRx * 0.2} y={bodyRy * 0.55} width={bodyRx * 0.2} height={targetHalfHeight * 0.4} fill="#0f172a" />
          <rect x={bodyRx * 0.5} y={bodyRy * 0.55} width={bodyRx * 0.2} height={targetHalfHeight * 0.4} fill="#0f172a" />
          <circle cx={bodyRx * 0.95} cy={-bodyRy * 0.55} r={bodyRy * 0.12} fill="#0f172a" />
        </>
      );
    }

    if (targetStyle === "animal-fox") {
      const bodyRx = targetHalfWidth * 0.58;
      const bodyRy = targetHalfHeight * 0.22;
      return (
        <>
          <ellipse cx={0} cy={0} rx={bodyRx} ry={bodyRy} fill="#111827" />
          <circle cx={bodyRx * 0.85} cy={-bodyRy * 0.4} r={bodyRy * 0.26} fill="#111827" />
          <polygon
            points={`${-bodyRx * 0.9},${bodyRy * 0.1} ${-bodyRx * 1.3},${-bodyRy * 0.3} ${-bodyRx * 1.15},${bodyRy * 0.55}`}
            fill="#111827"
          />
          <rect x={-bodyRx * 0.4} y={bodyRy * 0.5} width={bodyRx * 0.16} height={targetHalfHeight * 0.4} fill="#0f172a" />
          <rect x={-bodyRx * 0.05} y={bodyRy * 0.5} width={bodyRx * 0.16} height={targetHalfHeight * 0.4} fill="#0f172a" />
          <rect x={bodyRx * 0.25} y={bodyRy * 0.5} width={bodyRx * 0.16} height={targetHalfHeight * 0.4} fill="#0f172a" />
        </>
      );
    }

    if (targetStyle === "animal-boar") {
      const bodyRx = targetHalfWidth * 0.62;
      const bodyRy = targetHalfHeight * 0.26;
      return (
        <>
          <ellipse cx={0} cy={0} rx={bodyRx} ry={bodyRy} fill="#111827" />
          <circle cx={bodyRx * 0.82} cy={-bodyRy * 0.35} r={bodyRy * 0.32} fill="#111827" />
          <rect x={-bodyRx * 0.5} y={bodyRy * 0.6} width={bodyRx * 0.18} height={targetHalfHeight * 0.38} fill="#0f172a" />
          <rect x={-bodyRx * 0.15} y={bodyRy * 0.6} width={bodyRx * 0.18} height={targetHalfHeight * 0.38} fill="#0f172a" />
          <rect x={bodyRx * 0.2} y={bodyRy * 0.6} width={bodyRx * 0.18} height={targetHalfHeight * 0.38} fill="#0f172a" />
          <rect x={bodyRx * 0.45} y={bodyRy * 0.6} width={bodyRx * 0.18} height={targetHalfHeight * 0.38} fill="#0f172a" />
          <polygon
            points={`${bodyRx * 0.95},${-bodyRy * 0.3} ${bodyRx * 1.15},${-bodyRy * 0.05} ${bodyRx * 0.95},${bodyRy * 0.1}`}
            fill="#111827"
          />
        </>
      );
    }

    if (targetShape === "circle") {
      return (
        <>
          <circle cx={0} cy={0} r={Math.max(targetHalfWidth, targetHalfHeight)} fill="#64748b" opacity={0.22} />
          <circle cx={0} cy={0} r={bullseyeRadius * 1.75} fill="none" stroke="#0f172a" strokeWidth={0.06} />
          <circle cx={0} cy={0} r={bullseyeRadius} fill="#111827" />
          <circle cx={0} cy={0} r={bullseyeRadius * 0.35} fill="#e2e8f0" />
        </>
      );
    }

    return (
      <>
        {targetStyle === "standing" ? (
          <>
            <rect
              x={-targetHalfWidth * 0.22}
              y={-targetHalfHeight * 0.42}
              width={targetHalfWidth * 0.44}
              height={targetHalfHeight * 0.95}
              rx={0.18}
              fill="#111827"
              opacity={0.92}
            />
            <circle cx={0} cy={-targetHalfHeight * 0.58} r={bullseyeRadius * 0.52} fill="#111827" />
            <circle cx={0} cy={-targetHalfHeight * 0.1} r={bullseyeRadius * 0.22} fill="#f8fafc" />
          </>
        ) : targetStyle === "chest" ? (
          <>
            <path
              d={`
                M ${-targetHalfWidth * 0.58} ${targetHalfHeight * 0.34}
                L ${-targetHalfWidth * 0.38} ${-targetHalfHeight * 0.18}
                Q ${-targetHalfWidth * 0.22} ${-targetHalfHeight * 0.52} 0 ${-targetHalfHeight * 0.52}
                Q ${targetHalfWidth * 0.22} ${-targetHalfHeight * 0.52} ${targetHalfWidth * 0.38} ${-targetHalfHeight * 0.18}
                L ${targetHalfWidth * 0.58} ${targetHalfHeight * 0.34}
                Z
              `}
              fill="#111827"
              opacity={0.94}
            />
            <circle cx={0} cy={-targetHalfHeight * 0.06} r={bullseyeRadius * 0.24} fill="#f8fafc" />
          </>
        ) : (
          <>
            <rect
              x={-bullseyeRadius * 0.6}
              y={-bullseyeRadius * 0.6}
              width={bullseyeRadius * 1.2}
              height={bullseyeRadius * 1.2}
              fill="#111827"
              opacity={0.92}
            />
            <circle cx={0} cy={0} r={bullseyeRadius * 0.28} fill="#f8fafc" />
          </>
        )}
      </>
    );
  };

  const renderScene = () => (
    <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision">
      <defs>
        <radialGradient id={`scope-scene-${sceneSuffix}`} cx="50%" cy="48%" r="70%">
          <stop offset="0%" stopColor="#f8f8f5" />
          <stop offset="74%" stopColor="#ededea" />
          <stop offset="100%" stopColor="#d5d5d1" />
        </radialGradient>
        <radialGradient id={`scope-vignette-${sceneSuffix}`} cx="50%" cy="50%" r="68%">
          <stop offset="76%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.2)" />
        </radialGradient>
      </defs>

      <rect x={-extent} y={-extent} width={extent * 2} height={extent * 2} fill={`url(#scope-scene-${sceneSuffix})`} />

      <g>
        <g transform={`translate(${animatedTargetOffsetX} ${animatedTargetOffsetY})`}>
          <ellipse
            cx={0}
            cy={targetHalfHeight * 0.88}
            rx={Math.max(targetHalfWidth * 0.92, 0.35)}
            ry={Math.max(targetHalfHeight * 0.2, 0.18)}
            fill="#0f172a"
            opacity={0.12}
          />
          <clipPath id={`target-clip-${sceneSuffix}`}>
            <rect
              x={-targetHalfWidth}
              y={-targetHalfHeight}
              width={targetHalfWidth * 2}
              height={targetHalfHeight * 2}
              rx={targetShape === "circle" ? targetHalfWidth : 0.08}
            />
          </clipPath>
          {!resolvedTargetImage || targetImageError ? (
            <g clipPath={`url(#target-clip-${sceneSuffix})`}>
              {renderTarget()}
            </g>
          ) : null}
          <circle cx={0} cy={0} r={targetCenterRadius} fill="#38bdf8" opacity={0.95} />
        </g>
      </g>

      <rect x={-extent} y={-extent} width={extent * 2} height={extent * 2} fill={`url(#scope-vignette-${sceneSuffix})`} />
      <text
        x={-extent * 0.92}
        y={-extent * 0.84}
        fill="#6b7280"
        fontSize={extent * 0.08}
        fontFamily="Manrope, sans-serif"
      >
        {Math.round(distanceMeters)} m
      </text>
      <text
        x={-extent * 0.92}
        y={-extent * 0.72}
        fill="#94a3b8"
        fontSize={extent * 0.058}
        fontFamily="Manrope, sans-serif"
      >
        looks like {Math.max(apparentDistanceMeters, 1).toFixed(0)} m
      </text>
      <text
        x={extent * 0.28}
        y={-extent * 0.84}
        fill="#6b7280"
        fontSize={extent * 0.08}
        fontFamily="Manrope, sans-serif"
      >
        {clampedMagnification.toFixed(1)}x
      </text>
    </svg>
  );

  const renderVectorReticle = () => (
    <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision">
      <line x1={-extent} y1={0} x2={extent} y2={0} stroke="#221f1a" strokeOpacity={0.72} strokeWidth={0.035} />
      <line x1={0} y1={-extent} x2={0} y2={extent} stroke="#221f1a" strokeOpacity={0.72} strokeWidth={0.035} />
      {ticks.map((tick, idx) => (
        <line
          key={idx}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke="#221f1a"
          strokeOpacity={0.72}
          strokeWidth={0.035}
        />
      ))}
      {bdcMarks.map((mark, idx) => (
        <line
          key={`bdc-${idx}`}
          x1={-0.2}
          y1={-mark}
          x2={0.2}
          y2={-mark}
          stroke="#221f1a"
          strokeOpacity={0.72}
          strokeWidth={0.045}
        />
      ))}
    </svg>
  );

  const renderStyledReticle = () => {
    const stroke = "#1b1712";
    const majorStroke = 0.05;
    const minorStroke = 0.028;
    const dotR = 0.06;

    const renderGridTicks = (minorStepValue: number, majorStepValue = 1, tickMinor = 0.06, tickMajor = 0.12) => {
      const majorLines = [];
      const minorLines = [];
      for (let i = -extent; i <= extent; i += majorStepValue) {
        if (Math.abs(i) < 1e-6) continue;
        majorLines.push(
          <line key={`maj-x-${i}`} x1={i} y1={-tickMajor} x2={i} y2={tickMajor} stroke={stroke} strokeWidth={majorStroke} strokeOpacity={0.82} />,
          <line key={`maj-y-${i}`} x1={-tickMajor} y1={i} x2={tickMajor} y2={i} stroke={stroke} strokeWidth={majorStroke} strokeOpacity={0.82} />
        );
      }
      for (let i = -extent; i <= extent; i += minorStepValue) {
        if (Math.abs(i) < 1e-6) continue;
        const onMajor = Math.abs(i / majorStepValue - Math.round(i / majorStepValue)) < 1e-6;
        if (onMajor) continue;
        minorLines.push(
          <line key={`min-x-${i}`} x1={i} y1={-tickMinor} x2={i} y2={tickMinor} stroke={stroke} strokeWidth={minorStroke} strokeOpacity={0.74} />,
          <line key={`min-y-${i}`} x1={-tickMinor} y1={i} x2={tickMinor} y2={i} stroke={stroke} strokeWidth={minorStroke} strokeOpacity={0.74} />
        );
      }
      return { majorLines, minorLines };
    };

    if (vectorStyle === "nightforce-4a-i") {
      return (
        <svg viewBox={viewBox} className="absolute inset-0 h-full w-full">
          <line x1={-extent} y1={0} x2={-0.5} y2={0} stroke={stroke} strokeWidth={0.09} strokeOpacity={0.85} />
          <line x1={0.5} y1={0} x2={extent} y2={0} stroke={stroke} strokeWidth={0.09} strokeOpacity={0.85} />
          <line x1={0} y1={-extent} x2={0} y2={-0.5} stroke={stroke} strokeWidth={0.09} strokeOpacity={0.85} />
          <line x1={0} y1={0.5} x2={0} y2={extent} stroke={stroke} strokeWidth={0.09} strokeOpacity={0.85} />
          <circle cx={0} cy={0} r={0.11} fill="none" stroke={stroke} strokeWidth={0.06} strokeOpacity={0.85} />
        </svg>
      );
    }

    if (vectorStyle === "nightforce-fc-dmx") {
      const { majorLines, minorLines } = renderGridTicks(0.2, 1, 0.075, 0.16);
      return (
        <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision">
          <circle cx={0} cy={0} r={0.72} fill="none" stroke={stroke} strokeWidth={0.08} strokeOpacity={0.85} />
          <line x1={-extent} y1={0} x2={extent} y2={0} stroke={stroke} strokeWidth={0.04} strokeOpacity={0.74} />
          <line x1={0} y1={-extent} x2={0} y2={extent} stroke={stroke} strokeWidth={0.04} strokeOpacity={0.74} />
          {minorLines}
          {majorLines}
          {[1,2,3,4,5,6,7,8].map((m) => (
            <line key={`dmx-${m}`} x1={-m * 0.15} y1={m} x2={m * 0.15} y2={m} stroke={stroke} strokeWidth={0.04} strokeOpacity={0.65} />
          ))}
          <circle cx={0} cy={0} r={dotR} fill={stroke} fillOpacity={0.92} />
        </svg>
      );
    }

    if (vectorStyle === "vector-vos-tmoa") {
      const outerRingRadius = extent * 0.94;
      const centerRingRadius = 0.72;
      const lowerMajorMarks = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const sideHashes = [-8, -6, -4, -2, 2, 4, 6, 8];
      return (
        <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision">
          <circle cx={0} cy={0} r={outerRingRadius} fill="none" stroke={stroke} strokeWidth={0.045} strokeOpacity={0.18} />

          <line x1={-extent} y1={0} x2={-1.45} y2={0} stroke={stroke} strokeWidth={0.065} strokeOpacity={0.74} />
          <line x1={1.45} y1={0} x2={extent} y2={0} stroke={stroke} strokeWidth={0.065} strokeOpacity={0.74} />
          <line x1={0} y1={1.4} x2={0} y2={extent} stroke={stroke} strokeWidth={0.065} strokeOpacity={0.74} />
          <line x1={0} y1={-extent} x2={0} y2={-1.6} stroke={stroke} strokeWidth={0.05} strokeOpacity={0.44} />

          <polygon points="-2.7,-0.14 -1.38,-0.14 -1.08,0 -1.38,0.14 -2.7,0.14" fill={stroke} fillOpacity={0.82} />
          <polygon points="2.7,-0.14 1.38,-0.14 1.08,0 1.38,0.14 2.7,0.14" fill={stroke} fillOpacity={0.82} />
          <polygon points="-0.18,3.7 -0.18,1.45 0,1.08 0.18,1.45 0.18,3.7" fill={stroke} fillOpacity={0.82} />

          {sideHashes.map((x) => (
            <line
              key={`vos-h-${x}`}
              x1={x}
              y1={-0.2}
              x2={x}
              y2={0.2}
              stroke={stroke}
              strokeWidth={Math.abs(x) % 4 === 0 ? 0.06 : 0.04}
              strokeOpacity={0.72}
            />
          ))}

          {[-1, -0.5, 0.5, 1].map((x) => (
            <line
              key={`vos-center-${x}`}
              x1={x}
              y1={-0.12}
              x2={x}
              y2={0.12}
              stroke={stroke}
              strokeWidth={0.04}
              strokeOpacity={0.68}
            />
          ))}

          {lowerMajorMarks.map((y) => (
            <g key={`vos-v-${y}`}>
              <line
                x1={-(0.22 + y * 0.075)}
                y1={y}
                x2={0.22 + y * 0.075}
                y2={y}
                stroke={stroke}
                strokeWidth={y === 2 || y === 8 || y === 9 ? 0.065 : 0.045}
                strokeOpacity={0.7}
              />
              {y < 9 ? (
                <circle cx={0} cy={y + 0.5} r={0.07} fill={stroke} fillOpacity={0.62} />
              ) : null}
            </g>
          ))}

          {[45, 135, 225, 315].map((rotation) => (
            <path
              key={`vos-arc-${rotation}`}
              d={`M 0 ${-centerRingRadius} A ${centerRingRadius} ${centerRingRadius} 0 0 1 0.46 ${-centerRingRadius * 0.82}`}
              fill="none"
              stroke={stroke}
              strokeWidth={0.16}
              strokeLinecap="round"
              strokeOpacity={0.92}
              transform={`rotate(${rotation})`}
            />
          ))}
          <circle cx={0} cy={0} r={0.17} fill={stroke} fillOpacity={0.96} />
        </svg>
      );
    }

    if (
      vectorStyle === "nightforce-moa-c" ||
      vectorStyle === "nightforce-mil-c" ||
      vectorStyle === "nightforce-mil-xt" ||
      vectorStyle === "nightforce-mil-r" ||
      vectorStyle === "vector-vco2-mil"
    ) {
      const isMoa = vectorStyle === "nightforce-moa-c";
      const minorStepValue = isMoa ? 0.5 : 0.2;
      const { majorLines, minorLines } = renderGridTicks(minorStepValue, 1, isMoa ? 0.085 : 0.07, isMoa ? 0.17 : 0.15);
      const christmasMarks =
        vectorStyle === "nightforce-mil-xt" || vectorStyle === "nightforce-moa-c" || vectorStyle === "nightforce-mil-c" || vectorStyle === "vector-vco2-mil";

      return (
        <svg viewBox={viewBox} className="absolute inset-0 h-full w-full">
          <line x1={-extent} y1={0} x2={extent} y2={0} stroke={stroke} strokeWidth={0.04} strokeOpacity={0.78} />
          <line x1={0} y1={-extent} x2={0} y2={extent} stroke={stroke} strokeWidth={0.04} strokeOpacity={0.78} />
          {minorLines}
          {majorLines}
          {christmasMarks
            ? [1, 2, 3, 4, 5, 6, 7, 8].map((m) => (
                <g key={`tree-${m}`}>
                  <line x1={-m * 0.28} y1={m} x2={m * 0.28} y2={m} stroke={stroke} strokeWidth={0.035} strokeOpacity={0.62} />
                  <line x1={-m * 0.12} y1={m} x2={m * 0.12} y2={m} stroke={stroke} strokeWidth={0.05} strokeOpacity={0.78} />
                </g>
              ))
            : null}
          <circle cx={0} cy={0} r={dotR} fill={stroke} fillOpacity={0.95} />
        </svg>
      );
    }

    return renderVectorReticle();
  };

  const renderAimMarker = () => (
    <svg viewBox={viewBox} className="absolute inset-0 h-full w-full" shapeRendering="geometricPrecision">
      {viewMode === "hold" ? (
        <>
          <line
            x1={0}
            y1={0}
            x2={animatedAimMarkerX}
            y2={animatedAimMarkerY}
            stroke="#ff7b4a"
            strokeWidth={0.05}
            strokeDasharray="0.35 0.22"
            opacity={0.95}
          />
          <circle cx={animatedAimMarkerX} cy={animatedAimMarkerY} r={0.3} fill="none" stroke="#ff7b4a" strokeWidth={0.075} />
          <circle cx={animatedAimMarkerX} cy={animatedAimMarkerY} r={0.09} fill="#ff7b4a" />
          <circle cx={0} cy={0} r={0.12} fill="#38bdf8" opacity={0.95} />
          {Math.abs(displayLeadX) > 1e-3 || Math.abs(displayLeadY) > 1e-3 ? (
            <>
              <circle cx={animatedLeadX} cy={-animatedLeadY} r={0.2} fill="none" stroke="#facc15" strokeWidth={0.06} opacity={0.9} />
              <circle cx={animatedLeadX} cy={-animatedLeadY} r={0.07} fill="#facc15" opacity={0.95} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <circle cx={0} cy={0} r={0.24} fill="none" stroke="#FF8A5B" strokeWidth={0.07} />
          <circle cx={0} cy={0} r={0.08} fill="#FF8A5B" />
        </>
      )}
    </svg>
  );

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700/70 shadow-soft">
      <div className="h-[21rem] w-full bg-black flex items-center justify-center sm:h-[23rem]">
        <div className="flex items-center justify-center h-full w-full">
          <div
            ref={reticleFrameRef}
            className="relative h-[18.5rem] w-[18.5rem] rounded-full overflow-hidden bg-black shadow-[0_30px_90px_rgba(0,0,0,0.62)] sm:h-[20rem] sm:w-[20rem]"
          >
            <div className="absolute inset-0 rounded-full border border-slate-400/50" />
            <div className="absolute inset-[3%] rounded-full overflow-hidden bg-[#f4f3ef]">
              <div className="absolute inset-0">
                {renderScene()}
              </div>
              {resolvedTargetImage && !targetImageError ? (
                <div className="absolute inset-0">
                  <img
                    src={resolvedTargetImage}
                    alt="Target"
                    className="absolute scope-target-raster"
                    loading="lazy"
                    decoding="async"
                    onError={() => setTargetImageError(true)}
                    style={{
                      left: `${targetImageLeftPercent}%`,
                      top: `${targetImageTopPercent}%`,
                      width: `${scaledTargetImageWidthPercent}%`,
                      height: `${scaledTargetImageHeightPercent}%`,
                      transform: "translate(-50%, -50%)",
                      objectFit: "contain"
                    }}
                  />
                </div>
              ) : null}
              <div className="absolute inset-0">
                {resolvedReticleImage && !reticleImageError && reticleBitmap && reticleImageSizePx > 0 ? (
                  <canvas
                    ref={reticleCanvasRef}
                    className="absolute scope-reticle-canvas"
                    style={{
                      left: "50%",
                      top: "50%",
                      width: `${reticleImageSizePx}px`,
                      height: `${reticleImageSizePx}px`,
                      transform: "translate(-50%, -50%)",
                      opacity: 0.98
                    }}
                  />
                ) : vectorStyle ? (
                  <div
                    className="absolute inset-0 will-change-transform"
                    style={{ transform: `scale(${animatedReticleScale})`, transformOrigin: "center" }}
                  >
                    {renderStyledReticle()}
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 will-change-transform"
                    style={{ transform: `scale(${animatedReticleScale})`, transformOrigin: "center" }}
                  >
                    {renderVectorReticle()}
                  </div>
                )}
                {renderAimMarker()}
              </div>
              <div className="absolute inset-0 rounded-full scope-lens-overlay pointer-events-none" />
            </div>
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                boxShadow:
                  "inset 0 0 0 18px rgba(0,0,0,0.42), inset 0 0 34px rgba(0,0,0,0.85), inset 0 0 90px rgba(0,0,0,0.58)"
              }}
            />
          </div>
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-sand bg-black flex items-center justify-between">
        <span>{viewMode === "hold" ? "Оранжевый маркер: точка выноса, жёлтая точка: упреждение цели, синяя точка: центр цели" : "Цель смещена, сетка остаётся по центру"}</span>
        <span>{focalPlane} · {unit} · {clampedMagnification.toFixed(1)}x</span>
      </div>
      <div className="px-4 py-2 text-[11px] text-slate-300 bg-slate-950/80 border-t border-slate-700/70">
        Ballistic hold: {holdLabelY} · {holdLabelX}{leadX || leadY ? ` · Lead: ${leadLabel} / ${leadLabelY}` : ""} {focalPlane === "SFP" ? `· Display at ${clampedMagnification.toFixed(1)}x: ${displayLabelY} · ${displayLabelX}` : ""}{opticFov ? ` · Apparent distance: ${apparentDistanceMeters.toFixed(0)} m` : ""}{currentFovAt100m ? ` · FOV ${currentFovAt100m.toFixed(2)} m @ 100 m` : ""}
      </div>
    </div>
  );
}
