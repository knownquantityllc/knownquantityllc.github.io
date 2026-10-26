// Chemical Chords data: elements and their spectral lines, the substances on the shelf, what they make, and the reactions.
//
// Spectral lines are wavelengths in air, in nanometres, rounded from the NIST Atomic Spectra Database
// (physics.nist.gov/asd). The second number is a simplified relative brightness (strongest line = 1) for a typical lamp
// or flame; real brightness depends on temperature, so treat it as "which lines stand out", not a measurement.
// Lines marked as a band come from molecules (OH, CaOH, SrOH, C2 ...) rather than single atoms. A band is spread over a
// few nanometres; the number given is roughly where it is brightest.
(function (root) {
'use strict';

// [nm, brightness, band label (optional)]
const ELEMENTS = {
  H:  { name: 'Hydrogen',  Z: 1,  lines: [[656.28, 1], [486.13, 0.45], [434.05, 0.25], [410.17, 0.15]],
        about: 'The four visible hydrogen lines (the Balmer series) were the clue that led Niels Bohr to his model of the atom in 1913.' },
  Li: { name: 'Lithium',   Z: 3,  lines: [[670.78, 1], [610.36, 0.25], [460.29, 0.1]],
        about: 'One bright red line at 670.8 nm does almost all the work, which is why lithium flames look crimson.' },
  C:  { name: 'Carbon',    Z: 6,  lines: [[247.86, 1], [426.73, 0.45], [657.81, 0.35], [658.29, 0.3]],
        about: 'Carbon’s brightest atomic line is ultraviolet (247.9 nm). Its visible lines come from carbon atoms that have lost an electron.' },
  N:  { name: 'Nitrogen',  Z: 7,  lines: [[746.83, 1], [744.23, 0.7], [742.36, 0.45], [567.96, 0.3]],
        about: 'Atomic nitrogen glows deep red at the edge of what eyes can see. The blue-violet of auroras comes from nitrogen molecules instead.' },
  O:  { name: 'Oxygen',    Z: 8,  lines: [[777.19, 1], [777.42, 0.8], [844.64, 0.6], [557.73, 0.35], [630.03, 0.3]],
        about: 'The green of the northern lights is oxygen’s 557.7 nm line. Its strongest lines, near 777 nm, are just past red.' },
  Na: { name: 'Sodium',    Z: 11, lines: [[589.00, 1], [589.59, 0.55], [568.82, 0.08], [498.28, 0.05]],
        about: 'The two famous “D lines” are only 0.6 nm apart. Old orange streetlights were sodium lamps.' },
  Mg: { name: 'Magnesium', Z: 12, lines: [[518.36, 1], [517.27, 0.7], [516.73, 0.5], [285.21, 0.9], [383.83, 0.4]],
        about: 'Three green lines sit close together (the “b triplet”), and the brightest line of all is ultraviolet at 285.2 nm.' },
  Al: { name: 'Aluminium', Z: 13, lines: [[396.15, 1], [394.40, 0.6], [309.27, 0.5], [308.22, 0.4]],
        about: 'Aluminium’s strongest lines are violet and ultraviolet, on the very edge of sight.' },
  S:  { name: 'Sulfur',    Z: 16, lines: [[921.29, 1], [922.81, 0.7], [923.75, 0.45]],
        about: 'Sulfur atoms shine mostly in the infrared, near 922 nm, just past what eyes can see.' },
  Cl: { name: 'Chlorine',  Z: 17, lines: [[837.59, 1], [725.66, 0.5], [479.45, 0.3], [481.01, 0.25]],
        about: 'Chlorine’s strong lines are infrared. Chlorine adds almost no colour to a flame, which is why chloride salts are used for flame tests.' },
  K:  { name: 'Potassium', Z: 19, lines: [[766.49, 1], [769.90, 0.55], [404.41, 0.12], [404.72, 0.1]],
        about: 'Deep red lines at one end and violet lines at the other. Mixed together they look lilac.' },
  Ca: { name: 'Calcium',   Z: 20, lines: [[422.67, 1], [393.37, 0.8], [396.85, 0.75], [616.22, 0.2], [643.91, 0.2]],
        about: 'Calcium’s lines at 393 and 397 nm are so strong in sunlight that they were named H and K by Fraunhofer in 1814.' },
  Fe: { name: 'Iron',      Z: 26, lines: [[248.33, 1], [404.58, 0.6], [438.35, 0.55], [440.48, 0.45], [495.76, 0.3], [527.04, 0.3]],
        about: 'Iron has thousands of lines. Astronomers use them to measure the motion of stars.' },
  Cu: { name: 'Copper',    Z: 29, lines: [[324.75, 1], [327.40, 0.7], [521.82, 0.5], [515.32, 0.4], [510.55, 0.35]],
        about: 'Three green lines between 510 and 522 nm give copper its green-blue flame.' },
  Zn: { name: 'Zinc',      Z: 30, lines: [[213.86, 1], [481.05, 0.5], [472.22, 0.4], [468.01, 0.35], [636.23, 0.3]],
        about: 'Zinc’s brightest line is deep ultraviolet. Its visible lines are blue, with one red line at 636.2 nm.' },
  Sr: { name: 'Strontium', Z: 38, lines: [[460.73, 1], [407.77, 0.6], [421.55, 0.45]],
        about: 'A strontium atom’s brightest line is blue, yet strontium fireworks are red. The red comes from SrOH molecules in the flame.' },
  Ag: { name: 'Silver',    Z: 47, lines: [[328.07, 1], [338.29, 0.6], [546.55, 0.25], [520.91, 0.2]],
        about: 'Silver’s two strongest lines are ultraviolet, and two faint green lines are visible.' },
  I:  { name: 'Iodine',    Z: 53, lines: [[206.16, 1], [183.04, 0.7]],
        about: 'Iodine atoms shine in the deep ultraviolet. The purple of iodine vapour is light it absorbs, not light it gives off.' },
  Ba: { name: 'Barium',    Z: 56, lines: [[553.55, 1], [455.40, 0.7], [493.41, 0.45], [614.17, 0.3], [649.69, 0.25]],
        about: 'Barium’s 553.5 nm line is yellow-green, and barium salts make the green in fireworks.' },
  Pb: { name: 'Lead',      Z: 82, lines: [[405.78, 1], [368.35, 0.6], [283.31, 0.55], [363.96, 0.4]],
        about: 'Lead’s brightest visible line is violet, at 405.8 nm.' }
};

// ---------------------------------------------------------------- substances
// kind: liquid | solid (a powder or crystals that dissolve) | metal | gas | indicator
// look tells the vessel how to draw it. tier: 0 kitchen, 1 school lab, 2 advanced lab (on the shelf); products have no tier.
// flame: which element colours a flame when this is held in it.
// absorbs: roughly where a coloured substance absorbs most strongly, in nm. Its colour is the white light left over;
// the hum gives that absorbed colour a voice of its own.
const S = (id, name, formula, kind, color, els, about, more) => Object.assign({ id, name, formula, kind, color, els, about }, more || {});
const SUBSTANCES = [
  // kitchen
  S('water', 'Water', 'H₂O', 'liquid', '#5fb7ff', ['H', 'O'], 'Two hydrogen atoms bonded to one oxygen atom. It dissolves more substances than any other common liquid.', { tier: 0 }),
  S('vinegar', 'Vinegar', 'CH₃COOH', 'liquid', '#f3e3b0', ['C', 'H', 'O'], 'About 5% acetic acid in water. A weak acid: only a few of its molecules give up their hydrogen ion.', { tier: 0 }),
  S('bicarb', 'Baking soda', 'NaHCO₃', 'solid', '#f4f6fb', ['Na', 'H', 'C', 'O'], 'Sodium hydrogen carbonate, a mild base. Acids turn it into carbon dioxide gas, which is what makes cakes rise.', { tier: 0, flame: 'Na' }),
  S('salt', 'Table salt', 'NaCl', 'solid', '#ffffff', ['Na', 'Cl'], 'Sodium chloride: sodium ions and chloride ions packed in a cube-shaped crystal.', { tier: 0, flame: 'Na' }),
  S('sugar', 'Sugar', 'C₁₂H₂₂O₁₁', 'solid', '#fff8ec', ['C', 'H', 'O'], 'Sucrose. Its formula is twelve carbons plus what looks like eleven waters, which is why it was called a “carbo-hydrate”.', { tier: 0 }),
  S('peroxide', 'Hydrogen peroxide', 'H₂O₂', 'liquid', '#e6f4ff', ['H', 'O'], 'The 3% kind from a first-aid kit. It slowly breaks down into water and oxygen; a catalyst makes that happen in seconds.', { tier: 0 }),
  S('yeast', 'Yeast', 'catalase', 'solid', '#d9b77a', ['C', 'H', 'O', 'N'], 'Dried baking yeast. Its cells are full of catalase, an enzyme that breaks down hydrogen peroxide.', { tier: 0 }),
  S('cabbage', 'Red cabbage juice', 'anthocyanins', 'indicator', '#7b3fa0', ['C', 'H', 'O'], 'The purple colour in red cabbage is an anthocyanin, a natural pH indicator that turns red in acid and green in strong base.', { tier: 0 , absorbs: 560 }),
  S('kcl', 'Salt substitute', 'KCl', 'solid', '#ffffff', ['K', 'Cl'], 'Potassium chloride, sold as low-sodium salt. It tastes a little bitter.', { tier: 0, flame: 'K' }),
  S('cacl2', 'Calcium chloride', 'CaCl₂', 'solid', '#fbfbf4', ['Ca', 'Cl'], 'Used to melt ice on roads and to keep pickles crisp. Dissolving it gives off heat.', { tier: 0, flame: 'Ca' }),
  // school lab
  S('hcl', 'Hydrochloric acid', 'HCl', 'liquid', '#f4f9e8', ['H', 'Cl'], 'A strong acid: in water every molecule gives up its hydrogen ion. Your stomach makes a weak version of it.', { tier: 1, hazard: 'Corrosive. Goggles and gloves.' }),
  S('naoh', 'Sodium hydroxide', 'NaOH', 'liquid', '#eef4ff', ['Na', 'O', 'H'], 'A strong base, also called lye or caustic soda. Used to make soap.', { tier: 1, flame: 'Na', hazard: 'Corrosive, worse on skin than most acids.' }),
  S('phph', 'Phenolphthalein', 'C₂₀H₁₄O₄', 'indicator', '#f7f7f7', ['C', 'H', 'O'], 'An indicator that is colourless in acid and neutral water and turns pink above about pH 8.2.', { tier: 1 }),
  S('cuso4', 'Copper sulfate', 'CuSO₄', 'liquid', '#1e8fff', ['Cu', 'S', 'O'], 'Blue because copper ions in water absorb orange and red light (around 800 nm) and let blue through.', { tier: 1, flame: 'Cu', hazard: 'Harmful if swallowed, toxic to fish.' , absorbs: 810 }),
  S('iron', 'Iron nail', 'Fe', 'metal', '#9aa3ad', ['Fe'], 'A plain steel nail, which is mostly iron.', { tier: 1, look: 'nail' }),
  S('zinc', 'Zinc granules', 'Zn', 'metal', '#b9c2c9', ['Zn'], 'Zinc is the coating on galvanised steel, and it sits above iron in the reactivity series.', { tier: 1, look: 'granules' }),
  S('copper', 'Copper wire', 'Cu', 'metal', '#d9814a', ['Cu'], 'Copper sits below hydrogen in the reactivity series, so most acids cannot dissolve it.', { tier: 1, look: 'wire', flame: 'Cu' }),
  S('mg', 'Magnesium ribbon', 'Mg', 'metal', '#c9ced6', ['Mg'], 'A light, reactive metal. Once lit, it burns with a white light bright enough to damage eyes.', { tier: 1, look: 'ribbon', hazard: 'Never look straight at burning magnesium.' }),
  S('agno3', 'Silver nitrate', 'AgNO₃', 'liquid', '#f5f7fa', ['Ag', 'N', 'O'], 'Clear in the bottle, but it stains skin black where light turns it into specks of silver.', { tier: 1, hazard: 'Stains and burns skin.' }),
  S('ki', 'Potassium iodide', 'KI', 'liquid', '#fbfaf1', ['K', 'I'], 'Added to “iodised” salt. Its iodide ions are a fast catalyst for breaking down hydrogen peroxide.', { tier: 1, flame: 'K' }),
  S('pbno3', 'Lead nitrate', 'Pb(NO₃)₂', 'liquid', '#f6f6f8', ['Pb', 'N', 'O'], 'Clear in water, and toxic. Used here only for its famous yellow precipitate.', { tier: 1, hazard: 'Toxic. Not for home use.' }),
  S('nh3', 'Ammonia solution', 'NH₃', 'liquid', '#eaf6ff', ['N', 'H'], 'Ammonia gas dissolved in water, a weak base. Household ammonia is a dilute version.', { tier: 1, hazard: 'Never mix with bleach: it makes toxic chloramine gas.' }),
  S('fecl3', 'Iron(III) chloride', 'FeCl₃', 'liquid', '#e0a12a', ['Fe', 'Cl'], 'Orange-brown in water. Used to etch copper circuit boards.', { tier: 1, hazard: 'Corrosive, stains.' }),
  S('kscn', 'Potassium thiocyanate', 'KSCN', 'liquid', '#f7f7f2', ['K', 'S', 'C', 'N'], 'Colourless, but it grabs iron(III) ions and turns blood red, so it is a test for iron.', { tier: 1, flame: 'K' }),
  S('licl', 'Lithium chloride', 'LiCl', 'solid', '#ffffff', ['Li', 'Cl'], 'A white salt that pulls water out of the air. Its flame is crimson.', { tier: 1, flame: 'Li' }),
  S('srcl2', 'Strontium chloride', 'SrCl₂', 'solid', '#ffffff', ['Sr', 'Cl'], 'The salt that makes red fireworks red.', { tier: 1, flame: 'Sr' }),
  S('bacl2', 'Barium chloride', 'BaCl₂', 'solid', '#ffffff', ['Ba', 'Cl'], 'Barium salts make the green in fireworks.', { tier: 1, flame: 'Ba', hazard: 'Toxic if swallowed.' }),
  S('luminol', 'Luminol', 'C₈H₇N₃O₂', 'liquid', '#f4f7ff', ['C', 'H', 'N', 'O'], 'Dissolved in a basic solution. When it is oxidised it gives off light instead of heat. Crime-scene teams use it to find traces of blood.', { tier: 1 }),
  // advanced lab
  S('na', 'Sodium metal', 'Na', 'metal', '#d8dde3', ['Na'], 'So reactive it is stored under oil. Soft enough to cut with a knife.', { tier: 2, look: 'lump', flame: 'Na', hazard: 'Reacts violently with water. Lab demonstration only.' }),
  S('k', 'Potassium metal', 'K', 'metal', '#cfd6df', ['K'], 'Even more reactive than sodium: it is one row lower in the periodic table, so its outer electron is held more loosely.', { tier: 2, look: 'lump', flame: 'K', hazard: 'Can explode on contact with water.' }),
  S('li', 'Lithium metal', 'Li', 'metal', '#c7ccd2', ['Li'], 'The lightest metal: it floats on water, and even on oil.', { tier: 2, look: 'lump', flame: 'Li', hazard: 'Reacts with water, burns fiercely.' }),
  S('hno3', 'Nitric acid', 'HNO₃', 'liquid', '#fbf6d8', ['H', 'N', 'O'], 'A strong acid and a strong oxidiser: it can dissolve copper, which hydrochloric acid cannot.', { tier: 2, hazard: 'Very corrosive; gives off toxic fumes.' }),
  S('h2so4', 'Sulfuric acid', 'H₂SO₄', 'liquid', '#f6f3e6', ['H', 'S', 'O'], 'Concentrated, it pulls water out of almost anything, even out of sugar molecules.', { tier: 2, hazard: 'Causes severe burns. Always add acid to water, never water to acid.' }),
  S('rust', 'Iron oxide', 'Fe₂O₃', 'solid', '#a0442a', ['Fe', 'O'], 'Rust. Iron that has already combined with oxygen.', { tier: 2, look: 'powder' }),
  S('al', 'Aluminium powder', 'Al', 'metal', '#c4c9cf', ['Al'], 'Aluminium grabs oxygen more strongly than iron does, so it can steal oxygen from rust.', { tier: 2, look: 'powder' }),
  S('h2', 'Hydrogen gas', 'H₂', 'gas', '#d6ecff', ['H'], 'The lightest gas. It burns with a nearly invisible flame.', { tier: 2, hazard: 'Explosive mixed with air.' }),
  S('o2', 'Oxygen gas', 'O₂', 'gas', '#d9f5f0', ['O'], 'It does not burn itself, but it makes everything else burn faster.', { tier: 2 }),

  // products (made in the beaker, not on the shelf)
  S('naac', 'Sodium acetate', 'CH₃COONa', 'liquid', '#f2ead0', ['Na', 'C', 'H', 'O'], 'The salt left behind after vinegar meets baking soda. Concentrated, it is the stuff in reusable hand warmers.', { flame: 'Na' }),
  S('co2', 'Carbon dioxide', 'CO₂', 'gas', '#eeeeee', ['C', 'O'], 'The gas in fizzy drinks. Heavier than air, so it sinks.'),
  S('o2gas', 'Oxygen', 'O₂', 'gas', '#e9fbf6', ['O'], 'Released as tiny bubbles.'),
  S('h2gas', 'Hydrogen', 'H₂', 'gas', '#e6f2ff', ['H'], 'Released as bubbles. A lit splint held over it makes a squeaky pop.'),
  S('brine', 'Salt water', 'NaCl(aq)', 'liquid', '#cfe8ff', ['Na', 'Cl', 'H', 'O'], 'Sodium and chloride ions floating free in water.', { flame: 'Na' }),
  S('zncl2', 'Zinc chloride', 'ZnCl₂', 'liquid', '#eef3f5', ['Zn', 'Cl'], 'Colourless in water.'),
  S('mgcl2', 'Magnesium chloride', 'MgCl₂', 'liquid', '#eef3f5', ['Mg', 'Cl'], 'Colourless in water. Seawater is full of it.'),
  S('fecl2', 'Iron(II) chloride', 'FeCl₂', 'liquid', '#cfe7c8', ['Fe', 'Cl'], 'Iron(II) ions are a pale green.'),
  S('feso4', 'Iron(II) sulfate', 'FeSO₄', 'liquid', '#bfe3bf', ['Fe', 'S', 'O'], 'Pale green, the colour of iron(II) ions in water.'),
  S('znso4', 'Zinc sulfate', 'ZnSO₄', 'liquid', '#eef3f5', ['Zn', 'S', 'O'], 'Colourless. Zinc ions do not absorb visible light.'),
  S('cuno32', 'Copper nitrate', 'Cu(NO₃)₂', 'liquid', '#2a9df4', ['Cu', 'N', 'O'], 'Blue, from copper(II) ions.', { flame: 'Cu' , absorbs: 810 }),
  S('agmetal', 'Silver crystals', 'Ag', 'metal', '#e7ecf2', ['Ag'], 'Fine, shiny branches of pure silver.'),
  S('cumetal', 'Copper', 'Cu', 'metal', '#c4632e', ['Cu'], 'A brown-red layer of fresh copper.', { flame: 'Cu' }),
  S('nano3', 'Sodium nitrate', 'NaNO₃', 'liquid', '#f2f6fa', ['Na', 'N', 'O'], 'Stays dissolved: almost every nitrate does.', { flame: 'Na' }),
  S('kno3', 'Potassium nitrate', 'KNO₃', 'liquid', '#f2f6fa', ['K', 'N', 'O'], 'Saltpetre, stays dissolved.', { flame: 'K' }),
  S('agcl', 'Silver chloride', 'AgCl', 'solid', '#ffffff', ['Ag', 'Cl'], 'A white solid that will not dissolve. Light slowly turns it grey-violet, the chemistry behind old photographic film.'),
  S('pbi2', 'Lead iodide', 'PbI₂', 'solid', '#ffd21f', ['Pb', 'I'], 'Bright yellow crystals. Hot water dissolves it; as it cools, golden flakes fall like glitter.', { absorbs: 520 }),
  S('agi', 'Silver iodide', 'AgI', 'solid', '#f6efb0', ['Ag', 'I'], 'Pale yellow. Planes spray it into clouds to help ice crystals form (cloud seeding).'),
  S('cuoh2', 'Copper hydroxide', 'Cu(OH)₂', 'solid', '#57b7ff', ['Cu', 'O', 'H'], 'A pale blue, jelly-like solid.', { flame: 'Cu' }),
  S('feoh3', 'Iron(III) hydroxide', 'Fe(OH)₃', 'solid', '#9a4a1c', ['Fe', 'O', 'H'], 'Rust-brown flakes, closely related to rust itself.'),
  S('na2so4', 'Sodium sulfate', 'Na₂SO₄', 'liquid', '#f2f6fa', ['Na', 'S', 'O'], 'Colourless and dissolved.', { flame: 'Na' }),
  S('cuamm', 'Tetraamminecopper(II)', '[Cu(NH₃)₄]²⁺', 'liquid', '#2b2fd6', ['Cu', 'N', 'H'], 'Four ammonia molecules wrapped around one copper ion. It absorbs near 600 nm, so it looks a deep royal blue.', { flame: 'Cu' , absorbs: 600 }),
  S('fescn', 'Iron thiocyanate', '[Fe(SCN)]²⁺', 'liquid', '#a3001b', ['Fe', 'S', 'C', 'N'], 'Absorbs blue-green light near 480 nm, so what reaches your eye is blood red.', { absorbs: 480 }),
  S('nh4cl', 'Ammonium chloride', 'NH₄Cl', 'solid', '#ffffff', ['N', 'H', 'Cl'], 'A white solid, so fine that it hangs in the air as smoke.'),
  S('pinkbase', 'Pink indicator', 'phenolphthalein in base', 'liquid', '#ff3fa4', ['C', 'H', 'O', 'Na'], 'Phenolphthalein in base: its molecules open up and absorb green light near 552 nm, so they look pink.', { flame: 'Na' , absorbs: 552 }),
  S('cabred', 'Cabbage juice in acid', 'anthocyanin (acid form)', 'liquid', '#e0245e', ['C', 'H', 'O'], 'The red form of the anthocyanin molecule.', { absorbs: 525 }),
  S('cabblue', 'Cabbage juice in mild base', 'anthocyanin (blue form)', 'liquid', '#3a6fe0', ['C', 'H', 'O'], 'The blue form of the anthocyanin molecule.', { absorbs: 590 }),
  S('cabgreen', 'Cabbage juice in strong base', 'anthocyanin (green-yellow form)', 'liquid', '#7fcf3a', ['C', 'H', 'O'], 'The green-yellow form of the anthocyanin molecule.', { absorbs: 615 }),
  S('naoh_new', 'Sodium hydroxide', 'NaOH', 'liquid', '#eef4ff', ['Na', 'O', 'H'], 'Left behind in the water: the water is now strongly basic.', { flame: 'Na', same: 'naoh' }),
  S('koh', 'Potassium hydroxide', 'KOH', 'liquid', '#eef4ff', ['K', 'O', 'H'], 'A strong base left in the water.', { flame: 'K', same: 'naoh' }),
  S('lioh', 'Lithium hydroxide', 'LiOH', 'liquid', '#eef4ff', ['Li', 'O', 'H'], 'A strong base left in the water. Spacecraft use it to scrub carbon dioxide from the air.', { flame: 'Li', same: 'naoh' }),
  S('na2co3', 'Sodium carbonate', 'Na₂CO₃', 'solid', '#ffffff', ['Na', 'C', 'O'], 'Washing soda: a stronger base than baking soda.', { flame: 'Na' }),
  S('steam', 'Water vapour', 'H₂O(g)', 'gas', '#ffffff', ['H', 'O'], 'Water as a gas.'),
  S('no2', 'Nitrogen dioxide', 'NO₂', 'gas', '#b5521b', ['N', 'O'], 'A toxic red-brown gas, the brown in city smog.', { absorbs: 400 }),
  S('so2', 'Sulfur dioxide', 'SO₂', 'gas', '#f2f2f2', ['S', 'O'], 'A choking gas with the smell of a struck match.'),
  S('carbon', 'Carbon', 'C', 'solid', '#141210', ['C'], 'Puffy black carbon, full of steam holes.'),
  S('mgo', 'Magnesium oxide', 'MgO', 'solid', '#ffffff', ['Mg', 'O'], 'A white ash.'),
  S('al2o3', 'Aluminium oxide', 'Al₂O₃', 'solid', '#efe9e0', ['Al', 'O'], 'The same compound as sapphire and ruby.'),
  S('femolten', 'Molten iron', 'Fe', 'metal', '#ffb347', ['Fe'], 'Liquid iron at about 2,500 °C, which later cools into a solid lump.'),
  S('h2o2mix', 'Hydrogen and oxygen', '2H₂ + O₂', 'gas', '#e3f3ff', ['H', 'O'], 'The two gases mixed. Nothing happens until a flame or spark starts it, and then everything happens at once.'),
  S('thermix', 'Thermite mix', 'Fe₂O₃ + 2Al', 'solid', '#8c4a35', ['Fe', 'O', 'Al'], 'Rust and aluminium powder, stirred together. It needs a very hot start, so magnesium ribbon is used as a fuse.', { look: 'powder' }),
  S('lumimix', 'Luminol and peroxide', 'luminol + H₂O₂', 'liquid', '#eef3ff', ['C', 'H', 'N', 'O'], 'Ready to glow, but it needs a catalyst (iron or copper ions) to get going.'),
  S('foam', 'Oxygen foam', 'O₂ in soapy water', 'solid', '#ffffff', ['O', 'H'], 'Bubbles of oxygen.')
];
const BY_ID = {};
for (const s of SUBSTANCES) BY_ID[s.id] = s;

// ---------------------------------------------------------------- reaction types (the Codex sections)
const TYPES = {
  acidbase: { name: 'Acids and bases', about: 'An acid gives away hydrogen ions (H⁺), a base takes them. When they meet they cancel out into water and a salt, and they give off heat.' },
  indicator: { name: 'Indicators', about: 'An indicator is a molecule whose shape, and so its colour, changes with how acidic the solution is. pH runs from 0 (very acidic) through 7 (neutral) to 14 (very basic).' },
  gas: { name: 'Gas makers', about: 'Some reactions make a gas that bubbles out. Acids and carbonates make carbon dioxide; acids and reactive metals make hydrogen.' },
  precip: { name: 'Precipitates', about: 'Two clear solutions swap partners and one new pair does not dissolve, so it appears as a solid out of nowhere. That solid is a precipitate.' },
  swap: { name: 'Metal swaps', about: 'A more reactive metal pushes a less reactive one out of solution. The reactivity series (K, Na, Li, Ca, Mg, Al, Zn, Fe, H, Cu, Ag) predicts who wins.' },
  complex: { name: 'Complexes and colour', about: 'Metal ions can hold molecules or ions around them in a fixed shape called a complex. That changes which colours the metal absorbs.' },
  catalysis: { name: 'Breaking down', about: 'A decomposition splits one compound into simpler ones. A catalyst makes a reaction faster without being used up.' },
  burn: { name: 'Fire and fury', about: 'Combustion and other redox reactions move electrons from one substance to another and release a lot of energy, often as heat and light.' },
  flame: { name: 'Flame tests', about: 'Heat kicks a metal’s electrons up to higher energy levels. When they fall back they give off light at the exact wavelengths of that element. Those wavelengths are what you hear.' },
  light: { name: 'Light from chemistry', about: 'Chemiluminescence: a reaction leaves a molecule in an excited state, and it gives that energy away as light instead of heat.' }
};

// ---------------------------------------------------------------- reactions
// mix: two groups of substance ids, or 'heat'. One substance from each group meeting starts the reaction.
// makes: every product (gases bubble away). emit: the light the reaction gives off, which becomes its sound; without
// emit, the sound is built from the atoms in the products. fx: what the vessel shows. tempo: slow | medium | fast.
// code: the tune's name when the music is sent to Jam Jar or Chordfall (letters only, 12 at most).
const ACIDS = ['vinegar', 'hcl'];
const R = (o) => o;
const REACTIONS = [
  // acids and bases
  R({ id: 'neutral', name: 'Neutralisation', type: 'acidbase', mix: [['hcl'], ['naoh', 'naoh_new']], makes: ['brine'],
      eq: 'HCl + NaOH → NaCl + H₂O',
      what: 'The beaker gets warm, and that is all you can see. Every H⁺ from the acid has met an OH⁻ from the base and become water. What is left is salt water.',
      why: 'Making water from H⁺ and OH⁻ releases 57 kJ of heat for every mole (18 g) of water formed.',
      fx: { liquid: '#cfe8ff', heat: 1, dur: 4 }, tempo: 'slow', code: 'NEUTRAL', hint: 'Cancel a strong acid with a strong base.' }),
  R({ id: 'unpink', name: 'Pink disappears', type: 'indicator', mix: [['pinkbase'], ['hcl', 'vinegar']], makes: ['brine'],
      eq: 'In⁻ (pink) + H⁺ → HIn (colourless)',
      what: 'The pink vanishes. The acid has used up the base, and once the pH falls below about 8.2 phenolphthalein closes up and turns colourless again.',
      why: 'This is how a titration works: drip acid in until the colour just disappears and you know exactly how much base was there.',
      fx: { liquid: '#eef6ff', dur: 3 }, tempo: 'slow', code: 'UNPINK', hint: 'Add acid to something that turned pink.' }),
  R({ id: 'pink', name: 'Pink in base', type: 'indicator', mix: [['phph'], ['naoh', 'naoh_new', 'koh', 'lioh', 'nh3']], makes: ['pinkbase'],
      eq: 'HIn (colourless) + OH⁻ → In⁻ (pink) + H₂O',
      what: 'Instant hot pink. The base pulls hydrogen ions off the phenolphthalein molecules, and they open into a shape that absorbs green light.',
      why: 'Take green out of white light and what is left looks pink-magenta.',
      fx: { liquid: '#ff3fa4', dur: 3 }, tempo: 'medium', code: 'HOTPINK', hint: 'Phenolphthalein meets a base.' }),
  R({ id: 'cabacid', name: 'Cabbage turns red', type: 'indicator', mix: [['cabbage'], ACIDS.concat(['hno3'])], makes: ['cabred'],
      eq: 'anthocyanin + H⁺ → red flavylium form',
      what: 'The purple juice goes cherry red. Acid adds a hydrogen ion to the anthocyanin and changes which colours it absorbs.',
      why: 'Red means roughly pH 2 to 3, as acidic as vinegar or lemon juice.',
      fx: { liquid: '#e0245e', dur: 3 }, tempo: 'medium', code: 'CABBAGERED', hint: 'Red cabbage juice meets an acid.' }),
  R({ id: 'cabmild', name: 'Cabbage turns blue', type: 'indicator', mix: [['cabbage'], ['bicarb', 'na2co3']], makes: ['cabblue'],
      eq: 'anthocyanin + mild base → blue form',
      what: 'The juice turns blue. Baking soda is only mildly basic, about pH 8.',
      why: 'The same molecule that turned red in acid takes a third shape in mild base.',
      fx: { liquid: '#3a6fe0', dur: 3 }, tempo: 'medium', code: 'CABBAGEBLUE', hint: 'Red cabbage juice meets something from the baking cupboard.' }),
  R({ id: 'cabstrong', name: 'Cabbage turns green', type: 'indicator', mix: [['cabbage'], ['naoh', 'naoh_new', 'koh', 'lioh', 'nh3']], makes: ['cabgreen'],
      eq: 'anthocyanin + strong base → green-yellow form',
      what: 'Green, heading towards yellow. Strong bases (pH 11 to 13) break the molecule into forms that absorb red and blue.',
      why: 'One cabbage gives a whole colour chart: red, purple, blue, green, yellow as the pH climbs.',
      fx: { liquid: '#7fcf3a', dur: 3 }, tempo: 'medium', code: 'CABBAGEGREEN', hint: 'Red cabbage juice meets a strong base.' }),
  R({ id: 'smoke', name: 'Smoke from nothing', type: 'acidbase', mix: [['nh3'], ['hcl']], makes: ['nh4cl'],
      eq: 'NH₃ + HCl → NH₄Cl',
      what: 'A white cloud rises. Ammonia and hydrogen chloride fumes meet and make tiny solid crystals of ammonium chloride right in the air.',
      why: 'A base (ammonia) meeting an acid (hydrogen chloride) without any water: the salt has nowhere to dissolve, so it appears as smoke.',
      fx: { smoke: '#ffffff', heat: 1, dur: 5 }, tempo: 'slow', code: 'WHITESMOKE', hint: 'Open ammonia next to a strong acid.' }),

  // gas makers
  R({ id: 'volcano', name: 'Kitchen volcano', type: 'gas', mix: [['vinegar'], ['bicarb']], makes: ['naac', 'co2'],
      eq: 'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂',
      what: 'Foam everywhere. The acid turns hydrogen carbonate into carbonic acid, which falls apart straight away into water and carbon dioxide gas.',
      why: 'A spoonful of baking soda makes about a litre of carbon dioxide.',
      fx: { foam: '#fbf7ea', bubbles: 3, liquid: '#f2ead0', dur: 6 }, tempo: 'fast', code: 'VOLCANO', hint: 'Two things from the kitchen: one sour, one powdery.' }),
  R({ id: 'acidfizz', name: 'Acid fizz', type: 'gas', mix: [['hcl', 'hno3'], ['bicarb', 'na2co3']], makes: ['brine', 'co2'],
      eq: 'NaHCO₃ + HCl → NaCl + H₂O + CO₂',
      what: 'Much faster bubbling than vinegar. A strong acid hands over all its hydrogen ions at once.',
      why: 'Antacid tablets do the same job in your stomach: carbonate cancels stomach acid and you burp the carbon dioxide.',
      fx: { bubbles: 4, foam: '#ffffff', dur: 4 }, tempo: 'fast', code: 'ANTACID', hint: 'A strong acid meets something from the baking cupboard.' }),
  R({ id: 'zinchcl', name: 'Zinc in acid', type: 'gas', mix: [['zinc'], ['hcl']], makes: ['zncl2', 'h2gas'],
      eq: 'Zn + 2HCl → ZnCl₂ + H₂',
      what: 'Steady bubbles stream off the zinc. Zinc atoms give electrons to hydrogen ions, which pair up as hydrogen gas.',
      why: 'Zinc is above hydrogen in the reactivity series, so it can push hydrogen out of the acid.',
      fx: { bubbles: 2, dissolve: 1, liquid: '#eef3f5', dur: 6 }, tempo: 'medium', code: 'ZINCFIZZ', hint: 'A grey metal from the school lab, in acid.' }),
  R({ id: 'mghcl', name: 'Magnesium in acid', type: 'gas', mix: [['mg'], ['hcl']], makes: ['mgcl2', 'h2gas'],
      eq: 'Mg + 2HCl → MgCl₂ + H₂',
      what: 'Furious fizzing, and the ribbon disappears in seconds. The beaker gets hot.',
      why: 'Magnesium is higher in the reactivity series than zinc, so it reacts faster.',
      fx: { bubbles: 5, dissolve: 1, heat: 1, liquid: '#eef3f5', dur: 4 }, tempo: 'fast', code: 'MAGFIZZ', hint: 'A light metal ribbon, in acid.' }),
  R({ id: 'fehcl', name: 'Iron in acid', type: 'gas', mix: [['iron'], ['hcl']], makes: ['fecl2', 'h2gas'],
      eq: 'Fe + 2HCl → FeCl₂ + H₂',
      what: 'Slow, lazy bubbles, and the acid slowly turns pale green.',
      why: 'Iron is only just above hydrogen in the reactivity series. The green is iron(II) ions.',
      fx: { bubbles: 1, liquid: '#cfe7c8', dur: 6 }, tempo: 'slow', code: 'IRONFIZZ', hint: 'A nail in a strong acid.' }),

  // precipitates
  R({ id: 'agcl', name: 'White cloud', type: 'precip', mix: [['agno3'], ['salt', 'brine', 'hcl', 'kcl', 'cacl2', 'licl', 'srcl2', 'bacl2', 'fecl3', 'zncl2', 'mgcl2']], makes: ['agcl', 'nano3'],
      eq: 'AgNO₃ + NaCl → AgCl↓ + NaNO₃',
      what: 'A milky white solid forms instantly. Silver ions and chloride ions grab each other and drop out of the solution.',
      why: 'Silver chloride is about a million times less soluble than table salt. This is the standard lab test for chloride.',
      fx: { precip: '#ffffff', liquid: '#f1f3f6', dur: 5 }, tempo: 'slow', code: 'SILVERCLOUD', hint: 'Silver meets any chloride.' }),
  R({ id: 'pbi2', name: 'Golden rain', type: 'precip', mix: [['pbno3'], ['ki']], makes: ['pbi2', 'kno3'],
      eq: 'Pb(NO₃)₂ + 2KI → PbI₂↓ + 2KNO₃',
      what: 'Two clear liquids make a dazzling yellow solid. Warm it and let it cool, and it reforms as glittering golden flakes.',
      why: 'Lead iodide absorbs blue and violet light (shorter than about 530 nm), so it reflects yellow.',
      fx: { precip: '#ffd21f', glitter: '#ffe066', liquid: '#fff6c8', dur: 6 }, tempo: 'medium', code: 'GOLDENRAIN', hint: 'Lead meets iodide.' }),
  R({ id: 'agi', name: 'Pale yellow', type: 'precip', mix: [['agno3'], ['ki']], makes: ['agi', 'kno3'],
      eq: 'AgNO₃ + KI → AgI↓ + KNO₃',
      what: 'A creamy yellow solid. Silver iodide is even less soluble than silver chloride.',
      why: 'Chloride gives white, bromide cream, iodide yellow: chemists use these colours to tell the three apart.',
      fx: { precip: '#f6efb0', liquid: '#f8f6e4', dur: 5 }, tempo: 'slow', code: 'SILVERIODIDE', hint: 'Silver meets iodide.' }),
  R({ id: 'cuoh2', name: 'Blue jelly', type: 'precip', mix: [['cuso4', 'cuno32'], ['naoh', 'naoh_new', 'koh', 'lioh']], makes: ['cuoh2', 'na2so4'],
      eq: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
      what: 'Pale blue clumps form and sink. Copper ions take the hydroxide ions and come out as a solid.',
      why: 'Most metal hydroxides are insoluble, and many of them have their own colour, so this is a quick way to tell metals apart.',
      fx: { precip: '#57b7ff', liquid: '#dcefff', dur: 5 }, tempo: 'medium', code: 'BLUEJELLY', hint: 'Blue copper meets a strong base.' }),
  R({ id: 'feoh3', name: 'Rust flakes', type: 'precip', mix: [['fecl3'], ['naoh', 'naoh_new', 'koh', 'lioh', 'nh3']], makes: ['feoh3', 'brine'],
      eq: 'FeCl₃ + 3NaOH → Fe(OH)₃↓ + 3NaCl',
      what: 'Rust-brown flakes fill the beaker.',
      why: 'Iron(III) hydroxide is close to what rust is made of.',
      fx: { precip: '#9a4a1c', liquid: '#efe2cf', dur: 5 }, tempo: 'slow', code: 'RUSTFLAKES', hint: 'Orange iron meets a base.' }),

  // metal swaps
  R({ id: 'fecu', name: 'Copper-plated nail', type: 'swap', mix: [['iron'], ['cuso4']], makes: ['feso4', 'cumetal'],
      eq: 'Fe + CuSO₄ → FeSO₄ + Cu',
      what: 'The nail grows a red-brown coat of copper while the blue fades to pale green.',
      why: 'Iron is more reactive than copper, so iron atoms give their electrons to copper ions. Copper comes out as metal; iron goes into the water.',
      fx: { coat: '#c4632e', liquid: '#bfe3bf', dur: 7 }, tempo: 'slow', code: 'COPPERNAIL', hint: 'A nail in something blue.' }),
  R({ id: 'zncu', name: 'Blue to clear', type: 'swap', mix: [['zinc'], ['cuso4']], makes: ['znso4', 'cumetal'],
      eq: 'Zn + CuSO₄ → ZnSO₄ + Cu',
      what: 'The blue drains away completely and brown copper builds up on the zinc. The beaker warms up.',
      why: 'Zinc ions are colourless. This same reaction, split into two halves, is the Daniell cell, an early battery.',
      fx: { coat: '#c4632e', liquid: '#eef3f5', heat: 1, dur: 7 }, tempo: 'medium', code: 'BLUETOCLEAR', hint: 'Zinc in something blue.' }),
  R({ id: 'cuag', name: 'Silver tree', type: 'swap', mix: [['copper', 'cumetal'], ['agno3']], makes: ['cuno32', 'agmetal'],
      eq: 'Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag',
      what: 'Sparkling silver branches grow out of the copper wire, and the clear liquid turns blue.',
      why: 'Copper beats silver in the reactivity series. The blue is the copper that went into the water.',
      fx: { crystals: '#eef3f8', liquid: '#2a9df4', dur: 8 }, tempo: 'slow', code: 'SILVERTREE', hint: 'Copper wire in a clear silver solution.' }),

  // complexes
  R({ id: 'cuamm', name: 'Royal blue', type: 'complex', mix: [['cuso4', 'cuno32', 'cuoh2'], ['nh3']], makes: ['cuamm'],
      eq: 'Cu²⁺ + 4NH₃ → [Cu(NH₃)₄]²⁺',
      what: 'The pale blue deepens to an intense royal blue.',
      why: 'Four ammonia molecules bond to each copper ion. That moves its absorption from about 800 nm (red) to about 600 nm (orange), so far more light is absorbed.',
      fx: { liquid: '#2b2fd6', dur: 4 }, tempo: 'slow', code: 'ROYALBLUE', hint: 'Copper meets ammonia.' }),
  R({ id: 'fescn', name: 'Blood red', type: 'complex', mix: [['fecl3'], ['kscn']], makes: ['fescn', 'kcl'],
      eq: 'Fe³⁺ + SCN⁻ → [Fe(SCN)]²⁺',
      what: 'One drop and the beaker turns deep blood red.',
      why: 'The complex absorbs blue-green light near 480 nm. The test is so sensitive it finds iron at a few parts per million.',
      fx: { liquid: '#a3001b', dur: 4 }, tempo: 'slow', code: 'BLOODRED', hint: 'Orange iron meets a colourless potassium salt.' }),

  // breaking down
  R({ id: 'yeast', name: 'Kitchen toothpaste', type: 'catalysis', mix: [['peroxide'], ['yeast']], makes: ['water', 'o2gas'],
      eq: '2H₂O₂ → 2H₂O + O₂   (catalase)',
      what: 'A warm tower of foam climbs out of the beaker. The yeast’s catalase splits peroxide into water and oxygen.',
      why: 'One catalase molecule can break down millions of peroxide molecules every second, and it is not used up.',
      fx: { foam: '#f7efe0', bubbles: 2, heat: 1, dur: 7 }, tempo: 'fast', code: 'KITCHENFOAM', hint: 'Peroxide meets something alive.' }),
  R({ id: 'toothpaste', name: 'Elephant’s toothpaste', type: 'catalysis', mix: [['peroxide'], ['ki']], makes: ['water', 'o2gas'],
      eq: '2H₂O₂ → 2H₂O + O₂   (iodide catalyst)',
      what: 'Foam erupts out of the beaker, tinted yellow-brown by a little iodine.',
      why: 'Iodide ions pass oxygen atoms along from one peroxide molecule to the next and come out unchanged at the end.',
      fx: { foam: '#f2d48a', bubbles: 3, heat: 1, dur: 7 }, tempo: 'fast', code: 'ELEPHANT', hint: 'Peroxide meets iodide.' }),
  R({ id: 'bakeheat', name: 'Heated baking soda', type: 'catalysis', mix: [['heat'], ['bicarb']], makes: ['na2co3', 'steam', 'co2'],
      eq: '2NaHCO₃ → Na₂CO₃ + H₂O + CO₂',
      what: 'The powder hisses and gives off steam and carbon dioxide, leaving washing soda behind.',
      why: 'This is why baking soda works in an oven even without an acid.',
      fx: { gas: '#ffffff', boil: 1, dur: 4 }, tempo: 'medium', code: 'OVENRISE', hint: 'Heat something from the baking cupboard.' }),

  // fire and fury
  R({ id: 'nawater', name: 'Sodium in water', type: 'burn', mix: [['na'], ['water', 'brine', 'naac']], makes: ['naoh_new', 'h2gas'],
      emit: [[589.00, 1], [589.59, 0.55]],
      eq: '2Na + 2H₂O → 2NaOH + H₂',
      what: 'The lump melts into a silver ball and races across the water, fizzing, until it catches fire with a yellow-orange flame.',
      why: 'Sodium gives its outer electron to water so easily that the heat melts the metal and lights the hydrogen. The colour is sodium’s own D lines.',
      fx: { skitter: '#ffb340', flame: '#ffb340', bubbles: 2, dur: 5 }, tempo: 'fast', code: 'SODIUMRUN', hint: 'An alkali metal in water.' }),
  R({ id: 'kwater', name: 'Potassium in water', type: 'burn', mix: [['k'], ['water', 'brine', 'naac']], makes: ['koh', 'h2gas'],
      emit: [[766.49, 1], [769.90, 0.55], [404.41, 0.3], [404.72, 0.25]],
      eq: '2K + 2H₂O → 2KOH + H₂',
      what: 'Instant lilac flame and crackling. Potassium reacts faster than sodium.',
      why: 'Lilac is not one colour: it is deep red (766 nm) and violet (404 nm) at the same time, the two ends of the rainbow.',
      fx: { skitter: '#c58bff', flame: '#c58bff', sparks: '#e6c7ff', bubbles: 3, dur: 5 }, tempo: 'fast', code: 'LILACFIRE', hint: 'A more reactive alkali metal in water.' }),
  R({ id: 'liwater', name: 'Lithium in water', type: 'burn', mix: [['li'], ['water', 'brine', 'naac']], makes: ['lioh', 'h2gas'],
      eq: '2Li + 2H₂O → 2LiOH + H₂',
      what: 'It floats and fizzes steadily without catching fire.',
      why: 'Lithium is the least reactive alkali metal: its single outer electron is closest to the nucleus and held tightest.',
      fx: { skitter: '#e5e9ee', bubbles: 2, dur: 6 }, tempo: 'medium', code: 'LITHIUMFIZZ', hint: 'The lightest metal, in water.' }),
  R({ id: 'cuhno3', name: 'Brown fumes', type: 'burn', mix: [['copper', 'cumetal'], ['hno3']], makes: ['cuno32', 'no2', 'water'],
      eq: 'Cu + 4HNO₃ → Cu(NO₃)₂ + 2NO₂ + 2H₂O',
      what: 'Choking red-brown gas boils up and the liquid turns green, then blue, as the copper dissolves.',
      why: 'Nitric acid does not attack copper with hydrogen ions (that does not work) but with the nitrate: it takes copper’s electrons and becomes nitrogen dioxide.',
      fx: { gas: '#b5521b', bubbles: 3, dissolve: 1, liquid: '#2a9df4', heat: 1, dur: 7 }, tempo: 'medium', code: 'BROWNFUMES', hint: 'The metal hydrochloric acid could not touch, in a stronger acid.' }),
  R({ id: 'mixgas', name: 'Gas mixture', type: null, mix: [['h2'], ['o2']], makes: ['h2o2mix'], quiet: 1,
      what: 'The gases mix silently. A mixture of hydrogen and oxygen is stable until something lights it.' }),
  R({ id: 'bang', name: 'Hydrogen bang', type: 'burn', mix: [['heat'], ['h2o2mix']], makes: ['water'],
      emit: [[306.36, 1, 'OH band'], [308.90, 0.6, 'OH band'], [281.13, 0.3, 'OH band']],
      eq: '2H₂ + O₂ → 2H₂O',
      what: 'A sharp bang and a puff of water droplets. The flame was almost invisible.',
      why: 'Hydrogen burns with OH molecules glowing in the ultraviolet, near 306 nm, which our eyes cannot see. Rockets on the Space Shuttle burned exactly this.',
      fx: { flash: '#d9ecff', shock: 1, gas: '#ffffff', dur: 3 }, tempo: 'fast', code: 'HYDROGENBANG', hint: 'Two gases from the advanced shelf, then heat.' }),
  R({ id: 'mgburn', name: 'Burning magnesium', type: 'burn', mix: [['heat'], ['mg']], makes: ['mgo'],
      emit: [[518.36, 1], [517.27, 0.7], [516.73, 0.5], [285.21, 0.8], [500.0, 0.4, 'MgO band'], [450, 0.3, 'white-hot glow'], [600, 0.3, 'white-hot glow'], [680, 0.25, 'white-hot glow']],
      eq: '2Mg + O₂ → 2MgO',
      what: 'A blinding white light, and a crumbly white ash left behind.',
      why: 'The flame is about 3,100 °C, hot enough to glow at every colour at once, on top of magnesium’s own green lines. Old camera flashes used it.',
      fx: { flash: '#ffffff', flame: '#ffffff', sparks: '#ffffff', glow: '#ffffff', smoke: '#ffffff', dur: 5 }, tempo: 'fast', code: 'WHITEFIRE', hint: 'Light the ribbon.' }),
  R({ id: 'thermmix', name: 'Thermite mix', type: null, mix: [['rust'], ['al']], makes: ['thermix'], quiet: 1,
      what: 'Rust and aluminium powder, stirred together. It looks harmless. It needs something very hot to start it.' }),
  R({ id: 'thermite', name: 'Thermite', type: 'burn', mix: [['heat'], ['thermix']], makes: ['al2o3', 'femolten'],
      emit: [[438.35, 0.4], [396.15, 0.4], [500, 0.5, 'white-hot glow'], [580, 0.7, 'white-hot glow'], [660, 0.9, 'white-hot glow'], [740, 1, 'white-hot glow']],
      eq: 'Fe₂O₃ + 2Al → Al₂O₃ + 2Fe',
      what: 'A fountain of sparks, then a pool of white-hot molten iron.',
      why: 'Aluminium holds oxygen far more tightly than iron, so it rips the oxygen out of rust. Railway workers use it to weld rails together. Its glow is strongest towards red, the way a hot stove ring glows.',
      fx: { flash: '#ffd27a', flame: '#ffb347', sparks: '#ffcf6b', glow: '#ff9a3c', molten: '#ffb347', dur: 7 }, tempo: 'fast', code: 'THERMITE', hint: 'Rust plus a metal powder, then fire.' }),
  R({ id: 'snake', name: 'Black snake', type: 'burn', mix: [['sugar'], ['h2so4']], makes: ['carbon', 'steam', 'so2'],
      eq: 'C₁₂H₂₂O₁₁ → 12C + 11H₂O   (acid removes the water)',
      what: 'The sugar turns yellow, brown, then black, and a steaming column of carbon rises out of the beaker.',
      why: 'Sulfuric acid pulls the hydrogen and oxygen out of sugar as water. The heat turns that water to steam, which puffs the leftover carbon up into a tower.',
      fx: { snake: '#141210', gas: '#ffffff', heat: 1, dur: 8 }, tempo: 'slow', code: 'BLACKSNAKE', hint: 'Something sweet meets the strongest acid on the shelf.' }),

  // light
  R({ id: 'luminol1', name: 'Luminol mix', type: null, mix: [['luminol'], ['peroxide']], makes: ['lumimix'], quiet: 1,
      what: 'Nothing visible yet. Luminol and peroxide react only very slowly on their own: they need a catalyst.' }),
  R({ id: 'glow', name: 'Blue glow', type: 'light', mix: [['lumimix'], ['cuso4', 'fecl3', 'cuno32']], makes: ['water'],
      emit: [[405, 0.45, 'luminol glow'], [425, 1, 'luminol glow'], [445, 0.7, 'luminol glow'], [470, 0.3, 'luminol glow']],
      eq: 'luminol + H₂O₂ → 3-aminophthalate* → 3-aminophthalate + light',
      what: 'The lights dim and the beaker glows an eerie blue.',
      why: 'The metal ions speed up the oxidation. The product is born with extra energy and lets it go as blue light peaking near 425 nm. Iron in blood does the same job, which is how forensic teams find it.',
      fx: { glow: '#3f7bff', liquid: '#7aa6ff', dark: 1, dur: 9 }, tempo: 'slow', code: 'BLUEGLOW', hint: 'Mix the light-maker with peroxide, then add a metal catalyst.' })
];

// flame tests: hold any salt of these metals in the burner. emit is the light that colours the flame.
const FLAMES = {
  Na: { name: 'Sodium flame', colour: 'yellow-orange', flame: '#ffb12e', emit: [[589.00, 1], [589.59, 0.55]],
        why: 'Sodium’s two D lines are so bright that a few grains turn a whole flame orange. The two lines are 0.6 nm apart; as sound they are about half a hertz apart, so you hear them beat slowly.' },
  Li: { name: 'Lithium flame', colour: 'crimson', flame: '#ff2a4d', emit: [[670.78, 1], [610.36, 0.25]],
        why: 'Almost all of the light is one line at 670.8 nm, deep red.' },
  K:  { name: 'Potassium flame', colour: 'lilac', flame: '#c58bff', emit: [[766.49, 1], [769.90, 0.55], [404.41, 0.3], [404.72, 0.25]],
        why: 'Deep red plus violet makes lilac. It is faint, and a little sodium hides it, so chemists look through blue cobalt glass.' },
  Ca: { name: 'Calcium flame', colour: 'orange-red', flame: '#ff6a2a', emit: [[422.67, 0.5], [554, 0.6, 'CaOH band'], [622, 1, 'CaOH band']],
        why: 'The brick-red colour comes mostly from CaOH molecules formed in the flame, with bands near 554 and 622 nm.' },
  Sr: { name: 'Strontium flame', colour: 'red', flame: '#ff1e3c', emit: [[460.73, 0.4], [606, 0.8, 'SrOH band'], [682, 1, 'SrOH band']],
        why: 'The red comes from SrOH molecules glowing near 606 and 682 nm. Red fireworks use strontium.' },
  Ba: { name: 'Barium flame', colour: 'pale green', flame: '#b4ff5a', emit: [[553.55, 1], [524, 0.6, 'BaOH band'], [513, 0.5, 'BaOH band']],
        why: 'The green is barium’s 553.5 nm line plus bands from barium molecules. Green fireworks use barium.' },
  Cu: { name: 'Copper flame', colour: 'green-blue', flame: '#2affb2', emit: [[521.82, 1], [515.32, 0.8], [510.55, 0.6]],
        why: 'Three green copper lines between 510 and 522 nm. With chloride present, blue CuCl bands join in.' }
};
for (const m in FLAMES) {
  const f = FLAMES[m];
  REACTIONS.push({ id: 'flame' + m, name: f.name, type: 'flame', flameOf: m, emit: f.emit,
    eq: m + ' atoms, heated: electrons jump up, fall back, give off light',
    what: 'The flame turns ' + f.colour + '.', why: f.why,
    fx: { burner: f.flame, dur: 5 }, tempo: 'medium', code: ELEMENTS[m].name.toUpperCase() + 'FLAME',
    hint: 'Hold a ' + ELEMENTS[m].name.toLowerCase() + ' compound in the flame.' });
}

// things that meet and do not react, and why. Matched like reactions; no coins, but they show up in the Codex.
const NOTHING = [
  { id: 'cuhcl', mix: [['copper', 'cumetal'], ['hcl', 'vinegar']], name: 'Copper in acid',
    why: 'Nothing happens. Copper is below hydrogen in the reactivity series, so it cannot push hydrogen out of an acid.' },
  { id: 'agcu', mix: [['agmetal'], ['cuso4', 'cuno32']], name: 'Silver in copper',
    why: 'Nothing happens. Silver is less reactive than copper, so it cannot take copper’s place.' },
  { id: 'saltwater', mix: [['salt', 'kcl', 'cacl2', 'licl', 'srcl2', 'bacl2', 'sugar'], ['water']], name: 'Dissolving',
    why: 'It dissolves, but no new substance forms. That is a physical change, not a chemical reaction: boil the water off and you get the solid back.' },
  { id: 'phacid', mix: [['phph'], ['hcl', 'vinegar', 'water', 'hno3']], name: 'Phenolphthalein in acid',
    why: 'Still colourless. Phenolphthalein only changes colour above about pH 8.2.' },
  { id: 'vinsalt', mix: [['vinegar'], ['salt']], name: 'Vinegar and salt',
    why: 'Nothing new. Acetic acid is weaker than the acid that chloride comes from, so no swap happens.' },
  { id: 'boil', mix: [['heat'], ['water', 'brine', 'vinegar']], name: 'Boiling',
    why: 'It boils. Water turning to steam is still H₂O, so this is a physical change.' },
  { id: 'peroxwater', mix: [['peroxide'], ['water']], name: 'Diluting peroxide',
    why: 'It just gets weaker. Peroxide breaks down very slowly without a catalyst.' },
  { id: 'feag', mix: [['iron'], ['water']], name: 'Iron in water',
    why: 'Nothing you can see today. With oxygen and weeks of time, iron and water make rust.' }
];

const TIERS = [
  { name: 'Kitchen', need: 0 },
  { name: 'School lab', need: 3 },
  { name: 'Advanced lab', need: 10 }
];

const API = { ELEMENTS, SUBSTANCES, BY_ID, TYPES, REACTIONS, NOTHING, FLAMES, TIERS };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CC_DATA = API;
})(typeof window !== 'undefined' ? window : globalThis);
