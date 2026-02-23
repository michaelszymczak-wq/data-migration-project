#!/usr/bin/env python3
"""
VINx2 → InnoVint vessel import CSV converter.
Reads the barrel list and attribute table, validates against InnoVint rules,
and writes a cleaned import CSV + unmapped values report.
"""
import csv
from pathlib import Path

ATTR_TABLE  = Path('/Users/michaelszymczak/Desktop/InnoVint Vessel Attribute Table.csv')
BARREL_LIST = Path('/Users/michaelszymczak/Downloads/VINx2_BarrelList_detailed 10 Feb (1).csv')
OUTPUT_CSV  = Path('/Users/michaelszymczak/Desktop/innovint_vessels_import.csv')
REPORT_MD   = Path('/Users/michaelszymczak/Desktop/unmapped_report.md')


def read_attr_column(col_idx: int) -> set[str]:
    """Return all non-empty cell values from the given column (skip header row)."""
    values: set[str] = set()
    with open(ATTR_TABLE, encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        next(reader)  # header
        for row in reader:
            if col_idx < len(row):
                v = row[col_idx].strip()
                if v:
                    values.add(v)
    return values


# ── Load attribute lists ────────────────────────────────────────────────────
# Attribute table columns: VESSEL_TYPE(0) COOPER(1) WOOD(2) WOOD/FOREST(3)
#                          TOAST(4) BARREL STYLE(5) YEAR FIRST USED(6) COLOR(7)
valid_vessel_types = read_attr_column(0)
valid_coopers      = read_attr_column(1)   # case-sensitive per spec
valid_woods        = read_attr_column(2)
valid_forests      = read_attr_column(3)
valid_toasts_raw   = read_attr_column(4)
valid_years        = read_attr_column(6)
valid_colors       = read_attr_column(7)

# Toast: case-insensitive lookup → canonical value
toast_ci: dict[str, str] = {v.lower(): v for v in valid_toasts_raw}


OUTPUT_HEADERS = [
    'Vessel code', 'Vessel type', 'Capacity (vol)', 'Bottle Type',
    'Capacity (bottles)', 'Year first used', 'Cooper', 'Style',
    'Wood', 'Forest', 'Toast', 'Color', 'Tags', 'Owners',
]

# Source column indices in VINx2 barrel list CSV:
# 0 VINx2 ID  1 Code  2 Vessel type  7 Capacity (L)  12 Owner
# 13 Cooper   14 Year  16 Forest      17 Oak type      20 Toasting
# 23 Last contained

Issue = tuple[str, str, str, str]  # (vessel_code, field, src_value, note)


def get(row: list[str], idx: int) -> str:
    return row[idx].strip() if idx < len(row) else ''


def process_row(row: list[str]) -> tuple[dict[str, str], list[Issue]]:
    issues: list[Issue] = []
    code        = get(row,  1)
    vtype_src   = get(row,  2)
    capacity    = get(row,  7)
    owner       = get(row, 12)
    cooper_src  = get(row, 13)
    year_src    = get(row, 14)
    forest_src  = get(row, 16)
    wood_src    = get(row, 17)
    toast_src   = get(row, 20)
    color_src   = get(row, 23)

    out: dict[str, str] = {h: '' for h in OUTPUT_HEADERS}

    # Vessel code — copy as-is
    out['Vessel code'] = code

    # Vessel type — validate
    if vtype_src in valid_vessel_types:
        out['Vessel type'] = vtype_src
    elif vtype_src:
        issues.append((code, 'Vessel type', vtype_src,
                        f'"{vtype_src}" not in VESSEL_TYPE attribute list'))

    # Capacity (vol) — direct copy; blank stays blank
    out['Capacity (vol)'] = capacity

    # Year first used — validate range
    if year_src and year_src in valid_years:
        out['Year first used'] = year_src
    elif year_src:
        issues.append((code, 'Year first used', year_src,
                        f'"{year_src}" not in YEAR FIRST USED attribute list (valid: 1900–2032)'))

    # Cooper — case-sensitive validation
    if cooper_src and cooper_src in valid_coopers:
        out['Cooper'] = cooper_src
    elif cooper_src:
        candidates = [v for v in valid_coopers
                      if cooper_src.lower() in v.lower() or v.lower().startswith(cooper_src.lower())]
        note = f'"{cooper_src}" not found in COOPER attribute list (case-sensitive)'
        if candidates:
            note += f' — possible match(es): ' + ', '.join(f'"{c}"' for c in candidates[:3])
        issues.append((code, 'Cooper', cooper_src, note))

    # Wood — validate; "--" and blank are silently ignored
    if wood_src and wood_src != '--':
        if wood_src in valid_woods:
            out['Wood'] = wood_src
        else:
            candidates = [v for v in valid_woods
                          if wood_src.lower() in v.lower()]
            note = f'"{wood_src}" not found in WOOD attribute list'
            if candidates:
                note += f' — possible match: "{candidates[0]}"'
            issues.append((code, 'Wood', wood_src, note))

    # Forest — "--" and blank are silently ignored
    if forest_src and forest_src != '--':
        if forest_src in valid_forests:
            out['Forest'] = forest_src
        else:
            issues.append((code, 'Forest', forest_src,
                            f'"{forest_src}" not found in WOOD/FOREST attribute list'))

    # Toast — case-insensitive match, write canonical value
    if toast_src:
        canonical = toast_ci.get(toast_src.lower())
        if canonical:
            out['Toast'] = canonical
        else:
            issues.append((code, 'Toast', toast_src,
                            f'"{toast_src}" not found in TOAST attribute list'))

    # Color — case-sensitive validation
    if color_src and color_src in valid_colors:
        out['Color'] = color_src
    elif color_src:
        issues.append((code, 'Color', color_src,
                        f'"{color_src}" not found in COLOR attribute list'))

    # Owners — direct copy
    out['Owners'] = owner

    return out, issues


# ── Process all rows ────────────────────────────────────────────────────────
all_issues: list[Issue] = []
output_rows: list[dict[str, str]] = []

with open(BARREL_LIST, encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    _hdr = next(reader)
    for row in reader:
        if not any(c.strip() for c in row):
            continue
        out_row, issues = process_row(row)
        output_rows.append(out_row)
        all_issues.extend(issues)

# ── Write import CSV ────────────────────────────────────────────────────────
with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=OUTPUT_HEADERS, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    writer.writerows(output_rows)

# ── Write unmapped report ───────────────────────────────────────────────────
# Summarise systemic issues first, then per-row table
systemic: dict[tuple[str, str], list[str]] = {}
per_row: list[Issue] = []
for vessel_code, field, src_val, note in all_issues:
    key = (field, src_val)
    if key not in systemic:
        systemic[key] = []
    systemic[key].append(vessel_code)

with open(REPORT_MD, 'w', encoding='utf-8') as f:
    f.write('# Unmapped Values Report\n\n')
    f.write(f'**Vessels processed:** {len(output_rows)}  \n')
    f.write(f'**Total unmapped/invalid values:** {len(all_issues)}\n\n')

    f.write('## Summary by Issue (grouped)\n\n')
    f.write('| Field | Source Value | # Vessels Affected | Note | Vessel Codes |\n')
    f.write('|---|---|---|---|---|\n')
    seen_keys: set[tuple[str, str]] = set()
    for vessel_code, field, src_val, note in all_issues:
        key = (field, src_val)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        codes = systemic[key]
        codes_str = ', '.join(codes) if len(codes) <= 8 else ', '.join(codes[:8]) + f' … (+{len(codes)-8} more)'
        f.write(f'| {field} | {src_val} | {len(codes)} | {note} | {codes_str} |\n')

    f.write('\n## Full Per-Row Detail\n\n')
    f.write('| Vessel Code | Field | Source Value | Note |\n')
    f.write('|---|---|---|---|\n')
    for vessel_code, field, src_val, note in all_issues:
        f.write(f'| {vessel_code} | {field} | {src_val} | {note} |\n')

print(f'✓  {len(output_rows)} rows  →  {OUTPUT_CSV}')
print(f'✓  {len(all_issues)} issues  →  {REPORT_MD}')

# Quick summary to stdout
from collections import Counter
field_counts = Counter(f for _, f, _, _ in all_issues)
print('\nIssues by field:')
for field, n in field_counts.most_common():
    print(f'  {field}: {n}')
