from __future__ import annotations
import math
import numpy as np

from ..atmosphere.air_density import air_density, speed_of_sound
from ..wind.wind import wind_vector_enu
from ..coriolis.coriolis import coriolis_accel, eotvos_accel
from ..ballistics.drag_models import cd_from_mach
from ..utils.units import grains_to_kg, mm_to_m, moa_from_rad, mil_from_rad, kg_to_lb, m_to_in

G = 9.80665
RHO0 = 1.225


def direction_from_azimuth_elevation(azimuth_deg: float, elevation_deg: float) -> np.ndarray:
    az = math.radians(azimuth_deg)
    el = math.radians(elevation_deg)
    v_h = math.cos(el)
    north = v_h * math.cos(az)
    east = v_h * math.sin(az)
    up = math.sin(el)
    return np.array([east, north, up], dtype=float)


def adjust_muzzle_velocity(muzzle_velocity_mps: float, powder_temp_c: float | None, coeff: float | None, ref_temp_c: float = 15.0) -> float:
    if powder_temp_c is None or coeff is None:
        return muzzle_velocity_mps
    return muzzle_velocity_mps * (1.0 + coeff * (powder_temp_c - ref_temp_c))


def estimate_bullet_length_mm(weight_grains: float, caliber_mm: float) -> float:
    # Rough geometric estimate assuming lead density
    mass_kg = grains_to_kg(weight_grains)
    density = 11340.0  # kg/m^3
    volume = mass_kg / density
    d_m = mm_to_m(caliber_mm)
    area = math.pi * (d_m / 2.0) ** 2
    length_m = volume / max(area, 1e-9)
    return length_m * 1000.0


def gyro_stability_miller(
    bullet_weight_grains: float,
    caliber_mm: float,
    bullet_length_mm: float,
    twist_rate_in: float | None,
    muzzle_velocity_mps: float,
    temperature_c: float,
    pressure_hpa: float | None,
) -> float | None:
    if twist_rate_in is None or twist_rate_in <= 0.0:
        return None

    # Miller stability formula (approx, in imperial units)
    # https://www.jbmballistics.com/ballistics/topics/stability.shtml (conceptual reference)
    d_in = caliber_mm / 25.4
    l_in = bullet_length_mm / 25.4
    if d_in <= 0.0 or l_in <= 0.0:
        return None

    mass_gr = bullet_weight_grains
    t_cal = twist_rate_in / d_in  # calibers per turn
    l_cal = l_in / d_in

    # Atmosphere factor (temperature, pressure)
    temp_r = (temperature_c * 9.0 / 5.0) + 459.67
    if pressure_hpa is None:
        pressure_hpa = 1013.25
    pressure_inhg = pressure_hpa * 0.0295299830714
    atmos = (temp_r / 518.67) * (29.92 / pressure_inhg)

    v_fps = muzzle_velocity_mps * 3.28084

    sg = (30.0 * mass_gr) / (d_in ** 3 * l_cal * (1.0 + l_cal ** 2))
    sg *= (1.0 / (t_cal ** 2))
    sg *= math.sqrt(v_fps / 2800.0)
    sg *= atmos
    return sg


def drag_acceleration(
    v_rel: np.ndarray,
    rho: float,
    model: str,
    ballistic_coefficient: float,
    caliber_mm: float,
    mass_kg: float,
    temperature_c: float,
) -> np.ndarray:
    speed = float(np.linalg.norm(v_rel))
    if speed < 1e-6 or ballistic_coefficient <= 0.0:
        return np.zeros(3)

    mach = speed / max(1e-3, speed_of_sound(temperature_c))
    cd_ref = cd_from_mach(mach, model)

    d_m = mm_to_m(caliber_mm)
    area = math.pi * (d_m / 2.0) ** 2
    if area <= 0.0 or mass_kg <= 0.0:
        return np.zeros(3)

    # Convert BC to form factor i = SD / BC (use imperial units for G1/G7 BC)
    d_in = m_to_in(d_m)
    sd = kg_to_lb(mass_kg) / max(d_in ** 2, 1e-12)
    form_factor = sd / ballistic_coefficient
    cd = cd_ref * form_factor

    drag = 0.5 * rho * cd * area * speed ** 2
    return -(drag / mass_kg) * (v_rel / speed)


def rk4_step(state: np.ndarray, dt: float, deriv_func) -> np.ndarray:
    k1 = deriv_func(state)
    k2 = deriv_func(state + 0.5 * dt * k1)
    k3 = deriv_func(state + 0.5 * dt * k2)
    k4 = deriv_func(state + dt * k3)
    return state + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


