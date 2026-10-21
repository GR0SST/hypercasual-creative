// Agent-side Unity project explorer + converter. Read-only on the Unity
// project; no Unity install needed (Blender is used for FBX -> GLB).
//
//   bun unity.mjs scan   <UnityProject>                 overview: product, icon, fonts, candidates
//   bun unity.mjs find   <UnityProject> <words…>         search prefabs/models/materials/textures/fonts/audio
//   bun unity.mjs deps   <UnityProject> <asset> [--json] what a prefab uses: hierarchy, meshes, materials, colors, textures, animations
//   bun unity.mjs export <UnityProject> <asset> --out <dir>   GLB(s) + textures + <name>.unity.json manifest
//
// <asset> = path relative to the project (Assets/…/Player.prefab or …/hero.fbx).
// The GUID index is cached in ~/.cache/hypercasual-creative/unity/.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';

const [cmd, projArg, ...rest] = process.argv.slice(2);
if (!cmd || !projArg) {
  console.error('usage: bun unity.mjs <scan|find|deps|export> <UnityProject> [args]');
  process.exit(1);
}
const PROJ = resolve(projArg);
if (!existsSync(join(PROJ, 'Assets'))) throw new Error(`${PROJ} has no Assets/ folder`);
const flag = (name) => {
  const i = rest.indexOf(name);
  return i < 0 ? undefined : (rest[i + 1] ?? true);
};
const positional = rest.map((a) => a.replace(/\\/g, '/')).filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--json'));

const KIND = {
  '.prefab': 'prefab', '.fbx': 'model', '.obj': 'model', '.blend': 'model', '.dae': 'model', '.gltf': 'model', '.glb': 'model',
  '.mat': 'material', '.png': 'texture', '.jpg': 'texture', '.jpeg': 'texture', '.tga': 'texture', '.psd': 'texture', '.tif': 'texture', '.exr': 'texture',
  '.ttf': 'font', '.otf': 'font', '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.unity': 'scene', '.anim': 'animation', '.controller': 'animator',
  '.shader': 'shader', '.asset': 'asset', '.cs': 'script',
};
// Third-party noise: kept in the index, ranked down in summaries.
const VENDOR = /\/(Plugins|ExternalAssets|AssetKits|TextMesh Pro|JMO Assets|[^/]*SDK[^/]*|[^/]*Sdk[^/]*|Demigiant|Demos?|Examples?|DebugConsole|Firebase|GoogleMobileAds|MaxSdk|AppLovin|Editor)\//;

// ---------- GUID index ----------
function buildIndex() {
  const key = createHash('md5').update(PROJ).digest('hex').slice(0, 12);
  const cacheDir = join(homedir(), '.cache', 'hypercasual-creative', 'unity');
  const cache = join(cacheDir, `${key}.json`);
  const stamp = statSync(join(PROJ, 'Assets')).mtimeMs;
  if (existsSync(cache) && !flag('--reindex')) {
    const c = JSON.parse(readFileSync(cache, 'utf8'));
    if (c.stamp === stamp) return c;
  }
  const assets = {};
  for (const rel of readdirSync(join(PROJ, 'Assets'), { recursive: true })) {
    if (!rel.endsWith('.meta')) continue;
    const metaPath = join(PROJ, 'Assets', rel);
    const m = readFileSync(metaPath, 'utf8').match(/^guid: ([0-9a-f]{32})/m);
    if (!m) continue;
    // Unity paths always use '/', also on Windows (readdirSync returns '\\' there).
    const path = `Assets/${rel.slice(0, -5).split(sep).join('/')}`;
    const ext = extname(path).toLowerCase();
    // Folders have .meta files too; everything else is indexed (unknown ext = 'other').
    if (!ext && statSync(join(PROJ, path)).isDirectory()) continue;
    assets[m[1]] = { path, kind: KIND[ext] ?? (/shader$/.test(ext) ? 'shader' : 'other') };
  }
  const c = { stamp, assets };
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cache, JSON.stringify(c));
  return c;
}
const INDEX = buildIndex();
const byGuid = (g) => INDEX.assets[g];
const abs = (p) => join(PROJ, p);
const guidOf = (path) => Object.entries(INDEX.assets).find(([, a]) => a.path === path)?.[0];

