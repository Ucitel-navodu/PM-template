import type PptxGenJS from "pptxgenjs";
import type { ReportSettings, StatusReport } from "../types";
import type { StatusReportData, Roadmap } from "./report";
import type { ProjectSummary } from "./portfolio";
import { riskScore } from "./raid";
import { formatDate, formatMoney, formatPercent } from "./format";
import { itemColor, timeline, type ColorBy } from "../components/Roadmap";
import { LOGO_RATIO, logoSvg, symbolSvg } from "./brand";
import { MASK, sensitiveHidden } from "./sensitive";
import { IMPACT_LEVELS_DESC, riskMatrix, scoreFill } from "./raid";
import type { ImpactLevel, Risk } from "../types";

const LEVELS_ASC: ImpactLevel[] = ["Low", "Medium", "High", "Critical"];

/*
 * PowerPoint decks built with pptxgenjs (MIT): native, editable text boxes,
 * shapes, tables and charts - the PM can still adjust the deck in PowerPoint.
 * 16:9 (13.33 x 7.5 in). Everything is generated in the browser and saved
 * through a Blob download; nothing leaves the computer.
 */

type Tr = (key: string) => string;

// ORLEN Unipetrol PPT template (manual 6.1): red title / closing slides with the white logo and the
// graphic symbol, white content slides with a red heading, the logo bottom left and the symbol cut
// bottom right; Arial; tables with a red header; charts in the supplementary colours.
const RAG_HEX: Record<string, string> = {
  Green: "689425",
  Amber: "FBBA00",
  Red: "D81E04",
  Grey: "90A3B2",
};
/** Text on a RAG / score fill: the yellow needs dark text. */
const onFill = (fill: string) => (fill === "FBBA00" ? "2B3035" : "FFFFFF");
const RED = "D81E04";
const GREY = "676D6F";
const DARK = "2B3035";
const LINE = "E2E2E0";
const FONT = "Arial";
const hex = (c: string) => c.replace("#", "").toUpperCase();

/** SVG -> PNG data URL in the browser (PowerPoint versions without SVG support still show the image). */
async function png(svg: string, w: number, h: number): Promise<string> {
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/** Slide grid (inches, 16:9): every object stays inside the slide, content between header and footer. */
export const SLIDE = {
  w: 13.333,
  h: 7.5,
  margin: 0.5,
  contentTop: 1.35,
  contentBottom: 6.35,
  footerY: 6.85,
} as const;

/**
 * A graphic element placed "in bleed" (partly outside the slide, manual 5.4), rendered already cut to
 * the visible part, so the picture itself lies completely inside the slide and PowerPoint shows no
 * object hanging over the edge.
 */
async function bleed(
  svg: string,
  x: number,
  y: number,
  size: number,
  px = 900,
) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(SLIDE.w, x + size);
  const y1 = Math.min(SLIDE.h, y + size);
  const img = new Image();
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  await img.decode();
  const k = px / size; // pixels per inch
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((x1 - x0) * k);
  canvas.height = Math.round((y1 - y0) * k);
  canvas.getContext("2d")!.drawImage(img, (x - x0) * k, (y - y0) * k, px, px);
  return {
    data: canvas.toDataURL("image/png"),
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
  };
}

async function brandImages() {
  const logoH = 240;
  const logoW = Math.round(logoH * LOGO_RATIO);
  return {
    logo: await png(logoSvg("color"), logoW, logoH),
    logoNegative: await png(logoSvg("negative"), logoW, logoH),
    // bottom-right corner of content slides, top-right corner of the red slides
    symbol: await bleed(symbolSvg(false), 12.25, 6.55, 1.6, 480),
    symbolOnRed: await bleed(symbolSvg(true), 8.9, -1.9, 5.4, 1400),
  };
}
type BrandImages = Awaited<ReturnType<typeof brandImages>>;

/** Red title slide (also the closing slide). */
function redSlide(pptx: PptxGenJS, title: string, lines: string[] = []) {
  const slide = pptx.addSlide({ masterName: "RED" });
  slide.addText(title, {
    x: 0.8,
    y: 2.2,
    w: 8.6,
    h: 1.4,
    fontSize: 38,
    bold: true,
    color: "FFFFFF",
    fontFace: FONT,
    valign: "bottom",
  });
  lines.forEach((t, i) =>
    slide.addText(t, {
      x: 0.8,
      y: 3.7 + i * 0.45,
      w: 8.6,
      h: 0.42,
      fontSize: i ? 13 : 18,
      color: "FFFFFF",
      fontFace: FONT,
    }),
  );
  return slide;
}

/** Keep a box inside the slide (labels next to bars near the edge would otherwise hang over it). */
function inside<
  T extends {
    x?: PptxGenJS.Coord;
    y?: PptxGenJS.Coord;
    w?: PptxGenJS.Coord;
    h?: PptxGenJS.Coord;
  },
