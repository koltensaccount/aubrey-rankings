/** Six complete systems. The original screen typography remains available through Reset. */
export const TYPOGRAPHY_STORAGE_KEY = "aubrey.prototype.typography.v1";

type Options = {
  displayWeight: string;
  titleWeight: string;
  sectionWeight: string;
  displayTracking: string;
  titleTracking: string;
  bodyTracking: string;
  displayCase: string;
  sectionCase: string;
  sectionUsesDisplay: boolean;
  displayLeading: string;
  titleLeading: string;
  bodyLeading: string;
  bodyWeight: string;
  navWeight: string;
  scoreWeight: string;
  metaTracking: string;
  displayScale: string;
  bodySize: string;
};
const defaults: Options = {
  displayWeight: "500",
  titleWeight: "500",
  sectionWeight: "600",
  displayTracking: "-.035em",
  titleTracking: "-.02em",
  bodyTracking: "0em",
  displayCase: "none",
  sectionCase: "none",
  sectionUsesDisplay: false,
  displayLeading: "1.04",
  titleLeading: "1.2",
  bodyLeading: "1.75",
  bodyWeight: "400",
  navWeight: "500",
  scoreWeight: "500",
  metaTracking: ".015em",
  displayScale: "1",
  bodySize: "14px",
};
function system(
  id: string,
  name: string,
  description: string,
  display: string,
  ui: string,
  overrides: Partial<Options>,
) {
  const o = { ...defaults, ...overrides };
  const displayFont = `"AR ${display}", ${["Newsreader", "DM Serif Display"].includes(display) ? "Georgia, serif" : "Arial, sans-serif"}`;
  const uiFont = `"AR ${ui}", Arial, sans-serif`;
  return {
    id,
    name,
    description,
    display,
    ui,
    load: [
      { family: `AR ${display}`, weight: o.displayWeight },
      { family: `AR ${display}`, weight: o.titleWeight },
      { family: `AR ${ui}`, weight: o.navWeight },
    ],
    tokens: {
      "--type-display-ink": ["DM Serif Display", "Oswald"].includes(display)
        ? ".2em"
        : ".08em",
      "--type-title-ink": display === "Oswald" ? ".16em" : "0em",
      "--type-display-font": displayFont,
      "--type-title-font": displayFont,
      "--type-section-font": o.sectionUsesDisplay ? displayFont : uiFont,
      "--type-body-font": uiFont,
      "--type-nav-font": uiFont,
      "--type-score-font": uiFont,
      "--type-meta-font": uiFont,
      "--type-display-weight": o.displayWeight,
      "--type-title-weight": o.titleWeight,
      "--type-section-weight": o.sectionWeight,
      "--type-body-weight": o.bodyWeight,
      "--type-nav-weight": o.navWeight,
      "--type-score-weight": o.scoreWeight,
      "--type-display-tracking": o.displayTracking,
      "--type-title-tracking": o.titleTracking,
      "--type-body-tracking": o.bodyTracking,
      "--type-meta-tracking": o.metaTracking,
      "--type-display-case": o.displayCase,
      "--type-section-case": o.sectionCase,
      "--type-display-leading": o.displayLeading,
      "--type-title-leading": o.titleLeading,
      "--type-body-leading": o.bodyLeading,
      "--type-display-scale": o.displayScale,
      "--type-body-size": o.bodySize,
    },
  };
}
export const TYPOGRAPHY_PRESETS = [
  system(
    "screen-title",
    "Screen title",
    "Tall, emphatic titles. Quiet, precise information.",
    "Barlow Condensed",
    "Inter",
    {
      displayWeight: "700",
      titleWeight: "600",
      displayCase: "uppercase",
      displayTracking: ".005em",
      titleTracking: ".005em",
      displayLeading: "1.1",
      displayScale: "1.12",
      navWeight: "600",
      scoreWeight: "600",
      metaTracking: ".035em",
    },
  ),
  system(
    "editorial",
    "Editorial",
    "Literary contrast with a soft, geometric interface.",
    "Newsreader",
    "Manrope",
    {
      displayWeight: "400",
      titleWeight: "500",
      sectionWeight: "500",
      sectionUsesDisplay: true,
      displayTracking: "-.045em",
      titleTracking: "-.025em",
      displayLeading: "1.03",
      bodyLeading: "1.85",
      navWeight: "600",
      scoreWeight: "500",
      metaTracking: ".01em",
    },
  ),
  system(
    "matinee",
    "Matinée",
    "Warm, sculpted letterforms with straightforward utility.",
    "DM Serif Display",
    "Work Sans",
    {
      displayWeight: "400",
      titleWeight: "400",
      sectionWeight: "400",
      sectionUsesDisplay: true,
      displayTracking: "-.02em",
      titleTracking: "-.015em",
      displayLeading: "1.08",
      displayScale: ".96",
      bodyLeading: "1.8",
      navWeight: "500",
      scoreWeight: "600",
      metaTracking: ".045em",
    },
  ),
  system(
    "quiet-modern",
    "Quiet modern",
    "One family. Clear hierarchy, generous reading rhythm.",
    "Inter",
    "Inter",
    {
      displayWeight: "600",
      titleWeight: "600",
      sectionWeight: "600",
      displayTracking: "-.055em",
      titleTracking: "-.025em",
      displayLeading: "1.08",
      displayScale: ".88",
      bodyLeading: "1.75",
      bodyTracking: "-.005em",
      scoreWeight: "500",
      metaTracking: "0em",
    },
  ),
  system(
    "new-wave",
    "New wave",
    "Wide, unconventional display type. Calm, open body text.",
    "Syne",
    "DM Sans",
    {
      displayWeight: "800",
      titleWeight: "700",
      sectionWeight: "600",
      displayTracking: "-.04em",
      titleTracking: "-.025em",
      displayLeading: "1.06",
      titleLeading: "1.22",
      displayScale: ".88",
      bodyLeading: "1.8",
      navWeight: "500",
      scoreWeight: "500",
      metaTracking: ".02em",
    },
  ),
  system(
    "festival",
    "Festival",
    "Lean cinematic titles balanced by humanist application type.",
    "Oswald",
    "IBM Plex Sans",
    {
      displayWeight: "500",
      titleWeight: "500",
      sectionWeight: "600",
      displayTracking: "-.01em",
      titleTracking: "0em",
      displayLeading: "1.08",
      displayScale: "1.04",
      navWeight: "500",
      scoreWeight: "500",
      bodyLeading: "1.8",
      metaTracking: ".04em",
    },
  ),
] as const;
