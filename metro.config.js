// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// zustand's "exports" map resolves to its ESM build (esm/middleware.mjs) on
// web, which references `import.meta.env` — Metro bundles as a script, not
// a module, so `import.meta` throws a SyntaxError at parse time and the app
// never gets past the loading screen. Disabling package-exports resolution
// falls back to the "main" field (CJS, no import.meta).
config.resolver.unstable_enablePackageExports = false

module.exports = config
