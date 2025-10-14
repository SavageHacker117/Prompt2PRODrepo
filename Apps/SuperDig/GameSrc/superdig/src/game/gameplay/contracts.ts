export type Contract = { levelId: number; oilQuota: number; rewardCR: number; perk?: { type: string; value: number } };

export function isComplete(earnedCR: number, targetCR: number) {
  return earnedCR >= targetCR;
}