// ---------- Unity YAML ----------
function docs(file) {
  const text = readFileSync(abs(file), 'utf8').replace(/\r\n/g, '\n');
  if (!text.startsWith('%YAML')) throw new Error(`${file} is binary-serialized (set Asset Serialization to Force Text, or use the Unity batch exporter)`);
  const out = new Map();
  const re = /^--- !u!(\d+) &(-?\d+)( stripped)?\s*$/gm;
  const heads = [...text.matchAll(re)];
  heads.forEach((h, i) => {
    const body = text.slice(h.index + h[0].length, heads[i + 1]?.index ?? text.length);
    out.set(h[2], { cls: +h[1], id: h[2], stripped: !!h[3], body });
  });
  return out;
}
const ref = (body, key) => {
  const m = body.match(new RegExp(`${key}: \\{fileID: (-?\\d+)(?:, guid: ([0-9a-f]{32}))?`));
  return m ? { fileID: m[1], guid: m[2] } : null;
};
const refList = (body, key) => {
  const m = body.match(new RegExp(`${key}:\\n((?:\\s*- \\{fileID[^\\n]*\\n)*)`));
  return m ? [...m[1].matchAll(/fileID: (-?\d+)(?:, guid: ([0-9a-f]{32}))?/g)].map((x) => ({ fileID: x[1], guid: x[2] })) : [];
};
const vec = (body, key) => {
  const m = body.match(new RegExp(`${key}: \\{([^}]*)\\}`));
  if (!m) return null;
  const o = {};
  for (const [, k, v] of m[1].matchAll(/(\w+): (-?[\d.e+-]+)/g)) o[k] = +v;
  return o;
};
const str = (body, key) => body.match(new RegExp(`^\\s*${key}: (.*)$`, 'm'))?.[1]?.trim() ?? '';

const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');

function material(guid) {
  const a = byGuid(guid);
  if (!a) return { guid, missing: true };
  const d = [...docs(a.path).values()].find((x) => x.cls === 21);
  if (!d) return { path: a.path };
  const colors = {};
  const cm = d.body.match(/m_Colors:\n((?:\s+- \w+: \{[^}]*\}\n)*)/);
  if (cm) for (const [, k, v] of cm[1].matchAll(/- (\w+): \{([^}]*)\}/g)) {
    const o = {};
    for (const [, kk, vv] of v.matchAll(/(\w): (-?[\d.e+-]+)/g)) o[kk] = +vv;
    colors[k] = hex(o);
  }
  const textures = {};
  for (const [, k, g] of d.body.matchAll(/- (\w+):\n\s+m_Texture: \{fileID: -?\d+, guid: ([0-9a-f]{32})/g)) {
    if (byGuid(g)) textures[k] = byGuid(g).path;
  }
  const sh = ref(d.body, 'm_Shader');
  const main = colors._BaseColor ?? colors._Color ?? colors._MainColor ?? colors._TintColor ?? Object.values(colors)[0];
  const mainTex = textures._BaseMap ?? textures._MainTex ?? textures._Albedo ?? Object.values(textures)[0];
  return { name: str(d.body, 'm_Name'), path: a.path, shader: sh?.guid ? byGuid(sh.guid)?.path ?? sh.guid : `builtin:${sh?.fileID}`, color: main, texture: mainTex, shadowColor: colors._SColor, colors, textures };
}

