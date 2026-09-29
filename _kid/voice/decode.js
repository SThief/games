async () => { const base = new URL('../_kid/voice/', location.href); const m = await (await fetch(new URL('manifest.json', base))).json();
 const ac = new (window.AudioContext || window.webkitAudioContext)(); const bad = []; let n = 0, tot = 0;
 for (const [k, f] of Object.entries(m)) { try { const buf = await ac.decodeAudioData(await (await fetch(new URL(f, base))).arrayBuffer()); n++; tot += buf.duration; if (buf.duration < .2 || buf.duration > 6) bad.push([k, buf.duration]); } catch (e) { bad.push([k, String(e)]); } }
 return JSON.stringify({ keys: Object.keys(m).length, decoded: n, minutes: +(tot / 60).toFixed(1), bad }); }
