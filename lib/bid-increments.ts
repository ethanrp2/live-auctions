export interface BidIncrementRule {
  lowRange: number;
  highRange: number;
  step: number;
}

// All ranges and steps are in cents — matches Basta's bidIncrementTable and the
// cents-everywhere convention across the app.
export const DEFAULT_BID_INCREMENT_TABLE: BidIncrementRule[] = [
  { lowRange: 0, highRange: 100_000, step: 2_500 },
  { lowRange: 100_000, highRange: 5_000_000, step: 10_000 },
];

export function stepForBid(
  currentBid: number,
  table: BidIncrementRule[] = DEFAULT_BID_INCREMENT_TABLE
): number {
  for (const rule of table) {
    if (currentBid >= rule.lowRange && currentBid < rule.highRange) {
      return rule.step;
    }
  }
  const last = table[table.length - 1];
  return last ? last.step : 100;
}

export function nextIncrement(
  currentBid: number,
  table: BidIncrementRule[] = DEFAULT_BID_INCREMENT_TABLE
): number {
  return currentBid + stepForBid(currentBid, table);
}