>(o: T): T {
  if (typeof o.x !== "number" || typeof o.y !== "number") return o;
  const w = typeof o.w === "number" ? Math.min(o.w, SLIDE.w) : 0;
  const h = typeof o.h === "number" ? Math.min(o.h, SLIDE.h) : 0;
  const x = Math.min(Math.max(0, o.x), SLIDE.w - w);
  const y = Math.min(Math.max(0, o.y), SLIDE.h - h);
  return {
    ...o,
    x,
    y,
    ...(typeof o.w === "number" ? { w } : {}),
    ...(typeof o.h === "number" ? { h } : {}),
  };
}

/**
 * Corporate defaults for every slide (manual 3.3 / PPT template 6.1): Arial for all text, tables and
 * charts; table body rows striped #f8f6f6 under the red header row; table lines #e2e2e0.
 */
function brandSlides(pptx: PptxGenJS) {
  const addSlide = pptx.addSlide.bind(pptx);
  pptx.addSlide = ((opts?: PptxGenJS.AddSlideProps) => {
    const slide = addSlide(opts);
    const addText = slide.addText.bind(slide);
    const addTable = slide.addTable.bind(slide);
    const addChart = slide.addChart.bind(slide);
    const addShape = slide.addShape.bind(slide);
    slide.addText = ((
      text: Parameters<typeof addText>[0],
      o?: PptxGenJS.TextPropsOptions,
    ) =>
      addText(text, inside({ fontFace: FONT, ...o }))) as typeof slide.addText;
    slide.addShape = ((
      shape: Parameters<typeof addShape>[0],
      o?: PptxGenJS.ShapeProps,
    ) => addShape(shape, inside({ ...o }))) as typeof slide.addShape;
    slide.addTable = ((
      rows: PptxGenJS.TableRow[],
      o?: PptxGenJS.TableProps,
    ) => {
      const striped = rows.map((row, ri) =>
        row.map((cell) => {
          const options = { fontFace: FONT, color: DARK, ...cell.options };
          if (ri > 0 && ri % 2 === 0 && !cell.options?.fill)
            options.fill = { color: "F8F6F6" };
          return { ...cell, options };
        }),
      );
      return addTable(striped, { fontFace: FONT, valign: "middle", ...o });
    }) as typeof slide.addTable;
    slide.addChart = ((
      type: Parameters<typeof addChart>[0],
      data: Parameters<typeof addChart>[1],
      o?: PptxGenJS.IChartOpts,
    ) =>
      addChart(type, data, {
        catAxisLabelFontFace: FONT,
        valAxisLabelFontFace: FONT,
        dataLabelFontFace: FONT,
        legendFontFace: FONT,
        titleFontFace: FONT,
        catAxisLabelColor: DARK,
        valAxisLabelColor: GREY,
        catAxisLineColor: "CBCCC9",
        valAxisLineColor: "CBCCC9",
        valGridLine: { color: "E2E2E0", size: 0.75 },
        ...o,
      })) as typeof slide.addChart;
    return slide;
  }) as typeof pptx.addSlide;
}

async function newDeck(
  settings: ReportSettings,
  title: string,
): Promise<PptxGenJS> {
  const { default: Pptx } = await import("pptxgenjs");
  const img: BrandImages = await brandImages();
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;
  pptx.company = settings.organization || "ORLEN Unipetrol";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const logoH = 0.36; // 0.36 in ≈ 35 px tall, 125 px wide: above the 50 px digital minimum
  const logoW = logoH * LOGO_RATIO;
  brandSlides(pptx);
  pptx.defineSlideMaster({
    title: "PM",
    background: { color: "FFFFFF" },
    objects: [
      // symbol cut by the slide edge (manual 5.4), pre-cropped so it lies inside the slide
      { image: img.symbol },
      {
        image: {
          data: img.logo,
          x: SLIDE.margin,
          y: SLIDE.footerY,
          w: logoW,
          h: logoH,
        },
      },
      {
        text: {
          text: [settings.organization, settings.footer]
            .filter(Boolean)
            .join(" · "),
          // exclusion zone of the logo (height of its O) kept before the footer text
          options: {
            x: SLIDE.margin + logoW + 0.35,
            y: SLIDE.footerY + 0.02,
            w: 8,
            h: 0.3,
            fontSize: 9,
            color: GREY,
            fontFace: FONT,
          },
        },
      },
    ],
    slideNumber: {
      x: 11.4,
      y: SLIDE.footerY + 0.02,
      w: 0.6,
      h: 0.3,
      fontSize: 9,
      color: GREY,
      fontFace: FONT,
    },
  });
  pptx.defineSlideMaster({
    title: "RED",
    background: { color: RED },
    objects: [
      { image: img.symbolOnRed },
      {
        image: {
          data: img.logoNegative,
          x: 0.8,
          y: 6.4,
          w: 0.48 * LOGO_RATIO,
          h: 0.48,
        },
      },
    ],
  });
  return pptx;
}

