import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';

const currentDir = new URL(dirname(import.meta.url)).pathname;

export function loadFixtures(fixturePath: string) {
  return fs.readFile(join(currentDir, fixturePath), 'utf-8');
}
