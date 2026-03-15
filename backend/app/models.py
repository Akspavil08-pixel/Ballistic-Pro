from sqlalchemy import Column, Integer, String, Float
from .db import Base


class WeaponProfile(Base):
    __tablename__ = "weapons"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    weapon_type = Column(String, nullable=False)  # rifle, carbine, air, bow
    caliber_mm = Column(Float, nullable=False)
    barrel_length_mm = Column(Float, nullable=True)
    twist_rate_in = Column(Float, nullable=True)
    rifling_step_mm = Column(Float, nullable=True)
    sight_height_mm = Column(Float, nullable=False, default=45.0)
    zero_distance_m = Column(Float, nullable=False, default=100.0)
    weapon_mass_kg = Column(Float, nullable=True)


class AmmoProfile(Base):
    __tablename__ = "ammo"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    bullet_weight_grains = Column(Float, nullable=False)
    muzzle_velocity_mps = Column(Float, nullable=False)
    ballistic_coefficient = Column(Float, nullable=False)
    drag_model = Column(String, nullable=False, default="G1")
    powder_temp_c = Column(Float, nullable=True)
    muzzle_velocity_temp_coeff = Column(Float, nullable=True)  # fraction per C
    bullet_length_mm = Column(Float, nullable=True)


class OpticProfile(Base):
    __tablename__ = "optics"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    unit = Column(String, nullable=False)  # MIL or MOA
    click_value = Column(Float, nullable=False)
