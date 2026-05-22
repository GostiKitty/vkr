/**
 * Типовые приведённые сопротивления теплопередаче светопрозрачных заполнений
 * (ориентиры СП 50.13330.2024 для расчёта без паспорта конкретного изделия).
 */
export const TYPICAL_WINDOW_U_W_M2K = 2.1;
export const TYPICAL_DOOR_U_W_M2K = 1.5;

export function getTypicalWindowU_W_m2K(): number {
  return TYPICAL_WINDOW_U_W_M2K;
}

export function getTypicalDoorU_W_m2K(): number {
  return TYPICAL_DOOR_U_W_M2K;
}
