export interface NpcProfile {
  name: string;
  /** Minimum soldiers every non-staging territory keeps at home (the floor; see garrisonTarget). */
  garrison: number;
  /** How many future rounds of income a captured country is worth. */
  horizon: number;
  /** Extra value for wiping a player out. */
  eliminationBonus: number;
  /** Max fraction of the army the NPC will tie up in home garrisons. */
  defenceShare: number;
  /** Garrisons grow until a rival's best strike has at most this chance of taking the country. */
  safety: number;
  /** Never START an attack below this win probability. */
  minWinProbability: number;
  /** Never start an attack below this utility. */
  minUtility: number;
  /** Keep rolling while the utility of continuing exceeds this. */
  stopMargin: number;
  /** Scales how expensive losing a soldier is (lower = braver). */
  riskAversion: number;
  /** Extra weight (0 = none) on the territories of the chosen victim, the weakest surviving rival. */
  focus: number;
  /** Extra weight on targets that hold most of their owner's army (a decapitating strike). */
  decapitation: number;
  /** From this round on, captures are valued more and more (stops endless stand-offs). */
  impatienceStart: number;
  /** Rounds over which the value of a capture grows by another 100% of its base value. */
  impatienceScale: number;
}

export const BALANCED: NpcProfile = {
  name: 'balanced',
  garrison: 2,
  defenceShare: 0.5,
  safety: 0.3,
  horizon: 4,
  eliminationBonus: 4,
  minWinProbability: 0.55,
  minUtility: 0.5,
  stopMargin: 0,
  riskAversion: 1,
  focus: 1,
  decapitation: 3,
  impatienceStart: 12,
  impatienceScale: 12,
};

export const AGGRESSIVE: NpcProfile = {
  name: 'aggressive',
  garrison: 1,
  defenceShare: 0.3,
  safety: 0.5,
  horizon: 5,
  eliminationBonus: 6,
  minWinProbability: 0.4,
  minUtility: 0,
  stopMargin: -1.5,
  riskAversion: 0.7,
  focus: 1.5,
  decapitation: 4,
  impatienceStart: 8,
  impatienceScale: 10,
};

export const DEFENSIVE: NpcProfile = {
  name: 'defensive',
  garrison: 3,
  defenceShare: 0.7,
  safety: 0.15,
  horizon: 3,
  eliminationBonus: 3,
  minWinProbability: 0.7,
  minUtility: 1.5,
  stopMargin: 0.5,
  riskAversion: 1.3,
  focus: 0.5,
  decapitation: 2,
  impatienceStart: 20,
  impatienceScale: 20,
};

export const PROFILES: Record<string, NpcProfile> = { balanced: BALANCED, aggressive: AGGRESSIVE, defensive: DEFENSIVE };