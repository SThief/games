# Records every line the kid games can say, with Kokoro running locally (real voice, not the device's).
# Reads lines.json (written by dump_lines.mjs from each game's lines.js).
# A line is {key, say} for words, or {key, ipa: [..]} for isolated sounds ("buh"), said with a short gap.
# Existing clips are kept; clips no game uses any more are deleted. voice/report.json holds
# duration + brightness per clip so a broken sound shows up as a number, not just to the ear.
# Run:  ~/Project/voice-lab/.venv/bin/python _kid/make_voice.py
import hashlib, json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "voice")
LAB = os.path.expanduser("~/Project/voice-lab/models")
lines = json.load(open(os.path.join(ROOT, "lines.json")))

def filename(key):
    slug = re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-")[:40]
    return f"{slug}-{hashlib.md5(key.encode()).hexdigest()[:6]}.mp3"

def trim(a, sr):
    loud = np.nonzero(np.abs(a) > 2e-3)[0]
    return a[max(0, loud[0] - int(.04 * sr)): loud[-1] + int(.12 * sr)] if len(loud) else a

os.makedirs(OUT, exist_ok=True)
manifest = {l["key"]: filename(l["key"]) for l in lines}
rep_path = os.path.join(OUT, "report.json")
report = json.load(open(rep_path)) if os.path.exists(rep_path) else {}
only = set(sys.argv[1:])                      # optional: redo just these keys
todo = [l for l in lines if (l["key"] in only) or (not only and not os.path.exists(os.path.join(OUT, manifest[l["key"]])))]
k = Kokoro(f"{LAB}/kokoro-v1.0.onnx", f"{LAB}/voices-v1.0.bin") if todo else None
for i, l in enumerate(todo, 1):
    voice, speed = l.get("voice", "af_heart"), l.get("speed", 0.9)
    if "ipa" in l:
        parts = []
        for ph in l["ipa"]:
            a, sr = k.create(ph, voice=voice, speed=speed, lang="en-us", is_phonemes=True)
            parts += [trim(np.asarray(a, dtype=np.float32), sr), np.zeros(int(.28 * sr), dtype=np.float32)]
        a = np.concatenate(parts[:-1])
    else:
        a, sr = k.create(l["say"], voice=voice, speed=speed, lang="en-us")
        a = trim(np.asarray(a, dtype=np.float32), sr)
    a = np.clip(a * (10 ** (-19 / 20) / (np.sqrt(np.mean(a ** 2)) + 1e-9)), -.98, .98)
    spec = np.abs(np.fft.rfft(a)); freqs = np.fft.rfftfreq(len(a), 1 / sr)
    report[l["key"]] = {"sec": round(len(a) / sr, 2), "centroid_hz": int((spec * freqs).sum() / (spec.sum() + 1e-9))}
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as t:
        sf.write(t.name, a, sr)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", t.name, "-ac", "1", "-ar", "24000", "-b:a", "40k",
                    os.path.join(OUT, manifest[l["key"]])], check=True)
    os.unlink(t.name)
    print(f"{i}/{len(todo)} {l['key']}", flush=True)

keep = set(manifest.values())
for f in os.listdir(OUT):
    if f.endswith(".mp3") and f not in keep:
        os.remove(os.path.join(OUT, f))
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=0, ensure_ascii=False)
json.dump({k2: v for k2, v in report.items() if k2 in manifest}, open(rep_path, "w"), indent=0)
print(f"done: {len(manifest)} clips, {len(todo)} new")
