# Atlas

Interactive map editor for tabletop RPGs. You upload a map image, click points of interest
onto it, write an area description and add characters to each one — and out falls a single
static `index.html` you can hang anywhere.

The finished map is plain HTML + CSS + JS with no dependencies. The images are packed into
the file, so it needs no assets and no server.

## Quick start

```bash
git clone https://github.com/hajduk-j/dnd-atlas-map-maker.git atlas
cd atlas
node build.mjs          # produces index.html
```

Open `index.html` in a browser. Node is only needed for the build — the repo has no npm
dependencies.

While working on the sources:

```bash
node build.mjs --watch
```

## Where your work is stored

The editor runs entirely in your browser. Nothing is uploaded anywhere, and this repository
or GitHub never sees your maps.

- Work in progress is remembered in the browser (IndexedDB). That is tied to **one browser
  on one computer** and disappears if you clear site data.
- **Back up your map yourself.** Use **Save project** (`.atlas.json`) or **Export site**
  (`index.html`) regularly, and use **Open project** to carry on later or on another computer.

Online version: https://hajduk-j.github.io/dnd-atlas-map-maker/ (the same editor, no
download needed).

## How a map is made

1. Drag a map image onto the editor surface (JPG, PNG, WEBP).
2. **Add point** → click the map. A point can be moved by dragging at any time.
3. On the right, fill in the **Area** tab (type, faction, pictures, short and long description).
   A place can have several pictures: the first leads, and on the finished map they become a
   small gallery in a frame shaped by that first one. Then the **Characters** tab (portrait,
   name, role, description; the arrows change the order).
4. **Map settings** → atlas name, subtitle, intro text, regions and their colors.
5. **Preview** shows what the finished map looks like.
6. **Export site** → downloads `index.html` with the whole map inside.
7. Later, **Open project** takes that same `index.html` back and you carry on where you left off.

### Regions

A region is a faction that can additionally carry territory. Both parts are optional — a
faction without official borders works exactly as before, it just colors the points.

In **Map settings**, press **Edit** next to a region; the right-hand panel then lets you:

- **draw an area** — by clicking vertices. Enter or a click on the first vertex closes the
  polygon, Backspace takes the last vertex back, Esc cancels the drawing. On the finished map
  the polygon is **invisible** by default — it is there only so that hovering shows the region's name in
  the corner. Tick **Show this area on the finished map** (in the panel, or **Show** in the region's
  row in Map settings) and it is drawn as a soft wash of the region's color inside a fine line of
  it, fading in with the places as the reader zooms in;
- **place a big pin** — the region's name lettered across the map in spaced capitals, with a
  faint glow in the region's color and no marker under it. Clicking it opens a panel with the
  region's description and image. Characters belong to places, so a region has none. Without
  a big pin the region is not drawn on the map and its description is not shown.

You can also select a region by clicking inside its area directly in the editor.

### The border

A map image that is just an image ends like a photograph. **Map settings → Engrave a border
onto the map** draws one onto the sheet: two ruled lines with a tinted margin between them,
a lozenge at every corner and in the middle of each side, and a soft darkening towards the
edges. It is drawn in map coordinates, so it is part of the map and zooms with it, and it
moves no point. Turn it off for a map image that already carries a painted border of its own.

### Title artwork

**Map settings → Title artwork** takes a picture of the atlas's name — a lettered logo, best
as a PNG with a transparent background, which keeps its transparency. It hangs in the open
space above the map and never over it: it is sized to that space, shows while there is clear
air for it, and fades as moving in pushes it up under the header. Where the whole map leaves
no room above it — a wide map on a wide monitor — the atlas opens pulled back instead, so the
title is the first thing a reader sees. On a screen with no room even then (a phone held
sideways), it is left out. The editor itself does not draw it; the preview does.

### Boundary lines

