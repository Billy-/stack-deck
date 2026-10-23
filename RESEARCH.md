# Game research and product decisions

Researched 23 October 2026.

## What is established

[Lucky Egg USA’s own product listing on Faire](https://www.faire.com/product/p_sz2d5n27a3) describes a category answer followed by stacking its initial letter. It advertises **160 categories**, **20 letter pieces**, a base and timer, with **Quick Stack** (45-second rounds) and **Stack Battle** (turn-based play).

The advertised category count should not be assumed to equal the number of physical cards: product photographs show more than one category printed on a card. The app does not claim to reproduce that deck.

The supplied video shows the **Asian countries** category remaining in place over successive letter placements until the stack falls. The supplied images show **Ways to say “goodbye”** and **Fruit & vegetables**. Brand product imagery also shows **Phone apps**.

[Lucky Egg’s official preview page](https://www.luckyegg.co/pages/stack-it-game-preview) was accessible but did not provide a complete written rulebook. The short TikTok link was not retrievable through web research; the supplied video and pictures were inspected locally instead.

## Boundaries of the evidence

The complete official rules on disputed answers, repeated answers, phrases, proper nouns, scoring, and elimination were not independently established. The companion therefore leaves those decisions to the physical rulebook and the players. It does not invent or present new rules as official.

No official adult expansion was verified. After dark in this project is an original optional companion pack.

## Design decisions

- **One category stays visible:** no automatic timer, scoring, or letter generation.
- **Manual advance and Back:** players decide when the current round has ended or when to skip a category.
- **Two-way table text:** a useful optional view for a centrally placed phone.
- **Fresh categories:** shuffle without replacement, with explicit reshuffling after the deck ends.
- **Difficulty filtering:** narrow geographical prompts can have fewer possible initial letters, so they can be excluded.
- **Static implementation:** the app’s core needs only local card data and browser state, making it suitable for GitHub Pages.

## Hosting sources

- [GitHub Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Screen wake lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)

No promotional images, uploaded video, or screenshots are included in the project distribution.
