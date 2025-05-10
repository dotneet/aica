/**
 * Function that performs deep object assignment.
 * @param target The target object to assign to
 * @param sources Variable arguments of objects to assign
 * @returns The object after assignment
 */
export function deepAssign(
  target: Record<string, unknown>,
  ...sources: Partial<Record<string, unknown>>[]
): Record<string, unknown> {
  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (source[key] && typeof source[key] === "object") {
          if (!target[key] || typeof target[key] !== "object") {
            target[key] = {};
          }
          target[key] = deepAssign(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>,
          );
        } else {
          target[key] = source[key];
        }
      }
    }
  }
  return target;
}