**Map settings → Boundary lines** draws lines over the map: a border, a road, a river. Press
**Add boundary line** (or **Add line** next to an existing one) and click along the line; Enter,
or a click on the last point, finishes it, Backspace takes the last point back, Esc cancels. One
boundary can be drawn as several separate lines, for a border that forks or breaks off: press
**Add line** again, and **Clear** starts the boundary over. Each boundary has a color (white by
default) and a style: solid, dashed or dotted. A boundary with a name is listed once in the legend
of the finished map with a sample of its own style, however many lines it is drawn as, and two
boundaries with the same name are one entry; leave the name empty to keep it out of the legend.
Regions do not react to the pointer while a line is being drawn. In the finished map the lines
lie over the regions and under the places, and never take a click.

### The overview

Pulled all the way back, the finished map shows drifting clouds and the title artwork, and the
places and region names are not drawn. As the reader zooms in, the clouds and the title leave and
they fade in at the same moment, so the screen is never both at once. A hint at the foot of the
map says **Zoom in to reveal places** while they are out.

### Sessions

An atlas can be read at several moments of the campaign. **Map settings → Sessions** starts a
timeline. The map itself never changes between sessions: points stay where they are. Sessions
only decide what the side panel shows.

- **Recap.** Write what happened under each session. As soon as one session has a recap, the
  panel on the right of the finished map gets a switch at its top, **Session recap** or
  **Place**. The map opens on the recap of the session being read, and clicking a point flips
  the panel to that place. On a phone the header gets a **Session recap** button that opens the
  same panel.
- **Held back until a session.** On a point you can choose from which session its description,
  its pictures and each of its characters appear. Before that session the panel shows nothing
  for them (“Nothing has been written about this place yet.”). Use this to let a place fill up
  as the campaign goes on. A point that should not be on the map at all stays a matter for
  **Hide from players**, which applies to the whole atlas.

At the top of the panel in the finished map a small switch walks between sessions. The reader
lands in the last one, the world as it stands, and can go back. Everything is in the file, so
this is a way to pace the reading, not a secret: anyone who opens the file's source can read
what is held back. With fewer than two sessions there is no switch and nothing is held back.

### Getting back to a map

**Save project** downloads an `.atlas.json` with all the content. That is your source file —
keep it. The editor also remembers work in progress in the browser (IndexedDB), but that is
tied to one browser on one computer.

**Open project** takes either of those files: an `.atlas.json`, or an `index.html` the export
produced. The exported map carries the whole project inside it, so it is a working copy as
well as a finished page — open it, change a point, export again.

That cuts both ways: hidden points ride along in the file, and anyone who downloads the page
can read them out of it. If something must stay off the players' table, keep it out of the
project rather than only out of sight.

## Deploying to GitHub Pages

The repo holds two different things and both can be hosted:

- **the editor** — `index.html` in the root, that is this application;
- **your map** — the file that falls out of the export.

Recommended layout: the editor stays in the root, the exported map goes to `map/index.html`.
The editor then runs at `https://<user>.github.io/<repo>/`
and the map at `https://<user>.github.io/<repo>/map/`.

In the repo settings: **Settings → Pages → Source: GitHub Actions**. The workflow in
`.github/workflows/pages.yml` deploys the repo contents after every push to `main`.

## Structure

```
build.mjs         assembles src/ into index.html, no dependencies
index.html        build output (committed so that Pages works without a build)
src/
  shell.html      the editor page skeleton, __CSS__ and __JS__ markers
  editor.css      editor styles
  editor.js       editor logic, __VIEWER__ marker
  viewer.html     the finished-site template — an ordinary HTML file with markers
```

`src/viewer.html` is embedded into `editor.js` as a string at build time. The editor replaces
the markers `__TITLE__`, `__SUBTITLE__`, `__ICONS__`, `__TYPES__` and `__DATA__` in it during
the export.

`__DATA__` is the whole project, and it lands in a `<script type="application/json"
id="atlas-project">` block — that block is what **Open project** reads back out of a finished
map. The viewer narrows the project down to what the page may show (`published()` in
`viewer.html`): hidden points are dropped, and a region without a big pin keeps only its
outline. So the filtering lives in the viewer, not in the export, and the file never carries
the same image twice.

