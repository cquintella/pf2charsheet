export interface SessionState {
  currentHp: number | null;
  tempHp: number;
  dying: number;
  wounded: number;
  heroPoints: number;
  focusPoints: number;
  maxFocusPoints: number;
  shieldRaised: boolean;
  conditions: {
    frightened: number;
    sickened: number;
    clumsy: number;
    drained: number;
    enfeebled: number;
    slowed: number;
    offGuard: boolean;
  };
}

export const DEFAULT_SESSION_STATE: SessionState = {
  currentHp: null,
  tempHp: 0,
  dying: 0,
  wounded: 0,
  heroPoints: 1,
  focusPoints: 0,
  maxFocusPoints: 0,
  shieldRaised: false,
  conditions: {
    frightened: 0,
    sickened: 0,
    clumsy: 0,
    drained: 0,
    enfeebled: 0,
    slowed: 0,
    offGuard: false,
  },
};

export interface ConditionPenalties {
  ac: number;
  perception: number;
  fortitude: number;
  reflex: number;
  will: number;
  strChecks: number;
  dexChecks: number;
  strDamage: number;
  allChecks: number;
  maxHpReduction: number;
}

/**
 * Calcula penalidades de status e circunstância das condições ativas de PF2e Remaster.
 * Penalidades de mesmo tipo não acumulam (usa-se a maior).
 */
export function computeConditionPenalties(
  session: SessionState,
  level: number,
  shieldAcBonus = 0
): ConditionPenalties {
  const c = session.conditions;
  const globalStatus = Math.max(c.frightened, c.sickened);

  const acStatus = Math.max(globalStatus, c.clumsy);
  const acCirc = c.offGuard ? 2 : 0;
  const shieldBonus = session.shieldRaised && shieldAcBonus > 0 ? shieldAcBonus : 0;

  return {
    ac: shieldBonus - acStatus - acCirc,
    perception: -globalStatus,
    fortitude: -Math.max(globalStatus, c.drained),
    reflex: -Math.max(globalStatus, c.clumsy),
    will: -globalStatus,
    strChecks: -Math.max(globalStatus, c.enfeebled),
    dexChecks: -Math.max(globalStatus, c.clumsy),
    strDamage: -c.enfeebled,
    allChecks: -globalStatus,
    maxHpReduction: c.drained * level,
  };
}