function heading(slide: PptxGenJS.Slide, text: string, sub?: string) {
  slide.addText(text, {
    x: 0.5,
    y: 0.3,
    w: 10.3,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: RED,
    fontFace: FONT,
  });
  if (sub)
    slide.addText(sub, {
      x: 0.5,
      y: 0.85,
      w: 10.3,
      h: 0.35,
      fontSize: 12,
      color: GREY,
      fontFace: FONT,
    });
}

function ragPill(
  slide: PptxGenJS.Slide,
  rag: string,
  x: number,
  y: number,
  label: string,
) {
  slide.addShape("roundRect", {
    x,
    y,
    w: 1.6,
    h: 0.5,
    fill: { color: RAG_HEX[rag] ?? RAG_HEX.Grey },
    rectRadius: 0.1,
    line: { color: RAG_HEX[rag] ?? RAG_HEX.Grey },
  });
  slide.addText(label, {
    x,
    y,
    w: 1.6,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color: onFill(RAG_HEX[rag] ?? RAG_HEX.Grey),
    align: "center",
    valign: "middle",
  });
}

function kpi(
  slide: PptxGenJS.Slide,
  x: number,
  label: string,
  value: string,
  sub = "",
) {
  slide.addShape("rect", {
    x,
    y: 1.55,
    w: 2.95,
    h: 1.15,
    fill: { color: "F8F6F6" },
    line: { color: LINE },
  });
  slide.addText(label, {
    x: x + 0.15,
    y: 1.6,
    w: 2.7,
    h: 0.3,
    fontSize: 10,
    color: GREY,
  });
  slide.addText(value, {
    x: x + 0.15,
    y: 1.9,
    w: 2.7,
    h: 0.45,
    fontSize: 20,
    bold: true,
    color: DARK,
  });
  if (sub)
    slide.addText(sub, {
      x: x + 0.15,
      y: 2.33,
      w: 2.7,
      h: 0.3,
      fontSize: 10,
      color: GREY,
    });
}

const headerRow = (cells: string[], accent: string): PptxGenJS.TableRow =>
  cells.map((text) => ({
    text,
    options: {
      bold: true,
      color: "FFFFFF",
      fill: { color: accent },
      fontSize: 10,
      fontFace: FONT,
    },
  }));

const textBox = (
  slide: PptxGenJS.Slide,
  title: string,
  body: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  slide.addText(title, {
    x,
    y,
    w,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: DARK,
  });
  slide.addText(body || "—", {
    x,
    y: y + 0.38,
    w,
    h: h - 0.38,
    fontSize: 11,
    color: DARK,
    valign: "top",
    paraSpaceAfter: 2,
  });
};

const clip = (t: string | undefined, n: number) =>
  t && t.length > n ? `${t.slice(0, n - 1)}…` : (t ?? "");

/** Split rows into pages of `size` rows (none when there are no rows). */
export function paginate<T>(rows: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size)
    pages.push(rows.slice(i, i + size));
  return pages;
}

/** Light tint of a score colour for empty cells of the map (solid, no transparency). */
const EMPTY_TINT: Record<string, string> = {
  D81E04: "FBDED9",
  FBBA00: "FFEFB8",
  "689425": "E0EBCD",
};

/** P x I map as native shapes (counts of open risks and issues). Occupies about 4.0 x 3.6 in. */
function riskMap(
  slide: PptxGenJS.Slide,
  risks: Risk[],
  tr: Tr,
  x: number,
  y: number,
) {
  const m = riskMatrix(risks);
  const cw = 0.72;
  const ch = 0.6;
  const gap = 0.06;
  const lw = 0.85;
  IMPACT_LEVELS_DESC.forEach((pr, ri) => {
    slide.addText(pr, {
      x,
      y: y + ri * (ch + gap),
      w: lw - 0.08,
      h: ch,
      fontSize: 9,
      color: GREY,
      align: "right",
      valign: "middle",
    });
    LEVELS_ASC.forEach((im, ci) => {
      const n = m[pr][im];
      const { fill, text } = scoreFill(
        riskScore({ probability: pr, impact: im }),
      );
      const cell = {
        x: x + lw + ci * (cw + gap),
        y: y + ri * (ch + gap),
        w: cw,
        h: ch,
      };
      slide.addShape("rect", {
        ...cell,
        fill: { color: n ? fill : EMPTY_TINT[fill] },
        line: { color: "FFFFFF", width: 0 },
      });
      if (n)
        slide.addText(String(n), {
          ...cell,
          fontSize: 16,
          bold: true,
          color: text,
          align: "center",
          valign: "middle",
        });
    });
  });
  const by = y + 4 * (ch + gap);
  LEVELS_ASC.forEach((im, ci) =>
    slide.addText(im, {
      x: x + lw + ci * (cw + gap),
      y: by,
      w: cw,
      h: 0.28,
      fontSize: 9,
      color: GREY,
      align: "center",
    }),
  );
  const gridW = 4 * cw + 3 * gap;
  slide.addText(`↑ ${tr("risks_probability")}   ·   ${tr("risks_impact")} →`, {
    x: x + lw,
    y: by + 0.3,
    w: gridW,
    h: 0.28,
    fontSize: 9,
    color: GREY,
    align: "center",
  });
}

