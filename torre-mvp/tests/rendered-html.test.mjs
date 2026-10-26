import assert from "node:assert/strict";
import test from "node:test";

test("calculation reference points", () => {
  const calc = (r) => r < .7 ? 0 : r <= 1 ? 1 + (r - .7) * 9 / .3 : r <= 1.1 ? 10 + (r - 1) * 5 / .1 : 15;
  assert.equal(calc(.6), 0);
  assert.equal(calc(.7), 1);
  assert.ok(Math.abs(calc(1) - 10) < 1e-9);
  assert.ok(Math.abs(calc(1.1) - 15) < 1e-9);
  assert.equal(calc(1.2), 15);
});
