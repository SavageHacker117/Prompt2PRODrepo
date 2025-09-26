import { DCWO } from "../../apps/demo-web/src/canvasmind/dcwo";

test("DCWO type holds provenance", () => {
  const obj: DCWO = {
    id: "mesh1",
    context: { semantics: ["mesh"], provenance: { server: "mock" } },
    policy: {}
  };
  expect(obj.context.provenance?.server).toBe("mock");
});
