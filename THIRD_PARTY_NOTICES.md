# Third-party notices

## agency-agents (bundled roster)

`data/agents.json` is generated from the upstream
[agency-agents](https://github.com/msitarzewski/agency-agents) repository: the agent name,
description, `vibe`, colour/emoji and the verbatim Markdown body of 279 agent definitions, plus the
division taxonomy from its `divisions.json`.

- Upstream commit: `68f01534ef30805ed3764f2d302ad03fe443707a` (2026-09-28)
- Upstream license: MIT — Copyright (c) 2025 AgentLand Contributors

```
MIT License

Copyright (c) 2025 AgentLand Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The generated file keeps every agent body verbatim; only YAML frontmatter is parsed out and the
bodies are collected into one JSON document. Regenerate it with
`node build-roster.js /path/to/agency-agents`.

## Hermes agency-agents-router

The tool surface (`agency_agents_search` / `agency_agents_inspect` / `agency_agents_load`), the
ranking weights and the specialist-prompt preamble are ported from the Hermes
`agency-agents-router` plugin so that both hosts rank the roster identically. The Chinese keyword
bridge and the division aliases in `lib/roster.js` are additions of this port.

## PI-Desktop

This plugin runs inside [PI-Desktop](https://github.com/vastsa/PI-Desktop) and uses its plugin host
API. No PI-Desktop code is bundled here.
