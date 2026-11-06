import { build } from 'esbuild'

const common = {
  bundle: true,
  outdir: 'out',
  outbase: 'src',
  target: 'es2024',
  logLevel: 'info',
}

await Promise.all([
  build({
    ...common,
    entryPoints: ['src/main/main.ts'],
    format: 'esm',
    platform: 'node',
    packages: 'external',
  }),
  build({
    ...common,
    entryPoints: ['src/preload/preload.cts'],
    format: 'cjs',
    platform: 'node',
    external: ['electron'],
    outExtension: { '.js': '.cjs' },
  }),
  build({
    ...common,
    entryPoints: [
      'src/renderer/renderer.ts',
      'src/renderer/index.html',
      'src/renderer/tokens.css',
      'src/renderer/styles.css',
      'src/renderer/records.css',
    ],
    format: 'esm',
    platform: 'browser',
    loader: { '.html': 'copy', '.css': 'copy' },
  }),
])
