"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Button }     from "@/components/ui/button"
import { Progress }   from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge }      from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  WORLDS, HEROES, UPGRADES, ACHIEVEMENTS, DIMENSIONS,
  ANCIENTS, SHOP_ITEMS, CHALLENGES, BLOODLINES, FORMATIONS,
  HORROR_EVENTS, BLESSINGS, BLACK_MARKET, EQUIPMENT, TALENT_TREE, DAILY_REWARDS,
  formatNumber, formatTime, getHeroCost, spawnMonster, spawnFarmMonster, createInitialState, getBossTimerLimit,
  type GameState, type Hero, type HorrorEvent, type Blessing, type Equipment as EquipmentType,
} from "@/lib/game-data"
import {
  Skull, Swords, Flame, Shield, Zap, Star, Trophy, Settings,
  RefreshCw, ChevronRight, ChevronLeft, Ghost, Moon, Infinity,
  TrendingUp, Clock, Target, Layers, ShoppingBag, Dna, Gem,
  X, Play, Dices, Dna as DnaIcon, BookOpen, Users, Activity,
} from "lucide-react"

// ────────────────────────────────────────────────────────────────────
//  SAVE / LOAD
// ────────────────────────────────────────────────────────────────────

const SAVE_KEY = "terrorInfinitoSave_v5"

function serialize(s: GameState): string {
  return JSON.stringify({
    ...s,
    upgradeBought:       Array.from(s.upgradeBought),
    shopBought:          Array.from(s.shopBought),
    achievementsDone:    Array.from(s.achievementsDone),
    bloodlinesOwned:     Array.from(s.bloodlinesOwned),
    challengesDone:      Array.from(s.challengesDone),
    blessingsActive:     Array.from(s.blessingsActive),
    equipmentOwned:      Array.from(s.equipmentOwned),
    loginRewardsClaimed: Array.from(s.loginRewardsClaimed),
    activeEvent: null,
  })
}

function deserialize(json: string): GameState {
  const p = JSON.parse(json)
  const base = createInitialState()
  return {
    ...base,
    ...p,
    upgradeBought:       new Set<string>(p.upgradeBought       ?? []),
    shopBought:          new Set<string>(p.shopBought          ?? []),
    achievementsDone:    new Set<string>(p.achievementsDone    ?? []),
    bloodlinesOwned:     new Set<string>(p.bloodlinesOwned     ?? []),
    challengesDone:      new Set<string>(p.challengesDone      ?? []),
    blessingsActive:     new Set<string>(p.blessingsActive     ?? []),
    equipmentOwned:      new Set<string>(p.equipmentOwned      ?? []),
    loginRewardsClaimed: new Set<string>(p.loginRewardsClaimed ?? []),
    monster: p.monster ?? spawnMonster(1, 0),
    activeEvent: null,
    eventEndsAt: 0,
    eventMult: 1,
    notifications: p.notifications ?? [],
  }
}

// ────────────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────────────

function calcDPS(s: GameState): number {
  let dps = 0

  HEROES.forEach(h => {
    const lv = s.heroLevels[h.id] ?? 0
    if (lv > 0 && h.baseDps > 0) {
      let hDps = h.baseDps * lv
      UPGRADES.forEach(u => {
        if (s.upgradeBought.has(u.id) && u.heroId === h.id && u.type === "dps")
          hDps *= u.mult
      })
      hDps *= s.heroDpsMults[h.id] ?? 1
      // Equipment bonus for this hero
      const eqId = s.equippedItems[h.id]
      if (eqId) {
        const eq = EQUIPMENT.find(e => e.id === eqId)
        if (eq) hDps *= eq.dpsMult
      }
      dps += hDps
    }
  })

  // global upgrades
  UPGRADES.forEach(u => {
    if (s.upgradeBought.has(u.id) && u.type === "global")
      dps *= u.mult
  })

  // global equipment
  const globalEqId = s.equippedItems["global"]
  if (globalEqId) {
    const eq = EQUIPMENT.find(e => e.id === globalEqId)
    if (eq) dps *= eq.dpsMult
  }

  // dimensions
  DIMENSIONS.forEach(d => {
    const lv = s.dimensionLevels[d.id] ?? 0
    if (lv > 0) dps *= Math.pow(d.baseMult, lv)
  })

  // ancients
  const siyaLv  = s.ancientLevels["siya"]  ?? 0
  const morgLv  = s.ancientLevels["morg"]  ?? 0
  const gazeLv  = s.ancientLevels["gaze"]  ?? 0
  if (siyaLv > 0) dps *= 1 + siyaLv * 0.25
  if (morgLv > 0) dps *= 1 + morgLv * 0.11
  if (gazeLv > 0) dps *= 1 + gazeLv * 0.01

  // talent bonuses
  const talentDpsPct = calcTalentBonus(s, "dps_pct") + calcTalentBonus(s, "all_pct")
  if (talentDpsPct > 0) dps *= 1 + talentDpsPct

  // notoriety, event, transcend
  dps *= s.notorietyMult * s.eventMult * s.transcendMult

  // shop flat + bloodline
  dps += s.shopDps
  dps *= 1 + s.bloodlineDpsPct

  // formations
  FORMATIONS.forEach(f => {
    const allOwned = f.heroes.every(hid => (s.heroLevels[hid] ?? 0) > 0)
    if (allOwned) dps *= 1 + f.dpsBonus
  })

  return dps
}

function calcTalentBonus(s: GameState, effect: string): number {
  let total = 0
  TALENT_TREE.forEach(node => {
    if (node.effect === effect) {
      const rank = s.talentRanks[node.id] ?? 0
      if (rank > 0) total += node.effectPerRank * rank
    }
  })
  return total
}

function calcPPC(s: GameState): number {
  let ppc = 1
  const portadorLv = s.heroLevels["h0"] ?? 0
  ppc += portadorLv

  UPGRADES.forEach(u => {
    if (s.upgradeBought.has(u.id) && u.heroId === "h0" && u.type === "click")
      ppc *= u.mult
  })

  HEROES.forEach(h => {
    const lv = s.heroLevels[h.id] ?? 0
    if (lv > 0 && h.baseClick > 0)
      ppc += h.baseClick * lv * (s.heroClickMults[h.id] ?? 1)
  })

  // ancients
  const argLv  = s.ancientLevels["arg"]  ?? 0
  const fragLv = s.ancientLevels["frag"] ?? 0
  if (argLv  > 0) ppc *= 1 + argLv  * 0.20
  if (fragLv > 0) ppc *= 1 + fragLv * 0.30

  // equipment
  const eqId0 = s.equippedItems["h0"]
  if (eqId0) { const eq = EQUIPMENT.find(e => e.id === eqId0); if (eq) ppc *= eq.clickMult }
  const globalEqId = s.equippedItems["global"]
  if (globalEqId) { const eq = EQUIPMENT.find(e => e.id === globalEqId); if (eq) ppc *= eq.clickMult }

  // talent
  const talentClickPct = calcTalentBonus(s, "click_pct") + calcTalentBonus(s, "all_pct")
  if (talentClickPct > 0) ppc *= 1 + talentClickPct

  ppc += s.shopPpc
  ppc *= 1 + s.bloodlineClickPct
  ppc *= s.clickBoost * s.tempMult
  return ppc
}

function applyKill(prev: GameState): GameState {
  const reward       = prev.monster.reward
  const isBoss       = prev.monster.type === "boss" || prev.monster.type === "megaboss"
  const mamLv        = prev.ancientLevels["mamm"]  ?? 0
  const doraLv       = prev.ancientLevels["dora"]  ?? 0
  const fortLv       = prev.ancientLevels["fort"]  ?? 0
  let rpMult = 1
  if (mamLv  > 0) rpMult *= 1 + mamLv  * 0.10
  if (doraLv > 0) rpMult *= 1 + doraLv * 0.35
  if (isBoss && fortLv > 0) rpMult *= 1 + fortLv * 0.25
  rpMult *= 1 + prev.bloodlineRpPct

  const finalRp  = Math.floor(reward * rpMult)
  const soulBase = isBoss ? Math.max(1, Math.floor(prev.zone / 50)) : 0
  const soulGain = Math.floor(soulBase * (1 + prev.bloodlineSoulsPct))
  const newZone  = prev.zone + 1
  const newWorld = Math.min(Math.floor((newZone - 1) / 100), WORLDS.length - 1)

  // Bestiary
  const monKey = `${prev.worldIndex}_${prev.monster.name}`
  const bestiary = { ...prev.bestiary, [monKey]: (prev.bestiary[monKey] ?? 0) + 1 }

  // Progression: killing a boss in push mode advances farmZone
  const newFarmZone = isBoss && prev.progressionMode === "pushing"
    ? Math.max(prev.farmZone, newZone - 1)
    : prev.farmZone

  // Equipment drop from bosses
  let newEquipOwned = prev.equipmentOwned
  if (isBoss) {
    const eligible = EQUIPMENT.filter(e => e.dropZone <= prev.zone && !prev.equipmentOwned.has(e.id))
    if (eligible.length > 0) {
      const rarityChance = { common: 0.4, rare: 0.2, epic: 0.08, legendary: 0.02 }
      eligible.forEach(e => {
        if (Math.random() < rarityChance[e.rarity]) {
          newEquipOwned = new Set(newEquipOwned)
          newEquipOwned.add(e.id)
        }
      })
    }
  }

  return {
    ...prev,
    rp:         prev.rp + finalRp,
    rpTotal:    prev.rpTotal + finalRp,
    rpAllTime:  prev.rpAllTime + finalRp,
    souls:      prev.souls + soulGain,
    zone:       newZone,
    highZone:   Math.max(prev.highZone, newZone),
    highZoneAllTime: Math.max(prev.highZoneAllTime, newZone),
    worldIndex: newWorld,
    totalKills: prev.totalKills + 1,
    bossKills:  prev.bossKills + (isBoss ? 1 : 0),
    monster:    spawnMonster(newZone, newWorld),
    bestiary,
    farmZone:   newFarmZone,
    equipmentOwned: newEquipOwned,
    bossActive:      false,
    bossTimerStart:  0,
    bossFailCount:   isBoss ? 0 : prev.bossFailCount,
  }
}

