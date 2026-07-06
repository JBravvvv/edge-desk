"""Regenerate app.jsx (the home-screen build) from the canonical edge-desk.jsx.

The only differences are the three no-build transforms:
  1. the ES `import React …` line -> React read from the global (vendor script)
  2. drop `export default` so it's a plain in-page component
  3. append an explicit ReactDOM mount

Run:  python3 edge-desk-app/build.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "edge-desk.jsx"
OUT = ROOT / "edge-desk-app" / "app.jsx"

IMPORT_LINE = 'import React, { useState, useEffect, useCallback, useRef } from "react";'
HEADER = (
    "/* Auto-generated from edge-desk.jsx by build.py — do not edit directly.\n"
    "   React is loaded as a global (vendor/react*.js) and the component is\n"
    "   mounted explicitly at the bottom of this file. Otherwise identical. */\n"
    "const { useState, useEffect, useCallback, useRef } = React;"
)
MOUNT = (
    '\n\n/* Mount the app (React 18). */\n'
    'ReactDOM.createRoot(document.getElementById("root")).render(<EdgeDesk />);\n'
)

src = SRC.read_text()
if IMPORT_LINE not in src:
    raise SystemExit("Could not find the React import line in edge-desk.jsx")
src = src.replace(IMPORT_LINE, HEADER, 1)
src = src.replace("export default function EdgeDesk() {", "function EdgeDesk() {", 1)
OUT.write_text(src.rstrip() + MOUNT)
print(f"Wrote {OUT.relative_to(ROOT)} ({len(src.splitlines())} lines) from edge-desk.jsx")
