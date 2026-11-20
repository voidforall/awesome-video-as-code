---
name: decision-tree-diagrams
description: Create or update the hand-drawn Excalidraw decision trees that help README readers pick a tool within a section. Use when adding a decision tree to a README section, when entries in a section that already has a tree are added, removed, or re-described, or when asked to redraw, restyle, or translate a tree.
---

# Decision-tree diagrams

Each README section that lists tools can open with a decision tree. The tree walks the reader from their situation to the entries worth trying first. Trees are generated from JSON specs by `diagrams/render.mjs`. Read `diagrams/README.md` for the spec format and the render command. This skill covers what goes in a tree and how to ship it.

## Workflow

1. **Read the section first.** Read the section in `README.md` and in `README.zh-CN.md`. A tree may only point to entries that are listed in that section. If a branch needs a tool the list doesn't include, leave the branch out. Don't invent an entry.
2. **Write or update the spec** at `diagrams/specs/<section-id>.json`. Use a short lowercase id such as `frameworks`, `skills`, `mcp`, or `pipeline`.
3. **Render.** Run `cd diagrams && npm install && npm run render -- <section-id>`. If Playwright is already installed elsewhere, set `PLAYWRIGHT_MODULE` to its `index.mjs` and skip installing it again.
4. **Look at the result.** Screenshot all four SVGs in `assets/diagrams/` with Playwright: English and Chinese, light and dark. Check for overlapping labels, clipped text, and boxes that are too wide. Fix the spec and render again until the images are clean.
5. **Embed the tree** in both READMEs, directly under the section heading and above the list. Use the snippet below.
6. **Commit everything together:** the spec, all four SVGs, both `.excalidraw` scenes, and the README changes. Run `npx --yes awesome-lint` before you push.

## What makes a good tree

- **Ask about the reader's situation, not about the tools.** Good questions are "What is the video mostly made of?", "How will the agent write it?", and "Do you need a GUI?". Avoid feature checklists.
- **Keep it small.** Use at most three levels of questions and about ten leaves. A leaf may group two or three tools that suit the same situation.
- **Keep labels short.** Answers on arrows should be one or two short lines. Questions should be two lines at most; use `\n` to balance them.
- **Match the README's labels.** Set each leaf's `kind` (`code`, `hybrid`, or `pipeline`) to the label its entry has in the README.
- **Use notes only for decision-relevant caveats.** Examples: "check its license", "needs an API key", or "early builds". Don't restate the README description.
- **Write both languages.** The Chinese text should read naturally in Chinese, not as a word-for-word translation. Keep tool names in their original spelling.
- **Stay neutral.** A tree recommends where to start, not a single winner. Don't rank entries by stars.

## Embed snippet

In `README.md`, directly under the section heading:

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/diagrams/<id>.en.dark.svg">
    <img src="assets/diagrams/<id>.en.svg" width="100%" alt="Decision tree: <one sentence that names the questions and where each answer leads>">
  </picture>
</p>
```

In `README.zh-CN.md`, use `<id>.zh.svg` and `<id>.zh.dark.svg`, and write the alt text in Chinese.

The alt text must carry the whole decision for readers who can't see the image. State each question and what each answer leads to.

## Keeping trees current

When an entry is added to, removed from, or re-labelled in a section that has a tree, update that section's spec in the same change and render it again. A tree that points to a removed entry, or misses an obvious new one, is a bug.
