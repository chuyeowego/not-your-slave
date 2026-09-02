import { describe, expect, test, vi } from "vitest";

import home from "#channels/home.ts";
import think, { HEARTBEAT, TIMELINE } from "#schedules/think.ts";

describe("think schedule", () => {
  test("exports the shared address and a 15-minute cron", () => {
    expect(TIMELINE).toBe("timeline");
    expect(think.cron).toBe("*/15 * * * *");
    expect(HEARTBEAT).toContain("Read your mindlog with `mindlog_read`");
    expect(HEARTBEAT).toContain("Nobody asked for this");
  });

  test("queues the heartbeat onto the home timeline", async () => {
    const send = vi.fn().mockResolvedValue({ id: "ses_beat" });
    const to = vi.fn().mockReturnValue({ send });
    const waitUntil = vi.fn();
    const appAuth = {
      attributes: {},
      authenticator: "app",
      principalId: "agent",
      principalType: "app",
    };

    await think.run({ to, waitUntil, appAuth });

    expect(to).toHaveBeenCalledWith(home, {});
    expect(send).toHaveBeenCalledWith(HEARTBEAT, { auth: appAuth, turnPolicy: "queue" });
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });
});
