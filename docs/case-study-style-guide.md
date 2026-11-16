# Portfolio case study style guide

Use this guide for Ellen Lo’s project documentation pages. It captures the shared decisions from Super Adventure Land and BUGSKILL. New pages should feel like parts of the same portfolio while letting each project’s work determine the story and media.

The main rule: style by the role of the content. A gameplay description should look the same whether it describes Mama Pengo, a frog puppet, or a hand gesture. Apply a change to every equivalent component, then check both pages.

## Page structure

1. Shared header: Ellen Lo, contact link, and a thin divider.
2. Project introduction: category label, title, concise premise, My Role, Focus, and useful project links.
3. Optional trailer or primary media when it adds context.
4. Chapters organized around contributions and design decisions, with supporting clips close to the explanation.
5. Background and credits where they help explain ownership or context.
6. Shared footer: More work, Back to top, and contact.

Use one H1. Main chapters use H2; mechanic and feature titles use H3. Keep a visible heading for each section, without redundant labels explaining that a gallery is a gallery. Put role and project history in their appropriate places rather than crowding the role field.

## Visual language

Black background, light text, soft lilac headings, generous breathing room, and a thin outer frame. Let media and typography carry the page. Avoid default card borders, heavy containers, unnecessary badges, and ornamental UI.

| Element | Treatment |
| --- | --- |
| Background | `#000` |
| Main narrative | `#fff`, with `#ddd` for the introductory lead |
| Main headings | `#eeeaff`, subtle static lilac glow |
| Subheadings | `#d6d0f3` |
| Chapter labels | `#b6a9dc` |
| Mechanic descriptions | `#ccc`, matching SAL’s belly slide description |
| Media captions | `#bbb` |
| Design and technical notes | `#aaa`, with lilac labels |
| Outer frame | 1px `#888` |
| Horizontal rules | Thin and low contrast |

Color follows the text’s role. Do not turn a mechanic description into a gray Dosis caption just because it sits beside a video. Match the reference component’s font, size, line height, and color together.

## Typography

Fonts are bundled in `assets/fonts/`. Reuse the shared definitions in `assets/css/project.css`.

| Content role | Font | Desktop size | Small screens | Line height |
| --- | --- | --- | --- | --- |
| Project title | Space Notorious Rounded | `clamp(42px, 5.5vw, 76px)` | Same fluid rule | 1.12 |
| Chapter title | Space Notorious Rounded | `clamp(42px, 4.6vw, 62px)` | Same fluid rule | 1.15 |
| Narrative subsection | Dosis Medium | 30px | Allow natural wrapping | 1.2 |
| Gameplay highlight title | Dosis Medium | 24px | 24px | 1.2 |
| Main narrative | DM Sans Regular | 18px | 18px | 1.65 |
| Introductory lead | DM Sans Regular | 22px | 20px | 1.55 |
| Gameplay highlight description | DM Sans Regular | 16px | 15px at 640px and below | 1.65 |
| Media caption | Dosis Regular | 17px | 16px where needed | 1.45 |
| Design or technical note body | DM Sans Regular | 14px | 14px | 1.6 |
| Note label | Dosis Regular, uppercase | 14px | 14px | 1.6 |

Highlight titles include “Belly slide attack,” “Break the ice to counter,” “Wave, then clap,” and all power-up names. They share one scale. Narrative subsection headings can be larger because they introduce a broader story.

Design Note and Under the Hood use the same note treatment: a small uppercase lilac label above small body text. Reuse `.damage-sidenote` rather than making a new two-column note layout.

## Layout and spacing

Maximum content width is 1240px. The desktop frame has a 12px outer margin and fluid horizontal padding from 20px to 72px. At 640px and below, use an 8px outer margin and 18px horizontal padding.

Use approximately 24–28px between related narrative blocks, 12px between a highlight title and description, and 18–24px before its media. Desktop columns generally have a 28–42px gap. Keep 32–42px between stacked highlights so each reads as its own unit.

Separate major chapters with the shared eight-spoke SVG star and faint horizontal rules. A section divider has 64px above it on desktop, 40px on small screens, then 30px or 24px to the next chapter. Do not substitute an emoji star.

Align paired media along their top edges even when descriptions have different lengths. Use layout alignment rather than hardcoded paragraph heights or extra line breaks. Headings should wrap naturally. Decorative assets must not increase the title’s height or overlap text, links, or media.

## Responsive behavior

Breakpoints belong to the component, not a universal device category.

| Component | Wide layout | Narrow layout |
| --- | --- | --- |
| My Role and Focus | Two columns | Stack at 640px |
| Paired boss mechanics | Two columns | Stack at 640px |
| BUGSKILL power-up highlights | 2×2 grid | One per row at 700px and below |
| SAL feature gallery | Three columns, then two at 960px | One per row at 480px and below |
| Broad text and media splits | Two columns | Stack when the text becomes cramped; current pages use 640–800px depending on the component |
| Island selector | Five items with arrows | Three above, two centered below at 700px; keep arrows within each row |

