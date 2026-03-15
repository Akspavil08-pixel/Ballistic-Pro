import math
import numpy as np


def wind_vector_enu(speed_mps: float, direction_from_deg: float) -> np.ndarray:
    # Direction is where the wind comes FROM (meteorological).
    # Convert to direction TO.
    direction_to_deg = (direction_from_deg + 180.0) % 360.0
    az_rad = math.radians(direction_to_deg)
    north = math.cos(az_rad) * speed_mps
    east = math.sin(az_rad) * speed_mps
    up = 0.0
    return np.array([east, north, up], dtype=float)
