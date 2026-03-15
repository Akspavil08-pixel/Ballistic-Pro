import math

R_DRY = 287.05
R_VAPOR = 461.495
GAMMA = 1.4


def saturation_vapor_pressure_hpa(temp_c: float) -> float:
    # Tetens formula, valid for typical ambient temps
    return 6.112 * math.exp((17.67 * temp_c) / (temp_c + 243.5))


def air_density(
    temperature_c: float,
    pressure_hpa: float | None,
    humidity_percent: float,
    altitude_m: float,
) -> float:
    temp_k = temperature_c + 273.15
    if pressure_hpa is None:
        pressure_hpa = standard_pressure_hpa(altitude_m)

    sat_vp = saturation_vapor_pressure_hpa(temperature_c)
    vapor_hpa = max(0.0, min(100.0, humidity_percent)) / 100.0 * sat_vp
    dry_hpa = max(1.0, pressure_hpa - vapor_hpa)

    p_dry = dry_hpa * 100.0
    p_vapor = vapor_hpa * 100.0

    rho_dry = p_dry / (R_DRY * temp_k)
    rho_vapor = p_vapor / (R_VAPOR * temp_k)
    return rho_dry + rho_vapor


def speed_of_sound(temperature_c: float) -> float:
    temp_k = temperature_c + 273.15
    return math.sqrt(GAMMA * R_DRY * temp_k)


def standard_pressure_hpa(altitude_m: float) -> float:
    # ISA approximation
    p0 = 1013.25
    t0 = 288.15
    lapse = 0.0065
    g = 9.80665
    r = 287.05
    if altitude_m < 0:
        altitude_m = 0.0
    return p0 * (1 - lapse * altitude_m / t0) ** (g / (r * lapse))
