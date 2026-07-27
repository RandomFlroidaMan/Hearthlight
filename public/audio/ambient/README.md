# Ambient loops

Drop background music/soundscape loops here. The story screen picks one per
scene automatically, based on what the DM engine tags the scene with, and
crossfades between tracks when the mood changes.

Filenames must exactly match a track key below, with any of these
extensions: `.mp3`, `.m4a`, `.mp4`, `.wav`, `.flac`, `.ogg`. If more than one
extension exists for the same key, the smaller/faster-loading format wins
(that order: mp3, m4a, mp4, wav, flac, ogg) — flac/lossless files can be
large, and a loop needs to start instantly. A missing key just plays silence,
nothing breaks.

| Filename       | Mood                                                            |
| -------------- | ---------------------------------------------------------------- |
| `forest.*`     | Calm, woodsy, a little whimsical. Default outdoor exploration.   |
| `cave.*`       | Low, hushed, echoey but cozy — not spooky.                       |
| `coast.*`      | Gentle waves, breezy, open and bright.                           |
| `night.*`      | Soft, quiet, sleepy — crickets/stars energy, still safe and warm.|
| `village.*`    | Warm, homey, a little bustling — friendly-town energy.           |
| `danger.*`     | **Exciting, not scary.** Upbeat chase-scene / action-cue energy — think Saturday-morning-cartoon adventure, never tense or ominous. Used for complications and climaxes (a silly monster encounter, a big finish) — this app is never actually frightening, so the music shouldn't be either. |

Loops should be seamless (no audible seam on repeat) since they'll loop for
as long as a scene is on screen — could be anywhere from a few seconds to a
couple of minutes.
