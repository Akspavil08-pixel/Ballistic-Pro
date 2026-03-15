import math
import numpy as np

OMEGA = 7.2921159e-5


def omega_vector_enu(latitude_deg: float) -> np.ndarray:
    lat = math.radians(latitude_deg)
    return np.array([0.0, OMEGA * math.cos(lat), OMEGA * math.sin(lat)], dtype=float)


def coriolis_accel(velocity_enu: np.ndarray, latitude_deg: float) -> np.ndarray:
    omega = omega_vector_enu(latitude_deg)
    return 2.0 * np.cross(velocity_enu, omega)


def eotvos_accel(velocity_enu: np.ndarray, latitude_deg: float) -> np.ndarray:
    # Dynamic Eotvos term due to eastward velocity component.
    lat = math.radians(latitude_deg)
    v_east = velocity_enu[0]
    a_up = 2.0 * OMEGA * v_east * math.cos(lat)
    return np.array([0.0, 0.0, a_up], dtype=float)
