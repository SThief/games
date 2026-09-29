# Little Garden

A garden game for children aged 4–8: hear an English line, do it with a finger, and the garden grows.

## Add a word

1. Put a picture sheet in `art-src/`: a plant needs its five growth steps in one row; an animal needs one picture. Leave clear space between pictures.
2. Add one line for it to `garden.json`, next to the others.
3. Run both tools:

```bash
python3 tools/cut_art.py
~/Project/voice-lab/.venv/bin/python tools/make_voice.py
```

The first cuts the pictures, the second records every new line in the approved Kokoro voice. A line with no recording falls back to the device voice and warns in the console.
