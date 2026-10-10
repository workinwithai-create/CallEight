# CallEight

Eight-bar call-and-response desk for bedroom producers and AI-music finishers.

Suno and loop DAWs leave a solid pocket that never talks to itself. After a few hours of ear fatigue the producer abandons the track because “it doesn’t go anywhere.” Session players seat a short call and an answering chair on the same changes so the eight bars converse instead of photocopying.

CallEight writes that conversation on the progression you already have. A is the thin pocket. B is the same pocket with a call and response. Loudness is matched so the A/B is about the parts.

Live samples only. FluidR3 piano, upright, nylon, trumpet, violin, and acoustic kit from the PreEight bank, pinned to commit SHA. No oscillators. Audio never leaves the tab.

This desk is free.

## Why this exists

Current X conversations (Oct 2026) still center on the same finishing stall: the initial spark dies under the effort of turning a loop into a song, and ear fatigue makes the static pocket unbearable. The fix is not another preset. It is a conversational line that gives the loop somewhere to go.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| StackEight | Density stack — add voices to the chord |
| PassTwo | Second-pass inner motion on the same parts |
| CoatEight | Drum coat so a melody has drums |
| ClaveEight | Woodblock clave so a straight loop has a pocket |
| SoloEight | Full eight-bar solo on one chair |
| **CallEight** | Eight bars of call-and-response so the loop talks |

Yesterday’s desks stacked density or added inner motion. CallEight does not write a new section, a solo, or more chord voices. It seats a conversation.

## Pricing recommendation

One-time **$19** if you productize it, on Lemon Squeezy, mirrored on Gumroad. Do not subscribe. Forge Pass stays the subscription for the cloud tools (AuraMix, MixForge, ReleaseForge). Sell where producers already buy one-shot utilities: Lemon Squeezy first, a Gumroad mirror, and one post on r/WeAreTheMusicMakers. Not the App Store. Not Plugin Boutique.

The shipped app is free (MIT). No license gate. A priced build would need a Lemon Squeezy key check before it can be called a paid ship.

## Samples

Pinned commit SHAs only.

* PreEight bank @d58301e4a494555f411a2afbc448b724136eee76

Branch tips are not allowed.

## Export

Default bounce is 48 kHz, 24-bit stereo. At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0. The offline render decodes the already-loaded ArrayBuffers. It does not re-download. MIDI writes one track per chair with tempo and 4/4 set.

Files: `calleight-<recipe>-<bpm>bpm-<key>.wav` and the matching `.mid`.

## Acceptance checks

1. Export at 92 BPM, 8 bars, 48 kHz: exactly 1,001,739 samples, first transient within 1 ms of sample 0.
2. Loop seam has no click or drift against a 92 BPM grid.
3. Background tab stops cleanly with no stacked notes.
4. Live recipe / mute / BPM change is heard within one bar.
5. Blocked sample host names the missing instruments.
6. Longest pad sustains to the end of the note.
7. Grep: no `@main`, no `@gh-pages`, no `Math.random` in the export path, voice names match samples.

## License

MIT. workinwithai-create.

## Demo

Short demo video shows A (thin) vs B (call-and-response) on the Copper Rail groove at 92 BPM.
