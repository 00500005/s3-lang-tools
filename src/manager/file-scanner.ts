import { readFile } from 'fs';
import * as glob from 'glob';
import { nanoid } from 'nanoid/non-secure';
import { TextDocumentGroupUpdate } from '../api/doc-types';
import { ManagedSugarcubeDoc } from '../api';
import { DebugConsole } from '../config/log';

export async function readFileAsync(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    readFile(path, null, (err, data: Buffer) => {
      if (err) { reject(err) }
      else {
        resolve(data.toString())
      }
    })
  })
}
export async function queueFiles(debugConsole: DebugConsole, docs: ManagedSugarcubeDoc, progressToken: string, files: string[]): Promise<any> {
  return new Promise(async (resolve, reject) => {
    await Promise.all(files.map(async (f, id) => {
      const text = await readFileAsync(f).catch(e => reject(e))
      if (text) {
        docs.raw(`file://${f}`, text,
          <TextDocumentGroupUpdate>{
            id,
            count: files.length,
            progressToken,
          })
      }
    }));
    resolve()
  })
}
export async function filesFromRoot(root: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    glob('**/*.{tw,twee}', <glob.IOptions>{ root, absolute: true }, async (err, files) => {
      if (err) { reject(err); }
      else { resolve(files); }
    })
  })
}
