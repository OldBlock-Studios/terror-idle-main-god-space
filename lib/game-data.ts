// ═══════════════════════════════════════════════════════════════════
//  TERROR INFINITO — GAME DATA
//  Inspired by: Clicker Heroes, Cookie Clicker, Adventure Capitalist,
//  Tap Titans 2, Antimatter Dimensions + Infinite Horror (无限恐怖)
// ═══════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────
//  INTERFACES
// ────────────────────────────────────────────────────────────────────

export interface World {
  id: string
  name: string
  desc: string
  color: string
  mobs: string[]
  boss: string
  tier: number          // multiplier exponent for monster HP
}

export interface Hero {
  id: string
  name: string
  desc: string
  baseCost: number
  costMult: number      // 1.07–1.15
  baseDps: number       // 0 for Portador
  baseClick: number     // 0 for non-clickers
  unlockZone: number
}

export interface Upgrade {
  id: string
  name: string
  desc: string
  cost: number
  heroId: string        // hero id or "global"
  reqLevel: number      // 0 if global
  type: "dps" | "click" | "global"
  mult: number
}

export interface Achievement {
  id: string
  name: string
  desc: string
  condition: {
    type: "totalKills" | "totalClicks" | "zone" | "cycles" | "combo" | "bossKills" | "transcends"
    value: number
  }
}

export interface Ancient {
  id: string
  name: string
  desc: string
  baseCost: number
  costMult: number
  maxLevel: number
  effectDesc: string    // human-readable per level
}

export interface Dimension {
  id: string
  name: string
  desc: string
  cost: number          // in genes
  unlockCycles: number  // cycles needed
  baseMult: number      // DPS multiplier per purchase
}

export interface ShopItem {
  id: string
  name: string
  desc: string
  cost: number
  currency: "rank" | "gene" | "void"
  ppcBonus: number
  dpsBonus: number
  special: "autoclicker1" | "autoclicker5" | "autoprogress" | "none"
}

export interface ChallengeRun {
  id: string
  name: string
  desc: string
  restriction: string
  rewardDesc: string
  rewardType: "mult_click" | "mult_dps" | "mult_rp" | "extra_souls"
  rewardValue: number
}

export interface Bloodline {
  id: string
  name: string
  desc: string
  costVoid: number
  effectDesc: string
  effectType: "click_pct" | "dps_pct" | "rp_pct" | "souls_pct" | "offline_pct" | "crit_chance" | "crit_mult"
  effectValue: number
}

export interface Formation {
  id: string
  name: string
  heroes: string[]      // hero IDs that form the combo
  desc: string
  dpsBonus: number      // percentage multiplier
}

export interface BestiaryEntry {
  monsterId: string     // key = world.id + "_" + zone style
  name: string
  kills: number
}

export interface GameState {
  // ── Currencies
  rp: number
  rpTotal: number       // this cycle
  rpAllTime: number
  souls: number
  gene: number
  rank: number
  voidEssence: number

  // ── Progress
  zone: number
  highZone: number
  highZoneAllTime: number
  worldIndex: number

  // ── Active monster
  monster: {
    hp: number
    maxHp: number
    reward: number
    name: string
    type: "normal" | "boss" | "megaboss"
  }

  // ── Owned items  (Sets serialised as arrays)
  heroLevels: Record<string, number>
  heroDpsMults: Record<string, number>
  heroClickMults: Record<string, number>
  upgradeBought: Set<string>
  ancientLevels: Record<string, number>
  dimensionLevels: Record<string, number>
  shopBought: Set<string>
  achievementsDone: Set<string>
  bloodlinesOwned: Set<string>
  challengesDone: Set<string>

  // ── Bestiary
  bestiary: Record<string, number>   // mobKey -> kill count

  // ── Calculated (refreshed every tick)
  dps: number
  ppc: number

  // ── Combo
  combo: number
  maxCombo: number
  lastClickTime: number

  // ── Multipliers
  clickBoost: number
  tempMult: number
  transcendMult: number

  // ── Shop bonuses (flat)
  shopPpc: number
  shopDps: number
  autoClickerActive: boolean   // 1/s
  autoClickerFast: boolean     // 5/s
  autoProgressActive: boolean

  // ── Zone progression (Clicker Heroes style)
  activeChallengeId: string | null
  progressionMode: "pushing" | "farming"   // pushing = tentando avançar, farming = zona travada
  farmZone: number                          // zona onde está farmando (última segura)
  bossTimerStart: number                    // timestamp ms quando boss foi ativado
  bossTimerLimit: number                    // segundos para matar o boss
  bossActive: boolean                       // está num boss fight agora?
  bossFailCount: number                     // quantas vezes falhou o boss atual

  // ── Active horror event
  activeEvent: HorrorEvent | null
  eventEndsAt: number        // timestamp ms
  eventMult: number          // current event multiplier

  // ── Blessings (active after transcend picks)
  blessingsActive: Set<string>
  blessingComboFloor: number
  blessingOfflineMult: number
  blessingHorrorAffinity: number
  blessingAncientDiscount: number
  blessingBossSouls: number
  blessingMinCritMult: number

  // ── Notoriety
  notoriety: number          // increases as zone grows; harder mobs, bigger rewards
  notorietyMult: number      // damage/reward multiplier from notoriety