/** Risk register rows (ID, type, title, area, score, owner, action, due, status). */
function riskRows(rows: Risk[], hideNotes: boolean): PptxGenJS.TableRow[] {
  return rows.map((r) => {
    const sc = riskScore(r);
    const { fill, text } = scoreFill(sc);
    return [
      { text: r.id },
      { text: r.type },
      { text: clip(r.title || r.description, 80), options: { bold: true } },
      { text: clip(r.area, 30) },
      {
        text: String(sc),
        options: {
          bold: true,
          align: "center" as const,
          color: text,
          fill: { color: fill },
        },
      },
      { text: clip(r.owner, 30) },
      ...(hideNotes
        ? []
        : [
            {
              text: clip(
                r.type === "Issue"
                  ? r.resolution || r.mitigation
                  : r.mitigation,
                130,
              ),
            },
          ]),
      { text: formatDate(r.dueDate) },
      { text: r.status },
    ];
  });
}

export const RISK_ROWS_PER_SLIDE = 12;

/**
 * Risks: (1) "risk map" slide - the P x I map on the left, on the right the counts by severity and the
 * top 5; (2) full-width "risk register" slides, 12 rows each (none when nothing is open).
 */
export function addRiskSlides(
  pptx: PptxGenJS,
  all: Risk[],
  register: Risk[],
  tr: Tr,
  hideNotes = false,
) {
  const s = pptx.addSlide({ masterName: "PM" });
  heading(
    s,
    tr("report_risk_map_title"),
    `${register.length} × ${tr("report_open_raid")}`,
  );
  riskMap(s, all, tr, SLIDE.margin, 1.55);
  const right = 5.3;
  const bands = [
    {
      label: tr("report_risk_high"),
      n: register.filter((r) => riskScore(r) >= 9).length,
      fill: "D81E04",
      text: "FFFFFF",
    },
    {
      label: tr("report_risk_medium"),
      n: register.filter((r) => riskScore(r) >= 4 && riskScore(r) < 9).length,
      fill: "FBBA00",
      text: DARK,
    },
    {
      label: tr("report_risk_low"),
      n: register.filter((r) => riskScore(r) < 4).length,
      fill: "689425",
      text: "FFFFFF",
    },
  ];
  bands.forEach((b, i) => {
    const x = right + i * 2.55;
    s.addShape("rect", {
      x,
      y: 1.55,
      w: 2.4,
      h: 0.95,
      fill: { color: b.fill },
      line: { color: b.fill },
    });
    s.addText(String(b.n), {
      x: x + 0.15,
      y: 1.58,
      w: 0.9,
      h: 0.88,
      fontSize: 28,
      bold: true,
      color: b.text,
      valign: "middle",
    });
    s.addText(b.label, {
      x: x + 0.95,
      y: 1.58,
      w: 1.4,
      h: 0.88,
      fontSize: 11,
      bold: true,
      color: b.text,
      valign: "middle",
    });
  });
  const top = register.slice(0, 5);
  s.addText(tr("report_risk_top"), {
    x: right,
    y: 2.75,
    w: 7.5,
    h: 0.35,
    fontSize: 13,
    bold: true,
    color: DARK,
  });
  if (top.length) {
    s.addTable(
      [
        headerRow(
          [
            "ID",
            tr("raid_title"),
            "P×I",
            tr("common_owner"),
            tr("risks_due_date"),
          ],
          RED,
        ),
        ...top.map((r) => {
          const { fill, text } = scoreFill(riskScore(r));
          return [
            { text: r.id },
            {
              text: clip(r.title || r.description, 70),
              options: { bold: true },
            },
            {
              text: String(riskScore(r)),
              options: {
                bold: true,
                align: "center" as const,
                color: text,
                fill: { color: fill },
              },
            },
            { text: clip(r.owner, 28) },
            { text: formatDate(r.dueDate) },
          ];
        }),
      ],
      {
        x: right,
        y: 3.15,
        w: 7.55,
        colW: [0.75, 3.7, 0.6, 1.5, 1.0],
        fontSize: 10,
        border: { type: "solid", color: LINE, pt: 0.75 },
      },
    );
  } else {
    s.addText(tr("report_no_risks"), {
      x: right,
      y: 3.15,
      w: 7.5,
      h: 0.5,
      fontSize: 12,
      color: GREY,
    });
  }

  const cols = [
    "ID",
    tr("risks_type"),
    tr("raid_title"),
    tr("common_project_area"),
    "P×I",
    tr("common_owner"),
    ...(hideNotes ? [] : [tr("raid_detail")]),
    tr("risks_due_date"),
    tr("common_status"),
  ];
  const colW = hideNotes
    ? [0.7, 0.9, 4.6, 1.8, 0.6, 1.9, 1.0, 0.83]
    : [0.65, 0.8, 2.85, 1.35, 0.55, 1.45, 3.05, 0.9, 0.78];
  const pages = paginate(register, RISK_ROWS_PER_SLIDE);
  pages.forEach((rows, i) => {
    const slide = pptx.addSlide({ masterName: "PM" });
    heading(
      slide,
      pages.length > 1
        ? `${tr("report_risk_register_title")} (${i + 1}/${pages.length})`
        : tr("report_risk_register_title"),
      tr("report_risk_register_sub"),
    );
    slide.addTable([headerRow(cols, RED), ...riskRows(rows, hideNotes)], {
      x: SLIDE.margin,
      y: SLIDE.contentTop,
      w: 12.33,
      colW,
      fontSize: 9,
      border: { type: "solid", color: LINE, pt: 0.75 },
    });
  });
}

