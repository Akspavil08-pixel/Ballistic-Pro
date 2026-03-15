import g1Csv from "../data/g1.csv?raw";
import g7Csv from "../data/g7.csv?raw";

const G = 9.80665;
const R_DRY = 287.05;
const R_VAPOR = 461.495;
const GAMMA = 1.4;
const OMEGA = 7.2921159e-5;

const GRAIN_TO_KG = 0.00006479891;
const MM_TO_M = 0.001;
const LB_PER_KG = 2.2046226218;
const IN_PER_M = 39.37007874;

type Vec3 = [number, number, number];

const toRadians = (deg: number) => (deg * Math.PI) / 180.0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const vecAdd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vecSub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vecScale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const vecDot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vecCross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const vecNorm = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const vecNormalize = (a: Vec3): Vec3 => {
  const n = vecNorm(a);
  if (n < 1e-9) return [0, 0, 0];
  return [a[0] / n, a[1] / n, a[2] / n];
};

const grainsToKg = (grains: number) => grains * GRAIN_TO_KG;
const mmToM = (mm: number) => mm * MM_TO_M;
const kgToLb = (kg: number) => kg * LB_PER_KG;
const mToIn = (m: number) => m * IN_PER_M;
const moaFromRad = (rad: number) => (rad * 180.0 * 60.0) / Math.PI;
const milFromRad = (rad: number) => rad * 1000.0;

const parseCsv = (raw: string) => {
  const mach: number[] = [];
  const cd: number[] = [];
  raw
    .trim()
    .split(/\r?\n/)
    .forEach((line) => {
      const [m, c] = line.split(",").map((v) => Number(v.trim()));
      if (Number.isFinite(m) && Number.isFinite(c)) {
        mach.push(m);
        cd.push(c);
      }
    });
  return { mach, cd };
};

const G1 = parseCsv(g1Csv);
const G7 = parseCsv(g7Csv);

const interp = (x: number, xs: number[], ys: number[]) => {
  if (!xs.length) return 0;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (xs[mid] > x) hi = mid;
    else lo = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
};

const cdFromMach = (mach: number, model: string) => {
  const table = model?.toUpperCase() === "G7" ? G7 : G1;
  return interp(clamp(mach, 0, table.mach[table.mach.length - 1] ?? mach), table.mach, table.cd);
};

const saturationVaporPressure = (tempC: number) => 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));

const standardPressureHpa = (altitudeM: number) => {
  const p0 = 1013.25;
  const t0 = 288.15;
  const lapse = 0.0065;
  const g = 9.80665;
  const r = 287.05;
  const h = Math.max(0, altitudeM);
  return p0 * Math.pow(1 - (lapse * h) / t0, g / (r * lapse));
};

const airDensity = (temperatureC: number, pressureHpa: number | null, humidityPercent: number, altitudeM: number) => {
  const tempK = temperatureC + 273.15;
  const pressure = pressureHpa ?? standardPressureHpa(altitudeM);
  const satVp = saturationVaporPressure(temperatureC);
  const vaporHpa = clamp(humidityPercent, 0, 100) / 100.0 * satVp;
  const dryHpa = Math.max(1.0, pressure - vaporHpa);
  const pDry = dryHpa * 100.0;
  const pVapor = vaporHpa * 100.0;
  const rhoDry = pDry / (R_DRY * tempK);
  const rhoVapor = pVapor / (R_VAPOR * tempK);
  return rhoDry + rhoVapor;
};

const speedOfSound = (temperatureC: number) => {
  const tempK = temperatureC + 273.15;
  return Math.sqrt(GAMMA * R_DRY * tempK);
};

const windVectorEnu = (speedMps: number, directionFromDeg: number): Vec3 => {
  const directionTo = (directionFromDeg + 180.0) % 360.0;
  const az = toRadians(directionTo);
  const north = Math.cos(az) * speedMps;
  const east = Math.sin(az) * speedMps;
  return [east, north, 0];
};

const omegaVectorEnu = (latitudeDeg: number): Vec3 => {
  const lat = toRadians(latitudeDeg);
  return [0, OMEGA * Math.cos(lat), OMEGA * Math.sin(lat)];
};

const coriolisAccel = (velocity: Vec3, latitudeDeg: number): Vec3 => {
  const omega = omegaVectorEnu(latitudeDeg);
  return vecScale(vecCross(velocity, omega), 2.0);
};

const eotvosAccel = (velocity: Vec3, latitudeDeg: number): Vec3 => {
  const lat = toRadians(latitudeDeg);
  const vEast = velocity[0];
  const aUp = 2.0 * OMEGA * vEast * Math.cos(lat);
  return [0, 0, aUp];
};

