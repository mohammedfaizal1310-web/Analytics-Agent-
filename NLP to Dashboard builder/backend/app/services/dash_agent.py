import json
import re
from collections import Counter
from app.services.llm import call_llm_async


# ─────────────────────────────────────────────────────────────────────────────
# Column intelligence
# ─────────────────────────────────────────────────────────────────────────────

def classify_columns(dataset_data: list) -> dict:
    if not dataset_data:
        return {"temporal": [], "numeric": [], "categorical": [], "ignored": []}

    sample = dataset_data[:50]
    columns = list(sample[0].keys())
    BAD_KW  = ["id", "s.no", "serial", "index", "uuid", "guid", "no.", "#"]
    DATE_RE = re.compile(r"(date|time|year|month|week|day|quarter|period|created|updated)", re.I)

    temporal, numeric, categorical, ignored = [], [], [], []

    for col in columns:
        col_lower = str(col).lower()
        if any(b in col_lower for b in BAD_KW):
            ignored.append(col); continue

        values = [row.get(col) for row in sample if row.get(col) is not None]
        if not values: ignored.append(col); continue

        n_unique   = len(set(values))
        n_values   = len(values)
        num_cnt    = sum(1 for v in values if isinstance(v, (int, float)))

        if DATE_RE.search(col_lower):
            temporal.append(col); continue

        if num_cnt >= n_values * 0.7:
            ignored.append(col) if n_unique <= 2 else numeric.append(col)
        elif n_unique <= max(20, n_values * 0.5):
            categorical.append(col)
        else:
            ignored.append(col)

    return {"temporal": temporal, "numeric": numeric,
            "categorical": categorical, "ignored": ignored}


def pre_aggregate(dataset_data: list, categorical_cols: list, numeric_cols: list) -> dict:
    result = {}
    for col in categorical_cols:
        counter: Counter = Counter()
        for row in dataset_data:
            v = str(row.get(col, "")).strip()
            if v and v.lower() not in ("none", "nan", ""):
                counter[v] += 1
        if len(counter) < 2:
            continue
        top = dict(sorted(counter.items(), key=lambda x: -x[1])[:15])
        result[col] = {"counts": top}
    return result


def pre_aggregate_temporal(dataset_data: list, temporal_cols: list, numeric_cols: list) -> dict:
    result = {}
    for col in temporal_cols:
        buckets: dict = {}
        for row in dataset_data:
            t_val = str(row.get(col, "")).strip()
            if not t_val or t_val.lower() in ("none", "nan"): continue
            t_key = t_val[:7] if len(t_val) >= 7 else t_val
            buckets.setdefault(t_key, {nc: 0 for nc in numeric_cols})
            for nc in numeric_cols:
                try: buckets[t_key][nc] += float(row.get(nc, 0) or 0)
                except: pass
        if len(buckets) >= 2:
            result[col] = dict(sorted(buckets.items())[:30])
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Intent detection
# ─────────────────────────────────────────────────────────────────────────────

CHART_MAP = {
    "bar":         ["bar chart","bar graph","column chart","vertical bar","horizontal bar","barchart"],
    "stacked_bar": ["stacked bar","stacked column","clustered bar","grouped bar","clustered column"],
    "line":        ["line chart","line graph","trend","time series","over time","linechart"],
    "pie":         ["pie chart","pie graph","piechart"],
    "doughnut":    ["donut chart","doughnut chart","donut graph","doughnut graph"],
    "scatter":     ["scatter plot","scatter chart","scatter graph"],
    "radar":       ["radar chart","radar graph","spider chart"],
}

def detect_requested_charts(prompt: str) -> list:
    p = prompt.lower()
    return [ct for ct, kws in CHART_MAP.items() if any(kw in p for kw in kws)]

def wants_cards(prompt: str) -> bool:
    p = prompt.lower()
    return any(kw in p for kw in [
        "kpi","card","tile","metric card","summary card",
        "dashboard","overview","summary","report","analytics page"
    ])