/** RoadMap as native shapes: one slide, swimlanes, bars, milestone diamonds, today line. */
export function addRoadmapSlide(
  pptx: PptxGenJS,
  roadmap: Roadmap,
  title: string,
  colorBy: ColorBy,
  phases: string[],
  lang: "CZ" | "EN",
) {
  const slide = pptx.addSlide({ masterName: "PM" });
  heading(slide, title);
  const left = 0.5;
  const labelW = 1.7;
  const right = 12.85;
  const top = 1.35;
  const bottom = SLIDE.contentBottom; // above the logo / symbol band of the master
  const tl = timeline(roadmap.start, roadmap.end);
  const X = (key: string) =>
    left + labelW + tl.x(key) * (right - left - labelW);
  const lanes = roadmap.lanes.map((l) => ({
    ...l,
    rows: l.items.map((i) => [i]),
  }));
  const rows = lanes.reduce((n, l) => n + Math.max(1, l.rows.length), 0);
  const rowH = Math.min(
    0.42,
    (bottom - top - 0.35 - lanes.length * 0.08) / Math.max(1, rows),
  );
  const locale = lang === "CZ" ? "cs-CZ" : "en-GB";
  tl.months.forEach((m, i) => {
    const x = left + labelW + m.x * (right - left - labelW);
    const q = m.date.getMonth() % 3 === 0;
    slide.addShape("line", {
      x,
      y: top + 0.3,
      w: 0,
      h: bottom - top - 0.3,
      line: { color: q ? "CBCCC9" : "EFEEED", width: 0.75 },
    });
    const label = tl.quarterly
      ? q
        ? `Q${m.date.getMonth() / 3 + 1} ${m.date.getFullYear()}`
        : ""
      : m.date.toLocaleDateString(locale, { month: "short" });
    if (label && i < tl.months.length - 1)
      slide.addText(label, {
        x,
        y: top,
        w: 1.2,
        h: 0.28,
        fontSize: 9,
        color: GREY,
      });
  });
  let y = top + 0.35;
  lanes.forEach((lane, li) => {
    const h = Math.max(1, lane.rows.length) * rowH + 0.08;
    if (li % 2)
      slide.addShape("rect", {
        x: left,
        y,
        w: right - left,
        h,
        fill: { color: "F8F6F6" },
        line: { color: "F8F6F6" },
      });
    slide.addText(lane.name, {
      x: left + 0.05,
      y,
      w: labelW - 0.1,
      h,
      fontSize: 10,
      bold: true,
      color: DARK,
      valign: "middle",
    });
    lane.rows.forEach((row, ri) =>
      row.forEach((it) => {
        const cy = y + 0.04 + ri * rowH + rowH / 2;
        const color = hex(itemColor(it, colorBy, phases));
        const fs = Math.max(7, Math.min(9, rowH * 22));
        if (it.milestone) {
          const s = Math.min(0.26, rowH * 0.7);
          slide.addShape("diamond", {
            x: X(it.start) - s / 2,
            y: cy - s / 2,
            w: s,
            h: s,
            fill: { color },
            line: { color },
          });
          const left = X(it.start) + 2.4 > right;
          slide.addText(it.name, {
            x: left ? X(it.start) - s / 2 - 2.43 : X(it.start) + s / 2 + 0.03,
            y: cy - rowH / 2,
            w: 2.4,
            h: rowH,
            fontSize: fs,
            color: DARK,
            valign: "middle",
            align: left ? "right" : "left",
          });
          return;
        }
        const x1 = X(it.start);
        const w = Math.max(0.05, X(it.finish) - x1 + 0.01);
        const fits = w > it.name.length * 0.065 + 0.1;
        slide.addShape("roundRect", {
          x: x1,
          y: cy - rowH * 0.36,
          w,
          h: rowH * 0.72,
          fill: { color },
          line: { color },
          rectRadius: 0.05,
        });
        const left = !fits && x1 + w + 2.4 > right;
        slide.addText(
          it.name,
          fits
            ? {
                x: x1,
                y: cy - rowH / 2,
                w,
                h: rowH,
                fontSize: fs,
                color: "FFFFFF",
                valign: "middle",
              }
            : {
                x: left ? x1 - 2.43 : x1 + w + 0.03,
                y: cy - rowH / 2,
                w: 2.4,
                h: rowH,
                fontSize: fs,
                color: DARK,
                valign: "middle",
                align: left ? "right" : "left",
              },
        );
      }),
    );
    y += h;
  });
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (key >= roadmap.start && key <= roadmap.end)
    slide.addShape("line", {
      x: X(key),
      y: top + 0.3,
      w: 0,
      h: y - top - 0.3,
      line: { color: RED, width: 1.25, dashType: "dash" },
    });
}

