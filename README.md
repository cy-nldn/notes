# pdf notes studio

minimal terminal-style web app for organizing pdf notes.

## run locally

1. open a terminal in this folder.
2. start a static server:

```bash
python3 -m http.server 4173
```

3. open in browser:

```text
http://localhost:4173
```

## how to use

- click `+ upload` (or `pick`) or drag-drop pdf files into the drop zone.
- when uploading, enter optional `folder` and `tags`.
- use the search box (`> find`) to filter by title/folder/tag.
- click `grid/list` to switch layout.
- click folder/tag chips in the sidebar to filter.
- use `open`, `rename`, `drop` on each card.
- `◐` toggles dark/light mode.

## data storage

- metadata (title, tags, folder, dates, thumb data) is saved in `localStorage`.
- raw pdf files are saved in `IndexedDB`.
- data stays in your browser on this machine.