def is_dashboard_request(prompt: str) -> bool:
    p = prompt.lower()
    db_kws = ["dashboard","overview","summary","analytics","report","explore","full","create a"]
    specific = [kw for kws in CHART_MAP.values() for kw in kws]
    return any(kw in p for kw in db_kws) and not any(kw in p for kw in specific)


# ─────────────────────────────────────────────────────────────────────────────
# Post-process: strip blank / broken charts
# ─────────────────────────────────────────────────────────────────────────────

def strip_blank_charts(charts: list) -> list:
    clean = []
    for c in charts:
        labels   = c.get("labels", [])
        datasets = c.get("datasets", [])
        if not labels or not datasets: continue
        ok = True
        for ds in datasets:
            data = ds.get("data", [])
            if len(data) != len(labels): ok = False; break
            if not data: ok = False; break
            if all(v == 0 for v in data): ok = False; break
            if not all(isinstance(v, (int, float)) for v in data): ok = False; break
        if ok:
            clean.append(c)
    return clean


# ─────────────────────────────────────────────────────────────────────────────
# Main generator
# ─────────────────────────────────────────────────────────────────────────────

async def generate_dashboard_json(user_prompt: str, dataset_data: list = None) -> dict:

    if not dataset_data:
        return {"title":"No Data","description":"Dataset is empty","cards":[],"charts":[]}

    analysis      = classify_columns(dataset_data)
    temporal_cols = analysis["temporal"]
    numeric_cols  = analysis["numeric"]
    cat_cols      = analysis["categorical"]
    ignored_cols  = analysis["ignored"]
    n_rows        = len(dataset_data)

    cat_agg   = pre_aggregate(dataset_data, cat_cols, numeric_cols)
    time_agg  = pre_aggregate_temporal(dataset_data, temporal_cols, numeric_cols)

    requested = detect_requested_charts(user_prompt)
    is_dash   = is_dashboard_request(user_prompt)
    need_cards = wants_cards(user_prompt)

    # ── Intent instruction ────────────────────────────────────────────────
    if requested:
        n_req = len(requested)
        if n_req == 1:
            intent = f"""
USER WANTS EXACTLY THIS CHART TYPE: {requested[0]}
Generate 1 to 2 charts of type '{requested[0]}' only.
Do NOT add any other chart types.
Choose the categorical column with the most variety for best visual impact.
"""
        else:
            intent = f"""
USER WANTS EXACTLY THESE CHART TYPES: {requested}
Generate exactly one chart per requested type ({n_req} charts total).
Do NOT add extra charts beyond what was requested.
Pick the best column for each chart type from the aggregated data below.
"""
    elif is_dash:
        intent = f"""
USER WANTS A FULL PROFESSIONAL DASHBOARD.
Generate 4 to 6 charts using DIFFERENT chart types.
Include: at least 1 bar, 1 pie or doughnut, 1 line (only if temporal data exists).
Each chart must use a different column. No two charts should show the same data.
"""
    else:
        intent = "Generate 3–4 charts that best represent the data using the most suitable chart types."

    cards_instruction = """
Include 3–5 KPI cards with real computed stats (totals, averages, counts).
""" if need_cards else """
Do NOT include any cards. Return: "cards": []
"""

    # ── Suitability ───────────────────────────────────────────────────────
    line_ok    = len(time_agg) > 0
    bar_ok     = len(cat_agg) > 0
    pie_ok     = any(2 <= len(v["counts"]) <= 12 for v in cat_agg.values())
    scatter_ok = len(numeric_cols) >= 2

    suitability = f"""
CHART SUITABILITY:
- bar / stacked_bar : {'✅ POSSIBLE' if bar_ok   else '❌ SKIP'}
- pie / doughnut    : {'✅ POSSIBLE' if pie_ok   else '❌ SKIP - no column with 2–12 categories'}
- line              : {'✅ POSSIBLE (use temporal columns)' if line_ok else '⚠️  No temporal col — use categorical col sorted by count on X, count on Y'}
- scatter           : {'✅ POSSIBLE' if scatter_ok else '❌ SKIP - need 2 numeric columns'}

If a requested type is ❌ SKIP, substitute the closest available type and explain in description.
"""

    cat_agg_str  = json.dumps(cat_agg,  indent=2)
    time_agg_str = json.dumps(time_agg, indent=2)

    system_prompt = f"""You are an expert analytics dashboard generator for an enterprise application.

Return ONLY valid JSON. No markdown. No explanations. No code fences.

════════════════════════════════════════
DATASET OVERVIEW
════════════════════════════════════════
Total rows      : {n_rows}
Categorical cols: {cat_cols}
Numeric cols    : {numeric_cols}
Temporal cols   : {temporal_cols}
IGNORED cols    : {ignored_cols}  ← NEVER use

{suitability}

════════════════════════════════════════
USER INTENT
════════════════════════════════════════
{intent}

════════════════════════════════════════
KPI CARDS
════════════════════════════════════════
{cards_instruction}

════════════════════════════════════════
PRE-AGGREGATED CATEGORICAL DATA  (use these exact values)
════════════════════════════════════════
{cat_agg_str}

════════════════════════════════════════
PRE-AGGREGATED TEMPORAL DATA  (for line charts)
════════════════════════════════════════
{time_agg_str}

════════════════════════════════════════
ABSOLUTE RULES
════════════════════════════════════════
1. labels[] and datasets[].data[] MUST be the SAME length. Always.
2. datasets[].data[] MUST contain ONLY numbers — never strings or null.
3. Use the pre-aggregated counts above — never re-derive from raw data.
4. bar/pie/doughnut: labels = category names, data = count values from "counts" dict.
5. stacked_bar: each dataset must have a different label; every dataset must have stack:"stack0".
6. line with temporal: labels = sorted time-bucket keys, data = numeric sums.
7. line without temporal: labels = top-15 category values sorted by count, data = count values.
8. x_axis and y_axis MUST always be set for bar and line charts.
9. NEVER output a chart where all data[] values are 0.
10. NEVER output a chart where labels[] is empty.
11. NEVER output duplicate labels within a single chart.
12. Limit labels to 15 entries max per chart to avoid X-axis overcrowding.

OUTPUT FORMAT:
{{
  "title": "string",
  "description": "string",
  "cards": [],
  "charts": [
    {{
      "type": "bar",
      "title": "string",
      "description": "string",
      "x_axis": "column name",
      "y_axis": "metric name",
      "labels": ["A","B","C"],
      "datasets": [{{"label":"Count","data":[10,20,30]}}]
    }}
  ]
}}
"""

    user_msg = f"USER REQUEST: {user_prompt}\n\nGenerate the dashboard JSON using the pre-aggregated data above. Verify all label/data lengths match before outputting."

    raw    = await call_llm_async(system_prompt, user_msg, json_mode=True)
    result = json.loads(raw)

    # Strip blank / broken charts before returning
    result["charts"] = strip_blank_charts(result.get("charts", []))

    # If cards weren't asked for, always clear them
    if not need_cards:
        result["cards"] = []

    # ── Generate inference paragraph ──────────────────────────────────────
    if result.get("charts"):
        chart_summaries = []
        for c in result["charts"]:
            labels  = c.get("labels", [])[:5]
            ds      = c.get("datasets", [{}])[0]
            data    = ds.get("data", [])[:5]
            chart_summaries.append(
                f"{c.get('title','Chart')} ({c.get('type','bar')}): "
                f"labels={labels}, values={data}"
            )
        inference_prompt = (
            f"The following charts were generated from a dataset of {n_rows} rows:\n"
            + "\n".join(chart_summaries)
            + "\n\nWrite a single concise paragraph (2–4 sentences, plain English, no markdown, no bullet points) "
            "that summarises the key analytical insights these charts reveal. "
            "Focus on the most meaningful patterns, top categories, or notable distributions. "
            "Do not mention chart types or technical details — just the business insight."
        )
        try:
            inference_text = await call_llm_async("You are a concise business analyst.", inference_prompt)
            result["inference"] = inference_text.strip()
        except Exception:
            result["inference"] = ""
    else:
        result["inference"] = ""

    return result