import { validateTextureBudget, validateTrisCount } from "../../apps/demo-web/src/canvasmind/runtime/validators";

test("budget checks", () => {
  expect(validateTextureBudget(64, 128)).toBe(true);
  expect(validateTextureBudget(256, 128)).toBe(false);
  expect(validateTrisCount(100, 200)).toBe(true);
  expect(validateTrisCount(500, 200)).toBe(false);
});
