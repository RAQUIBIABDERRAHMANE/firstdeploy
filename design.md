# FirstDeploy AI Code Editor — Design Specification

> A premium, browser-based AI-native IDE built from scratch.
> Inspired by Cursor, Linear, and VS Code. Dark-mode first. Desktop-class UX.

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography](#3-typography)
4. [Layout & Panel Structure](#4-layout--panel-structure)
5. [Component Behaviour](#5-component-behaviour)
6. [Animations & Micro-interactions](#6-animations--micro-interactions)
7. [AI Chat Panel (Right Side — Always)](#7-ai-chat-panel-right-side--always)
8. [Keyboard Shortcuts](#8-keyboard-shortcuts)
9. [Technical Architecture](#9-technical-architecture)

---

## 1. Design Philosophy

| Principle | Description |
|:---|:---|
| **Dark-first** | Single dark theme only. No light mode toggling. |
| **Glass depth** | Panels use layered translucency to create spatial hierarchy. |
| **Purposeful motion** | Every animation has functional meaning — no decorative noise. |
| **Minimal chrome** | Max screen space goes to content, not toolbars. |
| **AI-native** | The AI Chat panel is a permanent, always-visible fixture on the right side. |

---

## 2. Color System

All colors use a Zinc/Violet dark palette with thin glass-border separators.

### 2.1 Background Layers (darkest → lightest)

| Layer | Token | Value | Usage |
|:---|:---|:---|:---|
| **Canvas** | `--bg-root` | `#09090B` | Full-screen workspace base |
| **Panel** | `--bg-panel` | `#111113` | Sidebar, terminal, AI drawer |
| **Card** | `--bg-card` | `#17171B` | Context menus, modals, active tabs |
| **Hover** | `--bg-hover` | `rgba(255,255,255,0.04)` | Hover state for list rows |
| **Border** | `--border` | `rgba(255,255,255,0.06)` | All panel separators |

### 2.2 Brand & Accent

| Role | Value | Used For |
|:---|:---|:---|
| **Primary** | `#7C3AED` | Brand identity, loading ring |
| **Accent** | `#8B5CF6` | Active tabs underline, focus rings, AI bubbles |
| **Accent Dim** | `rgba(139,92,246,0.15)` | Selected rows, ghost highlights |

### 2.3 Semantic Colors

| Role | Value | Used For |
|:---|:---|:---|
| **Success** | `#10B981` | Untracked/staged git files |
| **Warning** | `#F59E0B` | Modified files, lint warnings |
| **Danger** | `#EF4444` | Deleted files, errors, close actions |
| **Info** | `#3B82F6` | Terminal output, informational badges |

### 2.4 Text Scale

| Role | Value | Usage |
|:---|:---|:---|
| **Primary** | `#FFFFFF` | Headings, file names, code |
| **Secondary** | `#A1A1AA` | Labels, paths, placeholders |
| **Muted** | `#52525B` | Collapsed state captions |

---

## 3. Typography

| Element | Font | Size | Weight |
|:---|:---|:---|:---|
| UI Labels | `Inter` (system sans fallback) | 11–13px | 400–600 |
| Code Editor | `JetBrains Mono`, `Fira Code` | 13–14px | 400 |
| Headings | `Inter` | 13–16px | 700 |
| Terminal | `JetBrains Mono` | 12–13px | 400 |

- Line height for UI labels: `1.4`
- Letter spacing for headings: `0.02em`
- All monospace elements use `font-feature-settings: "liga" 1` for ligatures.

---

## 4. Layout & Panel Structure

The editor uses a **five-region desktop layout** that fills the entire browser viewport with no scrollbars.

```
┌─────────────────────────────────────────────────────────────────┐
│                        TOP BAR (36px)                           │
│  [Folder]  [Branch]      [🔍 Search…]       [Model] [⚙] [🔔]  │
├────┬────────────┬────────────────────────────┬──────────────────┤
│    │            │                            │                  │
│  A │  SIDEBAR   │     MONACO EDITOR          │   AI CHAT PANEL  │
│  C │  (resizable│     (Tabs + Breadcrumbs)   │   (always right) │
│  T │   200–400px│                            │   250–500px      │
│  I │            ├────────────────────────────│                  │
│  V │            │  BOTTOM PANEL (resizable)  │                  │
│  I │            │  Terminal / Problems / Logs│                  │
│  T │            │  180–500px                 │                  │
│  Y │            │                            │                  │
├────┴────────────┴────────────────────────────┴──────────────────┤
│                      STATUS BAR (22px)                          │
│  [Ln/Col]  [Language]  [Encoding]  [EOL]  [🔌 Connected]       │
└─────────────────────────────────────────────────────────────────┘
```

### 4.1 Panel Widths & Heights (Defaults)

| Panel | Default Size | Min | Max | Direction |
|:---|:---:|:---:|:---:|:---:|
| Left Sidebar | `260px` | `200px` | `400px` | Horizontal |
| Bottom Panel | `240px` | `180px` | `500px` | Vertical |
| AI Chat Panel | `340px` | `250px` | `500px` | Horizontal |

> **Note:** All panels are resizable via drag handles. Double-click the handle to snap-collapse or snap-open.

---

## 5. Component Behaviour

### 5.1 Top Bar
- **Left**: App icon + workspace folder name (basename only).
- **Center**: Search / Command Palette trigger — rounded pill, `Ctrl+Shift+P`.
- **Right**: Active AI model badge → Settings button → Notification bell.
- **Git Branch pill**: Live branch name next to the workspace name. Clickable.
- Height: fixed `36px`. Never scrolls or reflows.

### 5.2 Activity Bar (Leftmost Column)
- Vertical strip of icon buttons — `48px` wide.
- Icons: `Explorer`, `Search`, `Git`, `AI Assistant`, `Settings`.
- Active state: sliding `layoutId` animated 2px violet left bar.
- Hover: `scale(1.05)` + tooltip label floats to the right.

### 5.3 Left Sidebar (Resizable Drawer)
Three mutually exclusive panel views based on the active Activity Bar tab:

| Tab | Panel Content |
|:---|:---|
| `explorer` | File tree with context menu (new file, rename, delete) |
| `search` | Full-text grep search across workspace |
| `git` | Git status (modified / staged / untracked), diff view |

### 5.4 Monaco Code Editor (Central Area)
- **File Tabs**: Scrollable horizontal tabs. Unsaved = pulsing violet dot `●`.
- **Breadcrumbs**: `src › features › editor › CodeEditor.tsx` — clickable segments.
- **Inline AI Toolbar**: Appears on text selection as a floating bubble above cursor. Actions: `Explain`, `Fix`, `Refactor`, `Comment`.
- **Monaco Theme**: Custom dark theme aligned to `--bg-panel` + accent colors. Minimap enabled. Bracket colorization on.

### 5.5 Bottom Panel (Resizable Drawer)
Tabs: `Terminal` | `Problems` | `Output`

| Tab | Behaviour |
|:---|:---|
| **Terminal** | Full interactive PTY via xterm.js + WebSocket. Supports multiple tabs. |
| **Problems** | Linting/compile diagnostics list. |
| **Output** | System/server log stream. Monospace, selectable text. |

- Close button (×) in the header collapses the drawer.
- Clicking any tab re-opens the drawer if collapsed.

### 5.6 Status Bar
Fixed bottom strip — `22px`. Contains:
- Cursor position: `Ln 42, Col 8`
- Active language mode: `TypeScript`
- File encoding: `UTF-8`
- EOL mode: `LF`
- Connection status pill: `🟢 Connected` / `🔴 Offline`

---

## 6. Animations & Micro-interactions

All animations use **Framer Motion** with spring physics unless noted.

| Element | Animation | Spring Config |
|:---|:---|:---|
| Panel open/close | Width/height slide | `damping: 25, stiffness: 200` |
| Panel drag resize | Raw pointer events | No spring — direct pixel update |
| Activity Bar tabs | `layoutId` sliding bar | `damping: 30, stiffness: 300` |
| File tab mount | Slide-in from right | `x: 10 → 0, opacity: 0 → 1` |
| Inline AI Toolbar | Float-up fade-in | `y: 10 → 0, opacity: 0 → 1` |
| Command Palette | Drop from top | `y: -20 → 0 + backdrop blur` |
| Context menus | Scale + fade | `scale: 0.95 → 1, opacity: 0 → 1` |
| Loading ring | CSS `animate-spin` | — |

---

## 7. AI Chat Panel (Right Side — Always)

> The AI Chat Panel is **permanently fixed to the right side** of the editor layout.
> It is never relocated, never swapped with left sidebar, and always visible when open.

### 7.1 Panel Position
```
[Activity] [Sidebar] [Editor + Terminal] [AI PANEL ← RIGHT SIDE]
```

- Rendered as the **last child** in the horizontal flex layout.
- Resize handle is on its **left edge** (resizing pulls left into the editor).
- Controlled by `isAiPanelOpen` in Zustand — toggled from the Activity Bar AI icon.

### 7.2 Chat Mode
- Input box at the bottom, conversation scroll above.
- User messages: right-aligned, violet bubble.
- AI responses: left-aligned, dark card with markdown rendering.
- Streaming tokens appear in real-time with an animated cursor `▍`.
- Stop generation button appears while streaming.

### 7.3 Agent Mode
When a task involves workspace actions, the AI switches to **Agent Mode**:
- A task timeline appears showing each step (read / write / search / command).
- Steps show statuses: `pending → running → completed / failed`.
- Each step shows output preview (truncated to 300 chars).
- Groq receives the outcome and decides the next action automatically (up to 6 loops).

### 7.4 Supported Agent Actions

| Action Tag | Description |
|:---|:---|
| `read_file` | Reads a file from the workspace |
| `write_file` | Creates or overwrites a file |
| `list_dir` | Lists files and directories |
| `delete_file` | Deletes a file or folder |
| `run_command` | Runs a shell command in the workspace folder |
| `search_project` | Full-text grep across the workspace |

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|:---|:---|
| `Ctrl+Shift+P` | Open Command Palette |
| `Ctrl+,` | Open Settings |
| `Ctrl+\`` | Toggle terminal |
| `Ctrl+B` | Toggle left sidebar |
| `Ctrl+Shift+E` | Focus file explorer |
| `Ctrl+Shift+F` | Focus search panel |
| `Ctrl+Shift+G` | Focus git panel |
| `Ctrl+Shift+A` | Toggle AI Chat panel |

---

## 9. Technical Architecture

### 9.1 Frontend Stack

| Technology | Role |
|:---|:---|
| **Next.js 16 (App Router)** | Page routing, SSR/static output |
| **TypeScript** | Full type safety across all modules |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Panel animations and transitions |
| **Monaco Editor** | Core code editing surface |
| **xterm.js** | In-browser terminal emulator |
| **Zustand** | Global state (panels, tabs, chat, settings) |
| **React Query** | File system caching and polling |
| **Lucide Icons** | Icon set |

### 9.2 Backend Stack (`server.js`)

| Endpoint | Method | Description |
|:---|:---|:---|
| `/api/workspace/files` | `GET` | List directory contents |
| `/api/workspace/file` | `GET` | Read file content |
| `/api/workspace/file` | `POST` | Write / create file |
| `/api/workspace/file/delete` | `POST` | Delete file or folder |
| `/api/workspace/file/rename` | `POST` | Rename / move |
| `/api/workspace/file/copy-paste` | `POST` | Copy file or folder |
| `/api/workspace/command` | `POST` | Run shell command |
| `/api/workspace/search` | `GET` | Full-text search |
| `/api/workspace/git/status` | `GET` | Git status |
| `/api/ai/chat` | `POST` | Groq streaming completions (SSE) |
| `ws://…/api/terminal` | `WS` | PTY terminal session |
| `ws://…/api/watch` | `WS` | File system watcher |

### 9.3 State Management (`editorStore.ts`)

| State Slice | Contents |
|:---|:---|
| `workspacePath` | Active folder path from `?folder=` URL param |
| `openFiles` | List of currently open file tabs |
| `activeFile` | Currently focused file tab |
| `sidebarWidth` | Persisted left sidebar width |
| `bottomHeight` | Persisted terminal panel height |
| `aiPanelWidth` | Persisted AI panel width |
| `terminalTabs` | List of active terminal sessions |
| `chatMessages` | AI conversation history |
| `isAiGenerating` | Streaming state flag |
| `settings` | User preferences (model, API key, font, theme) |

### 9.4 AI Completions Pipeline

```
User Input
    │
    ▼
Frontend sends POST /api/ai/chat
    │  { messages[], model, apiKey }
    ▼
server.js → streams from Groq API
    │  https://api.groq.com/openai/v1/chat/completions
    ▼
SSE stream → parsed chunks → updateLastChatMessage()
    │
    ▼ (if action tags found in response)
Agent Loop: execute action → append result → re-call Groq
    │  (max 6 iterations)
    ▼
Final summary response displayed in chat
```

### 9.5 Deployment

```
docker compose up -d
```

- Container: `firstdeploy-editor`
- External port: `3100` → Internal: `3000`
- Environment: `GROQ_API_KEY`, `PORT`
- Access: `http://<HOST_IP>:3100/?folder=/absolute/path/to/project`
