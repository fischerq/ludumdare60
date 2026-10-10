# Design docs

The design docs are the source of truth for what the game is. Claude reads them before building anything and
keeps them current; Quirin makes the creative calls.

## Hierarchy

```
design/
  master.md            the whole game on one page: pitch, pillars, core loop, scope, decision log
  systems/<name>.md    one doc per system or mechanic, once it has enough content to need one
  systems/_template.md copy this to start a new system doc
```

- `master.md` stays short. When a section grows past a few paragraphs, split it into `systems/<name>.md` and
  leave a one-line summary with a link in the master.
- A system doc never contradicts the master. If they disagree, the master wins until Quirin decides otherwise.
- Every system doc links its testing ground in the lab (`/lab/` on the site) when it has one.

## Status markers

Each section and each system doc carries one of:

- **decided**: Quirin agreed to it. Build to this.
- **proposed**: Claude's suggestion, not agreed yet. Don't build on it beyond a lab bench.
- **open**: not answered yet. Ask before filling the gap.

## How a feature gets built

1. **Questions first.** Claude reads the relevant docs and, before writing code, asks up to 8 questions whose
   answers would change how it's built, each with a suggested default. Then it stops and waits.
2. **Slice scope.** The answers become a short scope in the doc: exactly what to build, and exactly what not to
   build in this slice.
3. **Bench if unsure.** If the feel of a mechanic is the open question, build or extend a lab bench first and
   compare variants there before touching the game.
4. **Build, then log.** Implement the slice, update the doc's status, and add a line to the decision log.

## Decision log

Each doc ends with a decision log, newest last: `YYYY-MM-DD: what was decided, and why (who decided)`.
Changing a decided point means a new log line, not editing the old one.