  // ── Bloodline permanent bonuses (summed on tick)
  bloodlineDpsPct: number
  bloodlineClickPct: number
  bloodlineRpPct: number
  bloodlineSoulsPct: number
  bloodlineOfflinePct: number
  bloodlineCritChance: number
  bloodlineCritMult: number

  // ── Lifetime
  totalClicks: number
  totalKills: number
  bossKills: number
  cycles: number
  transcends: number

  // ── Time
  playTime: number
  startTime: number
}

// ────────────────────────────────────────────────────────────────────
//  WORLDS
// ────────────────────────────────────────────────────────────────────

export const WORLDS: World[] = [
  {
    id: "w1", name: "Resident Evil", color: "#ef4444",
    desc: "Raccoon City — Sobreviva ao apocalipse zumbi",
    mobs: ["Zumbi Lento", "Zumbi Rastejante", "Licker", "Cão Zumbi", "Crimson Head"],
    boss: "Nemesis T-Type", tier: 1,
  },
  {
    id: "w2", name: "Alien", color: "#22c55e",
    desc: "LV-426 — Ninguém pode ouvir você gritar",
    mobs: ["Facehugger", "Chestburster", "Xenomorfo Drone", "Xenomorfo Guerreiro", "Praetorian"],
    boss: "Rainha Xenomorfa", tier: 2,
  },
  {
    id: "w3", name: "Silent Hill", color: "#a3a370",
    desc: "Fog World — Enfrente seus demônios internos",
    mobs: ["Nurse", "Lying Figure", "Mannequin", "Grey Child", "Air Screamer"],
    boss: "Pyramid Head", tier: 3,
  },
  {
    id: "w4", name: "Dead Space", color: "#b45309",
    desc: "USG Ishimura — Corte os membros",
    mobs: ["Slasher", "Lurker", "Infector", "Divider", "Brute"],
    boss: "Hive Mind", tier: 4,
  },
  {
    id: "w5", name: "Attack on Titan", color: "#ea580c",
    desc: "Paradis — Os muros caíram",
    mobs: ["Titan Puro 5m", "Titan Puro 10m", "Titan Anormal", "Titan 15m", "Titan Saltador"],
    boss: "Titan Colossal", tier: 5,
  },
  {
    id: "w6", name: "Evangelion", color: "#9333ea",
    desc: "NERV HQ — Os Anjos atacam",
    mobs: ["Sachiel", "Shamshel", "Ramiel", "Gaghiel", "Israfel"],
    boss: "Zeruel", tier: 6,
  },
  {
    id: "w7", name: "Jujutsu Kaisen", color: "#7c3aed",
    desc: "Shibuya — O incidente começou",
    mobs: ["Maldição Grau 4", "Maldição Grau 3", "Maldição Grau 2", "Maldição Grau 1", "Maldição Especial"],
    boss: "Ryomen Sukuna", tier: 7,
  },
  {
    id: "w8", name: "Dark Souls", color: "#f97316",
    desc: "Lothric — Prepare para morrer",
    mobs: ["Hollow Soldier", "Silver Knight", "Black Knight", "Darkwraith", "Balder Knight"],
    boss: "Soul of Cinder", tier: 8,
  },
  {
    id: "w9", name: "Bloodborne", color: "#c026d3",
    desc: "Yharnam — A Noite da Caçada",
    mobs: ["Beast Patient", "Church Giant", "Brainsucker", "Winter Lantern", "Nightmare Apostle"],
    boss: "Moon Presence", tier: 9,
  },
  {
    id: "w10", name: "Cthulhu Mythos", color: "#059669",
    desc: "R'lyeh — Ph'nglui mglw'nafh Cthulhu",
    mobs: ["Deep One", "Shoggoth", "Mi-Go", "Byakhee", "Star Spawn"],
    boss: "Cthulhu Desperto", tier: 10,
  },
  {
    id: "w11", name: "SCP Foundation", color: "#475569",
    desc: "Site-19 — Seguro. Conter. Proteger.",
    mobs: ["SCP-173", "SCP-096", "SCP-939", "SCP-049-2", "SCP-035 Host"],
    boss: "SCP-682", tier: 11,
  },
  {
    id: "w12", name: "Main God Space", color: "#d97706",
    desc: "无限恐怖 — O Espaco do Deus Principal",
    mobs: ["Portador Renegado", "Clone Demonico", "Entidade do Ciclo", "Guardiao do Reset"],
    boss: "O Deus Principal", tier: 12,
  },
]

// ────────────────────────────────────────────────────────────────────
//  HEROES
// ────────────────────────────────────────────────────────────────────

