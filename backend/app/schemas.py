from pydantic import BaseModel, Field
from typing import Optional, List


class WeaponBase(BaseModel):
    name: str
    weapon_type: str = Field(..., description="rifle|carbine|air|bow")
    caliber_mm: float
    barrel_length_mm: Optional[float] = None
    twist_rate_in: Optional[float] = None
    rifling_step_mm: Optional[float] = None
    sight_height_mm: float = 45.0
    zero_distance_m: float = 100.0
    weapon_mass_kg: Optional[float] = None


class WeaponCreate(WeaponBase):
    pass


class WeaponRead(WeaponBase):
    id: int

    class Config:
        from_attributes = True


class AmmoBase(BaseModel):
    name: str
    bullet_weight_grains: float
    muzzle_velocity_mps: float
    ballistic_coefficient: float
    drag_model: str = "G1"
    powder_temp_c: Optional[float] = None
    muzzle_velocity_temp_coeff: Optional[float] = None
    bullet_length_mm: Optional[float] = None


class AmmoCreate(AmmoBase):
    pass


class AmmoRead(AmmoBase):
    id: int

    class Config:
        from_attributes = True


class OpticBase(BaseModel):
    name: str
    unit: str = "MIL"
    click_value: float = 0.1


class OpticCreate(OpticBase):
    pass


class OpticRead(OpticBase):
    id: int

    class Config:
        from_attributes = True


class WeatherInput(BaseModel):
    temperature_c: float = 15.0
    pressure_hpa: Optional[float] = 1013.25
    humidity_percent: float = 50.0
    altitude_m: float = 0.0
    wind_speed_mps: float = 0.0
    wind_direction_deg: float = 0.0  # direction FROM (0 = North)


class GeometryInput(BaseModel):
    distance_m: float = 100.0
    shot_angle_deg: float = 0.0
    azimuth_deg: float = 0.0
    latitude_deg: float = 0.0


class SimulationSettings(BaseModel):
    max_range_m: float = 1000.0
    step_m: float = 10.0
    time_step_s: float = 0.002
    mode: str = "basic"  # basic|pro


class BallisticsRequest(BaseModel):
    weapon: WeaponBase
    ammo: AmmoBase
    optic: OpticBase
    weather: WeatherInput
    geometry: GeometryInput
    settings: SimulationSettings


class BallisticTableRow(BaseModel):
    distance_m: float
    drop_m: float
    drift_m: float
    time_s: float
    velocity_mps: float
    energy_j: float
    correction: float
    clicks: float
    holdover: float


class BallisticsResponse(BaseModel):
    summary: dict
    table: List[BallisticTableRow]
    trajectory: dict
