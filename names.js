// Procedural name generator for evolution-mode worms.

const A = [
  'Zeph','Vrix','Morn','Keld','Axon','Brix','Crux','Drav','Flyx','Gorn',
  'Haze','Ixor','Jurn','Krix','Lorv','Morv','Nyx','Oxen','Pyrx','Riv',
  'Sorn','Trix','Urv','Vrex','Wyrn','Xan','Yorn','Zax','Brel','Quiv',
  'Thex','Slor','Phen','Dusk','Elv','Fern','Grix','Helv','Inox','Junv',
];
const B = ['ix','or','an','ex','us','is','on','ax','un','en','yx','ov','ar','el','orn','ux','yn','iv'];

const _used = new Set();

export function generateName() {
  for (let i = 0; i < 80; i++) {
    const name = pick(A) + pick(B);
    if (!_used.has(name)) { _used.add(name); return name; }
  }
  // All combos exhausted — append a counter
  let n = 0;
  while (true) {
    const name = pick(A) + pick(B) + (++n);
    if (!_used.has(name)) { _used.add(name); return name; }
  }
}

// Splice front half of parentA's name with back half of parentB's name.
export function generateOffspringName(nameA, nameB) {
  const cut = Math.ceil(nameA.length / 2);
  const raw = nameA.slice(0, cut) + nameB.slice(Math.floor(nameB.length / 2));
  const candidate = (raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()).slice(0, 8);
  if (!_used.has(candidate)) { _used.add(candidate); return candidate; }
  return generateName();
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
