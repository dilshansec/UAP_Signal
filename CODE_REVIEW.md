# Code review and fixes

Reviewed the active desktop/mobile application, entry controller, HTML wiring, CSS, and editable datasets. Also checked standalone JavaScript files and inline scripts in the top-level HTML files for syntax errors.

## Fixed

- Browser autofill could paint the desktop password field pale blue/white. Added dark autofill background and text rules, dark input color scheme, and a flex-width safeguard in `entry.css`.
- Desktop incident cards used SVG coordinates as CSS pixels. Converted coordinates through the SVG screen matrix, including responsive scaling and letterboxing, before positioning the card.
- Popup positions could extend beyond the left/right map edges. Added horizontal clamping.
- Invalid or infinite coordinates could enter the map projection. Added finite-value and latitude/longitude range checks.
- Numeric incident names, dates, locations, types, and descriptions could break string operations and searching. Normalize them to strings.
- Detail handlers could access missing modal elements before checking for them. Added guards in desktop and mobile handlers.

## Verification

- Nine standalone/inline JavaScript syntax checks passed.
- Twenty tooltip edge-position cases passed.
- Malformed incident field and coordinate checks passed.
- Existing incident records remain present after validation.
- No missing local image paths in the active incident/gallery datasets.
- No missing local assets referenced by `index.html` and no duplicate HTML IDs.

## Remaining limitations

- No live browser or phone visual verification was available. Check autofilled password appearance, desktop popup positioning, mobile gestures, and loading-screen dismissal on actual devices.
- D3, TopoJSON, map geography, and fonts use external services. Offline use is not supported by the current setup.
- The desktop sign-in is a cinematic intro, not real authentication.
- Dataset values are inserted into HTML in several existing renderers. These are currently local, developer-edited files; accepting external/user-submitted datasets would require escaping/sanitizing them first.
- Legacy HTML pages are separate copies. Changes apply to the active `index.html` application, not those copies.

These checks do not establish that every possible runtime or browser-specific issue is resolved.