export const HEROES: Hero[] = [
  { id: "h0",  name: "Portador",          desc: "Voce, o escolhido pelo Deus Principal",         baseCost: 5,       costMult: 1.07, baseDps: 0,       baseClick: 1,    unlockZone: 1   },
  { id: "h1",  name: "Zumbi Aliado",      desc: "Um zumbi domesticado que luta ao seu lado",     baseCost: 10,      costMult: 1.15, baseDps: 1,       baseClick: 0,    unlockZone: 1   },
  { id: "h2",  name: "Alma Penada",       desc: "Espirito atormentado buscando vinganca",         baseCost: 100,     costMult: 1.15, baseDps: 8,       baseClick: 0,    unlockZone: 5   },
  { id: "h3",  name: "Demonio Menor",     desc: "Criatura do abismo com sede de sangue",          baseCost: 1100,    costMult: 1.14, baseDps: 47,      baseClick: 0,    unlockZone: 15  },
  { id: "h4",  name: "Vampiro Noturno",   desc: "Senhor da noite, eterno e mortal",               baseCost: 12000,   costMult: 1.14, baseDps: 260,     baseClick: 0,    unlockZone: 30  },
  { id: "h5",  name: "Lobisomem Alpha",   desc: "Lider da matilha amaldico3ada",                  baseCost: 130000,  costMult: 1.13, baseDps: 1400,    baseClick: 0,    unlockZone: 50  },
  { id: "h6",  name: "Bruxa das Trevas",  desc: "Mestre das artes proibidas",                     baseCost: 1.4e6,   costMult: 1.13, baseDps: 7800,    baseClick: 0,    unlockZone: 75  },
  { id: "h7",  name: "Cavaleiro da Morte",desc: "Guerreiro imortal alem da vida",                 baseCost: 20e6,    costMult: 1.12, baseDps: 44000,   baseClick: 0,    unlockZone: 100 },
  { id: "h8",  name: "Dragao Corrompido", desc: "Besta antiga consumida pela escuridao",          baseCost: 330e6,   costMult: 1.12, baseDps: 260000,  baseClick: 0,    unlockZone: 140 },
  { id: "h9",  name: "Anjo Caido",        desc: "Serafim banido do paraiso",                      baseCost: 5.1e9,   costMult: 1.11, baseDps: 1.6e6,   baseClick: 0,    unlockZone: 180 },
  { id: "h10", name: "Ita Ancestral",     desc: "Gigante dos tempos primordiais",                 baseCost: 75e9,    costMult: 1.11, baseDps: 10e6,    baseClick: 0,    unlockZone: 230 },
  { id: "h11", name: "Entidade do Vazio", desc: "Ser de pura escuridao cosmica",                  baseCost: 1e12,    costMult: 1.1,  baseDps: 65e6,    baseClick: 0,    unlockZone: 280 },
  { id: "h12", name: "Deus Menor",        desc: "Fragmento de divindade",                         baseCost: 14e12,   costMult: 1.1,  baseDps: 430e6,   baseClick: 0,    unlockZone: 340 },
  { id: "h13", name: "Conceito Vivo",     desc: "Manifestacao de uma ideia primordial",           baseCost: 170e12,  costMult: 1.09, baseDps: 2.9e9,   baseClick: 0,    unlockZone: 400 },
  { id: "h14", name: "Criador de Mundos", desc: "Arquiteto de realidades",                        baseCost: 2.1e15,  costMult: 1.09, baseDps: 21e9,    baseClick: 0,    unlockZone: 475 },
  { id: "h15", name: "Main God Clone",    desc: "Fragmento do proprio Deus Principal",            baseCost: 26e15,   costMult: 1.08, baseDps: 150e9,   baseClick: 0,    unlockZone: 550 },
]

// ────────────────────────────────────────────────────────────────────
//  UPGRADES
// ────────────────────────────────────────────────────────────────────

export const UPGRADES: Upgrade[] = [
  // Portador (click)
  { id: "u1",  name: "Punho de Ferro",        desc: "x2 dano de clique",              cost: 100,     heroId: "h0",     reqLevel: 10,  type: "click",  mult: 2  },
  { id: "u2",  name: "Furia Interior",         desc: "x3 dano de clique",              cost: 500,     heroId: "h0",     reqLevel: 25,  type: "click",  mult: 3  },
  { id: "u3",  name: "Poder Divino",           desc: "x5 dano de clique",              cost: 2500,    heroId: "h0",     reqLevel: 50,  type: "click",  mult: 5  },
  { id: "u4",  name: "Tocado pelo Vazio",      desc: "x10 dano de clique",             cost: 20000,   heroId: "h0",     reqLevel: 100, type: "click",  mult: 10 },
  // Zumbi
  { id: "u5",  name: "Horda Zumbi",            desc: "x2 DPS do Zumbi Aliado",         cost: 50,      heroId: "h1",     reqLevel: 10,  type: "dps",    mult: 2  },
  { id: "u6",  name: "Infeccao Total",         desc: "x4 DPS do Zumbi Aliado",         cost: 2000,    heroId: "h1",     reqLevel: 50,  type: "dps",    mult: 4  },
  // Alma
  { id: "u7",  name: "Toque Espectral",        desc: "x2 DPS da Alma Penada",          cost: 500,     heroId: "h2",     reqLevel: 10,  type: "dps",    mult: 2  },
  { id: "u8",  name: "Grito da Morte",         desc: "x4 DPS da Alma Penada",          cost: 20000,   heroId: "h2",     reqLevel: 50,  type: "dps",    mult: 4  },
  // Demonio
  { id: "u9",  name: "Fogo Infernal",          desc: "x2 DPS do Demonio Menor",        cost: 5000,    heroId: "h3",     reqLevel: 10,  type: "dps",    mult: 2  },
  { id: "u10", name: "Chamas do Abismo",       desc: "x4 DPS do Demonio Menor",        cost: 200000,  heroId: "h3",     reqLevel: 50,  type: "dps",    mult: 4  },
  // Vampiro
  { id: "u11", name: "Sede de Sangue",         desc: "x2 DPS do Vampiro",              cost: 50000,   heroId: "h4",     reqLevel: 10,  type: "dps",    mult: 2  },
  { id: "u12", name: "Pacto das Trevas",       desc: "x4 DPS do Vampiro",              cost: 2e6,     heroId: "h4",     reqLevel: 50,  type: "dps",    mult: 4  },
  // Lobisomem
  { id: "u13", name: "Frenesi",                desc: "x2 DPS do Lobisomem",            cost: 500000,  heroId: "h5",     reqLevel: 10,  type: "dps",    mult: 2  },
  // Global
  { id: "u14", name: "Sinergia Sombria",       desc: "x2 DPS de todos os herois",      cost: 10000,   heroId: "global", reqLevel: 0,   type: "global", mult: 2  },
  { id: "u15", name: "Forca Cosmica",          desc: "x3 DPS de todos os herois",      cost: 100000,  heroId: "global", reqLevel: 0,   type: "global", mult: 3  },
  { id: "u16", name: "Convergencia do Horror", desc: "x5 DPS de todos os herois",      cost: 1e6,     heroId: "global", reqLevel: 0,   type: "global", mult: 5  },
  { id: "u17", name: "Poder do Deus Principal",desc: "x10 DPS de todos os herois",     cost: 10e6,    heroId: "global", reqLevel: 0,   type: "global", mult: 10 },
  { id: "u18", name: "Transcendencia Global",  desc: "x25 DPS de todos os herois",     cost: 100e6,   heroId: "global", reqLevel: 0,   type: "global", mult: 25 },
]

