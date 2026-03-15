import { solveBallisticsLocal } from "./ballistics";

export async function solveBallistics(payload: unknown) {
  return solveBallisticsLocal(payload);
}
