from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models, schemas
from ..ballistics.engine import compute_ballistics

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


# Weapons
@router.get("/profiles/weapons", response_model=list[schemas.WeaponRead])
def list_weapons(db: Session = Depends(get_db)):
    return db.query(models.WeaponProfile).all()


@router.post("/profiles/weapons", response_model=schemas.WeaponRead)
def create_weapon(payload: schemas.WeaponCreate, db: Session = Depends(get_db)):
    weapon = models.WeaponProfile(**payload.model_dump())
    db.add(weapon)
    db.commit()
    db.refresh(weapon)
    return weapon


@router.get("/profiles/weapons/{weapon_id}", response_model=schemas.WeaponRead)
def get_weapon(weapon_id: int, db: Session = Depends(get_db)):
    weapon = db.query(models.WeaponProfile).filter(models.WeaponProfile.id == weapon_id).first()
    if not weapon:
        raise HTTPException(status_code=404, detail="Weapon not found")
    return weapon


@router.put("/profiles/weapons/{weapon_id}", response_model=schemas.WeaponRead)
def update_weapon(weapon_id: int, payload: schemas.WeaponCreate, db: Session = Depends(get_db)):
    weapon = db.query(models.WeaponProfile).filter(models.WeaponProfile.id == weapon_id).first()
    if not weapon:
        raise HTTPException(status_code=404, detail="Weapon not found")
    for key, value in payload.model_dump().items():
        setattr(weapon, key, value)
    db.commit()
    db.refresh(weapon)
    return weapon


@router.delete("/profiles/weapons/{weapon_id}")
def delete_weapon(weapon_id: int, db: Session = Depends(get_db)):
    weapon = db.query(models.WeaponProfile).filter(models.WeaponProfile.id == weapon_id).first()
    if not weapon:
        raise HTTPException(status_code=404, detail="Weapon not found")
    db.delete(weapon)
    db.commit()
    return {"status": "deleted"}


# Ammo
@router.get("/profiles/ammo", response_model=list[schemas.AmmoRead])
def list_ammo(db: Session = Depends(get_db)):
    return db.query(models.AmmoProfile).all()


@router.post("/profiles/ammo", response_model=schemas.AmmoRead)
def create_ammo(payload: schemas.AmmoCreate, db: Session = Depends(get_db)):
    ammo = models.AmmoProfile(**payload.model_dump())
    db.add(ammo)
    db.commit()
    db.refresh(ammo)
    return ammo


@router.get("/profiles/ammo/{ammo_id}", response_model=schemas.AmmoRead)
def get_ammo(ammo_id: int, db: Session = Depends(get_db)):
    ammo = db.query(models.AmmoProfile).filter(models.AmmoProfile.id == ammo_id).first()
    if not ammo:
        raise HTTPException(status_code=404, detail="Ammo not found")
    return ammo


@router.put("/profiles/ammo/{ammo_id}", response_model=schemas.AmmoRead)
def update_ammo(ammo_id: int, payload: schemas.AmmoCreate, db: Session = Depends(get_db)):
    ammo = db.query(models.AmmoProfile).filter(models.AmmoProfile.id == ammo_id).first()
    if not ammo:
        raise HTTPException(status_code=404, detail="Ammo not found")
    for key, value in payload.model_dump().items():
        setattr(ammo, key, value)
    db.commit()
    db.refresh(ammo)
    return ammo


@router.delete("/profiles/ammo/{ammo_id}")
def delete_ammo(ammo_id: int, db: Session = Depends(get_db)):
    ammo = db.query(models.AmmoProfile).filter(models.AmmoProfile.id == ammo_id).first()
    if not ammo:
        raise HTTPException(status_code=404, detail="Ammo not found")
    db.delete(ammo)
    db.commit()
    return {"status": "deleted"}


# Optics
@router.get("/profiles/optics", response_model=list[schemas.OpticRead])
def list_optics(db: Session = Depends(get_db)):
    return db.query(models.OpticProfile).all()


@router.post("/profiles/optics", response_model=schemas.OpticRead)
def create_optic(payload: schemas.OpticCreate, db: Session = Depends(get_db)):
    optic = models.OpticProfile(**payload.model_dump())
    db.add(optic)
    db.commit()
    db.refresh(optic)
    return optic


@router.get("/profiles/optics/{optic_id}", response_model=schemas.OpticRead)
def get_optic(optic_id: int, db: Session = Depends(get_db)):
    optic = db.query(models.OpticProfile).filter(models.OpticProfile.id == optic_id).first()
    if not optic:
        raise HTTPException(status_code=404, detail="Optic not found")
    return optic


@router.put("/profiles/optics/{optic_id}", response_model=schemas.OpticRead)
def update_optic(optic_id: int, payload: schemas.OpticCreate, db: Session = Depends(get_db)):
    optic = db.query(models.OpticProfile).filter(models.OpticProfile.id == optic_id).first()
    if not optic:
        raise HTTPException(status_code=404, detail="Optic not found")
    for key, value in payload.model_dump().items():
        setattr(optic, key, value)
    db.commit()
    db.refresh(optic)
    return optic


@router.delete("/profiles/optics/{optic_id}")
def delete_optic(optic_id: int, db: Session = Depends(get_db)):
    optic = db.query(models.OpticProfile).filter(models.OpticProfile.id == optic_id).first()
    if not optic:
        raise HTTPException(status_code=404, detail="Optic not found")
    db.delete(optic)
    db.commit()
    return {"status": "deleted"}


# Ballistics
@router.post("/ballistics/solve", response_model=schemas.BallisticsResponse)
def solve_ballistics(payload: schemas.BallisticsRequest):
    result = compute_ballistics(payload.model_dump())
    return result