// ────────────────────────────────────────────────────────────────────
//  ACHIEVEMENTS
// ────────────────────────────────────────────────────────────────────

export const ACHIEVEMENTS: Achievement[] = [
  { id: "ach1",  name: "Primeiro Sangue",    desc: "Mate 1 inimigo",           condition: { type: "totalKills",   value: 1       } },
  { id: "ach2",  name: "Cacador Iniciante",  desc: "Mate 100 inimigos",        condition: { type: "totalKills",   value: 100     } },
  { id: "ach3",  name: "Exterminador",       desc: "Mate 1.000 inimigos",      condition: { type: "totalKills",   value: 1000    } },
  { id: "ach4",  name: "Aniquilador",        desc: "Mate 10.000 inimigos",     condition: { type: "totalKills",   value: 10000   } },
  { id: "ach5",  name: "Genocida",           desc: "Mate 100.000 inimigos",    condition: { type: "totalKills",   value: 100000  } },
  { id: "ach6",  name: "Clicador",           desc: "Clique 100 vezes",         condition: { type: "totalClicks",  value: 100     } },
  { id: "ach7",  name: "Dedos Rapidos",      desc: "Clique 1.000 vezes",       condition: { type: "totalClicks",  value: 1000    } },
  { id: "ach8",  name: "Mestre do Clique",   desc: "Clique 10.000 vezes",      condition: { type: "totalClicks",  value: 10000   } },
  { id: "ach9",  name: "Dedo Divino",        desc: "Clique 100.000 vezes",     condition: { type: "totalClicks",  value: 100000  } },
  { id: "ach10", name: "Explorador",         desc: "Chegue na zona 10",        condition: { type: "zone",         value: 10      } },
  { id: "ach11", name: "Aventureiro",        desc: "Chegue na zona 50",        condition: { type: "zone",         value: 50      } },
  { id: "ach12", name: "Veterano",           desc: "Chegue na zona 100",       condition: { type: "zone",         value: 100     } },
  { id: "ach13", name: "Lenda",              desc: "Chegue na zona 500",       condition: { type: "zone",         value: 500     } },
  { id: "ach14", name: "Mito",               desc: "Chegue na zona 1000",      condition: { type: "zone",         value: 1000    } },
  { id: "ach15", name: "Renascido",          desc: "Faca 1 prestigio",         condition: { type: "cycles",       value: 1       } },
  { id: "ach16", name: "Ciclo Eterno",       desc: "Faca 10 prestigios",       condition: { type: "cycles",       value: 10      } },
  { id: "ach17", name: "Mestre do Loop",     desc: "Faca 50 prestigios",       condition: { type: "cycles",       value: 50      } },
  { id: "ach18", name: "Combo x10",          desc: "Alcance combo de 10",      condition: { type: "combo",        value: 10      } },
  { id: "ach19", name: "Combo x50",          desc: "Alcance combo de 50",      condition: { type: "combo",        value: 50      } },
  { id: "ach20", name: "Combo x100",         desc: "Alcance combo de 100",     condition: { type: "combo",        value: 100     } },
  { id: "ach21", name: "Caca-Chefes",        desc: "Mate 10 bosses",           condition: { type: "bossKills",    value: 10      } },
  { id: "ach22", name: "Matador de Titans",  desc: "Mate 100 bosses",          condition: { type: "bossKills",    value: 100     } },
  { id: "ach23", name: "Deicida",            desc: "Mate 500 bosses",          condition: { type: "bossKills",    value: 500     } },
  { id: "ach24", name: "Alem do Limite",     desc: "Transenda 1 vez",          condition: { type: "transcends",   value: 1       } },
  { id: "ach25", name: "Eterno",             desc: "Transenda 5 vezes",        condition: { type: "transcends",   value: 5       } },
]

