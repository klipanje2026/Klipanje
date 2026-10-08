// Transpile actual relative dependencies for Node tests without hand-maintained mocks.
import fs from 'node:fs/promises';
import {dirname, resolve, relative, extname} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
export async function loadTestModule(file, output) {
  const root=resolve('frontend/src'), destination=resolve(output), seen=new Map();
  async function compile(source) {
    if(seen.has(source))return seen.get(source);
    const target=resolve(destination,relative(root,source).replace(/\.(tsx?|mjs)$/,'.mjs'));
    seen.set(source,target);
    const text=await fs.readFile(source,'utf8');
    let code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const imports=[...code.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)];
    for(const match of imports){
      let dependency=resolve(dirname(source),match[2]);
      if(!extname(dependency))dependency+='.ts';
      const built=await compile(dependency);
      let path=relative(dirname(target),built).replaceAll('\\','/');
      if(!path.startsWith('.'))path='./'+path;
      code=code.replaceAll(match[1]+match[2]+match[1],JSON.stringify(path));
    }
    await fs.mkdir(dirname(target),{recursive:true});await fs.writeFile(target,code);return target;
  }
  return import(pathToFileURL(await compile(resolve(root,file))));
}