const directionFromAzimuthElevation = (azimuthDeg: number, elevationDeg: number): Vec3 => {
  const az = toRadians(azimuthDeg);
  const el = toRadians(elevationDeg);
  const vH = Math.cos(el);
  const north = vH * Math.cos(az);
  const east = vH * Math.sin(az);
  const up = Math.sin(el);
  return [east, north, up];
};

const adjustMuzzleVelocity = (muzzleVelocity: number, powderTemp: number | null, coeff: number | null, refTemp = 15) => {
  if (powderTemp == null || coeff == null) return muzzleVelocity;
  return muzzleVelocity * (1.0 + coeff * (powderTemp - refTemp));
};

const estimateBulletLengthMm = (weightGrains: number, caliberMm: number) => {
  const massKg = grainsToKg(weightGrains);
  const density = 11340.0;
  const volume = massKg / density;
  const dM = mmToM(caliberMm);
  const area = Math.PI * (dM / 2) ** 2;
  const lengthM = volume / Math.max(area, 1e-9);
  return lengthM * 1000.0;
};

const gyroStabilityMiller = (
  bulletWeightGrains: number,
  caliberMm: number,
  bulletLengthMm: number,
  twistRateIn: number | null,
  muzzleVelocityMps: number,
  temperatureC: number,
  pressureHpa: number | null
) => {
  if (!twistRateIn || twistRateIn <= 0) return null;
  const dIn = caliberMm / 25.4;
  const lIn = bulletLengthMm / 25.4;
  if (dIn <= 0 || lIn <= 0) return null;
  const massGr = bulletWeightGrains;
  const tCal = twistRateIn / dIn;
  const lCal = lIn / dIn;
  const tempR = (temperatureC * 9.0) / 5.0 + 459.67;
  const pressure = pressureHpa ?? 1013.25;
  const pressureInHg = pressure * 0.0295299830714;
  const atmos = (tempR / 518.67) * (29.92 / pressureInHg);
  const vFps = muzzleVelocityMps * 3.28084;
  let sg = (30.0 * massGr) / (dIn ** 3 * lCal * (1.0 + lCal ** 2));
  sg *= 1.0 / (tCal ** 2);
  sg *= Math.sqrt(vFps / 2800.0);
  sg *= atmos;
  return sg;
};

const dragAcceleration = (
  vRel: Vec3,
  rho: number,
  model: string,
  ballisticCoefficient: number,
  caliberMm: number,
  massKg: number,
  temperatureC: number
): Vec3 => {
  const speed = vecNorm(vRel);
  if (speed < 1e-6 || ballisticCoefficient <= 0) return [0, 0, 0];
  const mach = speed / Math.max(1e-3, speedOfSound(temperatureC));
  const cdRef = cdFromMach(mach, model);
  const dM = mmToM(caliberMm);
  const area = Math.PI * (dM / 2.0) ** 2;
  if (area <= 0 || massKg <= 0) return [0, 0, 0];
  const dIn = mToIn(dM);
  const sd = kgToLb(massKg) / Math.max(dIn ** 2, 1e-12);
  const formFactor = sd / ballisticCoefficient;
  const cd = cdRef * formFactor;
  const drag = 0.5 * rho * cd * area * speed ** 2;
  const scale = -(drag / massKg) * (1 / speed);
  return vecScale(vRel, scale);
};