// ────────────────────────────────────────────────────────────────────
//  ANCIENTS   (bought with souls)
// ────────────────────────────────────────────────────────────────────

export const ANCIENTS: Ancient[] = [
  // ── Classic set
  { id: "siya",  name: "Siyalatas",          desc: "+25% DPS quando idle (sem clicar)",              baseCost: 1,  costMult: 1.50, maxLevel: 50,   effectDesc: "+25% DPS idle por nivel"        },
  { id: "lib",   name: "Libertas",           desc: "+15% RP enquanto idle",                          baseCost: 1,  costMult: 1.50, maxLevel: 50,   effectDesc: "+15% RP idle por nivel"         },
  { id: "mamm",  name: "Mammon",             desc: "+10% todo RP recebido",                          baseCost: 2,  costMult: 1.60, maxLevel: 40,   effectDesc: "+10% RP por nivel"              },
  { id: "dora",  name: "Dora",               desc: "+35% RP de bosses",                              baseCost: 2,  costMult: 1.60, maxLevel: 40,   effectDesc: "+35% RP boss por nivel"         },
  { id: "arg",   name: "Argaiv",             desc: "+20% dano de clique por nivel",                  baseCost: 3,  costMult: 1.70, maxLevel: 35,   effectDesc: "+20% clique por nivel"          },
  { id: "frag",  name: "Fragsworth",         desc: "+30% multiplicador critico por nivel",            baseCost: 3,  costMult: 1.70, maxLevel: 35,   effectDesc: "+30% crit mult por nivel"       },
  { id: "jugg",  name: "Juggernaut",         desc: "+1% chance de critico por nivel",                baseCost: 5,  costMult: 1.80, maxLevel: 30,   effectDesc: "+1% crit chance por nivel"      },
  { id: "morg",  name: "Morgulis",           desc: "+11% DPS global por nivel (infinito)",           baseCost: 1,  costMult: 1.10, maxLevel: 9999, effectDesc: "+11% DPS por nivel"             },
  { id: "fort",  name: "Fortuna",            desc: "+25% RP de bosses acumulado",                    baseCost: 5,  costMult: 1.90, maxLevel: 25,   effectDesc: "+25% RP boss por nivel"         },
  { id: "chron", name: "Chronos",            desc: "+5s no timer de boss",                           baseCost: 4,  costMult: 1.75, maxLevel: 20,   effectDesc: "+5s timer por nivel"            },
  // ── Infinite Horror themed (from design doc)
  { id: "zheng", name: "Vontade de Zheng Zha",  desc: "+15% dano de clique + maior taxa de combo",  baseCost: 8,  costMult: 1.80, maxLevel: 40,   effectDesc: "+15% clique & combo por nivel"  },
  { id: "chu",   name: "Intelecto de Chu Xuan", desc: "+20% ganhos offline & -5% custo de herois",  baseCost: 6,  costMult: 1.75, maxLevel: 30,   effectDesc: "+20% offline/-5% custo"         },
  { id: "luoli", name: "Obsessao de Luo Li",    desc: "+3% crit chance e +50% crit mult por nivel", baseCost: 10, costMult: 1.90, maxLevel: 20,   effectDesc: "+3% crit/+50% critMult"         },
  { id: "gaze",  name: "Olhar do Deus Principal",desc: "+1% producao global por nivel (pilha com Morgulis)",baseCost:15,costMult:2.00,maxLevel:50, effectDesc: "+1% producao global"            },
  { id: "karma", name: "Karma Weaver",           desc: "5% chance de Plot Twist: x2/x3/x5 RP ao matar", baseCost: 12, costMult: 1.95, maxLevel: 25, effectDesc: "+5% chance de bonus RP"     },
  { id: "terror",name: "Terror Incarnate",       desc: "+40% dano a bosses e +40% recompensa de boss",baseCost: 10, costMult: 1.85, maxLevel: 30, effectDesc: "+40% boss dmg/reward"           },
  { id: "cycle", name: "Cycle Breaker",          desc: "-10% custo de Transcendencia por nivel",    baseCost: 20, costMult: 2.10, maxLevel: 10,   effectDesc: "-10% custo trans por nivel"     },
  { id: "reinc", name: "Reencarnacao Divina",    desc: "+5% de herois retidos apos reset",           baseCost: 15, costMult: 2.00, maxLevel: 10,   effectDesc: "+5% retencao herois"            },
  { id: "negsp", name: "Espaco Negativo",        desc: "+25% dano durante Eventos e Crises",         baseCost: 8,  costMult: 1.80, maxLevel: 20,   effectDesc: "+25% dano em eventos"           },
]

// ────────────────────────────────────────────────────────────────────
//  DIMENSIONS  (bought with genes, unlock after N cycles)
// ────────────────────────────────────────────────────────────────────

