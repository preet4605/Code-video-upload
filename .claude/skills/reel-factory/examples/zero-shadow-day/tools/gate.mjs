import { runScriptGate } from '../../../scripts/script_gate.mjs';
const r = runScriptGate(process.argv[2], 'script');
console.log(JSON.stringify({ pass: r.pass, fails: r.fails, warns: r.warns }, null, 1));
