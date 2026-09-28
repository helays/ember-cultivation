// Turn order (doc/02 §3.2): speed descending, player side wins ties.
// Buffs/debuffs change order naturally because the list is re-sorted every round.

export function turnOrder(combatants) {
  return combatants
    .filter((c) => c.hp > 0)
    .sort((a, b) => {
      if (b.spd !== a.spd) return b.spd - a.spd
      if (a.side !== b.side) return a.side === 'ally' ? -1 : 1
      return 0
    })
}