export const DIMENSIONS: Dimension[] = [
  { id: "d1", name: "1a Dimensao", desc: "x2 DPS por compra",   cost: 10,    unlockCycles: 1,   baseMult: 2  },
  { id: "d2", name: "2a Dimensao", desc: "x3 DPS por compra",   cost: 100,   unlockCycles: 5,   baseMult: 3  },
  { id: "d3", name: "3a Dimensao", desc: "x4 DPS por compra",   cost: 1000,  unlockCycles: 15,  baseMult: 4  },
  { id: "d4", name: "4a Dimensao", desc: "x5 DPS por compra",   cost: 10000, unlockCycles: 30,  baseMult: 5  },
  { id: "d5", name: "5a Dimensao", desc: "x8 DPS por compra",   cost: 100000,unlockCycles: 50,  baseMult: 8  },
  { id: "d6", name: "6a Dimensao", desc: "x10 DPS por compra",  cost: 1e6,   unlockCycles: 75,  baseMult: 10 },
  { id: "d7", name: "7a Dimensao", desc: "x15 DPS por compra",  cost: 10e6,  unlockCycles: 100, baseMult: 15 },
  { id: "d8", name: "8a Dimensao", desc: "x25 DPS por compra",  cost: 100e6, unlockCycles: 150, baseMult: 25 },
]

// ────────────────────────────────────────────────────────────────────
//  SHOP  (permanent cross-cycle items)
// ────────────────────────────────────────────────────────────────────

export const SHOP_ITEMS: ShopItem[] = [
  { id: "si1",  name: "Luvas de Combate",   desc: "+10 clique",              cost: 1,  currency: "rank", ppcBonus: 10,   dpsBonus: 0,     special: "none"           },
  { id: "si2",  name: "Espada Amaldico3ada",desc: "+50 clique",              cost: 5,  currency: "rank", ppcBonus: 50,   dpsBonus: 0,     special: "none"           },
  { id: "si3",  name: "Grimoiro Sombrio",   desc: "+100 DPS",                cost: 3,  currency: "rank", ppcBonus: 0,    dpsBonus: 100,   special: "none"           },
  { id: "si4",  name: "Servo Espectral",    desc: "+500 DPS",                cost: 10, currency: "rank", ppcBonus: 0,    dpsBonus: 500,   special: "none"           },
  { id: "si5",  name: "Amplificador Gene.",  desc: "+200 clique",             cost: 5,  currency: "gene", ppcBonus: 200,  dpsBonus: 0,     special: "none"           },
  { id: "si6",  name: "Mutacao Avancada",   desc: "+2000 DPS",               cost: 10, currency: "gene", ppcBonus: 0,    dpsBonus: 2000,  special: "none"           },
  { id: "si7",  name: "Fragmento do Vazio", desc: "+1000 clique",            cost: 3,  currency: "void", ppcBonus: 1000, dpsBonus: 0,     special: "none"           },
  { id: "si8",  name: "Essencia Cosmica",   desc: "+10000 DPS",              cost: 5,  currency: "void", ppcBonus: 0,    dpsBonus: 10000, special: "none"           },
  { id: "si9",  name: "Auto-Clicker I",     desc: "1 clique/s automatico",   cost: 20, currency: "rank", ppcBonus: 0,    dpsBonus: 0,     special: "autoclicker1"   },
  { id: "si10", name: "Auto-Clicker V",     desc: "5 cliques/s automaticos", cost: 25, currency: "gene", ppcBonus: 0,    dpsBonus: 0,     special: "autoclicker5"   },
  { id: "si11", name: "Auto-Progresso",     desc: "Avanca zonas automatico", cost: 10, currency: "void", ppcBonus: 0,    dpsBonus: 0,     special: "autoprogress"   },
]

// ────────────────────────────────────────────────────────────────────
//  CHALLENGES
// ────────────────────────────────────────────────────────────────────

export const CHALLENGES: ChallengeRun[] = [
  {
    id: "ch1", name: "Sem Herois",
    desc: "Complete a zona 25 sem comprar nenhum heroi alem do Portador.",
    restriction: "Apenas o Portador pode ser usado.",
    rewardDesc: "+50% dano de clique permanente",
    rewardType: "mult_click", rewardValue: 0.5,
  },
  {
    id: "ch2", name: "Boss Gigante",
    desc: "Derrote um boss com 10x HP na zona 50.",
    restriction: "Boss com 10x HP extra.",
    rewardDesc: "+25% RP de todos os inimigos",
    rewardType: "mult_rp", rewardValue: 0.25,
  },
  {
    id: "ch3", name: "Sem Upgrades",
    desc: "Chegue na zona 30 sem comprar nenhuma melhoria.",
    restriction: "Painel de melhorias bloqueado.",
    rewardDesc: "+100% DPS global",
    rewardType: "mult_dps", rewardValue: 1.0,
  },
  {
    id: "ch4", name: "Modo Hardcore",
    desc: "Chegue na zona 100 com DPS reduzido em 50%.",
    restriction: "DPS x0.5 durante o desafio.",
    rewardDesc: "+2 Almas por boss morto",
    rewardType: "extra_souls", rewardValue: 2,
  },
]

// ────────────────────────────────────────────────────────────────────
//  BLOODLINES  (permanent, cost Void Essence, persist through transcend)
// ────────────────────────────────────────────────────────────────────

