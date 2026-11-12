import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('Pure Web Audio engine guardrails (ADR-0014)', () => {
  it('has zero imports or mocks of tone or fakeTone in src/', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const selfPath = path.resolve(__filename);
    const files = collectSourceFiles(srcDir).filter((f) => path.resolve(f) !== selfPath);
    const offenders: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (
        /from\s+['"]tone['"]/.test(content) ||
        /vi\.mock\(\s*['"]tone['"]/.test(content) ||
        /fakeTone/.test(content)
      ) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('references only .wav default samples in DefaultSampleLoader and public/samples/README.md', () => {
    const loader = fs.readFileSync(
      path.resolve(process.cwd(), 'src/audio/DefaultSampleLoader.ts'),
      'utf8'
    );
    const readme = fs.readFileSync(
      path.resolve(process.cwd(), 'public/samples/README.md'),
      'utf8'
    );

    expect(loader).not.toMatch(/\/samples\/[^'"`\s]+\.mp3/);
    expect(readme).not.toMatch(/`[^`]+\.mp3`/i);
  });
});
