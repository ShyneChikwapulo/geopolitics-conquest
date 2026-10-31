# Logo

The game shows its logo from **`packages/web/public/brand/logo.svg`**. Replace that file with your own artwork
(keep the file name) and the splash screen, sign-in screen, menu and in-game header all update.

## Recommended artwork

| Property    | Recommendation                                                                  |
| ----------- | ------------------------------------------------------------------------------- |
| Format      | SVG (preferred). PNG or WebP also works, see below.                             |
| Shape       | Square, 1:1                                                                     |
| SVG size    | `viewBox="0 0 512 512"`, no fixed width/height needed                           |
| PNG size    | 1024 x 1024 px, transparent background (512 x 512 px is the minimum)            |
| Background  | Transparent. The round frame behind it comes from the design system.            |
| Safe area   | Keep the important shapes inside the central 80%: the frame trims the edges.    |
| Legibility  | It is shown as small as 30 px in the game header, so avoid hairline detail.     |
| Colour      | Works best in the ember `#ff5c35` / cream `#f2ede2` range on a dark background. |

Put only the **mark** in this file. The game name is drawn next to it as live text.

## Using a PNG instead of SVG

1. Copy the file here, for example `logo.png`.
2. Edit `packages/web/src/brand.ts` and change `LOGO_SRC` to `'/brand/logo.png'`.

## Frame around the logo

The logo sits in a round frame defined by three variables at the top of `src/styles/global.css`:
`--logo-frame-border`, `--logo-frame-bg` and `--logo-inset`. Set the first two to `transparent`
for a frameless logo, or reduce `--logo-inset` to let the artwork fill more of the circle.
