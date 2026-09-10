# Optional mobile layout

The mobile dashboard runs on screens **800px wide or smaller**. It uses the existing map and datasets. Desktop styles and application code are unchanged.

- `mobile.css`: phone layout, colors, cards, touch controls and mobile restriction overrides.
- `mobile.js`: mobile header, incident search, gallery, navigation and detail interactions.

To remove the mobile version, delete these two lines from `index.html`:

```html
<link rel="stylesheet" href="mobile.css">
<script src="mobile.js" defer></script>
```

You can then delete `mobile.css` and `mobile.js`. The original desktop layout and original mobile restriction screen will return. No changes to `app.js`, `style.css`, or your datasets are needed.

To preview, serve this folder normally and open the site on a phone or use a browser's responsive viewport at 390px wide. The page scrolls vertically; the map supports touch pan/zoom and the gallery scrolls horizontally. “View all” exposes every incident and a search field. Incident and gallery cards open the existing detail viewer.
