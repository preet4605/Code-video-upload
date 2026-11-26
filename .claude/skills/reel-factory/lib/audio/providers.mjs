// Tier B (generated) adapter interface. NO paid API is wired in. A provider turns a cue into an audio file plus its licence:
//
//   resolveGenerated(cue) -> { file: <path relative to the project>, licence: { name, url?, credit?, proof? } }
//
// To add one (ElevenLabs Sound Effects, Lyria, ...): implement this function, cache the result by hash of (provider, prompt, params) like the VO,
// and make the returned licence record the plan/terms you actually bought. render_stems then copies it into audio/licences.json.
// Until a provider is chosen this throws, so a cue with source "generated" and no cached `file` fails loudly instead of rendering silence.
export function resolveGenerated(cue) {
  throw new Error(`no provider configured: cue "${cue?.id}" asks for generated audio but no tier-B provider is installed. Import the file yourself (source "library" + licence) or use a tier-A synth kind.`);
}