const rk4Step = (state: number[], dt: number, deriv: (s: number[]) => number[]) => {
  const k1 = deriv(state);
  const k2 = deriv(state.map((v, i) => v + 0.5 * dt * k1[i]));
  const k3 = deriv(state.map((v, i) => v + 0.5 * dt * k2[i]));
  const k4 = deriv(state.map((v, i) => v + dt * k3[i]));
  return state.map((v, i) => v + (dt / 6.0) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
};

export const solveBallisticsLocal = (payload: any) => {
  const weapon = payload.weapon ?? {};
  const ammo = payload.ammo ?? {};
  const optic = payload.optic ?? {};
  const weather = payload.weather ?? {};
  const geometry = payload.geometry ?? {};
  const settings = payload.settings ?? {};

  const caliberMm = weapon.caliber_mm ?? 7.62;
  const sightHeightM = (weapon.sight_height_mm ?? 45.0) / 1000.0;
  const zeroDistanceM = weapon.zero_distance_m ?? 100.0;

  const powderTemp = ammo.powder_temp_c ?? null;
  const tempCoeff = ammo.muzzle_velocity_temp_coeff ?? null;
  const v0 = adjustMuzzleVelocity(ammo.muzzle_velocity_mps ?? 800, powderTemp, tempCoeff);

  const massKg = grainsToKg(ammo.bullet_weight_grains ?? 168);
  const bc = ammo.ballistic_coefficient ?? 0.45;
  const dragModel = ammo.drag_model ?? "G1";

  const temperatureC = weather.temperature_c ?? 15.0;
  const pressureHpa = weather.pressure_hpa ?? 1013.25;
  const humidityPercent = weather.humidity_percent ?? 50.0;
  const altitudeM = weather.altitude_m ?? 0.0;

  const windSpeed = weather.wind_speed_mps ?? 0.0;
  const windDir = weather.wind_direction_deg ?? 0.0;

  const distanceM = geometry.distance_m ?? 100.0;
  const shotAngle = geometry.shot_angle_deg ?? 0.0;
  const azimuth = geometry.azimuth_deg ?? 0.0;
  const latitude = geometry.latitude_deg ?? 0.0;

  const maxRangeM = settings.max_range_m ?? 1000.0;
  const stepM = settings.step_m ?? 10.0;
  const dt = settings.time_step_s ?? 0.002;

  const rho = airDensity(temperatureC, pressureHpa, humidityPercent, altitudeM);
  const windVec = windVectorEnu(windSpeed, windDir);

  const losDir = vecNormalize(directionFromAzimuthElevation(azimuth, shotAngle));
  const upAxis: Vec3 = [0, 0, 1];
  let rightDir = vecCross(losDir, upAxis);
  if (vecNorm(rightDir) < 1e-9) rightDir = [1, 0, 0];
  rightDir = vecNormalize(rightDir);

  const sightPos: Vec3 = [0, 0, sightHeightM];

  const simulateError = (deltaDeg: number) => {
    const boreDir = vecNormalize(directionFromAzimuthElevation(azimuth, shotAngle + deltaDeg));
    let state = [0, 0, 0, boreDir[0] * v0, boreDir[1] * v0, boreDir[2] * v0];
    let t = 0.0;
    let prevState = state.slice();
    while (t < 10.0) {
      const deriv = (s: number[]) => {
        const vel: Vec3 = [s[3], s[4], s[5]];
        const vRel = vecSub(vel, windVec);
        const aDrag = dragAcceleration(vRel, rho, dragModel, bc, caliberMm, massKg, temperatureC);
        const aGrav: Vec3 = [0, 0, -G];
        const aCor = coriolisAccel(vel, latitude);
        const aEot = eotvosAccel(vel, latitude);
        const acc = vecAdd(vecAdd(aDrag, aGrav), vecAdd(aCor, aEot));
        return [vel[0], vel[1], vel[2], acc[0], acc[1], acc[2]];
      };
      prevState = state.slice();
      state = rk4Step(state, dt, deriv);
      t += dt;
      const pos: Vec3 = [state[0], state[1], state[2]];
      const s = vecDot(vecSub(pos, sightPos), losDir);
      if (s >= zeroDistanceM) {
        const prevPos: Vec3 = [prevState[0], prevState[1], prevState[2]];
        const prevS = vecDot(vecSub(prevPos, sightPos), losDir);
        const frac = Math.abs(s - prevS) < 1e-9 ? 1.0 : (zeroDistanceM - prevS) / (s - prevS);
        const posAt: Vec3 = [
          prevPos[0] + (pos[0] - prevPos[0]) * frac,
          prevPos[1] + (pos[1] - prevPos[1]) * frac,
          prevPos[2] + (pos[2] - prevPos[2]) * frac
        ];
        const losPos = vecAdd(sightPos, vecScale(losDir, zeroDistanceM));
        const error = vecSub(posAt, losPos);
        return vecDot(error, upAxis);
      }
    }
    return 0.0;
  };

  let deltaLow = -2.0;
  let deltaHigh = 2.0;
  let errLow = simulateError(deltaLow);
  let errHigh = simulateError(deltaHigh);
  let zeroDelta = 0.0;
  if (errLow * errHigh > 0) {
    zeroDelta = (sightHeightM / Math.max(zeroDistanceM, 1.0)) * (180.0 / Math.PI);
  } else {
    for (let i = 0; i < 30; i += 1) {
      const mid = (deltaLow + deltaHigh) / 2.0;
      const errMid = simulateError(mid);
      if (errLow * errMid <= 0) {
        deltaHigh = mid;
        errHigh = errMid;
      } else {
        deltaLow = mid;
        errLow = errMid;
      }
      zeroDelta = mid;
    }
  }

  const boreDir = vecNormalize(directionFromAzimuthElevation(azimuth, shotAngle + zeroDelta));
  const distances: number[] = [];
  for (let d = 0; d <= maxRangeM + stepM * 0.5; d += stepM) distances.push(d);
  const results: any[] = [];

  let state = [0, 0, 0, boreDir[0] * v0, boreDir[1] * v0, boreDir[2] * v0];
  let t = 0.0;
  let nextIdx = 0;
  let prevState = state.slice();

  const maxTime = 30.0;
  while (t <= maxTime && nextIdx < distances.length) {
    const pos: Vec3 = [state[0], state[1], state[2]];
    const s = vecDot(vecSub(pos, sightPos), losDir);
    if (s >= distances[nextIdx]) {
      const prevPos: Vec3 = [prevState[0], prevState[1], prevState[2]];
      const prevS = vecDot(vecSub(prevPos, sightPos), losDir);
      const frac = Math.abs(s - prevS) < 1e-9 ? 1.0 : (distances[nextIdx] - prevS) / (s - prevS);
      const interpPos: Vec3 = [
        prevPos[0] + (pos[0] - prevPos[0]) * frac,
        prevPos[1] + (pos[1] - prevPos[1]) * frac,
        prevPos[2] + (pos[2] - prevPos[2]) * frac
      ];
      const interpVel: Vec3 = [
        prevState[3] + (state[3] - prevState[3]) * frac,
        prevState[4] + (state[4] - prevState[4]) * frac,
        prevState[5] + (state[5] - prevState[5]) * frac
      ];
      const losPos = vecAdd(sightPos, vecScale(losDir, distances[nextIdx]));
      const error = vecSub(interpPos, losPos);
      const dropM = -vecDot(error, upAxis);
      const driftM = vecDot(error, rightDir);
      const v = vecNorm(interpVel);
      const energy = 0.5 * massKg * v ** 2;
      const angleRad = Math.atan2(dropM, Math.max(distances[nextIdx], 1e-6));
      const correction = (optic.unit ?? "MIL").toUpperCase() === "MOA" ? moaFromRad(angleRad) : milFromRad(angleRad);
      const clickValue = optic.click_value ?? 0.1;
      const clicks = clickValue > 0 ? correction / clickValue : 0;
      results.push({
        distance_m: distances[nextIdx],
        drop_m: dropM,
        drift_m: driftM,
        time_s: t,
        velocity_mps: v,
        energy_j: energy,
        correction,
        clicks,
        holdover: correction
      });
      nextIdx += 1;
      continue;
    }

    prevState = state.slice();

    const deriv = (s: number[]) => {
      const vel: Vec3 = [s[3], s[4], s[5]];
      const vRel = vecSub(vel, windVec);
      const aDrag = dragAcceleration(vRel, rho, dragModel, bc, caliberMm, massKg, temperatureC);
      const aGrav: Vec3 = [0, 0, -G];
      const aCor = coriolisAccel(vel, latitude);
      const aEot = eotvosAccel(vel, latitude);
      const acc = vecAdd(vecAdd(aDrag, aGrav), vecAdd(aCor, aEot));
      return [vel[0], vel[1], vel[2], acc[0], acc[1], acc[2]];
    };

    state = rk4Step(state, dt, deriv);
    t += dt;
    if (state[2] < -200.0 && state[5] < 0) break;
  }

  const traj = {
    distance_m: results.map((r) => r.distance_m),
    drop_m: results.map((r) => r.drop_m),
    drift_m: results.map((r) => r.drift_m),
    velocity_mps: results.map((r) => r.velocity_mps),
    energy_j: results.map((r) => r.energy_j),
    time_s: results.map((r) => r.time_s)
  };

  const bulletLengthMm =
    ammo.bullet_length_mm ??
    estimateBulletLengthMm(ammo.bullet_weight_grains ?? 168, caliberMm);
  const stability = gyroStabilityMiller(
    ammo.bullet_weight_grains ?? 168,
    caliberMm,
    bulletLengthMm,
    weapon.twist_rate_in ?? null,
    v0,
    temperatureC,
    pressureHpa
  );

  return {
    summary: {
      zero_angle_deg: zeroDelta,
      air_density: rho,
      muzzle_velocity_mps: v0,
      stability_sg: stability,
      speed_of_sound_mps: speedOfSound(temperatureC)
    },
    table: results,
    trajectory: traj
  };
};
