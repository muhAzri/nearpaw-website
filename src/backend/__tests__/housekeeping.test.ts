import { describe, expect, it, vi } from "vitest";
import { createHousekeepingModule } from "../modules/housekeeping";

const SECRET = "0123456789abcdef0123456789abcdef";
const call = (controller: { run(r: Request): Promise<Response> }, auth?: string) =>
  controller.run(new Request("http://localhost/api/v1/cron/housekeeping", { headers: auth ? { authorization: auth } : {} }));

describe("housekeeping endpoint", () => {
  it("refuses to run when no secret is configured", async () => {
    const run = vi.fn(async () => ({}));
    const { controller } = createHousekeepingModule({ secret: () => undefined, tasks: [{ name: "t", run }] });
    expect((await call(controller, `Bearer ${SECRET}`)).status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret", async () => {
    const run = vi.fn(async () => ({}));
    const { controller } = createHousekeepingModule({ secret: () => SECRET, tasks: [{ name: "t", run }] });
    expect((await call(controller)).status).toBe(401);
    expect((await call(controller, "Bearer nope")).status).toBe(401);
    expect((await call(controller, `Bearer ${SECRET}x`)).status).toBe(401);
    expect((await call(controller, SECRET)).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs every task with the right secret and reports their counts", async () => {
    const { controller } = createHousekeepingModule({
      secret: () => SECRET,
      tasks: [
        { name: "photos", run: async () => ({ files: 4 }) },
        { name: "rate-limits", run: async () => ({ removed: 9 }) },
      ],
    });
    const res = await call(controller, `Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect((await res.json()).data.tasks).toEqual([
      { task: "photos", ok: true, result: { files: 4 } },
      { task: "rate-limits", ok: true, result: { removed: 9 } },
    ]);
  });

  it("keeps going when one task fails, and answers 500 so the cron run shows as failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn(async () => ({ removed: 1 }));
    const { controller } = createHousekeepingModule({
      secret: () => SECRET,
      tasks: [
        { name: "photos", run: async () => { throw new Error("bucket unreachable"); } },
        { name: "rate-limits", run: after },
      ],
    });
    const res = await call(controller, `Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(after).toHaveBeenCalled();
    expect((await res.json()).data.tasks[0]).toMatchObject({ task: "photos", ok: false, error: "bucket unreachable" });
  });
});
