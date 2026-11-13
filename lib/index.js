/**
 * dsh-material — 材料性能查询与选材
 */

export const name = "dsh-material";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

// 密度 g/cm3，抗拉 MPa，屈服 MPa，延伸率 %，相对成本指数（钢=1）
const MATS = {
  q235: { name: "Q235 碳钢", density: 7.85, tensile: 370, yield: 235, elong: 26, cost: 1.0, note: "通用结构件，可焊性好" },
  "45": { name: "45 号钢", density: 7.85, tensile: 600, yield: 355, elong: 16, cost: 1.1, note: "轴类/齿轮，调质后使用" },
  "40cr": { name: "40Cr 合金钢", density: 7.85, tensile: 980, yield: 785, elong: 9, cost: 1.4, note: "高强度轴/连杆" },
  "304": { name: "304 不锈钢", density: 7.93, tensile: 520, yield: 205, elong: 40, cost: 3.5, note: "食品/医疗，耐蚀" },
  "316": { name: "316 不锈钢", density: 8.0, tensile: 520, yield: 205, elong: 40, cost: 4.5, note: "海洋/化工，耐氯离子" },
  "6061": { name: "6061-T6 铝", density: 2.7, tensile: 310, yield: 276, elong: 12, cost: 2.2, note: "CNC 结构件，阳极氧化" },
  "7075": { name: "7075-T6 铝", density: 2.81, tensile: 570, yield: 505, elong: 11, cost: 3.0, note: "高强度轻量件" },
  h62: { name: "H62 黄铜", density: 8.5, tensile: 370, yield: 200, elong: 40, cost: 4.0, note: "导电/装饰/阀门" },
  tc4: { name: "TC4 钛合金", density: 4.43, tensile: 950, yield: 880, elong: 10, cost: 15.0, note: "航空/医疗，难加工" },
  abs: { name: "ABS 塑料", density: 1.05, tensile: 45, yield: 40, elong: 20, cost: 0.6, note: "外壳/注塑件" },
  pp: { name: "PP 塑料", density: 0.91, tensile: 30, yield: 25, elong: 200, cost: 0.5, note: "铰链/耐化学" },
  pc: { name: "PC 塑料", density: 1.2, tensile: 65, yield: 60, elong: 100, cost: 1.2, note: "透明/抗冲" },
  pa66: { name: "PA66 尼龙", density: 1.14, tensile: 80, yield: 75, elong: 30, cost: 0.9, note: "齿轮/耐磨" },
  pom: { name: "POM 聚甲醛", density: 1.41, tensile: 65, yield: 60, elong: 25, cost: 1.0, note: "精密齿轮/低摩擦" },
};

function n(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function f(x) { return (Math.round(x * 100) / 100).toString(); }

function find(name) {
  const k = String(name || "").toLowerCase().replace(/\s/g, "");
  if (MATS[k]) return [k, MATS[k]];
  for (const key of Object.keys(MATS)) {
    if (k.indexOf(key) >= 0 || MATS[key].name.toLowerCase().indexOf(k) >= 0) return [key, MATS[key]];
  }
  return null;
}

const TOOLS = {
  material_lookup: {
    description: "材料性能查询：按牌号/名称给出密度、抗拉、屈服、延伸率、成本指数与用途",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: { name: { type: "string", description: "牌号或名称，如 304 / 6061 / PA66" } },
      required: ["name"],
    },
    run(args) {
      const hit = find(args.name);
      if (!hit) throw new Error("未收录。可用: " + Object.values(MATS).map((m) => m.name).join(" / "));
      const m = hit[1];
      return ["材料性能", "=".repeat(52), "名称: " + m.name, "密度: " + m.density + " g/cm³", "抗拉: " + m.tensile + " MPa",
        "屈服: " + m.yield + " MPa", "延伸率: " + m.elong + "%", "成本指数: " + m.cost + "（钢=1）", "用途: " + m.note, "",
        "数据为常见参考值，选材以标准值与实测为准。", "", "更多工具：" + SITE].join(NL);
    },
  },
  material_select: {
    description: "按需求选材：最低屈服、最大密度、是否耐蚀、成本上限，输出候选排序",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        yield_min: { type: "number", description: "最低屈服 MPa" },
        density_max: { type: "number", description: "最大密度 g/cm³（可选）" },
        cost_max: { type: "number", description: "成本指数上限（钢=1，可选）" },
        corrosion: { type: "boolean", description: "是否需要耐蚀（可选）" },
        plastic_only: { type: "boolean", description: "只看塑料（可选）" },
      },
      required: ["yield_min"],
    },
    run(args) {
      const y = n(args.yield_min, 0);
      const dmax = args.density_max != null ? n(args.density_max, 0) : null;
      const cmax = args.cost_max != null ? n(args.cost_max, 0) : null;
      const corr = String(args.corrosion || "") === "true";
      const plastic = String(args.plastic_only || "") === "true";
      const out = [];
      for (const key of Object.keys(MATS)) {
        const m = MATS[key];
        if (m.yield < y) continue;
        if (dmax != null && m.density > dmax) continue;
        if (cmax != null && m.cost > cmax) continue;
        if (corr && !(m.name.indexOf("304") >= 0 || m.name.indexOf("316") >= 0 || m.name.indexOf("钛") >= 0)) continue;
        if (plastic && !(m.name.indexOf("塑料") >= 0 || m.name.indexOf("尼龙") >= 0 || m.name.indexOf("聚甲醛") >= 0)) continue;
        out.push(m);
      }
      out.sort((a, b) => a.cost - b.cost || b.yield - a.yield);
      const lines = ["选材结果", "=".repeat(52), "条件: 屈服 ≥ " + y + " MPa" + (dmax != null ? "，密度 ≤ " + dmax : "") + (cmax != null ? "，成本 ≤ " + cmax : "") + (corr ? "，耐蚀" : "") + (plastic ? "，仅塑料" : ""), ""];
      if (!out.length) lines.push("无满足条件材料，建议放宽条件。");
      for (const m of out.slice(0, 8)) lines.push(m.name + " | 屈服 " + m.yield + " MPa | 密度 " + m.density + " | 成本 " + m.cost + " | " + m.note);
      lines.push("");
      lines.push("排序按成本优先，其次屈服；实际需考虑加工、表面处理与供应。");
      lines.push("");
      lines.push("更多工具：" + SITE);
      return lines.join(NL);
    },
  },
};

export function apply(ctx, config) {
  void config;
  for (const name of Object.keys(TOOLS)) {
    const t = TOOLS[name];
    ctx.tools.register({
      name: name,
      description: t.description,
      parameters: t.parameters,
      output: TEXT_OUTPUT,
      async execute(args) { try { return { text: t.run(args || {}) }; } catch (e) { return { text: "处理失败: " + String((e && e.message) || e) }; } },
    });
  }
}
