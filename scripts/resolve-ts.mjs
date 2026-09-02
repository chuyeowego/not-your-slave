// eve resolves extensionless relative imports inside agent/; plain node does
// not. This lets a check import an agent module directly:
//   node --experimental-strip-types --import ./scripts/resolve-ts.mjs <check>
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return next(specifier + ".ts", context);
    }
    return next(specifier, context);
  },
});
