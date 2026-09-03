# docs/ — the working record

Nothing in here is read by the code. It is the record of how the film was made:
what was measured, what was decided, and what was tried and abandoned. It is
kept because most of it is reasoning that would otherwise have to be
rediscovered, and several entries are the only surviving explanation of why a
number in the source is the number it is.

| file | what it is |
|---|---|
| `ANALYSIS-PLAN.md` | how the audio analysis pass was to be run |
| `PREANALYSIS.md` | the provisional pass, before the real one |
| `analysis.pre.json` | its frozen output, kept as the comparison the plan calls for |
| `ANALYSIS.md` | what the real pass found |
| `LYRICS-REALIGNMENT.md` | how the vocal cue times were corrected |
| `FEEDBACK.md` | every round of viewing notes and what was done about them |

Two things to know if you go looking.

`analysis.pre.json` moved in here with the two documents that reference it, so
those references still resolve. `LYRICS-REALIGNMENT.md` refers to `lyrics.json`,
which stayed at the repository root because the build reads it — that one path
is now one level up.

`FEEDBACK.md` is largely in Finnish from the middle onward: the later rounds
were conducted in Finnish and the log was written in the language the
conversation happened in. The measurements, file names and numbers in it are
language-independent, and the English portion covers the first half.
