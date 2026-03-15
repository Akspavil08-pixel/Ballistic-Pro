from ..trajectory.solver import solve_trajectory


def compute_ballistics(request_data: dict) -> dict:
    return solve_trajectory(
        weapon=request_data["weapon"],
        ammo=request_data["ammo"],
        optic=request_data["optic"],
        weather=request_data["weather"],
        geometry=request_data["geometry"],
        settings=request_data["settings"],
    )
