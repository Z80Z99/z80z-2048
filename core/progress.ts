// Deliberate pragmatic exception: core importing from store.
// xpToNext lives in store/helpers because it is shared across
// store actions; duplicating it in core or moving it to a third
// shared module would add indirection for no benefit.
import { xpToNext } from '../store/helpers';

export function gainXp(
  xp: number,
  level: number,
  next: number,
): { xp: number; level: number; next: number } {
  while (xp >= next) {
    xp -= next;
    level++;
    next = xpToNext(level);
  }
  return { xp, level, next };
}