// FBX importer remaps: FBX material name -> project .mat (externalObjects in the .meta).
function modelMaterials(path) {
  const meta = abs(path) + '.meta';
  if (!existsSync(meta)) return {};
  const text = readFileSync(meta, 'utf8').replace(/\r\n/g, '\n');
  const out = {};
  for (const [, name, g] of text.matchAll(/type: UnityEngine:Material\n\s+assembly: [^\n]*\n\s+name: ([^\n]*)\n\s+second: \{fileID: -?\d+, guid: ([0-9a-f]{32})/g)) {
    if (byGuid(g)) out[name.trim()] = material(g);
  }
  return out;
}

function animatorClips(guid) {
  const a = byGuid(guid);
  if (!a) return [];
  const clips = new Set();
  for (const [, g] of readFileSync(abs(a.path), 'utf8').replace(/\r\n/g, '\n').matchAll(/m_Motion: \{fileID: -?\d+, guid: ([0-9a-f]{32})/g)) if (byGuid(g)) clips.add(byGuid(g).path);
  return [...clips];
}

// Prefab -> renderers with hierarchy path, mesh source, materials, world TRS (Unity space).
function prefabDeps(path, depth = 0) {
  const D = docs(path);
  const go = {}, goActive = {}, tr = {}, byGo = {};
  for (const d of D.values()) {
    if (d.cls === 1) {
      go[d.id] = str(d.body, 'm_Name');
      goActive[d.id] = str(d.body, 'm_IsActive') !== '0';
    }
    if (d.cls === 4 || d.cls === 224) {
      const g = ref(d.body, 'm_GameObject')?.fileID;
      tr[d.id] = { go: g, father: ref(d.body, 'm_Father')?.fileID, p: vec(d.body, 'm_LocalPosition'), r: vec(d.body, 'm_LocalRotation'), s: vec(d.body, 'm_LocalScale') };
      byGo[g] = d.id;
    }
  }
  const nodePath = (goId) => {
    const names = [];
    let t = tr[byGo[goId]];
    while (t) {
      names.unshift(go[t.go] ?? '?');
      t = tr[t.father];
    }
    return names.join('/');
  };
  // Inactive anywhere up the chain = not rendered in the game.
  const activeInHierarchy = (goId) => {
    let t = tr[byGo[goId]];
    while (t) {
      if (goActive[t.go] === false) return false;
      t = tr[t.father];
    }
    return true;
  };
  const world = (goId) => {
    // Compose TRS up the parent chain (Unity left-handed, unconverted).
    const chain = [];
    let t = tr[byGo[goId]];
    while (t) {
      chain.unshift(t);
      t = tr[t.father];
    }
    let M = { p: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1] };
    const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    const qrot = (q, v) => {
      const p = qmul(qmul(q, [...v, 0]), [-q[0], -q[1], -q[2], q[3]]);
      return [p[0], p[1], p[2]];
    };
    for (const t of chain) {
      const lp = t.p ? [t.p.x, t.p.y, t.p.z] : [0, 0, 0];
      const lr = t.r ? [t.r.x, t.r.y, t.r.z, t.r.w] : [0, 0, 0, 1];
      const ls = t.s ? [t.s.x, t.s.y, t.s.z] : [1, 1, 1];
      const sp = lp.map((v, i) => v * M.s[i]);
      const rp = qrot(M.r, sp);
      M = { p: rp.map((v, i) => v + M.p[i]), r: qmul(M.r, lr), s: ls.map((v, i) => v * M.s[i]) };
    }
    return M;
  };

  const renderers = [];
  const meshOf = {};
  for (const d of D.values()) if (d.cls === 33) meshOf[ref(d.body, 'm_GameObject')?.fileID] = ref(d.body, 'm_Mesh');
  for (const d of D.values()) {
    // Stripped renderers belong to nested prefabs; they're reported under `nested`.
    if ((d.cls !== 23 && d.cls !== 137) || d.stripped) continue;
    const g = ref(d.body, 'm_GameObject')?.fileID;
    const mesh = d.cls === 137 ? ref(d.body, 'm_Mesh') : meshOf[g];
    renderers.push({
      node: nodePath(g),
      name: go[g],
      skinned: d.cls === 137,
      visible: str(d.body, 'm_Enabled') !== '0' && activeInHierarchy(g),
      model: mesh?.guid ? byGuid(mesh.guid)?.path ?? `missing:${mesh.guid}` : mesh?.fileID === '0' ? null : `builtin:${mesh?.fileID}`,
      materials: refList(d.body, 'm_Materials').map((m) => (m.guid ? material(m.guid) : { builtin: m.fileID })),
      world: world(g),
    });
  }
  const animations = [];
  for (const d of D.values()) {
    if (d.cls !== 95) continue;
    const c = ref(d.body, 'm_Controller');
    if (c?.guid && byGuid(c.guid)) animations.push({ controller: byGuid(c.guid).path, clips: animatorClips(c.guid) });
  }
  // Nested prefabs / variants / model instances.
  const nested = [];
  for (const d of D.values()) {
    if (d.cls !== 1001) continue;
    const src = ref(d.body, 'm_SourcePrefab');
    const a = src?.guid && byGuid(src.guid);
    if (!a) continue;
    const mats = [...d.body.matchAll(/propertyPath: (m_Materials\.Array\.data\[\d+\])\n\s+value:.*\n\s+objectReference: \{fileID: -?\d+, guid: ([0-9a-f]{32})/g)].map((m) => ({ slot: m[1], ...material(m[2]) }));
    const mods = {};
    for (const [, prop, val] of d.body.matchAll(/propertyPath: (\S+)\n\s+value: ?(.*)/g)) mods[prop] = val.trim();
    const num = (k, dflt) => (mods[k] !== undefined && mods[k] !== '' ? +mods[k] : dflt);
    const parentT = tr[ref(d.body, 'm_TransformParent')?.fileID];
    const n = {
      source: a.path,
      kind: a.kind,
      parent: parentT ? go[parentT.go] : null,
      parentPath: parentT ? nodePath(parentT.go) : null,
      local: {
        p: [num('m_LocalPosition.x', 0), num('m_LocalPosition.y', 0), num('m_LocalPosition.z', 0)],
        r: [num('m_LocalRotation.x', 0), num('m_LocalRotation.y', 0), num('m_LocalRotation.z', 0), num('m_LocalRotation.w', 1)],
        s: [num('m_LocalScale.x', 1), num('m_LocalScale.y', 1), num('m_LocalScale.z', 1)],
      },
      // Overrides on the instance: deactivated object or disabled renderer.
      visible: mods.m_IsActive !== '0' && mods.m_Enabled !== '0' && (!parentT || activeInHierarchy(parentT.go)),
      materialOverrides: mats,
    };
    if (a.kind === 'prefab' && depth < 4) n.deps = prefabDeps(a.path, depth + 1);
    nested.push(n);
  }
  return { prefab: path, root: Object.values(tr).find((t) => !t.father || t.father === '0') ? go[Object.values(tr).find((t) => !t.father || t.father === '0').go] : basename(path), renderers, animations, nested };
}

function collectModels(deps, out = new Set()) {
  for (const r of deps.renderers) if (r.visible && r.model && !r.model.startsWith('builtin') && !r.model.startsWith('missing')) out.add(r.model);
  for (const n of deps.nested) {
    if (!n.visible) continue;
    if (n.kind === 'model') out.add(n.source);
    if (n.deps) collectModels(n.deps, out);
  }
  for (const a of deps.animations) for (const c of a.clips) if (KIND[extname(c).toLowerCase()] === 'model') out.add(c);
  return out;
}
function collectMaterials(deps, out = []) {
  for (const r of deps.renderers) out.push(...r.materials.filter((m) => m.path));
  for (const n of deps.nested) {
    out.push(...n.materialOverrides);
    if (n.deps) collectMaterials(n.deps, out);
  }
  return out;
}

// ---------- .anim -> three.js AnimationClip JSON ----------
// Unity clips are YAML curves keyed per path. Converted to linear tracks in
// glTF space (mirror X). The root node is skipped by default: the sim moves
// the character, and Unity's root carries its own axis fix-up.
function eulerToQuat([x, y, z]) {
  // Unity applies Z, then X, then Y (degrees) == three.js Euler order 'YXZ'.
  const r = Math.PI / 180;
  const [cx, sx, cy, sy, cz, sz] = [Math.cos((x * r) / 2), Math.sin((x * r) / 2), Math.cos((y * r) / 2), Math.sin((y * r) / 2), Math.cos((z * r) / 2), Math.sin((z * r) / 2)];
  return [sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
}
function convertAnim(path, { keepRoot = false } = {}) {
  const text = readFileSync(abs(path), 'utf8').replace(/\r\n/g, '\n');
  const name = str(text, 'm_Name');
  const section = (key) => text.match(new RegExp(`\\n  ${key}:\\n([\\s\\S]*?)(?=\\n  m_\\w+:)`))?.[1] ?? '';
  const tracks = [];
  let duration = 0;
  const read = (key, kind) => {
    for (const entry of section(key).split(/\n  - curve:/).slice(1)) {
      const p = entry.match(/\n    path: (.*)/)?.[1]?.trim() ?? '';
      if (!p || (!keepRoot && !p.includes('/'))) continue;
      const times = [];
      const values = [];
      for (const [, t, v] of entry.matchAll(/time: ([\d.e+-]+)\n\s+value: \{([^}]*)\}/g)) {
        const o = {};
        for (const [, k, n] of v.matchAll(/(\w): (-?[\d.e+-]+)/g)) o[k] = +n;
        times.push(+t);
        if (kind === 'quaternion') values.push(o.x, -o.y, -o.z, o.w);
        else if (kind === 'euler') {
          const q = eulerToQuat([o.x, o.y, o.z]);
          values.push(q[0], -q[1], -q[2], q[3]);
        } else if (kind === 'position') values.push(-o.x, o.y, o.z);
        else values.push(o.x, o.y, o.z);
      }
      if (!times.length) continue;
      duration = Math.max(duration, times[times.length - 1]);
      const node = p.split('/').pop();
      const prop = kind === 'euler' ? 'quaternion' : kind;
      tracks.push({ name: `${node}.${prop}`, type: prop === 'quaternion' ? 'quaternion' : 'vector', times, values });
    }
  };
  read('m_RotationCurves', 'quaternion');
  read('m_EulerCurves', 'euler');
  read('m_PositionCurves', 'position');
  read('m_ScaleCurves', 'scale');
  return { name, duration, tracks, uuid: createHash('md5').update(path).digest('hex') };
}

// ---------- platform helpers ----------
// Blender CLI: BLENDER=<path>, else the usual install locations, else PATH.
function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  if (process.platform === 'darwin' && existsSync('/Applications/Blender.app/Contents/MacOS/Blender')) return '/Applications/Blender.app/Contents/MacOS/Blender';
  if (process.platform === 'win32') {
    for (const base of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']].filter(Boolean)) {
      const dir = join(base, 'Blender Foundation');
      if (!existsSync(dir)) continue;
      const versions = readdirSync(dir).filter((d) => existsSync(join(dir, d, 'blender.exe'))).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      if (versions.length) return join(dir, versions[0], 'blender.exe');
    }
  }
  return 'blender';
}

// PSD/TGA/TIF -> PNG with ffmpeg (all platforms); macOS sips as a fallback.
function toPng(src, out) {
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', out], { stdio: 'ignore' });
  } catch (e) {
    if (process.platform !== 'darwin') throw new Error(`could not convert ${src} to PNG: ${e.message}`);
    execFileSync('sips', ['-s', 'format', 'png', src, '--out', out], { stdio: 'ignore' });
  }
}

