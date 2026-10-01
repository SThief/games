# Records every line the game can say with Kokoro (local, from ~/Project/voice-lab), so the
# child hears a real voice instead of the device's robotic one.
# Lines are built from garden.json with the same rules as game.js (see fill() there).
# voice/manifest.json maps a key to its clip: the exact text for the narrator, and
# "<voice>|<text>" for an animal's own sound, said in that animal's voice.
# Existing clips are kept; clips no line uses any more are deleted.
# Run:  ~/Project/voice-lab/.venv/bin/python tools/make_voice.py
import hashlib, json, os, re, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "voice")
LAB = os.path.expanduser("~/Project/voice-lab/models")

def fill(t, w, a=None):
    one, many = w.get("one", ""), w.get("many", "")
    t = t.replace("{animal}", a["one"]) if a else t
    return (t.replace("{One}", one[:1].upper() + one[1:]).replace("{Many}", many[:1].upper() + many[1:])
             .replace("{one}", one).replace("{many}", many))

data = json.load(open(os.path.join(ROOT, "garden.json")))
L, NARR = data["lines"], data["narrator"]
plants, visitors = data["plants"], [a for a in data["animals"] if a.get("visitor")]
as_list = lambda v: v if isinstance(v, list) else [v]

# Which words a template is filled with: {animal} means every visitor, {one}/{many} every plant,
# and "word" (a name said on tap) names the animals too.
texts = []
for key, val in L.items():
    for t in as_list(val):
        has_plant = any(x in t for x in ("{one}", "{many}", "{One}", "{Many}"))
        if "{animal}" in t and has_plant:
            texts += [fill(t, p, a) for a in visitors for p in plants]
        elif "{animal}" in t:
            texts += [fill(t, {}, a) for a in visitors]
        elif has_plant:
            texts += [fill(t, w) for w in (plants + data["animals"] if key == "word" else plants)]
        else:
            texts.append(t)

jobs = {t: (t, NARR["voice"], NARR["speed"]) for t in texts}   # key -> (text, voice, speed)
# each visitor's own sound, in its own voice
for a in visitors:
    jobs[f"{a['voice']}|{a['sound']}"] = (a["sound"], a["voice"], a.get("speed", 0.9))

def filename(key):
    slug = re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-")[:44]
    return f"{slug}-{hashlib.md5(key.encode()).hexdigest()[:6]}.mp3"

os.makedirs(OUT, exist_ok=True)
manifest = {k: filename(k) for k in jobs}
todo = [k for k in jobs if not os.path.exists(os.path.join(OUT, manifest[k]))]
k = Kokoro(f"{LAB}/kokoro-v1.0.onnx", f"{LAB}/voices-v1.0.bin") if todo else None
# a voice may be a mix of Kokoro voices, written "af_heart+af_bella"
style = lambda v: np.mean([k.get_voice_style(x) for x in v.split("+")], axis=0) if "+" in v else v
for i, key in enumerate(todo, 1):
    text, voice, speed = jobs[key]
    audio, sr = k.create(text, voice=style(voice), speed=speed, lang="en-us")
    a = np.asarray(audio, dtype=np.float32)
    loud = np.nonzero(np.abs(a) > 2e-3)[0]
    if len(loud):
        a = a[max(0, loud[0] - int(.04 * sr)): loud[-1] + int(.12 * sr)]
    a = np.clip(a * (10 ** (-19 / 20) / (np.sqrt(np.mean(a ** 2)) + 1e-9)), -.98, .98)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        sf.write(t.name, a, sr)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", t.name, "-ac", "1", "-ar", "24000", "-b:a", "40k",
                    os.path.join(OUT, manifest[key])], check=True)
    os.unlink(t.name)
    print(f"{i}/{len(todo)} {voice}: {text}", flush=True)

keep = set(manifest.values())
for f in os.listdir(OUT):
    if f.endswith(".mp3") and f not in keep:
        os.remove(os.path.join(OUT, f))
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=0, ensure_ascii=False)
print(f"done: {len(manifest)} clips, {len(todo)} new")