// ────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────

export function TerrorInfinitoGame() {
  const [gs, setGs]             = useState<GameState>(createInitialState)
  const [dmgNums, setDmgNums]   = useState<Array<{ id:number; val:number; x:number; y:number; crit:boolean }>>([])
  const [floats, setFloats]     = useState<Array<{ id:number; text:string; type:string }>>([])
  const [activeTab, setActiveTab] = useState("heroes")
  const [modal, setModal]       = useState<null | "prestige" | "transcend" | "challenge" | "settings" | "bloodline" | "bestiary" | "equipment" | "talents" | "daily" | "market">(null)
  const [buyAmount, setBuyAmount] = useState<1 | 10 | 100>(1)
  const [dpsHistory, setDpsHistory] = useState<number[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [showDailyReward, setShowDailyReward] = useState(false)
  const [dailyRewardInfo, setDailyRewardInfo] = useState<{rp:number;souls:number;gene:number;rank:number;desc:string;streak:number}|null>(null)

  const dmgId  = useRef(0)
  const floatId = useRef(0)
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (raw) {
        const loaded = deserialize(raw)
        const now = Date.now()
        const offlineSec = Math.max(0, Math.floor((now - loaded.startTime - loaded.playTime * 1000) / 1000))
        if (offlineSec > 30) {
          const offlineMult = 0.10 + loaded.bloodlineOfflinePct + loaded.blessingOfflineMult
          const offlineRp = Math.floor(loaded.dps * offlineSec * offlineMult)
          if (offlineRp > 0) {
            loaded.rp += offlineRp
            loaded.rpTotal += offlineRp
            loaded.rpAllTime += offlineRp
            toast(`Ganhou ${formatNumber(offlineRp)} RP offline (${formatTime(offlineSec)})`, "gold")
          }
        }
        // Daily login check
        const today = new Date().toISOString().split("T")[0]
        if (loaded.lastLoginDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]
          const newStreak = loaded.lastLoginDate === yesterday ? loaded.loginStreak + 1 : 1
          const rewardDay = DAILY_REWARDS.find(r => r.day === newStreak) ?? DAILY_REWARDS[0]
          loaded.rp += rewardDay.rp
          loaded.souls += rewardDay.souls
          loaded.gene += rewardDay.gene
          loaded.rank += rewardDay.rank
          loaded.lastLoginDate = today
          loaded.loginStreak = newStreak
          setDailyRewardInfo({ ...rewardDay, streak: newStreak })
          setShowDailyReward(true)
        }
        setGs(loaded)
      } else {
        // First time playing — give a small welcome reward
        const today = new Date().toISOString().split("T")[0]
        setGs(prev => ({ ...prev, lastLoginDate: today, loginStreak: 1 }))
      }
    } catch { /* silent */ }
    setIsLoaded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-save
  useEffect(() => {
    if (!isLoaded) return
    saveRef.current = setInterval(() => {
      setGs(s => { localStorage.setItem(SAVE_KEY, serialize(s)); return s })
    }, 15000)
    const onUnload = () => setGs(s => { localStorage.setItem(SAVE_KEY, serialize(s)); return s })
    window.addEventListener("beforeunload", onUnload)
    return () => {
      if (saveRef.current) clearInterval(saveRef.current)
      window.removeEventListener("beforeunload", onUnload)
    }
  }, [isLoaded])

  // ── Toast helper
  const toast = useCallback((text: string, type: string) => {
    const id = floatId.current++
    setFloats(p => [...p.slice(-10), { id, text, type }])
    setTimeout(() => setFloats(p => p.filter(f => f.id !== id)), 2200)
  }, [])

  // ── Game loop  (100 ms)
  useEffect(() => {
    if (!isLoaded) return
    loopRef.current = setInterval(() => {
      setGs(prev => {
        const dps = calcDPS(prev)
        const ppc = calcPPC(prev)
        const now = Date.now()
        let s = { ...prev, dps, ppc, playTime: prev.playTime + 0.1 }

        const isBossZone = s.monster.type === "boss" || s.monster.type === "megaboss"
        const isFarming  = s.progressionMode === "farming"

        // ── While FARMING: spawn farm mobs in a loop (never bosses, fixed difficulty)
        if (isFarming) {
          const dmg = (dps + (s.autoClickerActive ? ppc : 0)) * 0.1
          if (dmg > 0) {
            if (s.monster.hp - dmg <= 0) {
              // Kill farm mob → gain RP, spawn another farm mob immediately (same zone)
              const reward = s.monster.reward
              const mamLv  = s.ancientLevels["mamm"] ?? 0
              const doraLv = s.ancientLevels["dora"] ?? 0
              const rpMult = (1 + mamLv * 0.10) * (1 + doraLv * 0.35) * (1 + s.bloodlineRpPct)
              const finalRp = Math.floor(reward * rpMult)
              const farmWorldIdx = Math.min(Math.floor((s.farmZone - 1) / 100), WORLDS.length - 1)
              const monKey = `${s.worldIndex}_${s.monster.name}`
              s = {
                ...s,
                rp:         s.rp + finalRp,
                rpTotal:    s.rpTotal + finalRp,
                rpAllTime:  s.rpAllTime + finalRp,
                rank:       s.rank + Math.max(1, Math.ceil(finalRp * 0.005)),
                totalKills: s.totalKills + 1,
                bestiary:   { ...s.bestiary, [monKey]: (s.bestiary[monKey] ?? 0) + 1 },
                // Spawn next farm mob — same fixed difficulty, never a boss
                monster: spawnFarmMonster(s.farmZone, farmWorldIdx),
              }
            } else {
              s = { ...s, monster: { ...s.monster, hp: s.monster.hp - dmg } }
            }
          }
          return s
        }

        // ── While PUSHING ──────────────────────────────────────────────

        // Start boss timer when we hit a boss zone
        if (isBossZone && !s.bossActive) {
          const limit = getBossTimerLimit(s.ancientLevels)
          s = { ...s, bossActive: true, bossTimerStart: now, bossTimerLimit: limit }
        }

        // Boss timer expired → fall back to farm automatically
        if (s.bossActive && isBossZone) {
          const elapsed = (now - s.bossTimerStart) / 1000
          if (elapsed >= s.bossTimerLimit) {
            const farmWorldIdx = Math.min(Math.floor((s.farmZone - 1) / 100), WORLDS.length - 1)
            s = {
              ...s,
              progressionMode: "farming",
              zone:            s.farmZone,
              worldIndex:      farmWorldIdx,
              monster:         spawnFarmMonster(s.farmZone, farmWorldIdx),
              bossActive:      false,
              bossTimerStart:  0,
              bossFailCount:   s.bossFailCount + 1,
            }
            return s
          }
        }

        // DPS damage in push mode
        if (dps > 0) {
          const dmg = dps * 0.1
          if (s.monster.hp - dmg <= 0) {
            s = applyKill(s)
          } else {
            s = { ...s, monster: { ...s.monster, hp: s.monster.hp - dmg } }
          }
        }

        // Auto-clicker in push mode
        const autoRate = s.autoClickerFast ? 5 : s.autoClickerActive ? 1 : 0
        if (autoRate > 0) {
          const autoDmg = ppc * autoRate * 0.1
          if (s.monster.hp - autoDmg <= 0) {
            s = applyKill(s)
          } else {
            s = { ...s, monster: { ...s.monster, hp: s.monster.hp - autoDmg } }
          }
        }

        // Combo decay
        if (now - s.lastClickTime > 2000 && s.combo > s.blessingComboFloor) {
          s = { ...s, combo: Math.max(s.blessingComboFloor, s.combo - 1) }
        }

        // Horror event expiry
        if (s.activeEvent && now > s.eventEndsAt) {
          s = { ...s, activeEvent: null, eventMult: 1, eventEndsAt: 0 }
        }

        // Random horror event trigger
        if (!s.activeEvent && Math.random() < 0.0001) {
          const ev = HORROR_EVENTS[Math.floor(Math.random() * HORROR_EVENTS.length)]
          s = {
            ...s,
            activeEvent: ev,
            eventEndsAt: now + ev.duration * 1000,
            eventMult: ev.effect === "dps_mult" ? ev.effectValue : s.eventMult,
          }
        }

        return s
      })

      setGs(s => {
        setDpsHistory(h => [...h.slice(-59), s.dps])
        return s
      })
    }, 100)
    return () => { if (loopRef.current) clearInterval(loopRef.current) }
  }, [isLoaded])

  // ── Achievement checker
  useEffect(() => {
    if (!isLoaded) return
    ACHIEVEMENTS.forEach(a => {
      if (gs.achievementsDone.has(a.id)) return
      let met = false
      const { type, value } = a.condition
      if (type === "totalKills"  && gs.totalKills  >= value) met = true
      if (type === "totalClicks" && gs.totalClicks >= value) met = true
      if (type === "zone"        && gs.highZone    >= value) met = true
      if (type === "cycles"      && gs.cycles      >= value) met = true
      if (type === "combo"       && gs.maxCombo    >= value) met = true
      if (type === "bossKills"   && gs.bossKills   >= value) met = true
      if (type === "transcends"  && gs.transcends  >= value) met = true
      if (met) {
        setGs(prev => {
          const nd = new Set(prev.achievementsDone)
          nd.add(a.id)
          return { ...prev, achievementsDone: nd }
        })
        toast(`Conquista: ${a.name}!`, "achievement")
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.totalKills, gs.totalClicks, gs.highZone, gs.cycles, gs.maxCombo, gs.bossKills, gs.transcends])

  // ── Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top)  / rect.height) * 100

    setGs(prev => {
      const ppc   = calcPPC(prev)
      const juggLv = prev.ancientLevels["jugg"] ?? 0
      const fragLv = prev.ancientLevels["frag"] ?? 0
      const critChance = 0.05 + juggLv * 0.01 + prev.bloodlineCritChance
      const isCrit = Math.random() < critChance
      const comboMult = 1 + Math.min(prev.combo, 200) * 0.005  // up to +100% at 200 combo
      const critMult  = 2 + fragLv * 0.30 + prev.bloodlineCritMult
      const dmg       = ppc * comboMult * (isCrit ? critMult : 1)

      const id = dmgId.current++
      setDmgNums(p => [...p.slice(-20), { id, val: dmg, x, y, crit: isCrit }])
      setTimeout(() => setDmgNums(p => p.filter(d => d.id !== id)), 900)

      const now    = Date.now()
      const newCombo = prev.combo + 1

      let s = {
        ...prev,
        totalClicks:  prev.totalClicks + 1,
        combo:        newCombo,
        maxCombo:     Math.max(prev.maxCombo, newCombo),
        lastClickTime: now,
      }

      if (prev.monster.hp - dmg <= 0) {
        s = applyKill(s)
      } else {
        s = { ...s, monster: { ...s.monster, hp: s.monster.hp - dmg } }
      }

      return s
    })
  }, [])

  // ── Buy hero
  const buyHero = useCallback((hero: Hero, amount: number) => {
    setGs(prev => {
      const lv   = prev.heroLevels[hero.id] ?? 0
      const cost = getHeroCost(hero, amount, lv)
      if (prev.rp < cost) return prev
      toast(`+${amount} ${hero.name}`, "hero")
      return {
        ...prev,
        rp: prev.rp - cost,
        heroLevels: { ...prev.heroLevels, [hero.id]: lv + amount },
      }
    })
  }, [toast])

  // ── Buy upgrade
  const buyUpgrade = useCallback((id: string) => {
    setGs(prev => {
      if (prev.upgradeBought.has(id)) return prev
      const u = UPGRADES.find(x => x.id === id)
      if (!u || prev.rp < u.cost) return prev
      if (u.heroId !== "global") {
        const heroLv = prev.heroLevels[u.heroId] ?? 0
        if (heroLv < u.reqLevel) return prev
      }
      const nb = new Set(prev.upgradeBought); nb.add(id)
      toast(u.name + "!", "upgrade")
      return { ...prev, rp: prev.rp - u.cost, upgradeBought: nb }
    })
  }, [toast])

  // ── Buy ancient
  const buyAncient = useCallback((id: string) => {
    setGs(prev => {
      const a  = ANCIENTS.find(x => x.id === id)
      if (!a) return prev
      const lv = prev.ancientLevels[id] ?? 0
      if (lv >= a.maxLevel) return prev
      const cost = Math.floor(a.baseCost * Math.pow(a.costMult, lv))
      if (prev.souls < cost) return prev
      toast(`${a.name} Nv.${lv + 1}`, "ancient")
      return { ...prev, souls: prev.souls - cost, ancientLevels: { ...prev.ancientLevels, [id]: lv + 1 } }
    })
  }, [toast])

  // ── Buy dimension
  const buyDimension = useCallback((id: string) => {
    setGs(prev => {
      const d  = DIMENSIONS.find(x => x.id === id)
      if (!d) return prev
      if (prev.cycles < d.unlockCycles) return prev
      const lv   = prev.dimensionLevels[id] ?? 0
      const cost = Math.floor(d.cost * Math.pow(2, lv))
      if (prev.gene < cost) return prev
      toast(`${d.name} x${d.baseMult}`, "dimension")
      return { ...prev, gene: prev.gene - cost, dimensionLevels: { ...prev.dimensionLevels, [id]: lv + 1 } }
    })
  }, [toast])

  // ── Buy shop item
  const buyShopItem = useCallback((id: string) => {
    setGs(prev => {
      if (prev.shopBought.has(id)) return prev
      const item = SHOP_ITEMS.find(x => x.id === id)
      if (!item) return prev
      const have = item.currency === "rank" ? prev.rank
                  : item.currency === "gene" ? prev.gene
                  : prev.voidEssence
      if (have < item.cost) return prev
      const ns = new Set(prev.shopBought); ns.add(id)
      toast(item.name + "!", "shop")
      return {
        ...prev,
        rank:              item.currency === "rank" ? prev.rank - item.cost : prev.rank,
        gene:              item.currency === "gene" ? prev.gene - item.cost : prev.gene,
        voidEssence:       item.currency === "void" ? prev.voidEssence - item.cost : prev.voidEssence,
        shopBought: ns,
        shopPpc: prev.shopPpc + item.ppcBonus,
        shopDps: prev.shopDps + item.dpsBonus,
        autoClickerActive: item.special === "autoclicker1" ? true : prev.autoClickerActive,
        autoClickerFast:   item.special === "autoclicker5" ? true : prev.autoClickerFast,
        autoProgressActive:item.special === "autoprogress" ? true : prev.autoProgressActive,
      }
    })
  }, [toast])

  // ── Buy bloodline
  const buyBloodline = useCallback((id: string) => {
    setGs(prev => {
      if (prev.bloodlinesOwned.has(id)) return prev
      const bl = BLOODLINES.find(x => x.id === id)
      if (!bl || prev.voidEssence < bl.costVoid) return prev
      const nb = new Set(prev.bloodlinesOwned); nb.add(id)
      toast(`Linhagem: ${bl.name}!`, "bloodline")

      let clickPct    = prev.bloodlineClickPct
      let dpsPct      = prev.bloodlineDpsPct
      let rpPct       = prev.bloodlineRpPct
      let soulsPct    = prev.bloodlineSoulsPct
      let offlinePct  = prev.bloodlineOfflinePct
      let critChance  = prev.bloodlineCritChance
      let critMult    = prev.bloodlineCritMult

      if (bl.effectType === "click_pct")   clickPct   += bl.effectValue
      if (bl.effectType === "dps_pct")     dpsPct     += bl.effectValue
      if (bl.effectType === "rp_pct")      rpPct      += bl.effectValue
      if (bl.effectType === "souls_pct")   soulsPct   += bl.effectValue
      if (bl.effectType === "offline_pct") offlinePct += bl.effectValue
      if (bl.effectType === "crit_chance") critChance += bl.effectValue
      if (bl.effectType === "crit_mult")   critMult   += bl.effectValue

      return {
        ...prev,
        voidEssence: prev.voidEssence - bl.costVoid,
        bloodlinesOwned: nb,
        bloodlineClickPct:   clickPct,
        bloodlineDpsPct:     dpsPct,
        bloodlineRpPct:      rpPct,
        bloodlineSoulsPct:   soulsPct,
        bloodlineOfflinePct: offlinePct,
        bloodlineCritChance: critChance,
        bloodlineCritMult:   critMult,
      }
    })
  }, [toast])

  // ── Prestige (Ciclo)
  const prestige = useCallback(() => {
    setGs(prev => {
      const soulsGain = Math.max(1, Math.floor(Math.sqrt(prev.rpTotal / 1e6)))
      const geneGain  = Math.floor(prev.bossKills / 100)
      const rankGain  = Math.floor(prev.highZone  / 50)
      if (soulsGain < 1) return prev
      toast(`CICLO! +${soulsGain} Almas`, "prestige")
      if (geneGain > 0) toast(`+${geneGain} Genes`, "gene")
      if (rankGain > 0) toast(`+${rankGain} Rank`,  "rank")
      const talentGain = 1 + Math.floor(prev.highZone / 100)
      toast(`+${talentGain} Pontos de Talento`, "upgrade")
      const init = createInitialState()
      return {
        ...init,
        souls:             prev.souls + soulsGain,
        gene:              prev.gene  + geneGain,
        rank:              prev.rank  + rankGain,
        voidEssence:       prev.voidEssence,
        highZoneAllTime:   prev.highZoneAllTime,
        rpAllTime:         prev.rpAllTime,
        cycles:            prev.cycles + 1,
        transcends:        prev.transcends,
        transcendMult:     prev.transcendMult,
        ancientLevels:     prev.ancientLevels,
        dimensionLevels:   prev.dimensionLevels,
        shopBought:        prev.shopBought,
        shopPpc:           prev.shopPpc,
        shopDps:           prev.shopDps,
        autoClickerActive: prev.autoClickerActive,
        autoClickerFast:   prev.autoClickerFast,
        autoProgressActive:prev.autoProgressActive,
        achievementsDone:  prev.achievementsDone,
        challengesDone:    prev.challengesDone,
        bloodlinesOwned:   prev.bloodlinesOwned,
        bloodlineClickPct: prev.bloodlineClickPct,
        bloodlineDpsPct:   prev.bloodlineDpsPct,
        bloodlineRpPct:    prev.bloodlineRpPct,
        bloodlineSoulsPct: prev.bloodlineSoulsPct,
        bloodlineOfflinePct: prev.bloodlineOfflinePct,
        bloodlineCritChance: prev.bloodlineCritChance,
        bloodlineCritMult:   prev.bloodlineCritMult,
        maxCombo:            prev.maxCombo,
        bestiary:            prev.bestiary,
        // Equipment & Talents persist
        equipmentOwned:    prev.equipmentOwned,
        equippedItems:     prev.equippedItems,
        talentPoints:      prev.talentPoints + talentGain,
        talentRanks:       prev.talentRanks,
        // Daily login persists
        lastLoginDate:     prev.lastLoginDate,
        loginStreak:       prev.loginStreak,
        loginRewardsClaimed: prev.loginRewardsClaimed,
        // Market persists
        blackMarketRefreshes: prev.blackMarketRefreshes,
        blackMarketTradesLeft: prev.blackMarketTradesLeft,
        // Reset progression
        progressionMode: "pushing",
        farmZone: 1,
        bossActive: false,
        bossTimerStart: 0,
        bossFailCount: 0,
      }
    })
    setModal(null)
  }, [toast])

  // ── Transcend
  const transcend = useCallback(() => {
    setGs(prev => {
      if (prev.cycles < 10) return prev
      const voidGain = Math.max(1, Math.floor(prev.cycles / 5) + Math.floor(prev.highZoneAllTime / 500))
      toast(`TRANSCENSAO! +${voidGain} Essencia do Vazio`, "transcend")
      const init = createInitialState()
      return {
        ...init,
        voidEssence:        prev.voidEssence + voidGain,
        transcends:         prev.transcends + 1,
        transcendMult:      prev.transcendMult * 1.5,
        highZoneAllTime:    prev.highZoneAllTime,
        rpAllTime:          prev.rpAllTime,
        achievementsDone:   prev.achievementsDone,
        challengesDone:     prev.challengesDone,
        bloodlinesOwned:    prev.bloodlinesOwned,
        bloodlineClickPct:  prev.bloodlineClickPct,
        bloodlineDpsPct:    prev.bloodlineDpsPct,
        bloodlineRpPct:     prev.bloodlineRpPct,
        bloodlineSoulsPct:  prev.bloodlineSoulsPct,
        bloodlineOfflinePct:prev.bloodlineOfflinePct,
        bloodlineCritChance:prev.bloodlineCritChance,
        bloodlineCritMult:  prev.bloodlineCritMult,
        bestiary:           prev.bestiary,
      }
    })
    setModal(null)
  }, [toast])

  // ── Toggle push/farm mode
  const toggleProgressionMode = useCallback(() => {
    setGs(prev => {
      if (prev.progressionMode === "farming") {
        // Go back to pushing: move to the boss zone ahead of farmZone
        const pushZone  = prev.farmZone + 1
        const pushWorld = Math.min(Math.floor((pushZone - 1) / 100), WORLDS.length - 1)
        const limit     = getBossTimerLimit(prev.ancientLevels)
        return {
          ...prev,
          progressionMode: "pushing",
          zone:            pushZone,
          worldIndex:      pushWorld,
          monster:         spawnMonster(pushZone, pushWorld),
          bossActive:      false,
          bossTimerStart:  0,
          bossTimerLimit:  limit,
        }
      } else {
        // Manually retreat to farm
        const farmWorldIdx = Math.min(Math.floor((prev.farmZone - 1) / 100), WORLDS.length - 1)
        return {
          ...prev,
          progressionMode: "farming",
          zone:            prev.farmZone,
          worldIndex:      farmWorldIdx,
          monster:         spawnFarmMonster(prev.farmZone, farmWorldIdx),
          bossActive:      false,
          bossTimerStart:  0,
        }
      }
    })
  }, [])

  // ── Equip item
  const equipItem = useCallback((equipId: string, heroId: string) => {
    setGs(prev => {
      if (!prev.equipmentOwned.has(equipId)) return prev
      toast(`Equipado: ${EQUIPMENT.find(e => e.id === equipId)?.name}`, "shop")
      return { ...prev, equippedItems: { ...prev.equippedItems, [heroId]: equipId } }
    })
  }, [toast])

  // ── Buy talent node
  const buyTalent = useCallback((nodeId: string) => {
    setGs(prev => {
      const node = TALENT_TREE.find(n => n.id === nodeId)
      if (!node) return prev
      const rank = prev.talentRanks[nodeId] ?? 0
      if (rank >= node.maxRank) return prev
      const reqsMet = node.requires.every(r => (prev.talentRanks[r] ?? 0) > 0)
      if (!reqsMet) return prev
      if (prev.talentPoints < node.cost) return prev
      toast(`Talento: ${node.name} Nv.${rank + 1}`, "upgrade")
      return {
        ...prev,
        talentPoints: prev.talentPoints - node.cost,
        talentRanks: { ...prev.talentRanks, [nodeId]: rank + 1 },
      }
    })
  }, [toast])

  // ── Black market trade
  const doMarketTrade = useCallback((offerId: string) => {
    setGs(prev => {
      const offer = BLACK_MARKET.find(o => o.id === offerId)
      if (!offer) return prev
      const left = prev.blackMarketTradesLeft[offerId] ?? offer.maxTrades
      if (left <= 0) return prev
      const have = prev[offer.fromCurrency as keyof GameState] as number
      if (have < offer.fromAmount) return prev
      const updates: Partial<GameState> = {
        blackMarketTradesLeft: { ...prev.blackMarketTradesLeft, [offerId]: left - 1 },
      }
      // deduct from
      ;(updates as Record<string, unknown>)[offer.fromCurrency] = have - offer.fromAmount
      // add to
      const haveTo = prev[offer.toCurrency as keyof GameState] as number
      ;(updates as Record<string, unknown>)[offer.toCurrency] = haveTo + offer.toAmount
      toast(`Troca: +${formatNumber(offer.toAmount)} ${offer.toCurrency.toUpperCase()}`, "shop")
      return { ...prev, ...updates } as GameState
    })
  }, [toast])

  // ── Refresh black market (costs rank)
  const refreshMarket = useCallback(() => {
    setGs(prev => {
      const cost = 100 * (prev.blackMarketRefreshes + 1)
      if (prev.rank < cost) return prev
      const newLeft: Record<string, number> = {}
      BLACK_MARKET.forEach(o => { newLeft[o.id] = o.maxTrades })
      toast("Mercado Negro atualizado!", "shop")
      return {
        ...prev,
        rank: prev.rank - cost,
        blackMarketRefreshes: prev.blackMarketRefreshes + 1,
        blackMarketTradesLeft: newLeft,
        lastMarketRefresh: Date.now(),
      }
    })
  }, [toast])

  const resetGame = useCallback(() => {
    if (confirm("Resetar TODO o progresso? Isso nao pode ser desfeito!")) {
      localStorage.removeItem(SAVE_KEY)
      setGs(createInitialState())
    }
  }, [])

  // ── Derived values
  const world = useMemo(() => WORLDS[Math.min(gs.worldIndex, WORLDS.length - 1)], [gs.worldIndex])
  const hpPct = gs.monster.maxHp > 0 ? (gs.monster.hp / gs.monster.maxHp) * 100 : 100
  const potentialSouls = Math.max(1, Math.floor(Math.sqrt(gs.rpTotal / 1e6)))
  const potentialGenes = Math.floor(gs.bossKills / 100)
  const potentialRank  = Math.floor(gs.highZone / 50)
  const potentialVoid  = Math.max(1, Math.floor(gs.cycles / 5) + Math.floor(gs.highZoneAllTime / 500))

  // ────────────────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────────────────

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Skull className="w-16 h-16 mx-auto animate-pulse text-primary" />
          <p className="text-muted-foreground">Carregando Terror Idle: Main God Space...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

        {/* ── Floating Toasts */}
        <div className="fixed top-20 right-3 z-50 flex flex-col gap-1.5 pointer-events-none max-w-xs">
          {floats.map(f => (
            <div key={f.id} className={`
              px-3 py-1.5 rounded-lg font-semibold text-sm backdrop-blur-sm border animate-in slide-in-from-right-4 fade-in duration-200
              ${f.type === "gold"        ? "bg-amber-500/20 text-amber-300  border-amber-500/30"   : ""}
              ${f.type === "soul"        ? "bg-purple-500/20 text-purple-300 border-purple-500/30" : ""}
              ${f.type === "hero"        ? "bg-blue-500/20  text-blue-300   border-blue-500/30"    : ""}
              ${f.type === "upgrade"     ? "bg-green-500/20 text-green-300  border-green-500/30"   : ""}
              ${f.type === "prestige"    ? "bg-pink-500/20  text-pink-300   border-pink-500/30"    : ""}
              ${f.type === "achievement" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" : ""}
              ${f.type === "ancient"     ? "bg-cyan-500/20  text-cyan-300   border-cyan-500/30"    : ""}
              ${f.type === "dimension"   ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" : ""}
              ${f.type === "gene"        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : ""}
              ${f.type === "rank"        ? "bg-orange-500/20 text-orange-300 border-orange-500/30" : ""}
              ${f.type === "transcend"   ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30" : ""}
              ${f.type === "bloodline"   ? "bg-red-500/20   text-red-300    border-red-500/30"     : ""}
              ${f.type === "shop"        ? "bg-teal-500/20  text-teal-300   border-teal-500/30"    : ""}
            `}>{f.text}</div>
          ))}
        </div>

        {/* ── Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm">
          <div className="container mx-auto px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skull className="w-7 h-7 text-primary" />
                <span className="font-bold text-lg leading-none">Terror Idle</span>
                <Badge variant="outline" className="text-xs hidden sm:inline-flex">Main God Space</Badge>
              </div>

              {/* Currency pills */}
              <div className="flex flex-wrap items-center gap-2">
                <CurrencyPill icon={<Star className="w-3.5 h-3.5 text-amber-400" />} value={formatNumber(gs.rp)} label="RP" color="amber" />
                <CurrencyPill icon={<Ghost className="w-3.5 h-3.5 text-purple-400" />} value={formatNumber(gs.souls)} label="Almas" color="purple" />
                <CurrencyPill icon={<DnaIcon className="w-3.5 h-3.5 text-emerald-400" />} value={formatNumber(gs.gene)} label="Genes" color="emerald" />
                {gs.rank > 0 && <CurrencyPill icon={<Shield className="w-3.5 h-3.5 text-orange-400" />} value={formatNumber(gs.rank)} label="Rank" color="orange" />}
                {gs.voidEssence > 0 && <CurrencyPill icon={<Infinity className="w-3.5 h-3.5 text-fuchsia-400" />} value={formatNumber(gs.voidEssence)} label="Void" color="fuchsia" />}

                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setModal("settings")}>
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Stats bar */}
            <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" />{formatNumber(gs.dps)}/s</span>
              <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" />{formatNumber(gs.ppc)}/clique</span>
              <span className="flex items-center gap-1">
                <Zap className={`w-3.5 h-3.5 ${gs.combo > 50 ? "text-red-400" : gs.combo > 20 ? "text-orange-400" : "text-yellow-400"}`} />
                Combo {gs.combo}x {gs.combo >= 10 && `(+${Math.round(Math.min(gs.combo,200)*0.5)}%)`}
              </span>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatTime(gs.playTime)}</span>
              <span className="text-muted-foreground/60">Ciclos: {gs.cycles} | Trans: {gs.transcends}</span>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-3 py-4">
          <div className="grid lg:grid-cols-[1fr_380px] gap-4">

            {/* ── LEFT — Combat */}
            <div className="space-y-3">

              {/* World banner */}
              <div
                className="relative rounded-xl border border-border p-4 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${world.color}18 0%, transparent 60%)` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge style={{ background: world.color + "33", borderColor: world.color + "66", color: world.color }}>
                        {world.name}
                      </Badge>
                      {gs.transcendMult > 1 && (
                        <Badge variant="outline" className="text-fuchsia-400 border-fuchsia-500/30 text-xs">
                          Trans x{gs.transcendMult.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{world.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Progression mode toggle */}
                    <Button
                      size="sm"
                      variant={gs.progressionMode === "pushing" ? "default" : "outline"}
                      className={`text-xs h-7 px-2 ${gs.progressionMode === "pushing" ? "bg-red-600 hover:bg-red-700 border-red-500" : "border-green-600 text-green-400 hover:bg-green-900/30"}`}
                      onClick={toggleProgressionMode}
                    >
                      {gs.progressionMode === "pushing" ? "⚔ AVANÇANDO" : "🌾 FARM — Tentar Boss?"}
                    </Button>
                    <span className="font-mono font-bold text-sm">Z{gs.zone}</span>
                  </div>
                </div>

                {/* Progression status bar */}
                <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
                  {gs.progressionMode === "farming" ? (
                    <>
                      <span className="text-green-400">🌾 Farmando monstros normais — dificuldade fixa (Z{gs.farmZone})</span>
                      <span className="text-muted-foreground/60">| Clique no botão para tentar o boss novamente</span>
                      {gs.bossFailCount > 0 && <span className="text-orange-400">| Boss falhou {gs.bossFailCount}x</span>}
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">⚔ Avançando → Z{gs.zone}</span>
                      <span className="text-muted-foreground/60">| Recorde: Z{gs.highZone} | Farm: Z{gs.farmZone}</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Mundo {gs.worldIndex + 1}/{WORLDS.length}: {world.name}</p>
              </div>

              {/* Monster / click area */}
              <div
                className="relative rounded-xl border border-border overflow-hidden cursor-pointer select-none"
                style={{
                  background: `linear-gradient(180deg, ${world.color}12 0%, transparent 50%)`,
                  minHeight: 280,
                }}
                onClick={handleClick}
              >
                {/* HP bar */}
                <div className="absolute top-3 left-3 right-3 z-10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {gs.monster.type !== "normal" && (
                        <Skull className={`w-4 h-4 ${gs.monster.type === "megaboss" ? "text-red-400" : "text-orange-400"}`} />
                      )}
                      <span className={`font-semibold text-sm ${
                        gs.monster.type === "megaboss" ? "text-red-300" :
                        gs.monster.type === "boss"     ? "text-orange-300" : ""
                      }`}>
                        {gs.monster.name}
                      </span>
                      {gs.monster.type === "megaboss" && <Badge className="bg-red-500/20 text-red-400 text-xs">MEGA BOSS</Badge>}
                      {gs.monster.type === "boss"     && <Badge className="bg-orange-500/20 text-orange-400 text-xs">BOSS</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatNumber(gs.monster.hp)} / {formatNumber(gs.monster.maxHp)}
                    </span>
                  </div>
                  <div className="relative h-4 bg-border/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-100 ${
                        gs.monster.type === "megaboss" ? "bg-red-500" :
                        gs.monster.type === "boss"     ? "bg-orange-500" :
                        hpPct > 50 ? "bg-green-500" : hpPct > 25 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}
                    />
                  </div>

                  {/* Boss timer bar — only shown when boss is active in push mode */}
                  {gs.bossActive && (gs.monster.type === "boss" || gs.monster.type === "megaboss") && (() => {
                    const elapsed = (Date.now() - gs.bossTimerStart) / 1000
                    const remaining = Math.max(0, gs.bossTimerLimit - elapsed)
                    const timerPct  = (remaining / gs.bossTimerLimit) * 100
                    return (
                      <div className="mt-1">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className={timerPct < 25 ? "text-red-400 font-bold animate-pulse" : "text-muted-foreground"}>
                            ⏱ {remaining.toFixed(1)}s
                          </span>
                          <span className="text-muted-foreground/60">
                            {timerPct < 25 ? "⚠ QUASE ESGOTANDO!" : "Mate o boss antes do tempo acabar!"}
                          </span>
                        </div>
                        <div className="h-2 bg-border/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-100 ${
                              timerPct > 50 ? "bg-blue-500" : timerPct > 25 ? "bg-yellow-500" : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${timerPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Monster icon */}
                <div className="flex items-center justify-center min-h-[280px]">
                  <div className="relative">
                    <div className={`
                      w-28 h-28 rounded-full flex items-center justify-center
                      border-4 transition-all duration-75 hover:scale-105 active:scale-95
                      ${gs.monster.type === "megaboss"
                        ? "bg-red-500/20 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
                        : gs.monster.type === "boss"
                          ? "bg-orange-500/20 border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                          : "bg-primary/20 border-primary/50 shadow-[0_0_15px_rgba(var(--primary)/0.3)]"
                      }
                    `}>
                      <Swords className={`w-12 h-12 ${
                        gs.monster.type === "megaboss" ? "text-red-400" :
                        gs.monster.type === "boss"     ? "text-orange-400" : "text-primary"
                      }`} />
                    </div>

                    {/* Damage numbers */}
                    {dmgNums.map(d => (
                      <div key={d.id}
                        className="absolute pointer-events-none font-bold animate-in fade-in zoom-in-50 duration-100 fill-mode-both"
                        style={{
                          left: `${d.x}%`, top: `${d.y}%`,
                          transform: "translate(-50%, -50%)",
                          fontSize: d.crit ? "1.2rem" : "0.9rem",
                          color: d.crit ? "#f87171" : "#fbbf24",
                          textShadow: d.crit ? "0 0 12px #ef4444" : "0 0 8px #f59e0b",
                          zIndex: 20,
                        }}
                      >
                        {d.crit ? "CRIT! " : ""}{formatNumber(d.val)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom info */}
                <div className="absolute bottom-3 left-3 right-3 flex justify-between text-xs text-muted-foreground">
                  <span>Recompensa: <span className="text-amber-400 font-mono">{formatNumber(gs.monster.reward)} RP</span></span>
                  <span className="text-primary/60">clique para atacar</span>
                </div>
              </div>

              {/* DPS graph (mini sparkline) */}
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> DPS em tempo real
                  </span>
                  <span className="text-xs font-mono text-primary">{formatNumber(gs.dps)}/s</span>
                </div>
                <DpsGraph history={dpsHistory} />
              </div>

              {/* Prestige / Transcend / Challenge / new buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="h-auto py-2.5 flex-col gap-0.5 border-purple-500/30 hover:bg-purple-500/10 col-span-1"
                  onClick={() => setModal("prestige")}
                >
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-sm font-semibold">Ciclo</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    +{formatNumber(potentialSouls)} Almas
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-2.5 flex-col gap-0.5 border-fuchsia-500/30 hover:bg-fuchsia-500/10 col-span-1"
                  onClick={() => setModal("transcend")}
                  disabled={gs.cycles < 10}
                >
                  <div className="flex items-center gap-1.5 text-fuchsia-400">
                    <Layers className="w-4 h-4" />
                    <span className="text-sm font-semibold">Transcender</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {gs.cycles < 10 ? `${10 - gs.cycles} ciclos` : `+${formatNumber(potentialVoid)} Void`}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-2.5 flex-col gap-0.5 border-red-500/30 hover:bg-red-500/10 col-span-1"
                  onClick={() => setModal("challenge")}
                >
                  <div className="flex items-center gap-1.5 text-red-400">
                    <Dices className="w-4 h-4" />
                    <span className="text-sm font-semibold">Desafio</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{gs.challengesDone.size}/{CHALLENGES.length}</span>
                </Button>
              </div>

              {/* New system buttons */}
              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="outline" size="sm"
                  className="h-auto py-2 flex-col gap-0.5 border-yellow-500/30 hover:bg-yellow-500/10"
                  onClick={() => setModal("equipment")}
                >
                  <Swords className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-yellow-400">Equip</span>
                  <span className="text-xs text-muted-foreground">{gs.equipmentOwned.size}</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-auto py-2 flex-col gap-0.5 border-cyan-500/30 hover:bg-cyan-500/10"
                  onClick={() => setModal("talents")}
                >
                  <Star className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-cyan-400">Talentos</span>
                  <span className="text-xs text-muted-foreground">{gs.talentPoints}pts</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-auto py-2 flex-col gap-0.5 border-orange-500/30 hover:bg-orange-500/10"
                  onClick={() => setModal("market")}
                >
                  <ShoppingBag className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-orange-400">Mercado</span>
                  <span className="text-xs text-muted-foreground">Negro</span>
                </Button>
                <Button
                  variant="outline" size="sm"
                  className="h-auto py-2 flex-col gap-0.5 border-green-500/30 hover:bg-green-500/10"
                  onClick={() => setModal("daily")}
                >
                  <Trophy className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400">Daily</span>
                  <span className="text-xs text-muted-foreground">Dia {gs.loginStreak}</span>
                </Button>
              </div>

              {/* Stats footer */}
              <div className="p-3 bg-card border border-border rounded-xl">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  {[
                    { label: "Cliques",  value: formatNumber(gs.totalClicks) },
                    { label: "Kills",    value: formatNumber(gs.totalKills)  },
                    { label: "Bosses",   value: formatNumber(gs.bossKills), cls: "text-orange-400" },
                    { label: "Ciclos",   value: gs.cycles,                  cls: "text-purple-400" },
                    { label: "Trans",    value: gs.transcends,              cls: "text-fuchsia-400" },
                    { label: "Max Combo",value: `${gs.maxCombo}x`           },
                  ].map(st => (
                    <div key={st.label}>
                      <p className="text-xs text-muted-foreground">{st.label}</p>
                      <p className={`font-mono font-bold text-sm ${st.cls ?? ""}`}>{st.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT — Tabs */}
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              {/* Buy amount */}
              <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/30">
                <span className="text-xs text-muted-foreground mr-1">Comprar:</span>
                {([1, 10, 100] as const).map(n => (
                  <Button
                    key={n}
                    size="sm"
                    variant={buyAmount === n ? "default" : "ghost"}
                    className="h-6 px-2 text-xs"
                    onClick={() => setBuyAmount(n)}
                  >
                    x{n}
                  </Button>
                ))}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
                <TabsList className="grid grid-cols-6 rounded-none border-b border-border bg-muted/40 h-9">
                  <TabsTrigger value="heroes"     className="text-xs px-0"><Swords  className="w-4 h-4" /></TabsTrigger>
                  <TabsTrigger value="upgrades"   className="text-xs px-0"><TrendingUp className="w-4 h-4" /></TabsTrigger>
                  <TabsTrigger value="ancients"   className="text-xs px-0"><Ghost   className="w-4 h-4" /></TabsTrigger>
                  <TabsTrigger value="dimensions" className="text-xs px-0"><Layers  className="w-4 h-4" /></TabsTrigger>
                  <TabsTrigger value="shop"       className="text-xs px-0"><ShoppingBag className="w-4 h-4" /></TabsTrigger>
                  <TabsTrigger value="ach"        className="text-xs px-0 relative">
                    <Trophy className="w-4 h-4" />
                    {gs.achievementsDone.size > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-yellow-500 text-[9px] flex items-center justify-center font-bold text-black">
                        {gs.achievementsDone.size}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 h-[520px]">
                  {/* ── HEROES */}
                  <TabsContent value="heroes" className="m-0 p-2 space-y-1.5">
                    <SectionHeader title="Herois" sub="Clique para comprar" />
                    {HEROES.filter(h => gs.highZone >= h.unlockZone || (gs.heroLevels[h.id] ?? 0) > 0).map(hero => {
                      const lv   = gs.heroLevels[hero.id] ?? 0
                      const cost = getHeroCost(hero, buyAmount, lv)
                      const can  = gs.rp >= cost
                      return (
                        <div key={hero.id}
                          className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                            can ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10" : "border-border bg-muted/20 opacity-60 cursor-not-allowed"
                          }`}
                          onClick={() => can && buyHero(hero, buyAmount)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-medium text-sm truncate">{hero.name}</span>
                                {lv > 0 && <Badge variant="secondary" className="text-xs px-1">{lv}</Badge>}
                                {lv >= 100 && lv % 100 === 0 && <Badge className="text-xs px-1 bg-yellow-500/20 text-yellow-400">x{lv/100} EVOLUCAO</Badge>}
                              </div>
                              {lv > 0 && (
                                <p className="text-xs mt-0.5">
                                  {hero.baseDps > 0  && <span className="text-blue-400">DPS: {formatNumber(hero.baseDps * lv)}/s</span>}
                                  {hero.baseClick > 0 && <span className="text-green-400">Clique: +{formatNumber(hero.baseClick * lv)}</span>}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-mono ${can ? "text-amber-400" : "text-muted-foreground"}`}>{formatNumber(cost)}</p>
                              <p className="text-xs text-muted-foreground">{hero.baseDps > 0 ? `+${formatNumber(hero.baseDps * buyAmount)}/s` : `+${formatNumber(hero.baseClick * buyAmount)} clique`}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {/* Formations */}
                    <SectionHeader title="Formacoes" sub="Combos de herois" />
                    {FORMATIONS.map(f => {
                      const active = f.heroes.every(hid => (gs.heroLevels[hid] ?? 0) > 0)
                      return (
                        <div key={f.id} className={`p-2.5 rounded-lg border ${active ? "border-yellow-500/40 bg-yellow-500/5" : "border-border opacity-50"}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{f.name}</span>
                            <Badge className={active ? "bg-yellow-500/20 text-yellow-400" : "opacity-50"}>{active ? `+${f.dpsBonus*100}% DPS` : "Inativa"}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                        </div>
                      )
                    })}
                  </TabsContent>

                  {/* ── UPGRADES */}
                  <TabsContent value="upgrades" className="m-0 p-2 space-y-1.5">
                    <SectionHeader title="Melhorias" sub="Compradas com RP (unica vez)" />
                    {UPGRADES.filter(u => {
                      if (gs.upgradeBought.has(u.id)) return true
                      if (u.heroId === "global") return gs.rpAllTime >= u.cost * 0.05
                      return (gs.heroLevels[u.heroId] ?? 0) >= u.reqLevel * 0.5
                    }).map(u => {
                      const owned    = gs.upgradeBought.has(u.id)
                      const heroLv   = gs.heroLevels[u.heroId] ?? 0
                      const meetsReq = u.heroId === "global" || heroLv >= u.reqLevel
                      const can      = !owned && meetsReq && gs.rp >= u.cost
                      const heroName = HEROES.find(h => h.id === u.heroId)?.name
                      return (
                        <div key={u.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            owned ? "border-green-500/30 bg-green-500/8" :
                            can   ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer" :
                                    "border-border bg-muted/20 opacity-55 cursor-not-allowed"
                          }`}
                          onClick={() => can && buyUpgrade(u.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium">{u.name}</span>
                                {owned && <Badge className="text-xs bg-green-500/20 text-green-400">Ativa</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{u.desc}</p>
                              {!meetsReq && <p className="text-xs text-red-400 mt-0.5">Requer: {heroName} Nv.{u.reqLevel}</p>}
                            </div>
                            {!owned && (
                              <p className={`text-sm font-mono shrink-0 ${can ? "text-amber-400" : "text-muted-foreground"}`}>
                                {formatNumber(u.cost)} RP
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </TabsContent>

                  {/* ── ANCIENTS */}
                  <TabsContent value="ancients" className="m-0 p-2 space-y-1.5">
                    <SectionHeader title="Ancioes" sub={`Custo: Almas (${formatNumber(gs.souls)})`} />
                    {ANCIENTS.map(a => {
                      const lv   = gs.ancientLevels[a.id] ?? 0
                      const cost = Math.floor(a.baseCost * Math.pow(a.costMult, lv))
                      const can  = gs.souls >= cost && lv < a.maxLevel
                      return (
                        <div key={a.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            can ? "border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer" : "border-border bg-muted/20 opacity-60 cursor-not-allowed"
                          }`}
                          onClick={() => can && buyAncient(a.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{a.name}</span>
                                {lv > 0 && <Badge variant="secondary" className="text-xs">{lv}/{a.maxLevel}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                              <p className="text-xs text-purple-400 mt-0.5">{a.effectDesc}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-mono ${can ? "text-purple-400" : "text-muted-foreground"}`}>{formatNumber(cost)}</p>
                              <p className="text-xs text-muted-foreground">Almas</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </TabsContent>

                  {/* ── DIMENSIONS */}
                  <TabsContent value="dimensions" className="m-0 p-2 space-y-1.5">
                    <SectionHeader title="Dimensoes" sub={`Custo: Genes (${formatNumber(gs.gene)})`} />
                    {DIMENSIONS.map(d => {
                      const lv       = gs.dimensionLevels[d.id] ?? 0
                      const cost     = Math.floor(d.cost * Math.pow(2, lv))
                      const unlocked = gs.cycles >= d.unlockCycles
                      const can      = unlocked && gs.gene >= cost
                      return (
                        <div key={d.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            !unlocked ? "border-border opacity-40" :
                            can ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 cursor-pointer" :
                                  "border-border bg-muted/20 opacity-60 cursor-not-allowed"
                          }`}
                          onClick={() => can && buyDimension(d.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="text-sm font-medium">{d.name}</span>
                                {lv > 0 && <Badge variant="secondary" className="text-xs">x{lv}</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{d.desc}</p>
                              {!unlocked && <p className="text-xs text-red-400 mt-0.5">Requer {d.unlockCycles} ciclos</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-sm font-mono ${can ? "text-emerald-400" : "text-muted-foreground"}`}>{formatNumber(cost)}</p>
                              <p className="text-xs text-muted-foreground">Genes</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </TabsContent>

                  {/* ── SHOP */}
                  <TabsContent value="shop" className="m-0 p-2 space-y-1.5">
                    <SectionHeader title="Loja Permanente" sub="Persiste entre ciclos" />
                    {SHOP_ITEMS.map(item => {
                      const owned = gs.shopBought.has(item.id)
                      const have  = item.currency === "rank" ? gs.rank : item.currency === "gene" ? gs.gene : gs.voidEssence
                      const can   = !owned && have >= item.cost
                      const currLabel = item.currency === "rank" ? "Rank" : item.currency === "gene" ? "Genes" : "Void"
                      const currColor = item.currency === "rank" ? "text-orange-400" : item.currency === "gene" ? "text-emerald-400" : "text-fuchsia-400"
                      return (
                        <div key={item.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            owned ? "border-teal-500/30 bg-teal-500/8" :
                            can   ? "border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 cursor-pointer" :
                                    "border-border bg-muted/20 opacity-55 cursor-not-allowed"
                          }`}
                          onClick={() => can && buyShopItem(item.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{item.name}</span>
                                {owned && <Badge className="text-xs bg-teal-500/20 text-teal-400">Ativo</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                            </div>
                            {!owned && (
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-mono ${can ? currColor : "text-muted-foreground"}`}>{item.cost}</p>
                                <p className={`text-xs ${currColor}`}>{currLabel}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Bloodline section */}
                    <SectionHeader title="Linhagens de Sangue" sub={`Custo: Essencia do Vazio (${formatNumber(gs.voidEssence)})`} />
                    {BLOODLINES.map(bl => {
                      const owned = gs.bloodlinesOwned.has(bl.id)
                      const can   = !owned && gs.voidEssence >= bl.costVoid
                      return (
                        <div key={bl.id}
                          className={`p-2.5 rounded-lg border transition-colors ${
                            owned ? "border-red-500/30 bg-red-500/8" :
                            can   ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10 cursor-pointer" :
                                    "border-border bg-muted/20 opacity-55 cursor-not-allowed"
                          }`}
                          onClick={() => can && buyBloodline(bl.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium">{bl.name}</span>
                                {owned && <Badge className="text-xs bg-red-500/20 text-red-400">Ativa</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{bl.desc}</p>
                            </div>
                            {!owned && (
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-mono ${can ? "text-fuchsia-400" : "text-muted-foreground"}`}>{bl.costVoid}</p>
                                <p className="text-xs text-fuchsia-400">Void</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </TabsContent>

                  {/* ── ACHIEVEMENTS */}
                  <TabsContent value="ach" className="m-0 p-2">
                    <SectionHeader title="Conquistas" sub={`${gs.achievementsDone.size} / ${ACHIEVEMENTS.length}`} />
                    <div className="grid grid-cols-2 gap-1.5">
                      {ACHIEVEMENTS.map(a => {
                        const done = gs.achievementsDone.has(a.id)
                        return (
                          <Tooltip key={a.id}>
                            <TooltipTrigger asChild>
                              <div className={`p-2 rounded-lg border text-center transition-colors ${
                                done ? "border-yellow-500/40 bg-yellow-500/8" : "border-border bg-muted/20 opacity-40"
                              }`}>
                                <Trophy className={`w-5 h-5 mx-auto mb-1 ${done ? "text-yellow-400" : "text-muted-foreground"}`} />
                                <p className="text-xs font-medium truncate">{done ? a.name : "???"}</p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[200px]">
                              <p className="font-semibold">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{a.desc}</p>
                            </TooltipContent>
                          </Tooltip>
                        )
                      })}
                    </div>

                    {/* Bestiary */}
                    <SectionHeader title="Bestiario" sub="Inimigos derrotados" />
                    <div className="space-y-1">
                      {Object.entries(gs.bestiary).sort((a,b) => b[1]-a[1]).slice(0, 20).map(([key, kills]) => {
                        const name = key.split("_").slice(1).join("_")
                        return (
                          <div key={key} className="flex items-center justify-between px-2 py-1 rounded bg-muted/20">
                            <span className="text-xs">{name}</span>
                            <span className="text-xs font-mono text-red-400">{formatNumber(kills)}x</span>
                          </div>
                        )
                      })}
                      {Object.keys(gs.bestiary).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">Nenhum registro ainda.</p>
                      )}
                    </div>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          </div>
        </main>

        {/* ─── MODALS ─────────────────────────────────────────── */}

        {/* Prestige */}
        {modal === "prestige" && (
          <Modal title="Ciclo — Prestige" icon={<RefreshCw className="w-5 h-5 text-purple-400" />} onClose={() => setModal(null)}>
            <p className="text-sm text-muted-foreground mb-4">Reinicie e ganhe moedas permanentes para desbloquear sistemas mais poderosos.</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatBox label="Almas"  value={`+${formatNumber(potentialSouls)}`} color="purple" />
              <StatBox label="Genes"  value={`+${formatNumber(potentialGenes)}`} color="emerald" />
              <StatBox label="Rank"   value={`+${formatNumber(potentialRank)}`}  color="orange" />
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mb-5 bg-muted/30 rounded-lg p-3">
              <p><span className="text-red-400">Resetado:</span> RP, Herois, Melhorias, Zona</p>
              <p><span className="text-green-400">Mantido:</span> Almas, Genes, Rank, Ancioes, Dimensoes, Loja, Linhagens</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={prestige} disabled={potentialSouls < 1}>
                Ciclar Agora
              </Button>
            </div>
          </Modal>
        )}

        {/* Transcend */}
        {modal === "transcend" && (
          <Modal title="Transcensao" icon={<Layers className="w-5 h-5 text-fuchsia-400" />} onClose={() => setModal(null)}>
            <p className="text-sm text-muted-foreground mb-4">Reset profundo: perde tudo (incluindo Almas/Genes/Rank), mas ganha Essencia do Vazio e multiplica DPS permanentemente.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <StatBox label="Essencia do Vazio" value={`+${formatNumber(potentialVoid)}`} color="fuchsia" />
              <StatBox label="Mult. DPS"          value={`x${(gs.transcendMult * 1.5).toFixed(2)}`}  color="indigo" />
            </div>
            <div className="text-xs text-muted-foreground space-y-1 mb-5 bg-muted/30 rounded-lg p-3">
              <p><span className="text-red-400">Resetado:</span> TUDO exceto Conquistas e Linhagens</p>
              <p><span className="text-green-400">Mantido:</span> Conquistas, Linhagens, Void Essence acumulado</p>
              <p className="text-yellow-400">Requer 10 ciclos — voce tem {gs.cycles}.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancelar</Button>
              <Button className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700" onClick={transcend} disabled={gs.cycles < 10}>
                Transcender
              </Button>
            </div>
          </Modal>
        )}

        {/* Challenges */}
        {modal === "challenge" && (
          <Modal title="Desafios" icon={<Dices className="w-5 h-5 text-red-400" />} onClose={() => setModal(null)}>
            <div className="space-y-3">
              {CHALLENGES.map(ch => {
                const done = gs.challengesDone.has(ch.id)
                return (
                  <div key={ch.id} className={`p-3 rounded-lg border ${done ? "border-green-500/30 bg-green-500/8" : "border-red-500/30 bg-red-500/5"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{ch.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ch.desc}</p>
                        <p className="text-xs text-red-400 mt-1">Restricao: {ch.restriction}</p>
                        <p className="text-xs text-green-400 mt-0.5">Recompensa: {ch.rewardDesc}</p>
                      </div>
                      {done && <Badge className="bg-green-500/20 text-green-400 shrink-0">Completo</Badge>}
                    </div>
                  </div>
                )
              })}
            </div>
          </Modal>
        )}

        {/* Equipment Modal */}
        {modal === "equipment" && (
          <Modal title="Equipamentos" icon={<Swords className="w-5 h-5 text-yellow-400" />} onClose={() => setModal(null)}>
            <p className="text-xs text-muted-foreground mb-3">Itens dropam de bosses. Equipe em heróis para bônus permanentes neste ciclo.</p>
            {gs.equipmentOwned.size === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum equipamento ainda. Mate bosses para dropar itens!</p>
            )}
            <div className="space-y-2">
              {EQUIPMENT.filter(e => gs.equipmentOwned.has(e.id)).map(eq => {
                const rarityColor = eq.rarity === "legendary" ? "text-yellow-400 border-yellow-500/40" : eq.rarity === "epic" ? "text-purple-400 border-purple-500/40" : eq.rarity === "rare" ? "text-blue-400 border-blue-500/40" : "text-gray-400 border-gray-500/40"
                const equipped = Object.entries(gs.equippedItems).find(([, v]) => v === eq.id)
                return (
                  <div key={eq.id} className={`p-3 rounded-lg border ${rarityColor} bg-muted/20`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{eq.name}</span>
                          <Badge className={`text-xs ${rarityColor}`}>{eq.rarity}</Badge>
                          {equipped && <Badge className="text-xs bg-green-500/20 text-green-400">Equipado</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{eq.desc}</p>
                        <div className="flex gap-3 mt-1 text-xs">
                          {eq.dpsMult > 1 && <span className="text-blue-400">DPS x{eq.dpsMult}</span>}
                          {eq.clickMult > 1 && <span className="text-green-400">Click x{eq.clickMult}</span>}
                          {eq.rpMult > 1 && <span className="text-amber-400">RP x{eq.rpMult}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => equipItem(eq.id, eq.heroId)}>
                        Equipar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground">Itens por desbloquear: {EQUIPMENT.filter(e => !gs.equipmentOwned.has(e.id)).length} | Requer zona mínima para dropar.</p>
            </div>
          </Modal>
        )}

        {/* Talents Modal */}
        {modal === "talents" && (
          <Modal title="Árvore de Talentos" icon={<Star className="w-5 h-5 text-cyan-400" />} onClose={() => setModal(null)}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Talentos são permanentes. +1pt por ciclo +1pt a cada 100 zonas.</p>
              <Badge className="bg-cyan-500/20 text-cyan-400">{gs.talentPoints} pts</Badge>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {TALENT_TREE.map(node => {
                const rank = gs.talentRanks[node.id] ?? 0
                const maxed = rank >= node.maxRank
                const reqsMet = node.requires.every(r => (gs.talentRanks[r] ?? 0) > 0)
                const can = !maxed && reqsMet && gs.talentPoints >= node.cost
                const totalBonus = (node.effectPerRank * rank * 100).toFixed(0)
                return (
                  <div key={node.id}
                    className={`p-2.5 rounded-lg border transition-colors ${
                      maxed ? "border-cyan-500/40 bg-cyan-500/10" :
                      can   ? "border-cyan-500/30 hover:bg-cyan-500/5 cursor-pointer" :
                      !reqsMet ? "border-border opacity-30" :
                              "border-border opacity-50 cursor-not-allowed"
                    }`}
                    onClick={() => can && buyTalent(node.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{node.name}</span>
                          <Badge variant="secondary" className="text-xs">{rank}/{node.maxRank}</Badge>
                          {maxed && <Badge className="text-xs bg-cyan-500/20 text-cyan-400">MAX</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{node.desc}</p>
                        {rank > 0 && <p className="text-xs text-cyan-400 mt-0.5">Bônus atual: +{totalBonus}%</p>}
                        {!reqsMet && <p className="text-xs text-red-400 mt-0.5">Requer: {node.requires.join(", ")}</p>}
                      </div>
                      {!maxed && (
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-mono ${can ? "text-cyan-400" : "text-muted-foreground"}`}>{node.cost}pt</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Modal>
        )}

        {/* Black Market Modal */}
        {modal === "market" && (
          <Modal title="Mercado Negro" icon={<ShoppingBag className="w-5 h-5 text-orange-400" />} onClose={() => setModal(null)}>
            <p className="text-xs text-muted-foreground mb-1">Troque moedas a taxas desfavoráveis mas úteis em emergências.</p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">Refreshes: {gs.blackMarketRefreshes}</span>
              <Button size="sm" variant="outline" className="h-7 text-xs border-orange-500/30 text-orange-400"
                onClick={refreshMarket}
                disabled={gs.rank < 100 * (gs.blackMarketRefreshes + 1)}>
                Refresh ({formatNumber(100 * (gs.blackMarketRefreshes + 1))} Rank)
              </Button>
            </div>
            <div className="space-y-2">
              {BLACK_MARKET.map(offer => {
                const left = gs.blackMarketTradesLeft[offer.id] ?? offer.maxTrades
                const fromVal = gs[offer.fromCurrency as keyof GameState] as number
                const can = left > 0 && fromVal >= offer.fromAmount
                const currLabel = (c: string) => c === "rp" ? "RP" : c === "rank" ? "Rank" : c === "gene" ? "Gene" : c === "souls" ? "Almas" : "Void"
                const currColor = (c: string) => c === "rp" ? "text-amber-400" : c === "rank" ? "text-orange-400" : c === "gene" ? "text-emerald-400" : c === "souls" ? "text-purple-400" : "text-fuchsia-400"
                return (
                  <div key={offer.id}
                    className={`p-2.5 rounded-lg border transition-colors ${
                      can ? "border-orange-500/30 hover:bg-orange-500/5 cursor-pointer" : "border-border opacity-40 cursor-not-allowed"
                    }`}
                    onClick={() => can && doMarketTrade(offer.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{offer.name}</span>
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <span className={currColor(offer.fromCurrency)}>-{formatNumber(offer.fromAmount)} {currLabel(offer.fromCurrency)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className={currColor(offer.toCurrency)}>+{formatNumber(offer.toAmount)} {currLabel(offer.toCurrency)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{offer.desc}</p>
                      </div>
                      <Badge className={left > 0 ? "bg-orange-500/20 text-orange-400" : "opacity-40"}>{left}/{offer.maxTrades}</Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </Modal>
        )}

        {/* Daily Login Modal */}
        {modal === "daily" && (
          <Modal title="Login Diário" icon={<Trophy className="w-5 h-5 text-green-400" />} onClose={() => setModal(null)}>
            <div className="text-center mb-4">
              <p className="text-2xl font-bold text-green-400">Dia {gs.loginStreak} 🔥</p>
              <p className="text-xs text-muted-foreground">Último login: {gs.lastLoginDate || "Hoje"}</p>
            </div>
            <div className="space-y-2">
              {DAILY_REWARDS.map(r => {
                const claimed = gs.loginStreak >= r.day
                const isCurrent = gs.loginStreak === r.day
                return (
                  <div key={r.day} className={`p-2.5 rounded-lg border flex items-center gap-3 ${
                    isCurrent ? "border-green-500/50 bg-green-500/10" :
                    claimed   ? "border-border bg-muted/10 opacity-50" :
                                "border-border opacity-30"
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                      isCurrent ? "bg-green-500/30 text-green-400" :
                      claimed   ? "bg-muted text-muted-foreground" :
                                  "bg-muted/20 text-muted-foreground"
                    }`}>{r.day}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{r.desc}</p>
                      <div className="flex gap-2 text-xs mt-0.5 flex-wrap">
                        {r.rp > 0    && <span className="text-amber-400">+{formatNumber(r.rp)} RP</span>}
                        {r.souls > 0 && <span className="text-purple-400">+{r.souls} Almas</span>}
                        {r.gene > 0  && <span className="text-emerald-400">+{r.gene} Gene</span>}
                        {r.rank > 0  && <span className="text-orange-400">+{r.rank} Rank</span>}
                      </div>
                    </div>
                    {claimed && !isCurrent && <span className="text-green-400 text-xs shrink-0">✓</span>}
                    {isCurrent && <Badge className="bg-green-500/20 text-green-400 shrink-0 text-xs">HOJE</Badge>}
                  </div>
                )
              })}
            </div>
          </Modal>
        )}

        {/* Daily Reward Popup */}
        {showDailyReward && dailyRewardInfo && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowDailyReward(false)}>
            <div className="bg-card border border-green-500/50 rounded-xl p-6 max-w-sm w-full text-center shadow-[0_0_40px_rgba(34,197,94,0.2)]" onClick={e => e.stopPropagation()}>
              <Trophy className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-green-400 mb-1">Recompensa Diária!</h2>
              <p className="text-sm text-muted-foreground mb-1">{dailyRewardInfo.desc}</p>
              <p className="text-lg font-bold text-amber-400 mb-4">🔥 Streak: Dia {dailyRewardInfo.streak}</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {dailyRewardInfo.rp    > 0 && <StatBox label="Reward Points" value={`+${formatNumber(dailyRewardInfo.rp)}`}    color="amber"   />}
                {dailyRewardInfo.souls > 0 && <StatBox label="Hero Souls"    value={`+${dailyRewardInfo.souls}`}               color="purple"  />}
                {dailyRewardInfo.gene  > 0 && <StatBox label="Gene Frags"    value={`+${dailyRewardInfo.gene}`}                color="emerald" />}
                {dailyRewardInfo.rank  > 0 && <StatBox label="Rank Points"   value={`+${dailyRewardInfo.rank}`}                color="orange"  />}
              </div>
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => setShowDailyReward(false)}>
                Coletar!
              </Button>
            </div>
          </div>
        )}
        {modal === 'settings' && (
          <Modal title="Configuracoes" icon={<Settings className="w-5 h-5" />} onClose={() => setModal(null)}>
            <div className="space-y-3">
              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-1">
                <p>RP Total (este ciclo): <span className="font-mono text-amber-400">{formatNumber(gs.rpTotal)}</span></p>
                <p>RP All-Time: <span className="font-mono text-amber-400">{formatNumber(gs.rpAllTime)}</span></p>
                <p>Zona Max All-Time: <span className="font-mono">{gs.highZoneAllTime}</span></p>
                <p>Tempo de jogo: <span className="font-mono">{formatTime(gs.playTime)}</span></p>
                <p>Itens na Loja: <span className="font-mono text-teal-400">{gs.shopBought.size}/{SHOP_ITEMS.length}</span></p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { localStorage.setItem(SAVE_KEY, serialize(gs)); setModal(null); alert("Salvo!") }}>
                Salvar Agora
              </Button>
              <Button variant="destructive" className="w-full" onClick={resetGame}>
                Resetar Jogo (IRREVERSIVEL)
              </Button>
            </div>
          </Modal>
        )}

      </div>
    </TooltipProvider>
  )
}

// ────────────────────────────────────────────────────────────────────
//  SMALL COMPONENTS
// ────────────────────────────────────────────────────────────────────

function CurrencyPill({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 bg-${color}-500/10 px-2.5 py-1 rounded-lg border border-${color}-500/20 cursor-default`}>
          {icon}
          <span className={`font-mono font-bold text-sm text-${color}-400`}>{value}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="py-1 mt-1">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`bg-${color}-500/10 rounded-lg p-3 text-center border border-${color}-500/20`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold text-${color}-400`}>{value}</p>
    </div>
  )
}

function Modal({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">{icon}{title}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        {children}
      </div>
    </div>
  )
}

function DpsGraph({ history }: { history: number[] }) {
  if (history.length < 2) return <div className="h-12 bg-muted/20 rounded" />
  const max = Math.max(...history, 1)
  const points = history.map((v, i) => {
    const x = (i / (history.length - 1)) * 100
    const y = 100 - (v / max) * 90
    return `${x},${y}`
  }).join(" ")
  return (
    <svg viewBox="0 0 100 100" className="w-full h-12" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        fill="hsl(var(--primary) / 0.15)"
        stroke="none"
        points={`0,100 ${points} 100,100`}
      />
    </svg>
  )
}