export const BLOODLINES: Bloodline[] = [
  { id: "bl1", name: "Sangue do Portador",  desc: "+5% dano de clique permanente",  costVoid: 1,  effectDesc: "+5% clique",       effectType: "click_pct",   effectValue: 0.05  },
  { id: "bl2", name: "Essencia da Sombra",  desc: "+5% DPS permanente",             costVoid: 1,  effectDesc: "+5% DPS",          effectType: "dps_pct",     effectValue: 0.05  },
  { id: "bl3", name: "Heranca de Sang.",     desc: "+10% RP ganho permanente",       costVoid: 2,  effectDesc: "+10% RP",          effectType: "rp_pct",      effectValue: 0.10  },
  { id: "bl4", name: "DNA Espectral",        desc: "+10% Almas ganhas",              costVoid: 2,  effectDesc: "+10% Almas",       effectType: "souls_pct",   effectValue: 0.10  },
  { id: "bl5", name: "Gene do Vazio",        desc: "+10% ganhos offline",            costVoid: 3,  effectDesc: "+10% offline",     effectType: "offline_pct", effectValue: 0.10  },
  { id: "bl6", name: "Olho Critico",         desc: "+2% chance de critico",          costVoid: 3,  effectDesc: "+2% crit",         effectType: "crit_chance", effectValue: 0.02  },
  { id: "bl7", name: "Porcao Negra",         desc: "+25% multiplicador de critico",  costVoid: 4,  effectDesc: "+25% crit mult",   effectType: "crit_mult",   effectValue: 0.25  },
  { id: "bl8", name: "Linhagem Divina",      desc: "+20% clique e +20% DPS",         costVoid: 5,  effectDesc: "+20% tudo",        effectType: "dps_pct",     effectValue: 0.20  },
]

// ────────────────────────────────────────────────────────────────────
//  FORMATIONS  (hero synergy combos)
// ────────────────────────────────────────────────────────────────────

export const FORMATIONS: Formation[] = [
  { id: "f1", name: "Pacto Sombrio",      heroes: ["h3", "h4"],         desc: "Demonio + Vampiro = sede multiplica DPS",       dpsBonus: 2.0  },
  { id: "f2", name: "Exercito das Trevas",heroes: ["h1", "h2", "h3"],   desc: "Zumbi + Alma + Demonio = horda imparavel",      dpsBonus: 3.0  },
  { id: "f3", name: "Asas da Perdio",     heroes: ["h8", "h9"],         desc: "Dragao + Anjo = devastacao celeste",            dpsBonus: 5.0  },
  { id: "f4", name: "Fim dos Tempos",     heroes: ["h10", "h11", "h12"],desc: "Tita + Entidade + Deus = colapso total",       dpsBonus: 10.0 },
]

// ────────────────────────────────────────────────────────────────────
//  HORROR EVENTS  (random in-game events every 8-15 min)
// ────────────────────────────────────────────────────────────────────

export interface HorrorEvent {
  id: string
  name: string
  desc: string
  duration: number          // seconds
  effect: "click_mult" | "gold_mult" | "dps_mult" | "instant_waves" | "boss_rush"
  effectValue: number
  risk: boolean             // if true, has a downside
  riskDesc: string
  color: string
}

export const HORROR_EVENTS: HorrorEvent[] = [
  {
    id: "ev1",
    name: "Modo Final Destination",
    desc: "Cada clique tem 10% de chance de desviar — mas acertos criticos causam x10 dano.",
    duration: 45,
    effect: "click_mult", effectValue: 3,
    risk: true, riskDesc: "10% chance de clique errar",
    color: "#ef4444",
  },
  {
    id: "ev2",
    name: "Invasao: Team Japan",
    desc: "Boss especial japones aparece — recompensa massiva de RP e Almas.",
    duration: 60,
    effect: "boss_rush", effectValue: 5,
    risk: false, riskDesc: "",
    color: "#f97316",
  },
  {
    id: "ev3",
    name: "God Space Malfunction",
    desc: "Multiplicadores insanos por 45s — mas ha risco de Corrupcao (-20% RP).",
    duration: 45,
    effect: "dps_mult", effectValue: 6,
    risk: true, riskDesc: "30% chance de corrupcao (-20% RP)",
    color: "#a855f7",
  },
  {
    id: "ev4",
    name: "Jiangshi Outbreak",
    desc: "Horda de jiangshis fracos — combo cresce rapidamente, bom para maxar combo.",
    duration: 60,
    effect: "instant_waves", effectValue: 20,
    risk: false, riskDesc: "",
    color: "#22c55e",
  },
  {
    id: "ev5",
    name: "Invasao: Team India",
    desc: "Guerreiros indianos invadem com recompensas duplas de Genes.",
    duration: 60,
    effect: "gold_mult", effectValue: 4,
    risk: false, riskDesc: "",
    color: "#f59e0b",
  },
]

// ────────────────────────────────────────────────────────────────────
//  BLESSINGS  (chosen on Transcend — 3 from this list)
// ────────────────────────────────────────────────────────────────────

export interface Blessing {
  id: string
  name: string
  desc: string
  effect: "gene_cost" | "combo_floor" | "horror_affinity" | "offline_mult" | "ancient_refund" | "crit_always" | "boss_souls" | "dps_floor"
  value: number
}