## Data model

One project is one JSON object:

```jsonc
{
  "v": 1,
  "title": "The Confluence",
  "subtitle": "winter 1247",
  "tabTitle": "The Confluence campaign",  // optional: browser tab and link-preview title; defaults to `title`
  "intro": "Optional intro text.",
  "map": { "src": "data:image/jpeg;base64,…", "w": 2600, "h": 1700 },
  "frame": true,                  // engrave a border onto the sheet; absent counts as true
  "boundaries": [{                // optional lines drawn over the map
    "id": "k1", "label": "The old border",   // empty label: not in the legend
    "color": "#ffffff", "style": "dashed",   // style: "solid" | "dashed" | "dotted"
    "paths": [[[0.2,0.3],[0.35,0.4],[0.5,0.38]], [[0.5,0.38],[0.6,0.2]]]  // lines, each of at least two relative points
  }],
  "background": "magic",          // "magic" (default), "snow" or "mist"
  "titleImage": "data:image/webp;base64,…", // optional title artwork above the map
  "sessions": [                   // optional timeline, in chronological order
    { "id": "s1", "label": "Session 1 · The road north", "recap": "What happened, optional." },
    { "id": "s2", "label": "Session 2 · Winter camp" }
  ],
  "factions": [{                  // a faction; with `area` or `anchor` it is a region
    "id": "a1b2c3",
    "label": "The Borderlands",
    "color": "#3b6ea5",
    "area": [[0.11,0.2],[0.44,0.17],[0.4,0.52]],   // optional polygon, relative coordinates
    "areaVisible": true,                           // optional: draw the polygon on the finished map
    "anchor": { "x": 0.28, "y": 0.31 },            // optional big pin
    "summary": "A wild strip between the rivers.", // the big pin's panel
    "description": "Paragraphs are separated by a blank line.",
    "image": "data:image/jpeg;base64,…",
    "characters": []                               // unused: regions carry no characters
  }],
  "pois": [{
    "id": "d4e5f6",
    "name": "Mierheim",
    "type": "city",               // city village fortress port mountains forest ruin place person
    "factionId": "a1b2c3",
    "x": 0.42, "y": 0.67,         // relative to the map size, not pixels
    "at": {                       // optional: where it stands from a given session onwards
      "s2": { "x": 0.5, "y": 0.6 }
    },
    "hidden": false,              // kept out of the finished map, but still inside the file
    "summary": "The town at the world's door.",
    "description": "Paragraphs are separated by a blank line.",
    "images": ["data:image/jpeg;base64,…"], // any number; the first leads (older projects: "image")
    "descFrom": "s2",             // optional: summary and description appear from this session on
    "imagesFrom": "s2",           // optional: the pictures appear from this session on
    "characters": [{
      "id": "g7h8i9",
      "name": "Suzuki",
      "role": "leader of the Confluence",
      "description": "…",
      "image": "data:image/jpeg;base64,…",
      "from": "s2"                // optional: the character appears from this session on
    }]
  }]
}
```

The coordinates are relative, so swapping the base map for one of a different size does not
throw the points off.

A session id in `descFrom`, `imagesFrom` or a character's `from` means “shown from that session
on”; empty or missing means always, and an id that matches no session is treated the same way.
Points have no per-session position: `x`/`y` is where a point stands in every session. A project
saved by an earlier version with moves in `at` keeps `x`/`y` and drops the moves.

Projects saved before the interface switched to English carry Slovak `type` keys
(`mesto`, `dedina`, `pevnost`, `pristav`, `hory`, `les`, `ruina`, `miesto`). They are
translated when the project is loaded, so those points keep their icons.

## File sizes

Images are resampled on upload: the map to 2600 px on the longer side, area images to 1400,
portraits to 700. The export shows the resulting size up front. Above ~12 MB loading starts to
be noticeable on mobile — at that point simply use smaller images.

## License

MIT.
