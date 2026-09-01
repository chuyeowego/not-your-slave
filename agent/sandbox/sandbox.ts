import { defaultBackend, defineSandbox } from "eve/sandbox";
import { Drive, vercel } from "eve/sandbox/vercel";

// Every cron wake-up is its own session, and a session's sandbox filesystem is
// per-session on every backend. On Vercel a Drive is the one native way to give
// /workspace a life longer than the session that made it: the same volume is
// mounted every time, so what the agent builds is simply still there.
//
// Locally there is no equivalent - the Docker backend exposes no mounts - so the
// tar round-trip in hooks/workspace-sync.ts stays as the local mechanism. Note
// that vercel() creates hosted sandboxes even from local dev, so the backend is
// chosen by where the process is actually running.
const DRIVE = process.env.WORKSPACE_DRIVE ?? "not-your-slave-workspace";

export default defineSandbox({
  backend:
    process.env.VERCEL === "1"
      ? vercel({
          async sessionCreateOptions() {
            // getOrCreate is what makes the volume exist on the first ever
            // session; the mount itself refers to it by name.
            const drive = await Drive.getOrCreate({ name: DRIVE });
            return { mounts: { "/workspace": { drive: drive.name, mode: "read-write" } } };
          },
        })
      : defaultBackend(),
});
