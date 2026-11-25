import json, sys, shutil, os
proj, title, caption, tags = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
n = os.path.basename(proj)
dst = f"/mnt/project-files/horror-reels/{n}/"
os.makedirs(dst + "source/", exist_ok=True)
spec = json.load(open(f"{proj}/lines.json"))
qa = json.load(open(f"{proj}/out/qa_report.json"))
tl = json.load(open(f"{proj}/timeline.json"))
shutil.copy(f"{proj}/out/{n}.mp4", dst + f"{n}.mp4")
for f in ["qa_report.json", "qa_contact_sheet.png", "qa_safezone_sheet.png"]:
    if os.path.exists(f"{proj}/out/{f}"): shutil.copy(f"{proj}/out/{f}", dst + f)
for f in ["scene.mjs", "lines.json", "brief.json", "timeline.json"]: shutil.copy(f"{proj}/{f}", dst + "source/" + f)
v = qa.get("verdict") or qa.get("ship", {}).get("verdict")
md = [f"# {title}", "", f"Duration: {tl['duration_s']:.1f}s · QA verdict: **{v}** · Voice: Kalpa Aman (Hindi), temperature {spec.get('temperature')}", "",
      "## Voiceover (spoken Devanagari / on-screen Hinglish)", ""]
for i, l in enumerate(spec["lines"], 1):
    md += [f"{i}. {l['hl']}", f"   - {l['hi']}"]
md += ["", "## Instagram caption", "", caption, "", tags, ""]
open(dst + "script.md", "w").write("\n".join(md))
print(dst, v)