export const BLESSINGS: Blessing[] = [
  { id: "b1", name: "Gene Eterno",       desc: "Linhagens custam -30% Void Essence",       effect: "gene_cost",      value: 0.30 },
  { id: "b2", name: "Combo Infinito",    desc: "Combo nunca vai abaixo de 10",              effect: "combo_floor",    value: 10   },
  { id: "b3", name: "Afinidade Horror",  desc: "+50% RP em mundos de terror japones/chines", effect: "horror_affinity", value: 0.50 },
  { id: "b4", name: "Vigilia Eterna",    desc: "+50% ganhos offline",                        effect: "offline_mult",   value: 0.50 },
  { id: "b5", name: "Memoria dos Ancioes",desc: "Metade do custo de Ancioes",               effect: "ancient_refund", value: 0.50 },
  { id: "b6", name: "Olho Afiado",       desc: "Criticos sempre x3 (minimo)",               effect: "crit_always",    value: 3    },
  { id: "b7", name: "Colheita de Almas", desc: "+1 Alma extra por boss morto",               effect: "boss_souls",     value: 1    },
  { id: "b8", name: "Fundacao de DPS",   desc: "DPS nunca vai abaixo de 50% do maximo",     effect: "dps_floor",      value: 0.50 },
]

// ────────────────────────────────────────────────────────────────────
//  UTILITY FUNCTIONS
// ────────────────────────────────────────────────────────────────────

export function formatNumber(num: number): string {
  if (!isFinite(num) || isNaN(num)) return "0"
  if (num < 1000) return Math.floor(num).toString()

  const suffixes = [
    "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No",
    "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc",
  ]
  let i = 0
  let v = num
  while (v >= 1000 && i < suffixes.length - 1) { v /= 1000; i++ }
  if (v >= 100) return Math.floor(v) + suffixes[i]
  if (v >= 10)  return v.toFixed(1) + suffixes[i]
  return v.toFixed(2) + suffixes[i]
}

export function formatTime(seconds: number): string {
  if (seconds < 60)    return `${Math.floor(seconds)}s`
  if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

export function getHeroCost(hero: Hero, amount: number, currentLevel: number): number {
  let total = 0
  for (let i = 0; i < amount; i++) {
    total += Math.floor(hero.baseCost * Math.pow(hero.costMult, currentLevel + i))
  }
  return total
}

export function spawnMonster(zone: number, worldIndex: number): GameState["monster"] {
  const world = WORLDS[Math.min(worldIndex, WORLDS.length - 1)]
  const isMegaBoss = zone % 100 === 0
  const isBoss     = zone % 10  === 0

  const baseHp = 10 * Math.pow(1.15, zone - 1) * Math.pow(2, world.tier - 1)
  const hp     = isMegaBoss ? baseHp * 50 : isBoss ? baseHp * 10 : baseHp
  const name   = (isBoss || isMegaBoss)
    ? world.boss
    : world.mobs[Math.floor(Math.random() * world.mobs.length)]

  const reward = Math.max(1, Math.floor(zone * Math.pow(1.1, zone / 10) * world.tier))

  return {
    hp,
    maxHp: hp,
    reward,
    name,
    type: isMegaBoss ? "megaboss" : isBoss ? "boss" : "normal",
  }
}

// Boss timer limit: 30s base + 5s per Chronos level
export function getBossTimerLimit(ancientLevels: Record<string, number>): number {
  const chronosLv = ancientLevels["chron"] ?? 0
  return 30 + chronosLv * 5
}

// ────────────────────────────────────────────────────────────────────
//  INITIAL STATE
// ────────────────────────────────────────────────────────────────────

export function createInitialState(): GameState {
  return {
    rp: 0, rpTotal: 0, rpAllTime: 0,
    souls: 0, gene: 0, rank: 0, voidEssence: 0,

    zone: 1, highZone: 1, highZoneAllTime: 1, worldIndex: 0,

    monster: spawnMonster(1, 0),

    heroLevels: {}, heroDpsMults: {}, heroClickMults: {},
    upgradeBought:   new Set<string>(),
    ancientLevels:   {},
    dimensionLevels: {},
    shopBought:      new Set<string>(),
    achievementsDone:new Set<string>(),
    bloodlinesOwned: new Set<string>(),
    challengesDone:  new Set<string>(),
    bestiary:        {},

    dps: 0, ppc: 1,

    combo: 0, maxCombo: 0, lastClickTime: Date.now(),

    clickBoost: 1, tempMult: 1, transcendMult: 1,

    shopPpc: 0, shopDps: 0,
    autoClickerActive:  false,
    autoClickerFast:    false,
    autoProgressActive: false,

    activeChallengeId: null,

    progressionMode: "pushing",
    farmZone: 1,
    bossTimerStart: 0,
    bossTimerLimit: 30,
    bossActive: false,
    bossFailCount: 0,

    activeEvent: null,
    eventEndsAt: 0,
    eventMult: 1,

    blessingsActive: new Set<string>(),
    blessingComboFloor: 0,
    blessingOfflineMult: 0,
    blessingHorrorAffinity: 0,
    blessingAncientDiscount: 0,
    blessingBossSouls: 0,
    blessingMinCritMult: 0,

    notoriety: 0,
    notorietyMult: 1,

    bloodlineDpsPct:    0,
    bloodlineClickPct:  0,
    bloodlineRpPct:     0,
    bloodlineSoulsPct:  0,
    bloodlineOfflinePct:0,
    bloodlineCritChance:0,
    bloodlineCritMult:  0,

    totalClicks: 0, totalKills: 0, bossKills: 0,
    cycles: 0, transcends: 0,

    playTime: 0, startTime: Date.now(),
  }
}
