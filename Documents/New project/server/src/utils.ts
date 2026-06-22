import { randomUUID } from "node:crypto";
import type {
  ActionType,
  BattleContext,
  CastleState,
  CharacterClass,
  CharacterProfile,
  CharacterStatKey,
  CharacterStats,
  CombatRole,
  EquipmentSlotKey,
  EquipmentSlots,
  FactionSummary,
  ForgeOption,
  ForgeRecipe,
  GameConfig,
  InventoryItem,
  LoadoutSummary,
  MaterialType,
  QualityTier,
  SecondaryCharacterDefinition,
  ShopItem,
  SpecialSkillDefinition,
  StatusEffect,
  SubRoleSlot
} from "../../shared/events";

let runtimeGameConfig: GameConfig | null = null;

export function setRuntimeGameConfig(config: GameConfig | null) {
  runtimeGameConfig = config;
}

export function randomId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function randomRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function sanitizePartyCode(value?: string | null) {
  const code = (value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (code.length !== 6) {
    return null;
  }
  return code;
}

export function nowIso() {
  return new Date().toISOString();
}

export function taipeiDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function classMigrationBase(className: CharacterClass) {
  if (className === "warrior") {
    return { defense: 3, vitality: 4, technique: 2, luck: 1, tenacity: 4 };
  }
  if (className === "assassin") {
    return { defense: 1, vitality: 2, technique: 5, luck: 4, tenacity: 2 };
  }
  if (className === "mage") {
    return { defense: 1, vitality: 2, technique: 4, luck: 2, tenacity: 1 };
  }
  return { defense: 2, vitality: 3, technique: 2, luck: 4, tenacity: 2 };
}

export function classBaseStats(className: CharacterClass): CharacterStats {
  if (className === "warrior") {
    // 平衡微調 (2026-06-22)：balance-sim Monte Carlo 研究發現戰士在連擊系統中
    // 因技巧 / 速度過低而續擊率墊底（菁英難度勝率僅約 18-38%）。將基礎技巧
    // 4→8、速度 5→6 以補強連擊接續，模擬顯示戰士平均勝率回升到約 59%、
    // 職業勝率落差由 ~36pts 收斂到 ~22pts。詳見 balance-sim/ 與專題報告。
    return {
      attack: 12,
      defense: 6,
      luck: 3,
      intelligence: 5,
      vitality: 8,
      spirit: 6,
      technique: 8,
      tenacity: 7
    };
  }

  if (className === "assassin") {
    return {
      attack: 11,
      defense: 4,
      luck: 8,
      intelligence: 5,
      vitality: 5,
      spirit: 5,
      technique: 12,
      tenacity: 4
    };
  }

  if (className === "mage") {
    return {
      attack: 4,
      defense: 3,
      luck: 4,
      intelligence: 13,
      vitality: 4,
      spirit: 8,
      technique: 7,
      tenacity: 3
    };
  }

  return {
    attack: 5,
    defense: 4,
    luck: 7,
    intelligence: 7,
    vitality: 6,
    spirit: 13,
    technique: 4,
    tenacity: 5
  };
}

export function localizedClassName(className: CharacterClass) {
  if (className === "warrior") return "戰士";
  if (className === "assassin") return "刺客";
  if (className === "mage") return "法師";
  return "補師";
}

export function localizedRole(role: CombatRole) {
  if (role === "tank") return "坦克";
  if (role === "dps") return "輸出";
  if (role === "healer") return "治療";
  return "均衡";
}

export function classDefaultLoadout(className: CharacterClass): LoadoutSummary {
  if (className === "warrior") {
    return {
      preferredRole: "tank",
      blessing: "鋼鐵誓約",
      title: "前線破陣者",
      equipment: ["厚刃長劍", "訓練護甲"],
      skills: ["盾牆", "裂地", "怒吼"]
    };
  }

  if (className === "assassin") {
    return {
      preferredRole: "dps",
      blessing: "影步直覺",
      title: "黑衣雙刃",
      equipment: ["雙短劍", "煙霧披風"],
      skills: ["背刺", "影步", "弱點連斬"]
    };
  }

  if (className === "mage") {
    return {
      preferredRole: "dps",
      blessing: "星紋法印",
      title: "秘術觀測者",
      equipment: ["學徒法杖", "導流長袍"],
      skills: ["火矢", "寒霜", "奧術潮湧"]
    };
  }

  return {
    preferredRole: "healer",
    blessing: "聖輝恩典",
    title: "晨光祈禱者",
    equipment: ["聖枝權杖", "祈福披肩"],
    skills: ["治癒", "祝福", "淨化"]
  };
}

export function starterTitle(className: CharacterClass) {
  return classDefaultLoadout(className).title;
}

export function starterStatusEffects(): StatusEffect[] {
  return [
    {
      id: randomId("status"),
      name: "初心者祝福",
      description: "剛踏上旅途的角色會獲得一段短暫的新手保護。",
      kind: "buff",
      source: "title"
    }
  ];
}

export function starterSubRoleSlots(): SubRoleSlot[] {
  return [
    { slot: 1, item: null },
    { slot: 2, item: null },
    { slot: 3, item: null }
  ];
}

export function starterSecondaryCharacters() {
  return [
    {
      slot: 1,
      characterId: null,
      level: 1,
      exp: 0,
      unlockedSkillIds: [],
      lastTriggeredSkillId: null,
      cooldownUntilTick: null
    },
    {
      slot: 2,
      characterId: null,
      level: 1,
      exp: 0,
      unlockedSkillIds: [],
      lastTriggeredSkillId: null,
      cooldownUntilTick: null
    },
    {
      slot: 3,
      characterId: null,
      level: 1,
      exp: 0,
      unlockedSkillIds: [],
      lastTriggeredSkillId: null,
      cooldownUntilTick: null
    }
  ];
}

export function specialSkillCatalog(): SpecialSkillDefinition[] {
  return [
    {
      id: "class_blade_guard",
      name: "王者防壁",
      source: "class",
      requiredClass: "warrior",
      detail: "戰士專屬，攻防並重。",
      statBonus: { defense: 2, tenacity: 1 }
    },
    {
      id: "class_shadow_step",
      name: "影步處決",
      source: "class",
      requiredClass: "assassin",
      detail: "刺客專屬，提升技巧與爆發。",
      statBonus: { attack: 1, technique: 2 }
    },
    {
      id: "class_arcane_burst",
      name: "奧術爆裂",
      source: "class",
      requiredClass: "mage",
      detail: "法師專屬，提升智慧與法術輸出。",
      statBonus: { intelligence: 2, technique: 1 }
    },
    {
      id: "class_holy_grace",
      name: "聖光恩典",
      source: "class",
      requiredClass: "priest",
      detail: "補師專屬，提升速度與續戰。",
      statBonus: { spirit: 2, vitality: 1 }
    },
    {
      id: "kirito_starburst",
      name: "星爆氣流斬",
      source: "secondary",
      detail: "桐人風格雙劍連擊，強化攻擊與技巧。",
      statBonus: { attack: 2, technique: 2 }
    },
    {
      id: "asuna_mothers_rosario",
      name: "聖母聖詠",
      source: "secondary",
      detail: "亞絲娜高速突刺連段，強化技巧與速度。",
      statBonus: { technique: 2, spirit: 1 }
    },
    {
      id: "naruto_rasengan",
      name: "螺旋丸",
      source: "secondary",
      detail: "鳴人式近身爆發，強化體力與攻擊。",
      statBonus: { attack: 2, vitality: 1 }
    },
    {
      id: "gojo_infinity",
      name: "無下限術式",
      source: "secondary",
      detail: "五條悟風格防禦術式，強化智慧與防禦。",
      statBonus: { intelligence: 2, defense: 1 }
    },
    {
      id: "zelda_master_sword",
      name: "大師劍光",
      source: "secondary",
      detail: "林克風格劍技，強化攻擊與韌性。",
      statBonus: { attack: 1, tenacity: 2 }
    },
    {
      id: "jotaro_ora_ora",
      name: "歐拉歐拉",
      source: "secondary",
      detail: "承太郎風格高速拳連打，強化攻擊、速度與技巧。",
      statBonus: { attack: 2, spirit: 2, technique: 1 }
    },
    {
      id: "jotaro_time_stop",
      name: "時間暫停",
      source: "secondary",
      detail: "時間系爆發，開出追加行動窗口並壓低敵方攻勢。",
      statBonus: { spirit: 3, technique: 2 }
    },
    {
      id: "luffy_gatling",
      name: "橡膠機關槍",
      source: "secondary",
      detail: "魯夫高速連拳，適合高體力近戰壓制。",
      statBonus: { attack: 2, vitality: 2 }
    },
    {
      id: "luffy_gear_second",
      name: "二檔加速",
      source: "secondary",
      detail: "短時間提升速度與連打節奏。",
      statBonus: { attack: 2, spirit: 2, vitality: 1 }
    },
    {
      id: "tanjiro_water_breathing",
      name: "水之呼吸",
      source: "secondary",
      detail: "炭治郎穩定連斬，兼具技巧與韌性。",
      statBonus: { technique: 2, tenacity: 1 }
    },
    {
      id: "tanjiro_hinokami",
      name: "火之神神樂",
      source: "secondary",
      detail: "高爆發劍舞，強化攻擊與智慧判斷。",
      statBonus: { attack: 2, intelligence: 1, technique: 2 }
    },
    {
      id: "rem_morningstar",
      name: "流星錘亂舞",
      source: "secondary",
      detail: "雷姆近身壓制，強化攻擊與防禦。",
      statBonus: { attack: 2, defense: 1, vitality: 1 }
    },
    {
      id: "rem_healing_maid",
      name: "女僕急救",
      source: "secondary",
      detail: "雷姆支援節奏，能在戰鬥中補血。",
      statBonus: { spirit: 2, vitality: 1 }
    },
    {
      id: "edward_alchemy_spear",
      name: "鍊成長槍",
      source: "secondary",
      detail: "愛德華以鍊金術突刺破防。",
      statBonus: { intelligence: 2, technique: 2 }
    },
    {
      id: "edward_alchemy_parry",
      name: "鍊成壁反制",
      source: "secondary",
      detail: "鍊成防壁反制 Boss 攻勢。",
      statBonus: { defense: 2, intelligence: 1, technique: 1 }
    },
    {
      id: "manual_secret_breath",
      name: "秘傳呼吸法",
      source: "manual",
      detail: "秘籍解鎖的特殊呼吸法，提升全局續戰。",
      statBonus: { vitality: 1, spirit: 1, technique: 1 }
    },
    {
      id: "manual_time_pulse",
      name: "時脈密技",
      source: "manual",
      detail: "秘籍解鎖的時間系基礎，提升速度與反擊窗口。",
      statBonus: { spirit: 2, technique: 1 }
    }
  ];
}

export function secondaryCharacterCatalog(): SecondaryCharacterDefinition[] {
  return [
    {
      id: "kirito",
      name: "桐人",
      origin: "Sword Art Online",
      role: "雙劍刺客",
      weapon: "闡釋者 / 逐暗者",
      detail: "高速雙劍連擊，適合刺客與戰士主定位。",
      statBonus: { attack: 2, technique: 2 },
      unlockedSkillIds: ["kirito_starburst"]
    },
    {
      id: "asuna",
      name: "亞絲娜",
      origin: "Sword Art Online",
      role: "閃光劍士",
      weapon: "細劍 Lambent Light",
      detail: "高速突刺與支援節奏，兼顧輸出與速度。",
      statBonus: { technique: 2, spirit: 1 },
      unlockedSkillIds: ["asuna_mothers_rosario"]
    },
    {
      id: "naruto",
      name: "漩渦鳴人",
      origin: "Naruto",
      role: "近戰爆發",
      weapon: "查克拉與影分身",
      detail: "高體力、高爆發，適合前排與刺客混搭。",
      statBonus: { attack: 2, vitality: 2 },
      unlockedSkillIds: ["naruto_rasengan"]
    },
    {
      id: "gojo",
      name: "五條悟",
      origin: "Jujutsu Kaisen",
      role: "術式法師",
      weapon: "無下限術式",
      detail: "高智慧與防禦，適合法師與補師配置。",
      statBonus: { intelligence: 2, defense: 1, luck: 1 },
      unlockedSkillIds: ["gojo_infinity"]
    },
    {
      id: "link",
      name: "林克",
      origin: "The Legend of Zelda",
      role: "全能劍士",
      weapon: "大師之劍",
      detail: "穩定攻防與韌性，適合任何主定位補強。",
      statBonus: { attack: 1, defense: 1, tenacity: 2 },
      unlockedSkillIds: ["zelda_master_sword"]
    },
    {
      id: "jotaro",
      name: "承太郎",
      origin: "Stardust Crusaders",
      role: "時間拳手",
      weapon: "白金之星",
      detail: "高速拳連打與時間暫停，適合想測爆發與反擊節奏。",
      statBonus: { attack: 2, spirit: 3, technique: 2, tenacity: 1 },
      unlockedSkillIds: ["jotaro_ora_ora"]
    },
    {
      id: "luffy",
      name: "魯夫",
      origin: "One Piece",
      role: "橡膠船長",
      weapon: "橡膠拳與二檔",
      detail: "高體力連拳角色，適合前排或輸出位測試連打。",
      statBonus: { attack: 2, vitality: 3, spirit: 1 },
      unlockedSkillIds: ["luffy_gatling"]
    },
    {
      id: "tanjiro",
      name: "炭治郎",
      origin: "Demon Slayer",
      role: "呼吸劍士",
      weapon: "日輪刀",
      detail: "穩定劍技與爆發劍舞，適合技巧型角色。",
      statBonus: { attack: 1, technique: 3, tenacity: 1 },
      unlockedSkillIds: ["tanjiro_water_breathing"]
    },
    {
      id: "rem",
      name: "雷姆",
      origin: "Re:Zero",
      role: "鬼族支援",
      weapon: "流星錘",
      detail: "能打能補，適合隊伍需要續戰時裝備。",
      statBonus: { attack: 2, defense: 1, spirit: 2, vitality: 1 },
      unlockedSkillIds: ["rem_morningstar"]
    },
    {
      id: "edward",
      name: "愛德華",
      origin: "Fullmetal Alchemist",
      role: "鍊金術師",
      weapon: "鍊成長槍與防壁",
      detail: "智慧與技巧型角色，能破防也能降低 Boss 攻勢。",
      statBonus: { intelligence: 3, technique: 2, defense: 1 },
      unlockedSkillIds: ["edward_alchemy_spear"]
    }
  ];
}

export function defaultGameplaySpecialSkillCatalog(): SpecialSkillDefinition[] {
  return [
    {
      id: "class_blade_guard",
      name: "王者防壁",
      source: "class",
      requiredClass: "warrior",
      detail: "戰士熟練技，提升防禦與韌性。",
      statBonus: { defense: 2, tenacity: 1 },
      unlockLevel: 1
    },
    {
      id: "class_shadow_step",
      name: "影步處決",
      source: "class",
      requiredClass: "assassin",
      detail: "刺客熟練技，提升攻擊與技巧。",
      statBonus: { attack: 1, technique: 2 },
      unlockLevel: 1
    },
    {
      id: "class_arcane_burst",
      name: "奧術爆裂",
      source: "class",
      requiredClass: "mage",
      detail: "法師熟練技，提升智慧與技巧。",
      statBonus: { intelligence: 2, technique: 1 },
      unlockLevel: 1
    },
    {
      id: "class_holy_grace",
      name: "聖光恩典",
      source: "class",
      requiredClass: "priest",
      detail: "補師熟練技，提升速度與體力。",
      statBonus: { spirit: 2, vitality: 1 },
      unlockLevel: 1
    },
    {
      id: "kirito_starburst",
      name: "星爆氣流斬",
      source: "secondary",
      detail: "桐人雙劍高速連擊，造成大量物理傷害。",
      statBonus: { attack: 2, technique: 2 },
      unlockLevel: 1,
      baseChance: 0.42,
      cooldownTurns: 2,
      hitCount: 16,
      hitLabel: "雙劍連斬",
      finisherText: "第 16 hit：終結斬",
      logStyle: "multi_hit"
    },
    {
      id: "kirito_dual_blades",
      name: "雙劍解放",
      source: "secondary",
      detail: "桐人進入雙劍節奏，追加技巧傷害。",
      statBonus: { attack: 2, technique: 3 },
      unlockLevel: 3,
      baseChance: 0.36,
      cooldownTurns: 2
    },
    {
      id: "kirito_eclipse",
      name: "日蝕連斬",
      source: "secondary",
      detail: "桐人高階連斬，造成爆發傷害。",
      statBonus: { attack: 3, technique: 3 },
      unlockLevel: 5,
      baseChance: 0.3,
      cooldownTurns: 3
    },
    {
      id: "asuna_mothers_rosario",
      name: "聖母聖詠",
      source: "secondary",
      detail: "亞絲娜高速突刺，造成傷害並小幅治療隊友。",
      statBonus: { technique: 2, spirit: 1 },
      unlockLevel: 1,
      baseChance: 0.42,
      cooldownTurns: 2
    },
    {
      id: "asuna_flash_thrust",
      name: "閃光突刺",
      source: "secondary",
      detail: "亞絲娜連續突刺，提升技巧輸出。",
      statBonus: { technique: 3 },
      unlockLevel: 3,
      baseChance: 0.36,
      cooldownTurns: 2
    },
    {
      id: "asuna_healing_rhythm",
      name: "治癒節奏",
      source: "secondary",
      detail: "亞絲娜支援節奏，治療最低血量隊友。",
      statBonus: { spirit: 3 },
      unlockLevel: 5,
      baseChance: 0.32,
      cooldownTurns: 3
    },
    {
      id: "naruto_rasengan",
      name: "螺旋丸",
      source: "secondary",
      detail: "鳴人近身爆發，造成體術傷害。",
      statBonus: { attack: 2, vitality: 1 },
      unlockLevel: 1,
      baseChance: 0.42,
      cooldownTurns: 2
    },
    {
      id: "naruto_shadow_clone",
      name: "多重影分身",
      source: "secondary",
      detail: "鳴人分身追擊，追加多段傷害。",
      statBonus: { attack: 2, vitality: 2 },
      unlockLevel: 3,
      baseChance: 0.36,
      cooldownTurns: 2
    },
    {
      id: "naruto_sage_mode",
      name: "仙人模式",
      source: "secondary",
      detail: "鳴人高階爆發，造成大量傷害。",
      statBonus: { attack: 3, vitality: 3 },
      unlockLevel: 5,
      baseChance: 0.3,
      cooldownTurns: 3
    },
    {
      id: "gojo_infinity",
      name: "無下限術式",
      source: "secondary",
      detail: "五條悟術式壓制，造成法術傷害並降低 Boss 攻擊。",
      statBonus: { intelligence: 2, defense: 1 },
      unlockLevel: 1,
      baseChance: 0.4,
      cooldownTurns: 2
    },
    {
      id: "gojo_blue",
      name: "術式順轉 蒼",
      source: "secondary",
      detail: "五條悟牽引術式，造成智慧傷害。",
      statBonus: { intelligence: 3 },
      unlockLevel: 3,
      baseChance: 0.34,
      cooldownTurns: 2
    },
    {
      id: "gojo_purple",
      name: "虛式 茈",
      source: "secondary",
      detail: "五條悟高階術式，造成巨大法術傷害。",
      statBonus: { intelligence: 4 },
      unlockLevel: 5,
      baseChance: 0.28,
      cooldownTurns: 3
    },
    {
      id: "zelda_master_sword",
      name: "大師劍光",
      source: "secondary",
      detail: "林克大師劍斬擊，造成穩定傷害。",
      statBonus: { attack: 1, tenacity: 2 },
      unlockLevel: 1,
      baseChance: 0.4,
      cooldownTurns: 2
    },
    {
      id: "zelda_shield_parry",
      name: "盾反",
      source: "secondary",
      detail: "林克盾反，造成傷害並降低下次 Boss 攻擊。",
      statBonus: { defense: 2, tenacity: 2 },
      unlockLevel: 3,
      baseChance: 0.34,
      cooldownTurns: 2
    },
    {
      id: "zelda_triforce_courage",
      name: "勇氣三角力",
      source: "secondary",
      detail: "林克高階勇氣爆發，強化攻防傷害。",
      statBonus: { attack: 2, defense: 2, tenacity: 2 },
      unlockLevel: 5,
      baseChance: 0.28,
      cooldownTurns: 3
    },
    {
      id: "jotaro_ora_ora",
      name: "歐拉歐拉",
      source: "secondary",
      detail: "承太郎高速拳連打，逐 hit 造成物理傷害。",
      statBonus: { attack: 2, spirit: 2, technique: 1 },
      unlockLevel: 1,
      baseChance: 0.46,
      cooldownTurns: 2,
      hitCount: 12,
      hitLabel: "歐拉連打",
      finisherText: "第 12 hit：白金收拳",
      logStyle: "multi_hit"
    },
    {
      id: "jotaro_time_stop",
      name: "時間暫停",
      source: "secondary",
      detail: "時間停止期間追加行動窗口，傷害較高並大幅降低 Boss 下一次攻擊。",
      statBonus: { spirit: 3, technique: 2 },
      unlockLevel: 3,
      baseChance: 0.3,
      cooldownTurns: 3,
      hitCount: 6,
      hitLabel: "停時追擊",
      finisherText: "時間恢復：最後一擊",
      logStyle: "multi_hit"
    },
    {
      id: "jotaro_star_platinum",
      name: "白金精密打擊",
      source: "secondary",
      detail: "精密近身打擊，提高技巧暴擊與反擊節奏。",
      statBonus: { attack: 2, technique: 3 },
      unlockLevel: 5,
      baseChance: 0.32,
      cooldownTurns: 2
    },
    {
      id: "luffy_gatling",
      name: "橡膠機關槍",
      source: "secondary",
      detail: "魯夫高速連拳，逐 hit 造成物理傷害。",
      statBonus: { attack: 2, vitality: 2 },
      unlockLevel: 1,
      baseChance: 0.44,
      cooldownTurns: 2,
      hitCount: 10,
      hitLabel: "橡膠連拳",
      finisherText: "第 10 hit：重拳收尾",
      logStyle: "multi_hit"
    },
    {
      id: "luffy_gear_second",
      name: "二檔加速",
      source: "secondary",
      detail: "二檔加速後追加高速打擊。",
      statBonus: { attack: 2, spirit: 2, vitality: 1 },
      unlockLevel: 3,
      baseChance: 0.36,
      cooldownTurns: 2,
      hitCount: 7,
      hitLabel: "二檔追擊",
      finisherText: "蒸汽爆發：終段重擊",
      logStyle: "multi_hit"
    },
    {
      id: "luffy_nika_dawn",
      name: "解放之鼓",
      source: "secondary",
      detail: "高階爆發，兼具傷害與壓制。",
      statBonus: { attack: 3, vitality: 3, spirit: 2 },
      unlockLevel: 5,
      baseChance: 0.28,
      cooldownTurns: 3,
      hitCount: 8,
      hitLabel: "自由連打",
      finisherText: "黎明重擊",
      logStyle: "multi_hit"
    },
    {
      id: "tanjiro_water_breathing",
      name: "水之呼吸",
      source: "secondary",
      detail: "炭治郎水流連斬，穩定造成技巧傷害。",
      statBonus: { technique: 2, tenacity: 1 },
      unlockLevel: 1,
      baseChance: 0.42,
      cooldownTurns: 2,
      hitCount: 6,
      hitLabel: "水流斬",
      finisherText: "水面斬：收刀",
      logStyle: "multi_hit"
    },
    {
      id: "tanjiro_hinokami",
      name: "火之神神樂",
      source: "secondary",
      detail: "高爆發劍舞，造成大量傷害。",
      statBonus: { attack: 2, intelligence: 1, technique: 2 },
      unlockLevel: 3,
      baseChance: 0.34,
      cooldownTurns: 2,
      hitCount: 8,
      hitLabel: "火舞連斬",
      finisherText: "日暈之龍：終舞",
      logStyle: "multi_hit"
    },
    {
      id: "tanjiro_opening_thread",
      name: "破綻之線",
      source: "secondary",
      detail: "讀取敵方破綻，降低 Boss 下一次攻擊。",
      statBonus: { luck: 1, technique: 3 },
      unlockLevel: 5,
      baseChance: 0.3,
      cooldownTurns: 3
    },
    {
      id: "rem_morningstar",
      name: "流星錘亂舞",
      source: "secondary",
      detail: "雷姆流星錘連擊，造成穩定傷害。",
      statBonus: { attack: 2, defense: 1, vitality: 1 },
      unlockLevel: 1,
      baseChance: 0.42,
      cooldownTurns: 2,
      hitCount: 6,
      hitLabel: "錘擊",
      finisherText: "終段重砸",
      logStyle: "multi_hit"
    },
    {
      id: "rem_healing_maid",
      name: "女僕急救",
      source: "secondary",
      detail: "雷姆支援最低血量隊友。",
      statBonus: { spirit: 2, vitality: 1 },
      unlockLevel: 3,
      baseChance: 0.34,
      cooldownTurns: 2
    },
    {
      id: "rem_oni_guard_parry",
      name: "鬼化護衛",
      source: "secondary",
      detail: "鬼化後反制攻勢，降低 Boss 下一次攻擊。",
      statBonus: { attack: 2, defense: 2, tenacity: 1 },
      unlockLevel: 5,
      baseChance: 0.3,
      cooldownTurns: 3
    },
    {
      id: "edward_alchemy_spear",
      name: "鍊成長槍",
      source: "secondary",
      detail: "愛德華以鍊金術突刺破防。",
      statBonus: { intelligence: 2, technique: 2 },
      unlockLevel: 1,
      baseChance: 0.42,
      cooldownTurns: 2
    },
    {
      id: "edward_alchemy_parry",
      name: "鍊成壁反制",
      source: "secondary",
      detail: "鍊成防壁反制 Boss 攻勢。",
      statBonus: { defense: 2, intelligence: 1, technique: 1 },
      unlockLevel: 3,
      baseChance: 0.34,
      cooldownTurns: 2
    },
    {
      id: "edward_fullmetal_burst",
      name: "鋼之鍊成爆發",
      source: "secondary",
      detail: "高階鍊成爆發，造成智慧與技巧傷害。",
      statBonus: { intelligence: 3, technique: 3 },
      unlockLevel: 5,
      baseChance: 0.28,
      cooldownTurns: 3,
      hitCount: 5,
      hitLabel: "鍊成連擊",
      finisherText: "等價交換：終段爆破",
      logStyle: "multi_hit"
    },
    {
      id: "manual_secret_breath",
      name: "秘傳呼吸法",
      source: "manual",
      detail: "秘籍解鎖的呼吸法，提升續戰。",
      statBonus: { vitality: 1, spirit: 1, technique: 1 },
      unlockLevel: 1
    },
    {
      id: "manual_time_pulse",
      name: "時脈密技",
      source: "manual",
      detail: "秘籍解鎖的時間系基礎，提升速度與反擊窗口。",
      statBonus: { spirit: 2, technique: 1 },
      unlockLevel: 1
    }
  ];
}

export function gameplaySpecialSkillCatalog(): SpecialSkillDefinition[] {
  return runtimeGameConfig?.specialSkills || defaultGameplaySpecialSkillCatalog();
}

export function defaultGameplaySecondaryCharacterCatalog(): SecondaryCharacterDefinition[] {
  return [
    {
      id: "kirito",
      name: "桐人",
      origin: "Sword Art Online",
      role: "雙劍刺客",
      weapon: "闡釋者 / 逐暗者",
      detail: "高速雙劍連擊，適合刺客與戰士主定位。",
      statBonus: { attack: 2, technique: 2 },
      unlockedSkillIds: ["kirito_starburst", "kirito_dual_blades", "kirito_eclipse"],
      classAffinity: { warrior: 1.15, assassin: 1.25, mage: 0.8, priest: 0.85 },
      preferredEquipmentSlots: ["weapon", "offhand"]
    },
    {
      id: "asuna",
      name: "亞絲娜",
      origin: "Sword Art Online",
      role: "閃光劍士",
      weapon: "細劍 Lambent Light",
      detail: "高速突刺與支援節奏，兼顧輸出與速度。",
      statBonus: { technique: 2, spirit: 1 },
      unlockedSkillIds: ["asuna_mothers_rosario", "asuna_flash_thrust", "asuna_healing_rhythm"],
      classAffinity: { warrior: 1, assassin: 1.2, mage: 0.9, priest: 1.15 },
      preferredEquipmentSlots: ["weapon"]
    },
    {
      id: "naruto",
      name: "漩渦鳴人",
      origin: "Naruto",
      role: "近戰爆發",
      weapon: "查克拉與影分身",
      detail: "高體力、高爆發，適合前排與刺客混搭。",
      statBonus: { attack: 2, vitality: 2 },
      unlockedSkillIds: ["naruto_rasengan", "naruto_shadow_clone", "naruto_sage_mode"],
      classAffinity: { warrior: 1.15, assassin: 1.1, mage: 0.85, priest: 0.9 },
      preferredEquipmentSlots: ["weapon", "kneepad"]
    },
    {
      id: "gojo",
      name: "五條悟",
      origin: "Jujutsu Kaisen",
      role: "術式法師",
      weapon: "無下限術式",
      detail: "高智慧與防禦，適合法師與補師配置。",
      statBonus: { intelligence: 2, defense: 1, luck: 1 },
      unlockedSkillIds: ["gojo_infinity", "gojo_blue", "gojo_purple"],
      classAffinity: { warrior: 0.85, assassin: 0.95, mage: 1.3, priest: 1.1 },
      preferredEquipmentSlots: ["offhand", "helmet"]
    },
    {
      id: "link",
      name: "林克",
      origin: "The Legend of Zelda",
      role: "全能劍士",
      weapon: "大師之劍",
      detail: "穩定攻防與韌性，適合任何主定位補強。",
      statBonus: { attack: 1, defense: 1, tenacity: 2 },
      unlockedSkillIds: ["zelda_master_sword", "zelda_shield_parry", "zelda_triforce_courage"],
      classAffinity: { warrior: 1.25, assassin: 1, mage: 0.85, priest: 0.95 },
      preferredEquipmentSlots: ["weapon", "offhand"]
    },
    {
      id: "jotaro",
      name: "承太郎",
      origin: "Stardust Crusaders",
      role: "時間拳手",
      weapon: "白金之星",
      detail: "歐拉歐拉與時間暫停，適合測試高速連段、反擊與 Boss 壓制。",
      statBonus: { attack: 2, spirit: 3, technique: 2, tenacity: 1 },
      unlockedSkillIds: ["jotaro_ora_ora", "jotaro_time_stop", "jotaro_star_platinum"],
      classAffinity: { warrior: 1.2, assassin: 1.25, mage: 0.95, priest: 0.9 },
      preferredEquipmentSlots: ["weapon", "offhand", "kneepad"]
    },
    {
      id: "luffy",
      name: "魯夫",
      origin: "One Piece",
      role: "橡膠船長",
      weapon: "橡膠拳與二檔",
      detail: "高體力連拳角色，適合前排或輸出位測試連打。",
      statBonus: { attack: 2, vitality: 3, spirit: 1 },
      unlockedSkillIds: ["luffy_gatling", "luffy_gear_second", "luffy_nika_dawn"],
      classAffinity: { warrior: 1.2, assassin: 1.15, mage: 0.8, priest: 0.9 },
      preferredEquipmentSlots: ["weapon", "kneepad"]
    },
    {
      id: "tanjiro",
      name: "炭治郎",
      origin: "Demon Slayer",
      role: "呼吸劍士",
      weapon: "日輪刀",
      detail: "穩定劍技與爆發劍舞，適合技巧型角色。",
      statBonus: { attack: 1, technique: 3, tenacity: 1 },
      unlockedSkillIds: ["tanjiro_water_breathing", "tanjiro_hinokami", "tanjiro_opening_thread"],
      classAffinity: { warrior: 1.1, assassin: 1.25, mage: 0.85, priest: 1 },
      preferredEquipmentSlots: ["weapon"]
    },
    {
      id: "rem",
      name: "雷姆",
      origin: "Re:Zero",
      role: "鬼族支援",
      weapon: "流星錘",
      detail: "能打能補，適合隊伍需要續戰時裝備。",
      statBonus: { attack: 2, defense: 1, spirit: 2, vitality: 1 },
      unlockedSkillIds: ["rem_morningstar", "rem_healing_maid", "rem_oni_guard_parry"],
      classAffinity: { warrior: 1.05, assassin: 0.95, mage: 0.85, priest: 1.25 },
      preferredEquipmentSlots: ["weapon", "armor"]
    },
    {
      id: "edward",
      name: "愛德華",
      origin: "Fullmetal Alchemist",
      role: "鍊金術師",
      weapon: "鍊成長槍與防壁",
      detail: "智慧與技巧型角色，能破防也能降低 Boss 攻勢。",
      statBonus: { intelligence: 3, technique: 2, defense: 1 },
      unlockedSkillIds: ["edward_alchemy_spear", "edward_alchemy_parry", "edward_fullmetal_burst"],
      classAffinity: { warrior: 0.9, assassin: 1.05, mage: 1.25, priest: 1.05 },
      preferredEquipmentSlots: ["offhand", "helmet"]
    }
  ];
}

export function gameplaySecondaryCharacterCatalog(): SecondaryCharacterDefinition[] {
  return runtimeGameConfig?.secondaryCharacters || defaultGameplaySecondaryCharacterCatalog();
}

export function starterEquipmentSlots(): EquipmentSlots {
  return {
    weapon: null,
    offhand: null,
    helmet: null,
    armor: null,
    kneepad: null,
    pet: null,
    avatar: null
  };
}

export function cloneCharacter(character: CharacterProfile): CharacterProfile {
  return JSON.parse(JSON.stringify(character)) as CharacterProfile;
}

export function maxHpForCharacter(character: Pick<CharacterProfile, "level" | "stats">) {
  return (
    80 + character.level * 8 + character.stats.vitality * 4 + character.stats.defense * 3 + character.stats.tenacity
  );
}

export function maxMpForCharacter(character: Pick<CharacterProfile, "level" | "stats">) {
  return (
    30 + character.level * 5 + character.stats.intelligence * 4 + character.stats.spirit * 3 + character.stats.technique
  );
}

export function maxEnergyForCharacter(character: Pick<CharacterProfile, "level" | "stats">) {
  return (
    60 + character.level * 6 + character.stats.vitality * 2 + character.stats.spirit * 2 + character.stats.technique * 2
  );
}

export function nextLevelRequirement(level: number) {
  // 前期升得快、後期放緩的成長曲線：L1≈110、L5≈520、L10≈1340、L16≈2630、L20≈3650
  return Math.max(60, Math.round(70 + Math.pow(Math.max(1, level), 1.5) * 40));
}

export function bossBaseHp(memberCount: number, battleContext: BattleContext = "raid", averageBattleLevel = 1) {
  const levelFactor = Math.max(0, averageBattleLevel - 1);
  const levelScale = 1 + levelFactor * 0.2 + levelFactor * levelFactor * 0.01;
  const base = (180 + memberCount * 80) * levelScale;
  if (battleContext === "castle") return Math.round(base * 1.15);
  if (battleContext === "factionBoss" || battleContext === "guildBoss") return Math.round(base * 1.3);
  if (battleContext === "worldBoss") return Math.round(base * 1.6);
  return Math.round(base);
}

export function bossBaseAttack(memberCount: number, battleContext: BattleContext = "raid", averageBattleLevel = 1) {
  const levelScale = 1 + Math.max(0, averageBattleLevel - 1) * 0.07;
  const base = (11 + memberCount * 3) * levelScale;
  if (battleContext === "castle") return Math.round(base * 1.1);
  if (battleContext === "factionBoss" || battleContext === "guildBoss") return Math.round(base * 1.25);
  if (battleContext === "worldBoss") return Math.round(base * 1.45);
  return Math.round(base);
}

export function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

// 依敵人名稱關鍵字挑選有變化、貼合屬性的攻擊招式名，避免戰報每次都只寫「攻擊」。
const BOSS_ATTACK_MOVE_POOLS: Array<{ test: RegExp; moves: string[] }> = [
  { test: /火|焰|熔|炎|灼|燃|爆/, moves: ["熔岩噴發", "烈焰橫掃", "焦爆衝擊", "燎原突刺", "餘燼爪擊"] },
  { test: /冰|霜|雪|凍|寒/, moves: ["霜爆突刺", "寒冰碎擊", "凍霜重壓", "極寒吐息", "冰棘穿刺"] },
  { test: /毒|腐|瘴|蟲|沼|菌/, moves: ["劇毒撕咬", "腐蝕吐息", "瘴氣噴吐", "毒棘亂刺", "腐液潑灑"] },
  { test: /符|法|奧|魔|術|晶|靈|咒/, moves: ["奧能轟擊", "符咒爆裂", "魔力洪流", "晶刃齊射", "禁咒爆發"] },
  { test: /石|岩|巨|像|機關|傀儡|甲|殼|核/, moves: ["碎地猛擊", "巨力踏擊", "盾牆衝撞", "落石轟砸", "地裂重錘"] },
  { test: /狼|獸|牙|爪|豬|鼠|蜂/, moves: ["撕裂猛撲", "連環爪擊", "獠牙咬擊", "野性衝撞", "亂抓狂咬"] }
];
const BOSS_ATTACK_MOVE_DEFAULT = ["橫掃重擊", "連環突刺", "蓄力猛攻", "破甲斬擊", "壓制踏擊", "迅捷突進"];

export function bossAttackMoveName(bossName: string) {
  const matched = BOSS_ATTACK_MOVE_POOLS.find((entry) => entry.test.test(bossName));
  return randomFrom(matched ? matched.moves : BOSS_ATTACK_MOVE_DEFAULT);
}

export function capLogs(logs: string[]) {
  return logs.slice(-60);
}

export function updateCharacterStat(character: CharacterProfile, statKey: CharacterStatKey, amount: number) {
  character.stats[statKey] += amount;
  character.maxHp = maxHpForCharacter(character);
  character.maxMp = maxMpForCharacter(character);
  character.maxEnergy = maxEnergyForCharacter(character);
  character.hp = clamp(character.hp, 0, character.maxHp);
  character.mp = clamp(character.mp, 0, character.maxMp);
  character.energy = clamp(character.energy, 0, character.maxEnergy);
}

export function setPreferredRole(character: CharacterProfile, role: CombatRole) {
  character.loadout.preferredRole = role;
}

export function actionLabel(actionType: ActionType) {
  const labels: Record<ActionType, string> = {
    fishing: "釣魚",
    jump_rope: "跳繩",
    reading: "讀書",
    push_ups: "伏地挺身",
    meditation: "沉思",
    boxing: "拳擊",
    rest: "休息",
    mine_shallow: "淺層挖礦",
    mine_deep: "深層挖礦",
    forge: "鍛造"
  };
  return labels[actionType];
}

export function actionDurationMs(actionType: ActionType, durationHours?: number) {
  if (actionType === "mine_shallow" || actionType === "mine_deep" || actionType === "forge") {
    const hours = durationHours && [1, 2, 4, 8, 12].includes(durationHours) ? durationHours : 1;
    return hours * 60 * 60 * 1000;
  }
  return 60 * 60 * 1000;
}

export function actionDurationLabel(actionType: ActionType, durationHours?: number) {
  if (actionType === "mine_shallow" || actionType === "mine_deep" || actionType === "forge") {
    return `${durationHours || 1} 小時`;
  }
  return "1 小時";
}

export function equipmentSlotLabel(slot: EquipmentSlotKey) {
  const labels: Record<EquipmentSlotKey, string> = {
    weapon: "主武器",
    offhand: "副武器",
    helmet: "頭盔",
    armor: "盔甲",
    kneepad: "護膝",
    pet: "寵物",
    avatar: "替身"
  };
  return labels[slot];
}

export function factionSeedSummaries(): Array<Pick<FactionSummary, "id" | "name" | "color" | "description">> {
  return [
    { id: "faction_ember", name: "炎燼", color: "#e85d4f", description: "以攻勢與遠征聞名的前線陣營。" },
    { id: "faction_tide", name: "潮汐", color: "#4f9fe8", description: "擅長調度與戰術協作的海風陣營。" },
    { id: "faction_gale", name: "疾風", color: "#62c67f", description: "節奏迅猛，偏好突襲與快攻的機動陣營。" },
    { id: "faction_stone", name: "磐石", color: "#b58952", description: "穩守與反擊兼具，善於長線經營。" },
    { id: "faction_lumen", name: "晨曦", color: "#d7bb4f", description: "重視支援與信念，擅長資源整合。" }
  ];
}

export function seedCastles(): CastleState[] {
  const factions = factionSeedSummaries();
  const layerConfigs: Array<Pick<CastleState, "layerName" | "specialty" | "distanceFromCapital" | "buildSlots">> = [
    { layerName: "核心據點", specialty: "capital", distanceFromCapital: 0, buildSlots: 4 },
    { layerName: "外層一：農礦帶", specialty: "agriculture", distanceFromCapital: 1, buildSlots: 3 },
    { layerName: "外層二：討伐帶", specialty: "boss", distanceFromCapital: 2, buildSlots: 3 },
    { layerName: "外層三：礦脈帶", specialty: "mining", distanceFromCapital: 3, buildSlots: 2 },
    { layerName: "外層四：商路前線", specialty: "trade", distanceFromCapital: 4, buildSlots: 2 }
  ];
  return Array.from({ length: 25 }, (_, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const ownerFaction = factions[row];
    const isCapital = col === 0;
    const layerConfig = layerConfigs[col];
    return {
      id: `castle_${row + 1}_${col + 1}`,
      name: `${ownerFaction.name}${isCapital ? "首都" : `城池 ${col}`}`,
      row,
      col,
      layer: col,
      layerName: layerConfig.layerName,
      specialty: layerConfig.specialty,
      distanceFromCapital: layerConfig.distanceFromCapital,
      buildSlots: layerConfig.buildSlots,
      facilities: isCapital ? ["議事廳", "倉庫"] : [],
      ownerFactionId: ownerFaction.id,
      fortification: 100,
      maxFortification: 100,
      terrainAdvantage: isCapital ? 28 : 12 + col * 3,
      autoDefensePower: isCapital ? 95 : 45 + col * 12,
      garrisonSlots: isCapital ? 8 : 3 + Math.max(0, 4 - col),
      siegeResistance: isCapital ? 24 : 10 + col * 2,
      isCapital,
      bossName: isCapital ? `${ownerFaction.name}守城統領` : `${ownerFaction.name}守城隊長`,
      bossHp: isCapital ? 350 : 280,
      bossAttack: isCapital ? 32 : 24,
      rewardGold: isCapital ? 120 : 80,
      rewardMaterials: isCapital ? 60 : 36,
      bossSkills: isCapital
        ? ["統領號令：提高守軍攻擊", "壁壘反擊：依城防造成額外傷害", "士氣重整：低血量時提高防禦"]
        : col === 2
          ? ["破甲重擊：降低前排防禦", "召喚小隊：延長戰鬥壓力", "狂暴：血量低時提高攻擊"]
          : ["重擊：造成高額傷害", "防禦姿態：降低受到傷害"],
      rewardSummary: isCapital
        ? "大量公庫金幣與稀有戰利品機率"
        : col === 2
          ? "Boss 個人素材、戰鬥經驗與公庫金幣"
          : "公庫金幣與一般戰利品",
      mapNodePurpose: (["capital", "gathering", "guild_boss", "mining", "trade"] as const)[col],
      layerBenefit: [
        "公會管理、科技、倉庫與城防",
        "農業採集區：採集與精力恢復較快",
        "Boss 討伐區：公會 Boss、爬層與討伐營",
        "礦脈區：材料、鍛造素材與深層礦",
        "商路前線：玩家市場、交易與攻城前哨"
      ][col]
    };
  });
}

export function defaultShopItems(): ShopItem[] {
  return [
    {
      id: "shop_healing_tea",
      name: "回神茶",
      category: "consumable",
      price: 35,
      description: "簡單的補給飲品。",
      effectSummary: "精力 +12",
      stock: "infinite",
      energyBonus: 12
    },
    {
      id: "shop_bronze_blade",
      name: "青銅短刃",
      category: "equipment",
      equipmentSlot: "weapon",
      price: 120,
      description: "能撐過前期戰鬥的練習武器。",
      effectSummary: "攻擊 +1，耐久 70",
      stock: "infinite",
      rarity: "common",
      attackBonus: 1,
      statBonus: { attack: 1 },
      durability: 70,
      maxDurability: 70
    },
    {
      id: "shop_lucky_charm",
      name: "幸運護符",
      category: "sub_slot",
      price: 180,
      description: "小巧的護身物。",
      effectSummary: "運氣 +1",
      stock: "infinite",
      rarity: "uncommon",
      statBonus: { luck: 1 }
    },
    {
      id: "shop_forge_manual",
      name: "鍛造筆記",
      category: "manual",
      price: 220,
      description: "記錄常見鍛造心得的入門筆記。",
      effectSummary: "技巧 +1，智力 +1",
      stock: "infinite",
      rarity: "rare",
      statBonus: { technique: 1, intelligence: 1 }
    },
    {
      id: "shop_time_manual",
      name: "時脈密技",
      category: "manual",
      price: 360,
      description: "記錄時間系行動節奏的秘籍。",
      effectSummary: "速度 +2，技巧 +1，解鎖時間系技能",
      stock: "infinite",
      rarity: "epic",
      statBonus: { spirit: 2, technique: 1 }
    }
  ];
}

export function staticShopItems(): ShopItem[] {
  return runtimeGameConfig?.shopItems || defaultShopItems();
}

export function defaultForgeOptions(): ForgeOption[] {
  return [
    {
      id: "forge_weapon",
      name: "鍛造主武器",
      equipmentSlot: "weapon",
      materialCost: 20,
      effectSummary: "攻擊 +3，運氣 +1，耐久 100",
      attackBonus: 3,
      luckBonus: 1,
      statBonus: { attack: 3, luck: 1 },
      durability: 100,
      maxDurability: 100,
      recommendedMaterials: ["iron_ore", "silver_ore"]
    },
    {
      id: "forge_offhand",
      name: "鍛造副武器",
      equipmentSlot: "offhand",
      materialCost: 16,
      effectSummary: "防禦 +2，技巧 +1，耐久 100",
      defenseBonus: 2,
      statBonus: { defense: 2, technique: 1 },
      durability: 100,
      maxDurability: 100,
      recommendedMaterials: ["iron_ore", "leather"]
    },
    {
      id: "forge_helmet",
      name: "鍛造頭盔",
      equipmentSlot: "helmet",
      materialCost: 14,
      effectSummary: "防禦 +2，耐久 120",
      defenseBonus: 2,
      statBonus: { defense: 2 },
      durability: 120,
      maxDurability: 120,
      recommendedMaterials: ["iron_ore", "cloth"]
    },
    {
      id: "forge_armor",
      name: "鍛造盔甲",
      equipmentSlot: "armor",
      materialCost: 24,
      effectSummary: "防禦 +4，體力 +1，耐久 140",
      defenseBonus: 4,
      statBonus: { defense: 4, vitality: 1 },
      durability: 140,
      maxDurability: 140,
      recommendedMaterials: ["iron_ore", "obsidian_ore", "leather"]
    },
    {
      id: "forge_kneepad",
      name: "鍛造護膝",
      equipmentSlot: "kneepad",
      materialCost: 12,
      effectSummary: "防禦 +1，技巧 +1，耐久 110",
      defenseBonus: 1,
      statBonus: { defense: 1, technique: 1 },
      durability: 110,
      maxDurability: 110,
      recommendedMaterials: ["copper_ore", "bone"]
    }
  ];
}

export function forgeOptions(): ForgeOption[] {
  return runtimeGameConfig?.forgeOptions || defaultForgeOptions();
}

// Minecraft 式精確配方：材料種類與數量完全一致才會命中，命中產出特殊強力裝備
export function defaultForgeRecipes(): ForgeRecipe[] {
  return [
    {
      id: "recipe_obsidian_blade",
      name: "黑曜霸刃",
      equipmentSlot: "weapon",
      ingredients: { obsidian_ore: 5, iron_ore: 2 },
      effectSummary: "攻擊 +8，技巧 +2",
      statBonus: { attack: 8, technique: 2 },
      durability: 160,
      rarity: "epic",
      qualityTier: "epic",
      lore: "五份黑曜配雙鐵芯，刃口吞光。"
    },
    {
      id: "recipe_starfall_staff",
      name: "隕星法杖",
      equipmentSlot: "weapon",
      ingredients: { stardust: 3, bone: 2 },
      effectSummary: "智慧 +7，速度 +2",
      statBonus: { intelligence: 7, spirit: 2 },
      durability: 120,
      rarity: "epic",
      qualityTier: "epic",
      lore: "星塵纏繞獸骨，引落星之力。"
    },
    {
      id: "recipe_silver_aegis_armor",
      name: "白銀聖鎧",
      equipmentSlot: "armor",
      ingredients: { silver_ore: 4, cloth: 3 },
      effectSummary: "防禦 +6，速度 +2，體力 +2",
      statBonus: { defense: 6, spirit: 2, vitality: 2 },
      durability: 180,
      rarity: "epic",
      qualityTier: "epic",
      lore: "銀光織入聖布，邪祟不侵。"
    },
    {
      id: "recipe_dragonbone_bulwark",
      name: "龍骨重盾",
      equipmentSlot: "offhand",
      ingredients: { bone: 5, obsidian_ore: 2 },
      effectSummary: "防禦 +5，韌性 +4",
      statBonus: { defense: 5, tenacity: 4 },
      durability: 170,
      rarity: "epic",
      qualityTier: "epic",
      lore: "巨獸脊骨鑲黑曜，撞不碎的牆。"
    },
    {
      id: "recipe_starmark_circlet",
      name: "星紋頭環",
      equipmentSlot: "helmet",
      ingredients: { stardust: 2, silver_ore: 2, cloth: 1 },
      effectSummary: "智慧 +4，運氣 +3",
      statBonus: { intelligence: 4, luck: 3 },
      durability: 130,
      rarity: "rare",
      qualityTier: "masterwork",
      lore: "星紋在額前流轉，靈感不斷。"
    },
    {
      id: "recipe_swiftshadow_kneepads",
      name: "疾影皮護膝",
      equipmentSlot: "kneepad",
      ingredients: { leather: 4, cloth: 2 },
      effectSummary: "技巧 +5，運氣 +2",
      statBonus: { technique: 5, luck: 2 },
      durability: 120,
      rarity: "rare",
      qualityTier: "masterwork",
      lore: "輕若無物，步法快人一拍。"
    },
    {
      id: "recipe_prospector_pick",
      name: "礦工尋寶鎬",
      equipmentSlot: "weapon",
      ingredients: { copper_ore: 4, iron_ore: 2 },
      effectSummary: "運氣 +6，攻擊 +2",
      statBonus: { luck: 6, attack: 2 },
      durability: 110,
      rarity: "rare",
      qualityTier: "masterwork",
      lore: "老礦工說：銅四鐵二，挖到寶。"
    },
    {
      id: "recipe_ironwall_helm",
      name: "鐵壁戰盔",
      equipmentSlot: "helmet",
      ingredients: { iron_ore: 5, leather: 2 },
      effectSummary: "防禦 +5，體力 +2",
      statBonus: { defense: 5, vitality: 2 },
      durability: 150,
      rarity: "rare",
      qualityTier: "masterwork",
      lore: "五鐵雙革，正面硬接重錘。"
    }
  ];
}

export function forgeRecipes(): ForgeRecipe[] {
  return runtimeGameConfig?.forgeRecipes?.length ? runtimeGameConfig.forgeRecipes : defaultForgeRecipes();
}

export function createRecipeEquipment(input: {
  recipe: ForgeRecipe;
  forgeLevel: number;
  craftedBy?: string;
}): InventoryItem {
  const { recipe } = input;
  const quality = qualityTierMeta(recipe.qualityTier);
  const maxDurability = Math.round(recipe.durability + input.forgeLevel * 3);
  const itemLevel = Math.max(
    3,
    Math.round(input.forgeLevel + Object.values(recipe.ingredients).reduce((sum, qty) => sum + (qty || 0), 0))
  );
  return {
    id: randomId("item"),
    name: `${recipe.name}（${quality.label}）`,
    category: "equipment",
    effectSummary: `特殊配方產物：${recipe.effectSummary}${recipe.lore ? `。${recipe.lore}` : ""}`,
    equipmentSlot: recipe.equipmentSlot,
    rarity: recipe.rarity,
    craftSource: Object.entries(recipe.ingredients)
      .map(([type, qty]) => `${type}x${qty}`)
      .join(","),
    statBonus: { ...recipe.statBonus },
    attackBonus: recipe.statBonus.attack || 0,
    defenseBonus: recipe.statBonus.defense || 0,
    luckBonus: recipe.statBonus.luck || 0,
    tenacityBonus: recipe.statBonus.tenacity || 0,
    durability: maxDurability,
    maxDurability,
    isBroken: false,
    sortOrder: 0,
    stackable: false,
    quantity: 1,
    materialType: null,
    prefixName: recipe.name,
    suffixName: quality.label,
    qualityTier: recipe.qualityTier,
    itemLevel,
    sellPrice: Math.max(80, itemLevel * 20),
    salvagePrice: Math.max(30, itemLevel * 8),
    craftedBy: input.craftedBy || null,
    craftedAt: nowIso()
  };
}

export function matchForgeRecipe(materialTypes: MaterialType[], recipes = forgeRecipes()): ForgeRecipe | null {
  const counts = new Map<MaterialType, number>();
  for (const type of materialTypes) counts.set(type, (counts.get(type) || 0) + 1);
  for (const recipe of recipes) {
    const entries = Object.entries(recipe.ingredients) as Array<[MaterialType, number]>;
    if (!entries.length) continue;
    const exact = entries.length === counts.size && entries.every(([type, qty]) => counts.get(type) === qty);
    if (exact) return recipe;
  }
  return null;
}

export function defaultSoloDifficulties(): GameConfig["soloDifficulties"] {
  return {
    easy: { label: "簡單", hp: 90, attack: 12, gold: 24, exp: 18, qty: 1, risk: "低風險" },
    normal: { label: "普通", hp: 145, attack: 18, gold: 42, exp: 32, qty: 1, risk: "穩定" },
    hard: { label: "困難", hp: 220, attack: 26, gold: 72, exp: 54, qty: 2, risk: "高壓" },
    elite: { label: "菁英", hp: 330, attack: 36, gold: 120, exp: 90, qty: 3, risk: "危險" }
  };
}

export function gameplaySoloDifficulties(): GameConfig["soloDifficulties"] {
  return runtimeGameConfig?.soloDifficulties || defaultSoloDifficulties();
}

export function defaultSiegeRules(): GameConfig["siegeRules"] {
  return {
    durationMinutes: 20,
    tickIntervalSeconds: 60,
    baseEnergyCost: 9,
    minorFortificationDamage: 3,
    breakthroughMultiplier: 0.18,
    defenderTerrainMultiplier: 1.25,
    autoDefenseScaling: 1,
    minAttackerEnergy: 5
  };
}

export function defaultTowerRules(): GameConfig["towerRules"] {
  return {
    baseStepsRequired: 5,
    stepsPerSceneBand: 1,
    maxStepsRequired: 12,
    rushEnergyCost: 5,
    huntEnergyCost: 7,
    rushDoubleStepChance: 0.72,
    rushSingleStepChance: 0.22,
    huntStepChance: 0.38,
    bossFindChanceRush: 0.32,
    bossFindChanceHunt: 0.22,
    minorBossChanceRush: 0.22,
    minorBossChanceHunt: 0.36,
    bossHpMultiplier: 1,
    bossAttackMultiplier: 1,
    rewardMultiplier: 1,
    checkpointInterval: 2,
    checkpointGold: 18,
    checkpointBattleExp: 12,
    checkpointMaterialQuantity: 1
  };
}

export function gameplayTowerRules(): GameConfig["towerRules"] {
  return runtimeGameConfig?.towerRules || defaultTowerRules();
}

export function defaultPlayerAttackRules(): GameConfig["playerAttackRules"] {
  return {
    energyCost: 12,
    maxRounds: 5,
    attackerWinBattleExp: 36,
    attackerLoseBattleExp: 16,
    defenderWinBattleExp: 26,
    defenderLoseBattleExp: 12,
    baseGoldSteal: 12,
    goldStealPerBattleLevel: 4,
    goldStealLuckMultiplier: 0.8,
    minGoldSteal: 8,
    maxGoldSteal: 120
  };
}

export function gameplayPlayerAttackRules(): GameConfig["playerAttackRules"] {
  return runtimeGameConfig?.playerAttackRules || defaultPlayerAttackRules();
}

export function defaultWorldBossRules(): GameConfig["worldBossRules"] {
  return {
    bossName: "裂界魔龍",
    bossHp: 520,
    bossAttack: 34,
    maxRounds: 12,
    rewardGold: 420,
    rewardMaterials: 8,
    materialType: "stardust",
    firstWinPersonalGoldRate: 0.35,
    firstWinMaterialRate: 0.5,
    firstWinBattleExp: 120,
    repeatWinPersonalGold: 60,
    repeatWinGuildGold: 80,
    repeatWinBattleExp: 70,
    lossPersonalGold: 24,
    lossGuildGold: 30,
    lossBattleExp: 32,
    participationMaterials: 1
  };
}

export function gameplayWorldBossRules(): GameConfig["worldBossRules"] {
  return runtimeGameConfig?.worldBossRules || defaultWorldBossRules();
}

export function defaultRoomBossRules(): GameConfig["roomBossRules"] {
  return {
    bossName: "裂岩巨像",
    tickIntervalMs: 2000,
    hpMultiplier: 1,
    attackMultiplier: 1,
    winBattleExp: 18,
    lossBattleExp: 8,
    winInstinctExp: 10,
    lossInstinctExp: 4,
    winGold: 36,
    lossGold: 12
  };
}

export function gameplayRoomBossRules(): GameConfig["roomBossRules"] {
  return runtimeGameConfig?.roomBossRules || defaultRoomBossRules();
}

export function defaultStatRules(): GameConfig["statRules"] {
  return {
    attack: {
      attackPower: 3,
      defensePower: 0.4,
      sustain: 0,
      siege: 1.8,
      growth: 1,
      summary: "提高攻擊傷害（補師則轉化為治療量）；攻城時提高破防與對守軍傷害。"
    },
    defense: {
      attackPower: 0.6,
      defensePower: 2.6,
      sustain: 0.6,
      siege: 0.8,
      growth: 1,
      summary: "提高百分比減傷、最大 HP 與格擋減傷量。"
    },
    luck: {
      attackPower: 0.9,
      defensePower: 0.8,
      sustain: 0.4,
      siege: 0.8,
      growth: 1,
      summary: "提高幸運特殊事件機率（與對手比運：閃避、奇遇、讓對手失足）並小幅提高暴擊。"
    },
    intelligence: {
      attackPower: 1.6,
      defensePower: 1.2,
      sustain: 0.4,
      siege: 1.4,
      growth: 1,
      summary: "提高技能觸發率與技能傷害，並小幅提升技能暴擊；法師主屬性。"
    },
    vitality: {
      attackPower: 0.8,
      defensePower: 1.4,
      sustain: 2,
      siege: 0.6,
      growth: 1,
      summary: "提高最大 HP 並回復精力；小幅穩定心態（較不因心態低落而降傷或退縮）。"
    },
    spirit: {
      attackPower: 0.9,
      defensePower: 1.3,
      sustain: 1.7,
      siege: 0.7,
      growth: 1,
      summary: "顯示為速度：大幅提高連擊接續次數與閃避，小幅提高反擊與暴擊，並回復 MP、延長時間系技能窗口。"
    },
    technique: {
      attackPower: 2,
      defensePower: 1.1,
      sustain: 0.5,
      siege: 1.7,
      growth: 1,
      summary: "大幅提高反擊、格擋與暴擊率，小幅提高閃避與命中。"
    },
    tenacity: {
      attackPower: 0.5,
      defensePower: 2,
      sustain: 2.2,
      siege: 0.7,
      growth: 1,
      summary: "大幅穩定心態（幾乎不因心態低落而降傷或投降），提供固定減傷並降低裝備耐久損耗。"
    }
  };
}

export function defaultGameConfig(): GameConfig {
  return {
    specialSkills: defaultGameplaySpecialSkillCatalog(),
    secondaryCharacters: defaultGameplaySecondaryCharacterCatalog(),
    soloDifficulties: defaultSoloDifficulties(),
    shopItems: defaultShopItems(),
    forgeOptions: defaultForgeOptions(),
    forgeRecipes: defaultForgeRecipes(),
    siegeRules: defaultSiegeRules(),
    statRules: defaultStatRules(),
    towerRules: defaultTowerRules(),
    playerAttackRules: defaultPlayerAttackRules(),
    worldBossRules: defaultWorldBossRules(),
    roomBossRules: defaultRoomBossRules()
  };
}

export function buildSkillLogLines(input: {
  actorName: string;
  characterName: string;
  skill: SpecialSkillDefinition;
  targetName: string;
  damage: number;
  healing?: number;
  healingTargetName?: string | null;
}) {
  const shouldUseMultiHit = input.skill.logStyle === "multi_hit" || input.skill.source === "secondary";
  const requestedHitCount = Math.max(
    shouldUseMultiHit ? 4 : 1,
    Math.round(input.skill.hitCount || (shouldUseMultiHit ? 4 : 1))
  );
  const hitCount = Math.min(requestedHitCount, Math.max(1, input.damage));
  if (!shouldUseMultiHit || hitCount <= 1) {
    return [
      `【角色技能】${input.actorName} 的 ${input.characterName} 自動施放「${input.skill.name}」，對 ${input.targetName} 造成 ${input.damage} 點傷害${
        input.healing ? `，並回復 ${input.healingTargetName || input.actorName} ${input.healing} HP` : ""
      }。`
    ];
  }

  const hitLabel = input.skill.hitLabel || "連擊";
  const lines = [`【角色技能】${input.actorName} 的 ${input.characterName} 發動「${input.skill.name}」。`];
  let remaining = input.damage;
  for (let index = 1; index <= hitCount; index += 1) {
    const slotsLeft = hitCount - index;
    const budget = Math.max(1, remaining - slotsLeft);
    const scaled = Math.round((input.damage / hitCount) * (0.78 + (index / hitCount) * 0.44));
    const hitDamage = index === hitCount ? remaining : Math.max(1, Math.min(budget, scaled));
    remaining -= hitDamage;
    if (index === hitCount) {
      lines.push(
        `${hitCount === requestedHitCount && input.skill.finisherText ? input.skill.finisherText : `第 ${hitCount} hit：終結斬`}，造成 ${hitDamage} 點傷害；總傷害 ${input.damage}。${
          input.healing ? ` 並回復 ${input.healingTargetName || input.actorName} ${input.healing} HP。` : ""
        }`
      );
    } else {
      lines.push(`${hitLabel} ${index} / ${hitCount}：造成 ${hitDamage} 點傷害。`);
    }
  }
  return lines;
}

export function resolveTimeStopWindow(input: {
  actorName: string;
  targetName: string;
  stats: CharacterStats;
  battleLevel: number;
  slotLevel: number;
  manualActive: boolean;
  followUpSkillNames?: string[];
}) {
  const speed = input.stats.spirit;
  const technique = input.stats.technique;
  const battleLevel = Math.max(1, input.battleLevel || 1);
  const slotLevel = Math.max(1, input.slotLevel || 1);
  const windowMultiplier = input.manualActive ? 1.18 : 1;
  const normalAttack = Math.max(
    4,
    Math.round((input.stats.attack * 0.72 + technique * 0.42 + battleLevel * 2.2) * windowMultiplier)
  );
  const knifeThrow = Math.max(
    3,
    Math.round((technique * 0.58 + speed * 0.48 + input.stats.luck * 0.24 + slotLevel) * windowMultiplier)
  );
  const followUpNames = input.followUpSkillNames?.filter(Boolean) || [];
  const followUpName = followUpNames.length ? randomFrom(followUpNames) : "破綻精密打擊";
  const followUpDamage = Math.max(
    5,
    Math.round(
      (input.stats.attack * 0.35 + input.stats.intelligence * 0.42 + technique * 0.46 + battleLevel) * windowMultiplier
    )
  );
  const manualDamage = input.manualActive ? Math.max(4, Math.round((speed + technique + slotLevel * 2) * 0.32)) : 0;
  const recoveredEnergy = Math.max(1, Math.round(speed / (input.manualActive ? 4 : 6)));
  const recoveredMp = input.manualActive ? 2 : 0;
  const logs = [
    `時間暫停：${input.actorName} 停住 ${input.targetName}，展開${input.manualActive ? "延長" : "短暫"}行動窗口。`,
    `追加行動：${input.actorName} 普通攻擊造成 ${normalAttack} 點傷害。`,
    `追加行動：${input.actorName} 丟出飛刀造成 ${knifeThrow} 點傷害。`,
    `追加行動：${input.actorName} 接續「${followUpName}」造成 ${followUpDamage} 點傷害。`
  ];
  if (input.manualActive) {
    logs.push(`時脈密技：窗口延長，再造成 ${manualDamage} 點傷害並回復 ${recoveredMp} MP。`);
  }
  logs.push(`時間恢復流動：${input.actorName} 回復 ${recoveredEnergy} 精力，${input.targetName} 下一次攻勢被壓低。`);

  return {
    damage: normalAttack + knifeThrow + followUpDamage + manualDamage,
    recoveredEnergy,
    recoveredMp,
    bossAttackModifier: input.manualActive ? 0.56 : 0.68,
    logs
  };
}

export function hasEquippedTimeManual(character: Pick<CharacterProfile, "learnedManuals" | "equippedManuals">) {
  const equipped = new Set(character.equippedManuals);
  return character.learnedManuals.some(
    (manual) =>
      equipped.has(manual.manualId) &&
      (manual.unlockedSkillId === "manual_time_pulse" ||
        manual.manualId.includes("time") ||
        manual.name.includes("時脈"))
  );
}

export function materialCatalog(): Array<{
  type: MaterialType;
  name: string;
  weight: number;
  affinity: Partial<Record<EquipmentSlotKey, number>>;
}> {
  return [
    {
      type: "iron_ore",
      name: "鐵礦",
      weight: 36,
      affinity: { weapon: 3, offhand: 2, helmet: 2, armor: 3, kneepad: 2 }
    },
    { type: "copper_ore", name: "銅礦", weight: 22, affinity: { weapon: 2, offhand: 3, kneepad: 2 } },
    { type: "silver_ore", name: "銀礦", weight: 14, affinity: { weapon: 2, offhand: 2, helmet: 1 } },
    { type: "obsidian_ore", name: "黑曜礦", weight: 10, affinity: { weapon: 4, armor: 3 } },
    { type: "stardust", name: "星砂", weight: 8, affinity: { weapon: 1, offhand: 1, pet: 2, avatar: 2 } },
    { type: "leather", name: "皮革", weight: 16, affinity: { offhand: 2, armor: 2, kneepad: 3 } },
    { type: "cloth", name: "布料", weight: 16, affinity: { helmet: 2, armor: 1, avatar: 2 } },
    { type: "bone", name: "骨材", weight: 12, affinity: { weapon: 1, kneepad: 3, pet: 2 } }
  ];
}

export function materialName(type: MaterialType) {
  return materialCatalog().find((entry) => entry.type === type)?.name || type;
}

export function createMaterialItem(type: MaterialType, quantity = 1): InventoryItem {
  return {
    id: randomId("item"),
    name: materialName(type),
    category: "material",
    effectSummary: "鍛造與修復素材",
    rarity: type === "obsidian_ore" || type === "stardust" ? "rare" : "common",
    craftSource: null,
    isBroken: false,
    sortOrder: 0,
    stackable: true,
    quantity,
    materialType: type,
    prefixName: null,
    suffixName: null,
    qualityTier: null,
    tenacityBonus: 0,
    itemLevel: 1,
    sellPrice: null,
    salvagePrice: null,
    craftedBy: null,
    craftedAt: null
  };
}

export function qualityTierMeta(tier: QualityTier) {
  const map: Record<QualityTier, { label: string; rarity: InventoryItem["rarity"]; multiplier: number }> = {
    rough: { label: "粗製", rarity: "common", multiplier: 0.8 },
    standard: { label: "標準", rarity: "common", multiplier: 1 },
    fine: { label: "精良", rarity: "uncommon", multiplier: 1.2 },
    masterwork: { label: "精品", rarity: "rare", multiplier: 1.45 },
    epic: { label: "史詩級", rarity: "epic", multiplier: 1.75 },
    divine: { label: "神工級", rarity: "epic", multiplier: 2.1 }
  };
  return map[tier];
}

export function pickQualityTier(score: number): QualityTier {
  if (score >= 92) return "divine";
  if (score >= 80) return "epic";
  if (score >= 66) return "masterwork";
  if (score >= 52) return "fine";
  if (score >= 38) return "standard";
  return "rough";
}

export function createForgedEquipment(input: {
  equipmentSlot: EquipmentSlotKey;
  customName?: string;
  materialTypes: MaterialType[];
  stats: CharacterStats;
  instinctLevel: number;
  forgeLevel: number;
  craftedBy?: string;
}): InventoryItem {
  const materialInfo = materialCatalog();
  const materials = input.materialTypes
    .map((type) => materialInfo.find((entry) => entry.type === type))
    .filter(Boolean) as Array<(typeof materialInfo)[number]>;
  const materialCount = Math.max(1, materials.length);
  const affinityScore = materials.reduce((sum, entry) => sum + (entry.affinity[input.equipmentSlot] || 0), 0);
  const qualityScore =
    24 +
    affinityScore * 4 +
    materialCount * 2 +
    input.forgeLevel * 3 +
    input.instinctLevel * 2 +
    input.stats.luck +
    input.stats.technique +
    Math.floor(Math.random() * 18);
  const qualityTier = pickQualityTier(qualityScore);
  const quality = qualityTierMeta(qualityTier);
  const baseTypeName =
    input.equipmentSlot === "weapon"
      ? "長刃"
      : input.equipmentSlot === "offhand"
        ? "護手"
        : input.equipmentSlot === "helmet"
          ? "頭盔"
          : input.equipmentSlot === "armor"
            ? "戰甲"
            : input.equipmentSlot === "kneepad"
              ? "護膝"
              : input.equipmentSlot === "pet"
                ? "靈寵"
                : "替身";
  const primaryMaterial = materials[0]?.name || "素材";
  const customName = (input.customName || "").trim();
  const prefixName = customName || primaryMaterial;
  const suffixName = `${quality.label}${baseTypeName}`;
  const basePower = Math.max(1, Math.round(materialCount * quality.multiplier));
  const attackBonus = input.equipmentSlot === "weapon" ? basePower + Math.floor(input.stats.attack / 8) : 0;
  const defenseBonus = ["offhand", "helmet", "armor", "kneepad"].includes(input.equipmentSlot)
    ? basePower + Math.floor(input.stats.defense / 10)
    : 0;
  const luckBonus = Math.max(
    0,
    Math.floor((input.stats.luck + materialCount) / 10) +
      (qualityTier === "divine" ? 2 : qualityTier === "epic" ? 1 : 0)
  );
  const tenacityBonus = Math.max(
    0,
    Math.floor((input.stats.tenacity + materialCount) / 12) + (input.equipmentSlot === "armor" ? 1 : 0)
  );
  const techniqueBonus = Math.max(
    0,
    input.equipmentSlot === "offhand" || input.equipmentSlot === "kneepad" ? Math.floor(basePower / 2) : 0
  );
  const vitalityBonus = Math.max(0, input.equipmentSlot === "armor" ? Math.floor(basePower / 2) : 0);
  const durabilityBase = input.equipmentSlot === "armor" ? 130 : input.equipmentSlot === "helmet" ? 110 : 100;
  const maxDurability = Math.round(
    durabilityBase + materialCount * 4 + input.forgeLevel * 2 + input.stats.tenacity * 1.5
  );
  const itemLevel = Math.max(1, Math.round((input.instinctLevel + input.forgeLevel + materialCount) / 2));
  const statBonus: Partial<CharacterStats> = {
    ...(attackBonus ? { attack: attackBonus } : {}),
    ...(defenseBonus ? { defense: defenseBonus } : {}),
    ...(luckBonus ? { luck: luckBonus } : {}),
    ...(tenacityBonus ? { tenacity: tenacityBonus } : {}),
    ...(techniqueBonus ? { technique: techniqueBonus } : {}),
    ...(vitalityBonus ? { vitality: vitalityBonus } : {})
  };

  return {
    id: randomId("item"),
    name: `${prefixName} ${suffixName}`.trim(),
    category: "equipment",
    effectSummary: `${materials.map((entry) => entry.name).join(" / ")} 打造的 ${baseTypeName}`,
    equipmentSlot: input.equipmentSlot,
    rarity: quality.rarity,
    craftSource: materials.map((entry) => entry.type).join(","),
    statBonus,
    attackBonus,
    defenseBonus,
    luckBonus,
    tenacityBonus,
    durability: maxDurability,
    maxDurability,
    isBroken: false,
    sortOrder: 0,
    stackable: false,
    quantity: 1,
    materialType: null,
    prefixName,
    suffixName,
    qualityTier,
    itemLevel,
    sellPrice: Math.max(20, itemLevel * 12 + materialCount * 6),
    salvagePrice: Math.max(8, itemLevel * 6 + materialCount * 3),
    craftedBy: input.craftedBy || null,
    craftedAt: nowIso()
  };
}

export function toInventoryItem(source: ShopItem | ForgeOption): InventoryItem {
  const rarity = "rarity" in source ? source.rarity : undefined;
  const hpBonus = "hpBonus" in source ? source.hpBonus : undefined;
  const mpBonus = "mpBonus" in source ? source.mpBonus : undefined;
  const energyBonus = "energyBonus" in source ? source.energyBonus : undefined;
  return {
    id: randomId("item"),
    name: source.name,
    category: "category" in source ? source.category : "equipment",
    effectSummary: source.effectSummary,
    equipmentSlot: source.equipmentSlot ?? null,
    rarity: rarity ?? "common",
    craftSource: "materialCost" in source ? source.id : null,
    statBonus: source.statBonus,
    attackBonus: source.attackBonus,
    defenseBonus: source.defenseBonus,
    luckBonus: source.luckBonus,
    hpBonus,
    mpBonus,
    energyBonus,
    durability: source.durability ?? null,
    maxDurability: source.maxDurability ?? null,
    isBroken: false,
    sortOrder: 0,
    stackable: false,
    quantity: 1,
    materialType: null,
    prefixName: null,
    suffixName: null,
    qualityTier: "standard",
    tenacityBonus: source.statBonus?.tenacity,
    itemLevel: 1,
    sellPrice: "price" in source ? source.price : 12,
    salvagePrice: Math.max(4, Math.floor(("price" in source ? source.price : 12) / 2)),
    craftedBy: null,
    craftedAt: null
  };
}
