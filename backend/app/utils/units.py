import math

GRAIN_TO_KG = 0.00006479891
IN_TO_M = 0.0254
MM_TO_M = 0.001
LB_PER_KG = 2.2046226218
IN_PER_M = 39.37007874


def grains_to_kg(grains: float) -> float:
    return grains * GRAIN_TO_KG


def mm_to_m(mm: float) -> float:
    return mm * MM_TO_M


def inches_to_m(inches: float) -> float:
    return inches * IN_TO_M


def kg_to_lb(kg: float) -> float:
    return kg * LB_PER_KG


def m_to_in(meters: float) -> float:
    return meters * IN_PER_M


def moa_from_rad(rad: float) -> float:
    return math.degrees(rad) * 60.0


def mil_from_rad(rad: float) -> float:
    return rad * 1000.0
