import * as fsSync from 'fs';
import * as path from 'path';

/**
 * The heartbeat file is placed inside the nodemon-watched src/ directory so
 * that touching it resets nodemon's restart delay. This prevents nodemon from
 * restarting the API server while in-process code generation is writing files
 * (which is especially important for embedded PGlite projects where the
 * generate-code endpoint runs schematics in-process).
 *
 * The file uses a .json extension because nodemon is configured to watch
 * ts,json files. It is placed at the src/ root (not inside any metadata
 * directory) so it is not caught by the metadata JSON ignore rule.
 */
const HEARTBEAT_FILENAME = 'solidx-nodemon-heartbeat.json';
const HEARTBEAT_INTERVAL_MS = 1500;

export interface NodemonHeartbeatHandle {
  stop: () => void;
}

/**
 * Starts a heartbeat that touches a file in the nodemon-watched directory
 * every ~1.5 s. Call `stop()` after the response has been flushed to allow
 * nodemon to restart.
 *
 * @param srcDir Absolute path to the `src/` directory nodemon watches.
 */
export function startNodemonHeartbeat(srcDir: string): NodemonHeartbeatHandle {
  const filePath = path.join(srcDir, HEARTBEAT_FILENAME);
  let stopped = false;

  const touch = () => {
    try {
      fsSync.writeFileSync(filePath, String(Date.now()));
    } catch {
      // best-effort — if the file can't be written, nodemon will simply
      // restart as usual, which is the safe fallback.
    }
  };

  // Write immediately so the delay resets before any schematic output lands.
  touch();

  const timer = setInterval(touch, HEARTBEAT_INTERVAL_MS);

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      try {
        fsSync.unlinkSync(filePath);
      } catch {
        // file may not exist — ignore
      }
    },
  };
}
