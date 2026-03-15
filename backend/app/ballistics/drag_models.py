from __future__ import annotations
from pathlib import Path
import numpy as np

# High-resolution reference drag curves for G1/G7 (Cd vs Mach).
# Loaded from CSV files to keep the data clean and editable.

DATA_DIR = Path(__file__).resolve().parent
G1_PATH = DATA_DIR / "g1.csv"
G7_PATH = DATA_DIR / "g7.csv"


def _load_table(path: Path) -> tuple[np.ndarray, np.ndarray]:
    data = np.loadtxt(path, delimiter=",")
    if data.ndim == 1:
        data = np.expand_dims(data, axis=0)
    mach = data[:, 0]
    cd = data[:, 1]
    return mach, cd


_MACH_G1, _CD_G1 = _load_table(G1_PATH)
_MACH_G7, _CD_G7 = _load_table(G7_PATH)


def _interp(mach: float, mach_table: np.ndarray, cd_table: np.ndarray) -> float:
    mach = float(max(0.0, min(mach, mach_table[-1])))
    return float(np.interp(mach, mach_table, cd_table))


def cd_from_mach(mach: float, model: str) -> float:
    model = (model or "G1").upper()
    if model == "G7":
        return _interp(mach, _MACH_G7, _CD_G7)
    return _interp(mach, _MACH_G1, _CD_G1)
