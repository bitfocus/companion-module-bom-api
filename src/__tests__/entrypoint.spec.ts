import { describe, expect, it } from 'vitest'
import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = join(import.meta.dirname, '../..')

/**
 * Companion runs a module under development straight from dist, with Node's own ESM loader. The packaged build is
 * bundled by esbuild, and vitest smooths over CommonJS interop, so neither notices an import only they can resolve:
 * a named import from lodash, which is CommonJS, built and passed every test but failed to load in Companion with
 * "does not provide an export named 'orderBy'". So compile the module and load it the way Companion does.
 */
describe('entrypoint', () => {
	it('loads with Node alone, unbundled', async () => {
		// Inside node_modules, so the compiled module resolves its dependencies as dist does
		const outDir = await mkdtemp(join(root, 'node_modules/.cache-entrypoint-'))
		try {
			const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
			await run(process.execPath, [tsc, '-p', join(root, 'tsconfig.build.json'), '--outDir', outDir])
			const { stdout } = await run(process.execPath, [
				'--input-type=module',
				'-e',
				'const m = await import(process.argv[1]); console.log(typeof m.default, Array.isArray(m.UpgradeScripts))',
				join(outDir, 'main.js'),
			])
			expect(stdout.trim()).toBe('function true')
		} finally {
			await rm(outDir, { recursive: true, force: true })
		}
	}, 60000)
})