export interface DeckInput {
  data: StatusReportData;
  report: Pick<
    StatusReport,
    | "rag"
    | "ragComment"
    | "summary"
    | "achievements"
    | "nextSteps"
    | "escalations"
    | "date"
  >;
  roadmap: Roadmap;
  colorBy: ColorBy;
  settings: ReportSettings;
  tr: Tr;
  lang: "CZ" | "EN";
}

/** Status report / SteCo deck (8 slides + closing slide). Returns the file name. */
export async function downloadStatusDeck({
  data,
  report,
  roadmap,
  colorBy,
  settings,
  tr,
  lang,
}: DeckInput): Promise<string> {
  const p = data.project;
  const cur = p.info.currency;
  const pptx = await newDeck(
    settings,
    `${p.info.projectName} – ${tr("report_title")}`,
  );
  const accent = RED; // corporate red only (manual 4.1)
  const hide = sensitiveHidden(); // supplier mode: no budget, no change requests, no notes
  const ragLabel = (r: string) => tr(`report_rag_${r}`);

  // 1 Title
  const s1 = redSlide(pptx, p.info.projectName, [
    `${tr("report_title")} · ${formatDate(report.date)}`,
    [
      p.info.projectId,
      p.info.itpm && `ITPM: ${p.info.itpm}`,
      p.info.businessOwner && `Business owner: ${p.info.businessOwner}`,
    ]
      .filter(Boolean)
      .join("   ·   "),
  ]);
  s1.addShape("roundRect", {
    x: 0.8,
    y: 4.75,
    w: 1.6,
    h: 0.5,
    fill: { color: "FFFFFF" },
    rectRadius: 0.1,
    line: { color: "FFFFFF" },
  });
  s1.addText(ragLabel(report.rag), {
    x: 0.8,
    y: 4.75,
    w: 1.6,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color:
      RAG_HEX[report.rag] === "FBBA00" ? DARK : (RAG_HEX[report.rag] ?? DARK),
    align: "center",
    valign: "middle",
  });

  // 2 Executive summary
  const s2 = pptx.addSlide({ masterName: "PM" });
  heading(
    s2,
    tr("report_exec_summary"),
    `${tr("report_period")}: ${formatDate(data.period.from)} – ${formatDate(data.period.to)}`,
  );
  ragPill(s2, report.rag, 11.23, 0.4, ragLabel(report.rag));
  kpi(s2, 0.5, tr("portfolio_progress"), formatPercent(data.summary.progress));
  kpi(
    s2,
    3.6,
    tr("plan_finish"),
    formatDate(data.finish) || "—",
    data.finishVariance
      ? `${data.finishVariance > 0 ? "+" : ""}${data.finishVariance} ${tr("report_wd_vs_baseline")}`
      : "",
  );
  if (hide)
    kpi(
      s2,
      6.7,
      tr("nav_milestones"),
      `${data.milestones.overdue.length} / ${data.milestones.upcoming.length}`,
      `${tr("report_overdue")} / ${tr("report_upcoming")}`,
    );
  else
    kpi(
      s2,
      6.7,
      tr("report_budget_forecast"),
      formatMoney(data.budget.forecast, cur),
      `${tr("budget_current")}: ${formatMoney(data.budget.current, cur)}`,
    );
  kpi(
    s2,
    9.8,
    tr("report_open_raid"),
    `${data.summary.openRisks} / ${data.summary.openIssues}`,
    hide ? "" : `${tr("cr_open")}: ${data.changes.open.length}`,
  );
  textBox(
    s2,
    tr("report_summary"),
    [report.ragComment, report.summary].filter(Boolean).join("\n\n"),
    0.5,
    2.95,
    6.1,
    3.4,
  );
  textBox(
    s2,
    tr("report_escalations"),
    report.escalations,
    6.9,
    2.95,
    5.9,
    3.4,
  );

  // 3 RoadMap
  addRoadmapSlide(
    pptx,
    roadmap,
    tr("report_roadmap"),
    colorBy,
    p.lists.phases,
    lang,
  );

  // 4 Milestones
  const s4 = pptx.addSlide({ masterName: "PM" });
  heading(s4, tr("nav_milestones"));
  const ms = [...data.milestones.overdue, ...data.milestones.upcoming].slice(
    0,
    12,
  ); // 12 rows fit above the footer
  s4.addTable(
    [
      headerRow(
        [
          tr("report_milestone"),
          tr("report_planned"),
          tr("report_baseline"),
          tr("common_status"),
        ],
        accent,
      ),
      ...(ms.length
        ? ms.map((m) => {
            const overdue = data.milestones.overdue.includes(m);
            return [
              { text: m.name },
              {
                text: formatDate(m.plannedDate),
                options: overdue ? { color: RED, bold: true } : {},
              },
              { text: formatDate(m.baselineDate) },
              { text: overdue ? tr("report_overdue") : m.paymentStatus },
            ];
          })
        : [[{ text: "—" }, { text: "" }, { text: "" }, { text: "" }]]),
    ],
    {
      x: 0.5,
      y: SLIDE.contentTop,
      w: 12.3,
      colW: [6.3, 2, 2, 2],
      fontSize: 11,
      border: { type: "solid", color: LINE, pt: 0.75 },
    },
  );

  // 5 Done / next
  const s5 = pptx.addSlide({ masterName: "PM" });
  heading(s5, tr("report_progress_title"));
  textBox(
    s5,
    tr("report_achievements"),
    report.achievements,
    0.5,
    SLIDE.contentTop,
    6.0,
    5.0,
  );
  textBox(
    s5,
    tr("report_next_steps"),
    report.nextSteps,
    6.9,
    SLIDE.contentTop,
    5.9,
    5.0,
  );

  // 6 Risks and issues: P x I map + the whole register of open risks and issues (continued on more slides)
  addRiskSlides(pptx, p.risks, data.riskRegister, tr, hide);

  // 7 Changes and decisions (supplier mode: decisions only, and only when there are some)
  if (!hide || data.decisions.length) {
    const s7 = pptx.addSlide({ masterName: "PM" });
    heading(s7, hide ? tr("raid_Decision") : tr("report_changes_decisions"));
    const crs = [...data.changes.open, ...data.changes.decided].slice(
      0,
      data.decisions.length ? 7 : 14,
    );
    if (!hide)
      s7.addTable(
        [
          headerRow(
            [
              "ID",
              tr("cr_title"),
              tr("cr_type"),
              tr("cr_impact_days"),
              `${tr("report_impact")} (${cur})`,
              tr("common_status"),
            ],
            accent,
          ),
          ...(crs.length
            ? crs.map((c) => [
                { text: c.id },
                { text: c.title },
                { text: c.type },
                { text: String(c.impactDays) },
                { text: c.impactCost.toLocaleString("cs-CZ") },
                { text: c.status },
              ])
            : [
                [
                  { text: "—" },
                  { text: "" },
                  { text: "" },
                  { text: "" },
                  { text: "" },
                  { text: "" },
                ],
              ]),
        ],
        {
          x: 0.5,
          y: SLIDE.contentTop,
          w: 12.3,
          colW: [1, 5.1, 1.4, 1.4, 2, 1.4],
          fontSize: 10,
          border: { type: "solid", color: LINE, pt: 0.75 },
        },
      );
    if (data.decisions.length) {
      textBox(
        s7,
        tr("raid_Decision"),
        data.decisions
          .map(
            (d) =>
              `• ${formatDate(d.decisionDate)} ${d.title || d.description}${d.decidedBy ? ` (${d.decidedBy})` : ""}`,
          )
          .join("\n"),
        0.5,
        hide ? SLIDE.contentTop : 4.55,
        12.3,
        hide ? 5.0 : 1.8,
      );
    }
  }

  // 8 Budget (not in supplier mode)
  if (!hide) {
    const s8 = pptx.addSlide({ masterName: "PM" });
    heading(s8, tr("nav_budget"));
    const b = data.budget;
    s8.addChart(
      "bar",
      [
        {
          name: cur,
          labels: [
            tr("budget_current"),
            tr("report_planned"),
            tr("report_committed"),
            tr("report_actual"),
            tr("report_budget_forecast"),
          ],
          values: [b.current, b.planned, b.committed, b.actual, b.forecast],
        },
      ],
      {
        x: 0.5,
        y: SLIDE.contentTop,
        w: 7.8,
        h: 5.0,
        barDir: "col",
        chartColors: ["00779C"],
        showValue: true,
        dataLabelFormatCode: "#,##0",
        valAxisLabelFormatCode: "#,##0",
        catAxisLabelFontSize: 10,
        valAxisLabelFontSize: 9,
        dataLabelFontSize: 9,
      },
    );
    s8.addTable(
      [
        [
          { text: tr("budget_approved") },
          { text: formatMoney(b.approved, cur), options: { align: "right" } },
        ],
        [
          { text: tr("budget_approved_changes") },
          { text: formatMoney(b.changes, cur), options: { align: "right" } },
        ],
        [
          { text: tr("budget_current"), options: { bold: true } },
          {
            text: formatMoney(b.current, cur),
            options: { bold: true, align: "right" },
          },
        ],
        [
          { text: tr("report_actual") },
          { text: formatMoney(b.actual, cur), options: { align: "right" } },
        ],
        [
          { text: tr("report_budget_forecast") },
          { text: formatMoney(b.forecast, cur), options: { align: "right" } },
        ],
        ...(b.capex || b.opex
          ? [
              [
                { text: "– CAPEX" },
                {
                  text: formatMoney(b.capex, cur),
                  options: { align: "right" as const },
                },
              ],
              [
                { text: "– OPEX" },
                {
                  text: formatMoney(b.opex, cur),
                  options: { align: "right" as const },
                },
              ],
            ]
          : []),
        [
          { text: tr("report_variance"), options: { bold: true } },
          {
            text: formatMoney(b.variance, cur),
            options: {
              bold: true,
              align: "right",
              color: b.variance < 0 ? RED : "163D14",
            },
          },
        ],
      ],
      {
        x: 8.6,
        y: SLIDE.contentTop + 0.2,
        w: 4.2,
        colW: [2.2, 2],
        fontSize: 11,
        border: { type: "solid", color: LINE, pt: 0.75 },
      },
    );
  }

  // 9 Closing
  redSlide(pptx, tr("report_thanks"));

  const fileName = `${p.info.projectName.replace(/[\\/:*?"<>|]+/g, "-")} - status ${report.date}.pptx`;
  await pptx.writeFile({ fileName, compression: true });
  return fileName;
}