// ---------- commands ----------
const all = Object.values(INDEX.assets);
const ours = (a) => !VENDOR.test('/' + a.path + '/');

if (cmd === 'scan') {
  const ps = existsSync(abs('ProjectSettings/ProjectSettings.asset')) ? readFileSync(abs('ProjectSettings/ProjectSettings.asset'), 'utf8') : '';
  const version = existsSync(abs('ProjectSettings/ProjectVersion.txt')) ? readFileSync(abs('ProjectSettings/ProjectVersion.txt'), 'utf8').match(/m_EditorVersion: (.*)/)?.[1] : '?';
  const ser = existsSync(abs('ProjectSettings/EditorSettings.asset')) ? readFileSync(abs('ProjectSettings/EditorSettings.asset'), 'utf8').match(/m_SerializationMode: (\d)/)?.[1] : '?';
  const icons = [...new Set([...ps.matchAll(/m_Icon: \{fileID: \d+, guid: ([0-9a-f]{32})/g)].map((m) => byGuid(m[1])?.path).filter(Boolean))];
  const iconGuess = all.filter((a) => a.kind === 'texture' && /icon|logo/i.test(basename(a.path)) && ours(a)).slice(0, 10).map((a) => a.path);
  const count = {};
  for (const a of all) count[a.kind] = (count[a.kind] ?? 0) + 1;
  const folders = {};
  for (const a of all.filter(ours)) {
    if (!['prefab', 'model', 'material', 'texture'].includes(a.kind)) continue;
    const f = a.path.split('/').slice(0, 3).join('/');
    folders[f] = (folders[f] ?? 0) + 1;
  }
  const groups = {
    hero: /player|hero|character|stickman|main.?char/i,
    enemy: /enemy|boss|monster|zombie|rival|opponent/i,
    collectible: /coin|gem|diamond|collect|pickup|money|crystal|star/i,
    obstacle: /obstacle|trap|saw|spike|wall|barrier|hammer/i,
    level: /level|finish|start|platform|road|track|ground|gate/i,
    skin: /skin|hat|outfit|costume/i,
  };
  console.log(`${str(ps, 'productName') || basename(PROJ)}  (${str(ps, 'companyName')})  Unity ${version}  serialization: ${ser === '2' ? 'Force Text (parsable)' : `mode ${ser} (may be binary: use the Unity batch exporter)`}`);
  console.log(`assets: ${Object.entries(count).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  console.log(`\nicons (player settings): ${icons.join(', ') || '-'}\nicon/logo-looking textures: ${iconGuess.join(', ') || '-'}`);
  console.log(`\nfonts: ${all.filter((a) => a.kind === 'font' && ours(a)).map((a) => a.path).join('\n       ') || '-'}`);
  console.log(`\nscenes: ${all.filter((a) => a.kind === 'scene' && ours(a)).map((a) => a.path).slice(0, 15).join('\n        ')}`);
  console.log(`\nbiggest game-content folders (non-vendor):`);
  for (const [f, n] of Object.entries(folders).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(n).padStart(5)}  ${f}`);
  for (const [g, re] of Object.entries(groups)) {
    const hits = all.filter((a) => (a.kind === 'prefab' || a.kind === 'model') && ours(a) && re.test(basename(a.path))).slice(0, 12);
    if (hits.length) console.log(`\n${g} candidates:\n  ${hits.map((a) => a.path).join('\n  ')}`);
  }
  console.log(`\nnext: bun unity.mjs deps <proj> "<prefab>"  |  bun unity.mjs find <proj> <words>`);
} else if (cmd === 'find') {
  const words = positional.map((w) => w.toLowerCase());
  const kinds = flag('--kind') ? String(flag('--kind')).split(',') : ['prefab', 'model', 'material', 'texture', 'font', 'audio', 'animation'];
  const hits = all
    .filter((a) => kinds.includes(a.kind) && words.every((w) => a.path.toLowerCase().includes(w)))
    .sort((a, b) => Number(!ours(a)) - Number(!ours(b)) || a.path.length - b.path.length)
    .slice(0, parseInt(flag('--limit') ?? '40', 10));
  for (const a of hits) console.log(`${a.kind.padEnd(9)} ${a.path}${ours(a) ? '' : '  (vendor)'}`);
  if (!hits.length) console.log('no matches');
} else if (cmd === 'deps') {
  const path = positional[0];
  const a = all.find((x) => x.path === path);
  if (!a) throw new Error(`not in index: ${path}`);
  if (a.kind !== 'prefab') {
    console.log(`${path} is a ${a.kind}; deps works on prefabs. Models export directly: bun unity.mjs export <proj> "${path}" --out <dir>`);
    process.exit(0);
  }
  const d = prefabDeps(path);
  if (flag('--json')) {
    console.log(JSON.stringify(d, null, 1));
    process.exit(0);
  }
  const print = (d, ind = '') => {
    console.log(`${ind}prefab ${d.prefab}`);
    for (const r of d.renderers) {
      console.log(`${ind}  ${r.skinned ? 'skinned' : 'mesh   '} ${r.node}  <- ${r.model ?? '(none)'}${r.visible ? '' : '  (hidden in game)'}`);
      for (const m of r.materials) console.log(`${ind}      mat ${m.name ?? m.builtin ?? '?'}  color ${m.color ?? '-'}${m.shadowColor ? ` shade ${m.shadowColor}` : ''}${m.texture ? `  tex ${m.texture}` : ''}  [${basename(String(m.shader ?? ''))}]`);
    }
    for (const an of d.animations) console.log(`${ind}  animator ${an.controller}\n${ind}      clips from: ${an.clips.join(', ') || '-'}`);
    for (const n of d.nested) {
      console.log(`${ind}  nested ${n.kind} ${n.source}${n.parent ? `  under ${n.parentPath}` : ''}${n.visible ? '' : '  (hidden in game)'}`);
      for (const m of n.materialOverrides) console.log(`${ind}      override ${m.slot} -> ${m.name} color ${m.color ?? '-'}${m.texture ? ` tex ${m.texture}` : ''}`);
      if (n.deps) print(n.deps, ind + '    ');
    }
  };
  print(d);
  console.log(`\nmodels: ${[...collectModels(d)].join(', ') || '-'}`);
} else if (cmd === 'export') {
  const path = positional[0];
  const outDir = resolve(String(flag('--out') ?? 'assets/models'));
  const a = all.find((x) => x.path === path);
  if (!a) throw new Error(`not in index: ${path}`);
  mkdirSync(join(outDir, 'textures'), { recursive: true });
  const deps = a.kind === 'prefab' ? prefabDeps(path) : { prefab: null, renderers: [], animations: [], nested: [{ source: path, kind: 'model', materialOverrides: [] }] };
  const models = [...collectModels(deps)];
  const blender = findBlender();
  const script = join(dirname(fileURLToPath(import.meta.url)), 'fbx2glb.py');
  const glbs = {};
  for (const m of models) {
    const out = join(outDir, basename(m, extname(m)) + '.glb');
    if (['.glb', '.gltf'].includes(extname(m).toLowerCase())) copyFileSync(abs(m), out);
    else {
      console.log(`blender: ${m}`);
      execFileSync(blender, ['-b', '--factory-startup', '-P', script, '--', abs(m), out], { stdio: ['ignore', 'ignore', 'inherit'] });
    }
    glbs[m] = relative(outDir, out).split(sep).join('/'); // URL-style, also on Windows
  }
  // Textures -> PNG next to the GLBs.
  const texMap = {};
  const remaps = Object.fromEntries(models.map((m) => [glbs[m], modelMaterials(m)]));
  for (const m of [...collectMaterials(deps), ...Object.values(remaps).flatMap((r) => Object.values(r))]) {
    if (!m.texture || texMap[m.texture]) continue;
    const out = join(outDir, 'textures', basename(m.texture, extname(m.texture)) + '.png');
    if (extname(m.texture).toLowerCase() === '.png') copyFileSync(abs(m.texture), out);
    else toPng(abs(m.texture), out);
    texMap[m.texture] = relative(outDir, out).split(sep).join('/');
  }
  const mat = (m) => ({ name: m.name, color: m.color, shadowColor: m.shadowColor, texture: m.texture ? texMap[m.texture] : undefined, unityShader: m.shader });
  const manifest = {
    source: { project: basename(PROJ), asset: path },
    models: glbs,
    // Match GLB nodes by `name` (= Unity GameObject name = FBX node name).
    renderers: deps.renderers.filter((r) => r.visible).map((r) => ({ name: r.name, node: r.node, skinned: r.skinned, model: glbs[r.model], materials: r.materials.filter((m) => m.path).map(mat), world: r.world })),
    // Nested prefab/model instances: attach `model` under the node named `parent` with `local` TRS.
    attachments: deps.nested.filter((n) => n.visible).map((n) => {
      const models = n.kind === 'model' ? [n.source] : [...collectModels(n.deps ?? { renderers: [], nested: [], animations: [] })];
      return { source: n.source, models: models.map((m) => glbs[m]), parent: n.parent, local: n.local, materials: n.materialOverrides.map(mat) };
    }),
    // Per GLB: glTF material name (= FBX material name) -> Unity material. Fallback when no renderer info.
    modelMaterials: Object.fromEntries(Object.entries(remaps).map(([glb, r]) => [glb, Object.fromEntries(Object.entries(r).map(([k, m]) => [k, mat(m)]))])),
    animations: deps.animations,
    note: 'world/local = Unity space (left-handed). For glTF/three.js: position (-x, y, z), quaternion (x, -y, -z, w). Hidden-in-game parts are left out.',
  };
  const name = basename(path, extname(path));
  // Unity-native clips (.anim) -> one JSON of three.js clips. FBX-embedded clips are already in the GLBs.
  const animFiles = [...new Set(deps.animations.flatMap((a) => a.clips).filter((c) => extname(c).toLowerCase() === '.anim'))];
  if (animFiles.length) {
    const clips = animFiles.map((f) => convertAnim(f, { keepRoot: !!flag('--keep-root') }));
    writeFileSync(join(outDir, `${name}.anims.json`), JSON.stringify(clips));
    manifest.clips = `${name}.anims.json`;
    console.log(`clips: ${clips.map((c) => `${c.name} (${c.duration.toFixed(2)}s, ${c.tracks.length} tracks)`).join(', ')}`);
  }
  writeFileSync(join(outDir, `${name}.unity.json`), JSON.stringify(manifest, null, 1));
  console.log(`\n${Object.keys(glbs).length} model(s), ${Object.keys(texMap).length} texture(s) -> ${outDir}\nmanifest: ${join(outDir, `${name}.unity.json`)}`);
} else {
  throw new Error(`unknown command ${cmd}`);
}
