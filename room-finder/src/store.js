import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

// Tracks which listing IDs we've already reported, so scheduled runs only
// surface *new* rooms instead of re-notifying you about the same ones.
export class SeenStore {
  constructor(root) {
    this.path = resolve(root, "results", "seen.json");
    this.ids = new Set();
    if (existsSync(this.path)) {
      try {
        this.ids = new Set(JSON.parse(readFileSync(this.path, "utf8")));
      } catch {
        this.ids = new Set();
      }
    }
  }

  has(id) {
    return this.ids.has(id);
  }

  add(id) {
    this.ids.add(id);
  }

  save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify([...this.ids], null, 2));
  }
}