/** One-slide portfolio overview for management (plus a title slide). */
export async function downloadPortfolioDeck(
  rows: {
    name: string;
    itpm: string;
    summary: ProjectSummary;
    currency: string;
    budget: number;
    trend?: string;
  }[],
  settings: ReportSettings,
  tr: Tr,
  date: string,
): Promise<string> {
  const pptx = await newDeck(settings, tr("report_portfolio_title"));
  const accent = RED;
  redSlide(pptx, tr("report_portfolio_title"), [formatDate(date)]);

  const s2 = pptx.addSlide({ masterName: "PM" });
  heading(s2, tr("report_portfolio_title"));
  s2.addTable(
    [
      headerRow(
        [
          tr("portfolio_rag"),
          tr("dash_project_name"),
          "ITPM",
          tr("portfolio_progress"),
          tr("portfolio_next_milestone"),
          tr("report_open_raid"),
          tr("portfolio_budget_used"),
          tr("portfolio_finish"),
        ],
        accent,
      ),
      ...rows.map((r) => [
        {
          text: `${r.summary.rag}${r.trend ? ` ${r.trend}` : ""}`,
          options: {
            bold: true,
            color: onFill(RAG_HEX[r.summary.rag]),
            fill: { color: RAG_HEX[r.summary.rag] },
            align: "center" as const,
          },
        },
        { text: r.name, options: { bold: true } },
        { text: r.itpm },
        { text: formatPercent(r.summary.progress) },
        {
          text: r.summary.nextMilestone
            ? `${r.summary.nextMilestone.name} (${formatDate(r.summary.nextMilestone.plannedDate)})`
            : "—",
        },
        { text: `${r.summary.openRisks} / ${r.summary.openIssues}` },
        {
          text: sensitiveHidden()
            ? MASK
            : r.summary.budgetUsedPct === null
              ? "—"
              : `${Math.round(r.summary.budgetUsedPct * 100)} %`,
        },
        { text: formatDate(r.summary.finish) },
      ]),
    ],
    {
      x: 0.5,
      y: SLIDE.contentTop,
      w: 12.3,
      colW: [1, 2.8, 1.5, 1, 2.6, 1.2, 1.1, 1.1],
      fontSize: 10,
      border: { type: "solid", color: LINE, pt: 0.75 },
    },
  );
  const fileName = `Portfolio ${date}.pptx`;
  await pptx.writeFile({ fileName, compression: true });
  return fileName;
}
