export type BrandColorToken =
  | "aurora"
  | "carbon"
  | "graphite"
  | "soft-mist"
  | "signal-white";

export interface BrandColor {
  token: BrandColorToken;
  hex: string;
  rgb: [number, number, number];
}

export interface BrandTypography {
  family: string;
  weights: {
    hero: number;
    headline: number;
    subhead: number;
    body: number;
    caption: number;
  };
  lineHeight: {
    display: number;
    body: number;
    chat: number;
  };
}

export interface BrandRadii {
  card: number;
  badge: number;
  pill: number;
}

export interface BrandTokens {
  colors: Record<BrandColorToken, BrandColor>;
  typography: BrandTypography;
  radii: BrandRadii;
  shadows: {
    card: string;
    badge: string;
  };
}

export const arcleBrandTokens: BrandTokens = {
  colors: {
    aurora: {
      token: "aurora",
      hex: "#E9F28E",
      rgb: [233, 242, 142],
    },
    carbon: {
      token: "carbon",
      hex: "#0D0D0C",
      rgb: [13, 13, 12],
    },
    graphite: {
      token: "graphite",
      hex: "#353535",
      rgb: [53, 53, 53],
    },
    "soft-mist": {
      token: "soft-mist",
      hex: "#F4F7EA",
      rgb: [244, 247, 234],
    },
    "signal-white": {
      token: "signal-white",
      hex: "#FFFFFF",
      rgb: [255, 255, 255],
    },
  },
  typography: {
    family: "Inter",
    weights: {
      hero: 800,
      headline: 700,
      subhead: 600,
      body: 400,
      caption: 300,
    },
    lineHeight: {
      display: 0.92,
      body: 1.35,
      chat: 1.4,
    },
  },
  radii: {
    card: 20,
    badge: 22,
    pill: 999,
  },
  shadows: {
    card: "0 12px 60px rgba(0,0,0,0.65)",
    badge: "0 8px 30px rgba(0,0,0,0.45)",
  },
};