Keep the island video and its selector together, followed by a clear gap before the next narrative block. Wrapped choices need consistent icon boxes, title spacing, and adequate touch targets. Do not solve overflow by shrinking all text or adding horizontal page scrolling.

Use `minmax(0, 1fr)` for grid columns and preserve media width within the container. Test at 375, 480, 640 or 664, 825, and 1280px, plus the exact breakpoint when changing a layout.

## Video and image presentation

Use real project media with a short explanation of what to notice. Give separate mechanics their own highlights. A grid can group related clips without compressing all of them into one desktop row.

Preserve the aspect ratio that shows the interaction clearly. Square power-up clips suit BUGSKILL; portrait gameplay suits SAL. Crop and position intentionally so hands, targets, expressions, and relevant UI remain visible. Avoid unnecessary white borders. Consistent aspect ratios are useful within a carousel or a set of related clips.

Trim at actual scene changes rather than approximate whole seconds. Include the setup, action, and visible result when the source allows it. Inspect the first and last frames so loops never flash into a different clip. Preserve source footage separately so trims remain reversible.

### Playback and loading

Reuse `assets/js/project.js`:

- Start inline loops muted, with `playsinline`.
- Use `data-autoplay` and `<source data-src="…">` for viewport-controlled loading; avoid an unconditional HTML `autoplay` attribute.
- Load video near the viewport, play when visible, and pause offscreen or when the tab is hidden.
- Respect a manual pause instead of restarting immediately.
- Supply a poster and reserve the media’s aspect ratio to prevent layout shifts.
- Use SVG play, pause, and sound controls, with accessible button labels and visible keyboard focus.
- Use `data-silent` for clips without sound and hide their sound controls.

Desktop hover can enable sound; touch screens need an explicit sound button. Keep only one clip audible at a time and fade audio in over about 500ms. Preserve sound intent while a hovered carousel changes clips. Verify real phone playback because desktop emulation cannot establish mobile audio performance.

Use compressed MP4 with fast-start metadata for loops. For external trailers, provide a meaningful iframe title and a direct watch link as a fallback.

## Popovers and carousels

Use a compact popover for optional context: character references, concept iterations, or a brief asset note. Keep essential narrative visible on the page.

Triggers use the shared dotted underline and support hover, focus, and tap through the shared script. Popovers must fit within the viewport, dismiss predictably, and stay usable on touch screens.

Concept exploration uses one image at a time, with a short caption, previous and next controls, and a position counter. Keep frames consistent, remove decorative white borders, and choose a crop that leaves the subject comfortably framed. Avoid oversized panels and unnecessary subtitles such as “why I moved on” when the captions already explain it.

## Writing voice

Use first person, plain language, and Ellen’s conversational tone. Explain the interaction concretely, then the design choice or implementation work when it matters. Keep feature copy short enough to scan beside a clip.

Good examples from the pages:

- “Make a finger gun and flex your thumb to shoot 👉”
- “Spray once to slow flies down, then again to kill them.”
- “A little help from a frog hand puppet 😝”
- “I thought this version was cute, but beside the baby Pengos, she didn’t look related to them.”

Emoji can add personality in prose when intentional. Omit the ending period for the short emoji-ended descriptions above. Controls and structural decorations use SVG, not emoji.

Make ownership clear: use “I” for Ellen’s contribution and “we” for team work. Credit existing assets and systems. Describe AI-assisted work through the actual design, iteration, rigging, animation, or integration decisions involved. Name tools when they clarify the process; avoid a long tool inventory in the main narrative.

Keep useful specifics such as blinking, eyeshadow deformation, feather movement, and item states when they demonstrate real work. Combine them into concise explanations rather than a troubleshooting diary. Do not invent results, metrics, shipped features, or responsibility.

Use approved names consistently across headings, body copy, selectors, captions, and accessible labels: for example, Sunny Meadows and Desert Ruins. Asset filenames can remain stable.

## Implementation and review

Shared components belong in `assets/css/project.css` and `assets/js/project.js`. Page-specific composition belongs in a page stylesheet such as `assets/css/bugskill.css`. Prefer one shared rule over accumulating later overrides; consolidate rules when changing their behavior.

When adjusting a style, identify every component with the same role on both pages. Check computed styles against the intended reference, not just the selector name. Version changed stylesheets when needed so browser caching does not hide an update. Reload the local preview and inspect the actual result.

Before calling a page ready:

- Compare titles, descriptions, captions, notes, and labels across both pages.
- Check wide, intermediate, and narrow layouts for overflow, awkward wrapping, cramped spacing, and overlaps.
- Confirm media framing, scene boundaries, lazy loading, manual controls, and offscreen pausing.
- Check keyboard access, accessible labels, and touch controls.
- Verify links and run JavaScript syntax and diff checks where relevant.
- Report any behavior that still needs a real phone check.

Keep preview, homepage linking, and publication separate. A request to build or revise a subpage does not by itself request adding it to the homepage or pushing it live.
