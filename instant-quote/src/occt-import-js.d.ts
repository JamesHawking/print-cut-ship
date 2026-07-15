// occt-import-js ships no TypeScript types; declare the Emscripten factory.
declare module 'occt-import-js' {
  import type { OcctModule } from './lib/mesh/parse-step'

  interface OcctInitOptions {
    locateFile?: (path: string) => string
  }

  const occtimportjs: (options?: OcctInitOptions) => Promise<OcctModule>
  export default occtimportjs
}
