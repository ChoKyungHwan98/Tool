# Third-party notices

## MiniMax OpenRoom and frontend-dev Skill (design references)

- OpenRoom source: https://github.com/MiniMax-AI/OpenRoom
- OpenRoom reviewed commit: `02468154c4d99f8925916425bf444d672454fb3d`
- frontend-dev Skill source: https://github.com/MiniMax-AI/skills/blob/main/skills/frontend-dev/SKILL.md
- skills reviewed commit: `60aaae52bb2af8162732751a4332f62a5fef518b`
- Both repositories are published under the MIT License by MiniMax.
- No OpenRoom component, SCSS module, image, or application asset is copied. Public design rules were independently implemented in `ui/src/devtoys-shell.css`, `ui/src/App.tsx`, and `ui/src/toolCatalog.ts`.
- Decision record: `docs/MINIMAX_UI_REFERENCE_KO.md`

## Prombot / NAI Prompt Randomizer (behavior reference)

- Source: https://github.com/JioChoi/NAI-Prompt-Randomizer
- Reviewed commit: `9c15bd0f2e779908387b1adf427771bc837efd7b`
- Reviewed files: `README.md`, `index.html`, `js/script.js`, `js/worker.js`, `index.js`
- Upstream README declares MIT; `package.json` declares ISC; the repository has no root license text.
- To avoid that metadata conflict, no upstream source file, dataset, image, or style asset is copied into this product. The preset/history boundary and prompt-composition behavior were independently reimplemented in TypeScript and C++.
- Local implementation: `ui/src/promptLibrary.ts`, `ui/src/PromptLibraryTool.tsx`, `native/PromptLibraryStore.cpp`

## DevToys Windows UI

- Source: https://github.com/DevToys-app/DevToys
- Reviewed commit: `7e12df8448aa1f6aec4a8736b3e06a1c90530715`
- Source-derived files:
  - `src/app/dev/DevToys.Blazor/Assets/sass/theme/windows/dark.scss`
  - `src/app/dev/DevToys.Blazor/Components/Menu/NavBar/NavBar.razor.scss`
  - `src/app/dev/DevToys.Blazor/Components/Menu/NavBar/NavBarItem.razor.scss`
  - `src/app/dev/DevToys.Blazor/Components/Collections/GridView/GridView.razor.scss`
  - `src/app/dev/DevToys.Blazor/Pages/SubPages/ToolGroup.razor.scss`
  - `src/app/dev/DevToys.Blazor/wwwroot/img/hero/dark-theme-tile.png`
- Local derivative: `ui/src/devtoys-shell.css`
- Local copied asset: `ui/public/assets/devtoys-dark-theme-tile.png`

MIT License

Copyright (c) 2021

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

## Nimbalyst desktop UI (inactive comparison file)

- Source: https://github.com/nimbalyst/nimbalyst
- Reviewed commit: `2e6237c8e8114eda32129f75df1b2a6b8aaf754c`
- Ported sources:
  - `packages/runtime/src/themes/builtin/dark/theme.json`
  - `packages/electron/src/renderer/components/ProjectRail.css`
  - `packages/electron/src/renderer/components/NavigationGutter/NavigationGutter.tsx`
  - `packages/electron/src/renderer/components/TabManager/TabBar.tsx`
  - `packages/electron/src/renderer/components/WindowTopBar/WindowTopBar.tsx`
- Local derivative: `ui/src/nimbalyst-shell.css`

MIT License

Copyright (c) 2024-2026 Nimbalyst Inc.

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