def solve_trajectory(
    weapon: dict,
    ammo: dict,
    optic: dict,
    weather: dict,
    geometry: dict,
    settings: dict,
) -> dict:
    caliber_mm = weapon["caliber_mm"]
    sight_height_m = weapon.get("sight_height_mm", 45.0) / 1000.0
    zero_distance_m = weapon.get("zero_distance_m", 100.0)

    powder_temp_c = ammo.get("powder_temp_c")
    temp_coeff = ammo.get("muzzle_velocity_temp_coeff")
    v0 = adjust_muzzle_velocity(ammo["muzzle_velocity_mps"], powder_temp_c, temp_coeff)

    mass_kg = grains_to_kg(ammo["bullet_weight_grains"])
    bc = ammo["ballistic_coefficient"]
    drag_model = ammo.get("drag_model", "G1")

    temperature_c = weather.get("temperature_c", 15.0)
    pressure_hpa = weather.get("pressure_hpa", 1013.25)
    humidity_percent = weather.get("humidity_percent", 50.0)
    altitude_m = weather.get("altitude_m", 0.0)

    wind_speed = weather.get("wind_speed_mps", 0.0)
    wind_dir = weather.get("wind_direction_deg", 0.0)

    distance_m = geometry.get("distance_m", 100.0)
    shot_angle_deg = geometry.get("shot_angle_deg", 0.0)
    azimuth_deg = geometry.get("azimuth_deg", 0.0)
    latitude_deg = geometry.get("latitude_deg", 0.0)

    max_range_m = settings.get("max_range_m", 1000.0)
    step_m = settings.get("step_m", 10.0)
    dt = settings.get("time_step_s", 0.002)

    rho = air_density(temperature_c, pressure_hpa, humidity_percent, altitude_m)
    wind_vec = wind_vector_enu(wind_speed, wind_dir)

    los_dir = direction_from_azimuth_elevation(azimuth_deg, shot_angle_deg)
    los_dir = los_dir / max(np.linalg.norm(los_dir), 1e-9)
    up_axis = np.array([0.0, 0.0, 1.0])
    right_dir = np.cross(los_dir, up_axis)
    if np.linalg.norm(right_dir) < 1e-9:
        right_dir = np.array([1.0, 0.0, 0.0])
    right_dir = right_dir / max(np.linalg.norm(right_dir), 1e-9)

    sight_pos = np.array([0.0, 0.0, sight_height_m])

    def simulate_error(delta_deg: float) -> float:
        bore_dir = direction_from_azimuth_elevation(azimuth_deg, shot_angle_deg + delta_deg)
        bore_dir = bore_dir / max(np.linalg.norm(bore_dir), 1e-9)
        state = np.zeros(6)
        state[3:] = bore_dir * v0
        t = 0.0
        prev_state = state.copy()
        prev_s = 0.0
        while t < 10.0:
            def deriv(s):
                pos = s[:3]
                vel = s[3:]
                v_rel = vel - wind_vec
                a_drag = drag_acceleration(v_rel, rho, drag_model, bc, caliber_mm, mass_kg, temperature_c)
                a_grav = np.array([0.0, 0.0, -G])
                a_cor = coriolis_accel(vel, latitude_deg)
                a_eot = eotvos_accel(vel, latitude_deg)
                acc = a_drag + a_grav + a_cor + a_eot
                return np.hstack([vel, acc])

            prev_state = state.copy()
            state = rk4_step(state, dt, deriv)
            t += dt
            pos = state[:3]
            s = float(np.dot(pos - sight_pos, los_dir))
            if s >= zero_distance_m:
                # interpolate between prev_state and state
                prev_pos = prev_state[:3]
                prev_s = float(np.dot(prev_pos - sight_pos, los_dir))
                if abs(s - prev_s) < 1e-9:
                    frac = 1.0
                else:
                    frac = (zero_distance_m - prev_s) / (s - prev_s)
                pos_at = prev_pos + (pos - prev_pos) * frac
                los_pos = sight_pos + los_dir * zero_distance_m
                error = pos_at - los_pos
                return float(np.dot(error, up_axis))
        return 0.0

    # Binary search for zeroing angle
    delta_low = -2.0
    delta_high = 2.0
    err_low = simulate_error(delta_low)
    err_high = simulate_error(delta_high)
    if err_low * err_high > 0:
        # Fallback small angle if no sign change
        zero_delta = (sight_height_m / max(zero_distance_m, 1.0)) * 180.0 / math.pi
    else:
        zero_delta = 0.0
        for _ in range(30):
            mid = (delta_low + delta_high) / 2.0
            err_mid = simulate_error(mid)
            if err_low * err_mid <= 0:
                delta_high = mid
                err_high = err_mid
            else:
                delta_low = mid
                err_low = err_mid
            zero_delta = mid

    bore_dir = direction_from_azimuth_elevation(azimuth_deg, shot_angle_deg + zero_delta)
    bore_dir = bore_dir / max(np.linalg.norm(bore_dir), 1e-9)

    # Prepare output arrays
    distances = np.arange(0.0, max_range_m + step_m, step_m)
    results = []

    state = np.zeros(6)
    state[3:] = bore_dir * v0

    t = 0.0
    next_idx = 0

    max_time = 30.0
    prev_state = state.copy()

    while t <= max_time and next_idx < len(distances):
        pos = state[:3]
        s = float(np.dot(pos - sight_pos, los_dir))
        if s >= distances[next_idx]:
            # Interpolate state at desired distance
            prev_pos = prev_state[:3]
            prev_s = float(np.dot(prev_pos - sight_pos, los_dir))
            if abs(s - prev_s) < 1e-9:
                frac = 1.0
            else:
                frac = (distances[next_idx] - prev_s) / (s - prev_s)
            interp_pos = prev_pos + (pos - prev_pos) * frac
            interp_vel = prev_state[3:] + (state[3:] - prev_state[3:]) * frac

            los_pos = sight_pos + los_dir * distances[next_idx]
            error = interp_pos - los_pos
            drop_m = -float(np.dot(error, up_axis))
            drift_m = float(np.dot(error, right_dir))

            v = float(np.linalg.norm(interp_vel))
            energy = 0.5 * mass_kg * v ** 2
            angle_rad = math.atan2(drop_m, max(distances[next_idx], 1e-6))
            if optic.get("unit", "MIL").upper() == "MOA":
                correction = moa_from_rad(angle_rad)
            else:
                correction = mil_from_rad(angle_rad)
            click_value = optic.get("click_value", 0.1)
            clicks = correction / click_value if click_value > 0 else 0.0

            results.append({
                "distance_m": float(distances[next_idx]),
                "drop_m": drop_m,
                "drift_m": drift_m,
                "time_s": float(t),
                "velocity_mps": v,
                "energy_j": energy,
                "correction": correction,
                "clicks": clicks,
                "holdover": correction,
            })
            next_idx += 1
            continue

        prev_state = state.copy()

        def deriv(s):
            vel = s[3:]
            v_rel = vel - wind_vec
            a_drag = drag_acceleration(v_rel, rho, drag_model, bc, caliber_mm, mass_kg, temperature_c)
            a_grav = np.array([0.0, 0.0, -G])
            a_cor = coriolis_accel(vel, latitude_deg)
            a_eot = eotvos_accel(vel, latitude_deg)
            acc = a_drag + a_grav + a_cor + a_eot
            return np.hstack([vel, acc])

        state = rk4_step(state, dt, deriv)
        t += dt

        # If bullet is far below line of sight and descending, stop
        if state[2] < -200.0 and state[5] < 0:
            break

    # Prepare summary and arrays
    traj = {
        "distance_m": [row["distance_m"] for row in results],
        "drop_m": [row["drop_m"] for row in results],
        "drift_m": [row["drift_m"] for row in results],
        "velocity_mps": [row["velocity_mps"] for row in results],
        "energy_j": [row["energy_j"] for row in results],
        "time_s": [row["time_s"] for row in results],
    }

    bullet_length_mm = ammo.get("bullet_length_mm") or estimate_bullet_length_mm(
        ammo["bullet_weight_grains"], caliber_mm
    )
    stability = gyro_stability_miller(
        ammo["bullet_weight_grains"],
        caliber_mm,
        bullet_length_mm,
        weapon.get("twist_rate_in"),
        v0,
        temperature_c,
        pressure_hpa,
    )

    return {
        "summary": {
            "zero_angle_deg": zero_delta,
            "air_density": rho,
            "muzzle_velocity_mps": v0,
            "stability_sg": stability,
            "speed_of_sound_mps": speed_of_sound(temperature_c),
        },
        "table": results,
        "trajectory": traj,
    }
