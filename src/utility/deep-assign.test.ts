import { expect, it } from "bun:test";
import { deepAssign } from "./deep-assign";

it("deepAssign keep the property in the nested object", () => {
  const a = { a: { a1: 1, a2: 2 }, b: 10 };
  const b = { a: { a1: 2, a3: 3 }, b: 50 };
  const result = deepAssign(a, b);
  expect(result).toEqual({ a: { a1: 2, a2: 2, a3: 3 }, b: 50 });
});

it("deepAssign accept multiple sources", () => {
  const a = { a: { a1: 1, a2: 2 }, b: 10, c: 100 };
  const b = { a: { a1: 2, a3: 3 }, b: 50 };
  const c = { a: { a4: 4 }, c: 200, d: 1000 };
  const result = deepAssign(a, b, c);
  expect(result).toEqual({
    a: { a1: 2, a2: 2, a3: 3, a4: 4 },
    b: 50,
    c: 200,
    d: 1000,
  });
});
