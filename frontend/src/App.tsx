import { useEffect, useMemo, useState } from "react";
import { Field } from "./components/Field";
import { SelectField } from "./components/SelectField";
import { SectionCard } from "./components/SectionCard";
import { Toggle } from "./components/Toggle";
import { StatCard } from "./components/StatCard";
import { TrajectoryCharts } from "./graphs/TrajectoryCharts";
import { ReticleCanvas } from "./reticle/ReticleCanvas";
import { reticleProfiles } from "./reticle/reticleProfiles";
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

function parseMagnificationRange(label?: string | null) {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)x/i);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
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
    widthCm: 90,
    heightCm: 110,
    shape: "rect" as const,
    style: "animal-deer" as const,
    sourceUrl: "custom"
  },
  {
    id: "boar-silhouette",
    name: "Силуэт кабана",
    widthCm: 100,
    heightCm: 60,
    shape: "rect" as const,
    style: "animal-boar" as const,
    sourceUrl: "custom"
  },
  {
    id: "moose-silhouette",
    name: "Силуэт лося",
    widthCm: 120,
    heightCm: 140,
    shape: "rect" as const,
    style: "animal-moose" as const,
    sourceUrl: "custom"
  },
  {
    id: "bear-silhouette",
    name: "Силуэт медведя",
    widthCm: 140,
    heightCm: 90,
    shape: "rect" as const,
    style: "animal-bear" as const,
    sourceUrl: "custom"
  },
  {
    id: "fox-silhouette",
    name: "Силуэт лисы",
    widthCm: 90,
    heightCm: 50,
    shape: "rect" as const,
    style: "animal-fox" as const,
    sourceUrl: "custom"
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

  const [targetId, setTargetId] = useState(targetModels[0].id);

  const [training, setTraining] = useState(true);
  const [activeSection, setActiveSection] = useState<"weapon" | "ammo" | "optic" | "weather" | "geometry">("weapon");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const isPro = settings.mode === "pro";

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
    parseMagnificationRange(activeVariant?.name) ??
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

  const horizontalCorrection = useMemo(() => {
    if (!currentRow) return 0;
    const angleRad = Math.atan2(currentRow.drift_m, Math.max(currentRow.distance_m, 1e-6));
    return optic.unit === "MOA" ? moaFromRad(angleRad) : milFromRad(angleRad);
  }, [currentRow, optic.unit]);

  const windClicks = useMemo(() => {
    if (!currentRow || !optic.click_value) return 0;
    return horizontalCorrection / optic.click_value;
  }, [currentRow, horizontalCorrection, optic.click_value]);

  const elevationClicks = useMemo(() => {
    if (!currentRow || !optic.click_value) return 0;
    return currentRow.correction / optic.click_value;
  }, [currentRow, optic.click_value]);

  const elevationClickLabel = useMemo(() => {
    if (!currentRow) return "—";
    const absClicks = Math.abs(elevationClicks).toFixed(1);
    if (elevationClicks > 0) return `U ${absClicks}`;
    if (elevationClicks < 0) return `D ${absClicks}`;
    return "0.0";
  }, [currentRow, elevationClicks]);

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

  const tableRows = useMemo(() => {
    if (!result?.table) return [];
    return result.table.filter((row: any) => row.distance_m % 100 === 0 && row.distance_m > 0);
  }, [result]);

  const windClicksForRow = (row: any) => {
    if (!row || !optic.click_value) return 0;
    const angleRad = Math.atan2(row.drift_m, Math.max(row.distance_m, 1e-6));
    const correction = optic.unit === "MOA" ? moaFromRad(angleRad) : milFromRad(angleRad);
    return correction / optic.click_value;
  };

  return (
    <div className="min-h-screen app-shell">
      <div className="app-header">
        <div className="mx-auto mobile-shell px-4 py-4 flex flex-col gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-slate-400">Ballistic Pro</p>
            <h1 className="font-display text-2xl text-white">Профессиональный баллистический калькулятор</h1>
            <p className="text-xs text-slate-300 mt-1">
              Быстрый ввод, точная физика, готовые поправки.
            </p>
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
              { id: "weapon", label: "Оружие" },
              { id: "ammo", label: "Патрон" },
              { id: "optic", label: "Прицел" },
              { id: "weather", label: "Погода" },
              { id: "geometry", label: "Дистанция" }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id as typeof activeSection)}
                className={`segment-pill ${activeSection === item.id ? "active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto mobile-shell px-4 py-4">

        {training ? (
          <div className="mt-6 rounded-xl border border-slate-700/70 bg-slate-900/80 p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <InfoIcon className="h-6 w-6 text-ocean" />
              <h2 className="font-display text-base text-white">Режим обучения</h2>
            </div>
            <p className="text-xs text-slate-300 mt-2">
              Здесь короткие объяснения. Наведите курсор на ⓘ у параметров, чтобы увидеть подсказку.
            </p>
            <div className="grid gap-3 mt-4 md:grid-cols-3">
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

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
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
              value={weapon.caliber_mm}
              onChange={(v) => setWeapon((w) => ({ ...w, caliber_mm: Number(v) }))}
              unit="мм"
              step={0.01}
              icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="barrel"
              label="Длина ствола"
              tooltipKey="barrelLength"
              value={weapon.barrel_length_mm}
              onChange={(v) => setWeapon((w) => ({ ...w, barrel_length_mm: Number(v) }))}
              unit="мм"
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
                  value={weapon.rifling_step_mm}
                  onChange={(v) => setWeapon((w) => ({ ...w, rifling_step_mm: Number(v) }))}
                  unit="мм/оборот"
                  step={1}
                  icon={<IconWrapper><TargetIcon className="h-5 w-5" /></IconWrapper>}
                />
              </>
            ) : null}
            <Field
              id="sight-height"
              label="Высота прицела"
              tooltipKey="sightHeight"
              value={weapon.sight_height_mm}
              onChange={(v) => setWeapon((w) => ({ ...w, sight_height_mm: Number(v) }))}
              unit="мм"
              step={0.5}
              icon={<IconWrapper><ScopeIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="zero"
              label="Дистанция пристрелки"
              tooltipKey="zeroDistance"
              value={weapon.zero_distance_m}
              onChange={(v) => setWeapon((w) => ({ ...w, zero_distance_m: Number(v) }))}
              unit="м"
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
              value={ammo.muzzle_velocity_mps}
              onChange={(v) => setAmmo((a) => ({ ...a, muzzle_velocity_mps: Number(v) }))}
              unit="м/с"
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
                  value={ammo.powder_temp_c}
                  onChange={(v) => setAmmo((a) => ({ ...a, powder_temp_c: Number(v) }))}
                  unit="°C"
                  step={1}
                  icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="temp-coeff"
                  label="Коэффициент скорости"
                  tooltipKey="powderTemp"
                  value={ammo.muzzle_velocity_temp_coeff}
                  onChange={(v) => setAmmo((a) => ({ ...a, muzzle_velocity_temp_coeff: Number(v) }))}
                  unit="1/°C"
                  step={0.001}
                  icon={<IconWrapper><BulletIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="bullet-length"
                  label="Длина пули"
                  tooltipKey="bulletLength"
                  value={ammo.bullet_length_mm}
                  onChange={(v) => setAmmo((a) => ({ ...a, bullet_length_mm: Number(v) }))}
                  unit="мм"
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
            <Field
              id="temp"
              label="Температура"
              tooltipKey="temperature"
              value={weather.temperature_c}
              onChange={(v) => setWeather((w) => ({ ...w, temperature_c: Number(v) }))}
              unit="°C"
              step={1}
              icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="pressure"
              label="Давление"
              tooltipKey="pressure"
              value={weather.pressure_hpa}
              onChange={(v) => setWeather((w) => ({ ...w, pressure_hpa: Number(v) }))}
              unit="гПа"
              step={1}
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
              value={weather.altitude_m}
              onChange={(v) => setWeather((w) => ({ ...w, altitude_m: Number(v) }))}
              unit="м"
              step={1}
              icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="wind"
              label="Скорость ветра"
              tooltipKey="windSpeed"
              value={weather.wind_speed_mps}
              onChange={(v) => setWeather((w) => ({ ...w, wind_speed_mps: Number(v) }))}
              unit="м/с"
              step={0.1}
              icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
            />
            <Field
              id="wind-dir"
              label="Направление ветра"
              tooltipKey="windDirection"
              value={weather.wind_direction_deg}
              onChange={(v) => setWeather((w) => ({ ...w, wind_direction_deg: Number(v) }))}
              unit="°"
              step={1}
              icon={<IconWrapper><WeatherIcon className="h-5 w-5" /></IconWrapper>}
            />
              </SectionCard>
            ) : null}

            {activeSection === "geometry" ? (
              <SectionCard title="5. Дистанция и геометрия" subtitle="Позиция цели и стрелка">
            <Field
              id="distance"
              label="Дистанция"
              tooltipKey="distance"
              value={geometry.distance_m}
              onChange={(v) => setGeometry((g) => ({ ...g, distance_m: Number(v) }))}
              unit="м"
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
            <div className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
              <p className="font-semibold text-white">Размер мишени</p>
              <p className="mt-1 text-slate-200">{target.widthCm} × {target.heightCm} см</p>
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
                  value={settings.max_range_m}
                  onChange={(v) => setSettings((s) => ({ ...s, max_range_m: Number(v) }))}
                  unit="м"
                  step={10}
                  icon={<IconWrapper><DistanceIcon className="h-5 w-5" /></IconWrapper>}
                />
                <Field
                  id="step"
                  label="Шаг таблицы"
                  tooltipKey="step"
                  value={settings.step_m}
                  onChange={(v) => setSettings((s) => ({ ...s, step_m: Number(v) }))}
                  unit="м"
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

          <div className="grid gap-4">
            <SectionCard title="6. Результаты" subtitle="Поправки, клики и траектория">
              <div className="grid gap-3 grid-cols-2">
              <StatCard
                label="Вертикальная поправка"
                value={currentRow ? `${currentRow.correction.toFixed(2)} ${optic.unit}` : "—"}
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
                value={currentRow ? `${currentRow.velocity_mps.toFixed(1)} м/с` : "—"}
              />
              <StatCard
                label="Энергия"
                value={currentRow ? `${currentRow.energy_j.toFixed(0)} Дж` : "—"}
              />
              <StatCard
                label="Падение"
                value={currentRow ? `${(currentRow.drop_m * CM_PER_M).toFixed(1)} см` : "—"}
              />
              <StatCard
                label="Снос ветром"
                value={currentRow ? `${(currentRow.drift_m * CM_PER_M).toFixed(1)} см` : "—"}
              />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
              <StatCard
                label="Плотность воздуха"
                value={result ? `${result.summary.air_density.toFixed(3)} кг/м³` : "—"}
              />
              <StatCard
                label="Скорость звука"
                value={result ? `${result.summary.speed_of_sound_mps.toFixed(1)} м/с` : "—"}
              />
              <StatCard
                label="Стабильность (SG)"
                value={result?.summary?.stability_sg ? result.summary.stability_sg.toFixed(2) : "—"}
              />
              </div>
              {error ? <p className="text-sm text-ember mt-3">{error}</p> : null}
            </SectionCard>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ResultIcon className="h-5 w-5 text-ocean" />
                <h2 className="font-display text-base text-white">Симуляция прицела</h2>
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="text-slate-300">Кратность</p>
                    <p className="mt-1 font-semibold text-white">
                      {magnification.toFixed(1)}x
                    </p>
                  </div>
                  <div className="text-right text-slate-400">
                    <p>{magnificationRange.min.toFixed(1)}x - {magnificationRange.max.toFixed(1)}x</p>
                    <p>{activeReticle?.focalPlane === "FFP" ? "FFP" : "SFP"} · масштаб мишени</p>
                  </div>
                </div>
                <input
                  type="range"
                  min={magnificationRange.min}
                  max={magnificationRange.max}
                  step={0.1}
                  value={magnification}
                  onChange={(event) => setMagnification(Number(event.target.value))}
                  className="scope-slider mt-4 w-full"
                />
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setReticleViewMode("hold")}
                    className={`rounded-lg px-3 py-2 text-xs border transition ${
                      reticleViewMode === "hold"
                        ? "bg-emerald-500/80 text-white border-emerald-400/60"
                        : "bg-slate-900/70 border-slate-700/70 text-slate-300"
                    }`}
                  >
                    Точка выноса
                  </button>
                  <button
                    type="button"
                    onClick={() => setReticleViewMode("shift-target")}
                    className={`rounded-lg px-3 py-2 text-xs border transition ${
                      reticleViewMode === "shift-target"
                        ? "bg-emerald-500/80 text-white border-emerald-400/60"
                        : "bg-slate-900/70 border-slate-700/70 text-slate-300"
                    }`}
                  >
                    Смещение цели
                  </button>
                </div>
              </div>
              <ReticleCanvas
                holdX={horizontalCorrection}
                holdY={currentRow ? currentRow.correction : 0}
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
                targetWidthCm={target.widthCm}
                targetHeightCm={target.heightCm}
                targetShape={target.shape}
                targetStyle={target.style}
                targetImageSrc={target.imageSrc}
                viewMode={reticleViewMode}
                opticFov={activeReticle?.opticFov}
              />
            </div>

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

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ResultIcon className="h-5 w-5 text-ocean" />
                <h2 className="font-display text-base text-white">Таблица стрельбы</h2>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-900/80">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-900/90 text-slate-200 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Distance</th>
                      <th className="px-4 py-3 text-left">Drop (см)</th>
                      <th className="px-4 py-3 text-left">Wind drift (см)</th>
                      <th className="px-4 py-3 text-left">Clicks (R/L)</th>
                      <th className="px-4 py-3 text-left">Holdover</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.length ? (
                      tableRows.map((row: any) => (
                        <tr key={row.distance_m} className="border-t border-slate-700/70 text-slate-200">
                          <td className="px-4 py-3">{row.distance_m.toFixed(0)} м</td>
                          <td className="px-4 py-3">{(row.drop_m * CM_PER_M).toFixed(1)}</td>
                          <td className="px-4 py-3">{(row.drift_m * CM_PER_M).toFixed(1)}</td>
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
          </div>
        </div>

        <div className="sticky-bar">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              Дистанция: {geometry.distance_m} м · {optic.unit}
            </div>
            <button
              className="rounded-full bg-emerald-500/90 px-5 py-2 text-white text-sm shadow-glow"
              onClick={handleCalc}
            >
              {loading ? "Расчет..." : "Рассчитать"}
            </button>
          </div>
        </div>

        <footer className="mt-4 text-xs text-slate-500">
          Ballistic Pro — PWA с офлайн режимом, расчетами RK4 и поддержкой G1/G7.
        </footer>
      </div>
    </div>
  );
}
