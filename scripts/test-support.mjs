import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
export async function testModules() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = await mkdtemp(join(tmpdir(), 'quanaqyl-pg-'));
  const compiled = new Map();
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
  async function compile(name) {
    if (compiled.has(name)) return compiled.get(name);
    const destination = join(directory, name + '.mjs'); compiled.set(name, destination);
    let filename = name;
    if (!name.endsWith('.json')) {
      try { await readFile(join(root, name + '.tsx')); filename += '.tsx'; }
      catch { filename += '.ts'; }
    }
    const source = await readFile(join(root, filename), 'utf8');
    let output = name.endsWith('.json') ? `export default ${source};` : ts.transpileModule(source, {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    for (const match of [...output.matchAll(/from\s+(['"])(@\/[^'"]+|\.{1,2}\/[^'"]+)\1/g)]) {
      const dependency = match[2].startsWith('@/') ? match[2].slice(2) : relative(root, resolve(root, dirname(name), match[2]));
      output = output.replace(match[0], `from ${JSON.stringify(pathToFileURL(await compile(dependency)).href)}`);
    }
    await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, output); return destination;
  }
  return { load: async name => import(pathToFileURL(await compile(name)).href), directory,
    close: () => rm(directory, { recursive: true, force: true }) };
}
