// -----------------------------------------------------------------------------
// A small JSON file in /data, the only writable volume of the container.
//
// It holds what must survive a restart: the calls of the day (the quota
// ledger) and which rain alerts were already fired. No secret goes there:
// the API key lives in the Gladys configuration.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_DATA_DIR = process.env.DATA_DIR || '/data';

/**
 * @param {string | null} dir null keeps everything in memory (tests)
 */
export function createStore(dir = DEFAULT_DATA_DIR) {
  const file = dir ? join(dir, 'state.json') : null;
  let writing = Promise.resolve();

  return {
    /** The saved state, `{}` when there is none or it cannot be read. */
    async load() {
      if (!file) {
        return {};
      }
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    },

    /** Write the whole state (temporary file then rename: never half a file). */
    save(state) {
      if (!file) {
        return Promise.resolve();
      }
      writing = writing
        .catch(() => {})
        .then(async () => {
          await mkdir(dir, { recursive: true });
          const temporary = `${file}.tmp`;
          await writeFile(temporary, JSON.stringify(state));
          await rename(temporary, file);
        });
      return writing;
    },
  };
}
