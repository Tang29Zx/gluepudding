export interface WorldAssetManifestItem {
  label: string;
  path: string;
}

export const criticalWorldAssets: readonly WorldAssetManifestItem[] = [
  { label: "可行走地面", path: "/models/world/ground.glb" },
  { label: "出生点装饰", path: "/models/world/central-decor.glb" },
  { label: "樱花树远景", path: "/models/world/sakura-tree-low.glb" },
  { label: "占卜屋外壳", path: "/models/fortune/tarot_tent.glb" },
  { label: "占卜屋魔法阵", path: "/models/fortune/tarot_magic_circle.glb" },
  { label: "实验室传送台", path: "/models/laboratory/teleporter.glb" },
  { label: "天空实验室外壳", path: "/models/laboratory/dome.glb" },
  { label: "天空实验室地板", path: "/models/laboratory/glass_floor.glb" },
];

export const backgroundWorldAssets: readonly WorldAssetManifestItem[] = [
  { label: "樱花树中景", path: "/models/world/sakura-tree-mid.glb" },
  { label: "樱花树近景", path: "/models/world/sakura-tree-high.glb" },
];

export const fortuneInteriorAssets: readonly WorldAssetManifestItem[] = [
  { label: "塔罗桌", path: "/models/fortune/tarot_table.glb" },
  { label: "塔罗桌布", path: "/models/fortune/tarot_table_cloth.glb" },
  { label: "塔罗烛台", path: "/models/fortune/tarot_candle_stand.glb" },
  { label: "塔罗水晶底座", path: "/models/fortune/tarot_crystal_base.glb" },
  { label: "塔罗水晶球", path: "/models/fortune/tarot_crystal_ball.glb" },
  {
    label: "塔罗示例牌",
    path: "/models/fortune/tarot_card_sample_major_00_fool.glb",
  },
  { label: "星座穹顶", path: "/models/fortune/zodiac_star_dome.glb" },
  { label: "星座轮盘", path: "/models/fortune/zodiac_wheel.glb" },
  { label: "周易桌", path: "/models/fortune/iching_table.glb" },
  { label: "周易地纹", path: "/models/fortune/iching_floor_pattern.glb" },
  { label: "周易签筒", path: "/models/fortune/iching_lot_cylinder.glb" },
  { label: "周易铜钱", path: "/models/fortune/iching_coin.glb" },
  { label: "周易竹签", path: "/models/fortune/iching_bamboo_slips.glb" },
  { label: "周易爻线", path: "/models/fortune/iching_line_yang.glb" },
];

export const gomokuAssets: readonly WorldAssetManifestItem[] = [
  { label: "五子棋棋盘", path: "/models/gomoku/gomoku_board.glb" },
  { label: "五子棋黑子", path: "/models/gomoku/black_stone.glb" },
  { label: "五子棋白子", path: "/models/gomoku/white_stone.glb" },
];

export const audioAssets: readonly WorldAssetManifestItem[] = [
  { label: "世界音乐", path: "/audio/world_bgm.mp3" },
  { label: "占卜屋音乐", path: "/audio/fortune_bgm.mp3" },
];

const tarotTextureSlugs = [
  "fool",
  "magician",
  "high_priestess",
  "empress",
  "emperor",
  "hierophant",
  "lovers",
  "chariot",
  "strength",
  "hermit",
  "wheel_of_fortune",
  "justice",
  "hanged_man",
  "death",
  "temperance",
  "devil",
  "tower",
  "star",
  "moon",
  "sun",
  "judgement",
  "world",
] as const;

export const tarotTextureAssets: readonly WorldAssetManifestItem[] =
  tarotTextureSlugs.map((slug, index) => ({
    label: `塔罗牌面 ${index}`,
    path: `/textures/tarot/major_${String(index).padStart(2, "0")}_${slug}.jpg`,
  }));
