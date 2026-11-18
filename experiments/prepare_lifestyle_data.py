"""Build two deterministic observational demos from the CC0 Fitbit export.

No records or outcomes are synthesized. Each run is one participant's mean in
one condition, so repeated daily observations are not treated as independent
participants. Requires only the Python standard library.
"""
from __future__ import annotations

import csv
import hashlib
import json
import platform
import statistics
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "data" / "fitbit-fitness-tracker-data.zip"
ARCHIVE_URL = "https://www.kaggle.com/api/v1/datasets/download/arashnic/fitbit"
SOURCE_URL = "https://www.kaggle.com/datasets/arashnic/fitbit"
PREFIX = "mturkfitbit_export_4.12.16-5.12.16/Fitabase Data 4.12.16-5.12.16/"
ACTIVITY_NAME = "dailyActivity_merged.csv"
SLEEP_NAME = "sleepDay_merged.csv"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def clean_numbers(value):
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [clean_numbers(item) for item in value]
    if isinstance(value, dict):
        return {key: clean_numbers(item) for key, item in value.items()}
    return value


def canonical_bytes(value) -> bytes:
    return json.dumps(clean_numbers(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def mean(values) -> float:
    return round(statistics.fmean(values), 4)


def extract_raw_files() -> tuple[str, list[str]]:
    if not ARCHIVE.exists():
        raise SystemExit(f"缺少原始数据包：{ARCHIVE}\n下载地址：{ARCHIVE_URL}")
    archive_bytes = ARCHIVE.read_bytes()
    extracted = []
    with zipfile.ZipFile(ARCHIVE) as source:
        for name in (ACTIVITY_NAME, SLEEP_NAME):
            target = ROOT / "data" / name
            target.write_bytes(source.read(PREFIX + name))
            extracted.append(str(target.relative_to(ROOT)).replace("\\", "/"))
    return sha256_bytes(archive_bytes), extracted


def read_csv(name: str) -> list[dict[str, str]]:
    with (ROOT / "data" / name).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def activity_rows() -> dict[tuple[str, object], dict]:
    rows = {}
    for row in read_csv(ACTIVITY_NAME):
        date = datetime.strptime(row["ActivityDate"], "%m/%d/%Y").date()
        steps = int(row["TotalSteps"])
        if steps > 0:
            rows[(row["Id"], date)] = {"steps": steps, "date": date}
    return rows


def sleep_rows() -> dict[tuple[str, object], int]:
    grouped: dict[tuple[str, object], int] = defaultdict(int)
    for row in read_csv(SLEEP_NAME):
        date = datetime.strptime(row["SleepDay"].split()[0], "%m/%d/%Y").date()
        minutes = int(row["TotalMinutesAsleep"])
        if minutes > 0:
            grouped[(row["Id"], date)] += minutes
    return dict(grouped)


def make_run(experiment_id: str, config_id: str, pair: int, value: float, days: int, latest, metric_key: str, extra_metrics=None):
    metrics = {metric_key: value, "observed_days": days}
    if extra_metrics:
        metrics.update(extra_metrics)
    return clean_numbers({
        "id": f"{experiment_id}-{config_id}-p{pair:02d}",
        "config_id": config_id,
        "seed": None,
        "repeat": pair,
        "phase": "participant_mean",
        "value": value,
        "metrics": metrics,
        "batch": "original",
        "recorded_at": latest.isoformat() + "T12:00:00Z",
        "note": f"同一参与者在该条件下的 {days} 天均值；不是单日独立样本",
    })


def base_experiment(experiment_id: str, title: str, subtitle: str, metric: dict, baseline: str, target: int, archive_hash: str, design: dict):
    return {
        "schema_version": "1.1.0",
        "experiment": {
            "id": experiment_id,
            "title": title,
            "subtitle": subtitle,
            "kind": "lifestyle",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "duration_s": 0,
            "metric": metric,
            "baseline_config": baseline,
            "target_seeds": target,
            "dataset": {
                "name": "FitBit Fitness Tracker Data / Fitabase 4.12.16–5.12.16",
                "source": SOURCE_URL,
                "license_note": "Kaggle 数据卡标注 CC0: Public Domain；30名同意提交追踪器数据的Fitbit用户。仅作产品演示，不作医疗建议。",
                "period": "2016-04-12 至 2016-05-12（具体记录范围以原始文件为准）",
                "archive_download": ARCHIVE_URL,
                "archive_sha256": archive_hash,
                "raw_files": [ACTIVITY_NAME, SLEEP_NAME],
            },
            "design": design,
            "environment": {
                "生成脚本": "Python " + platform.python_version() + " 标准库",
                "分析单位": "参与者在单个条件下的日均值",
                "随机生成": "无；不生成、不补值、不修改原始结果",
            },
        },
    }


def finalize(data: dict, configs: list[dict], runs: list[dict], output_name: str) -> dict:
    data["configs"] = configs
    data["runs"] = runs
    data["provenance"] = {
        "script": "experiments/prepare_lifestyle_data.py",
        "command": "python experiments/prepare_lifestyle_data.py",
        "data_mode": "public_observational_demo",
        "description": "直接由CC0原始CSV按公开规则聚合；每个值都是参与者在某条件下的真实日均值，不是合成生活记录。",
        "runs_sha256": sha256_bytes(canonical_bytes(runs)),
    }
    clean = clean_numbers(data)
    target = ROOT / "public" / "data" / output_name
    target.write_text(json.dumps(clean, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stats = {}
    for config in configs:
        values = [run["value"] for run in runs if run["config_id"] == config["id"]]
        stats[config["id"]] = {
            "n": len(values),
            "mean": mean(values),
            "sample_sd": round(statistics.stdev(values), 4) if len(values) > 1 else 0,
            "min": min(values),
            "max": max(values),
        }
    return {
        "output": str(target.relative_to(ROOT)).replace("\\", "/"),
        "output_sha256": sha256_bytes(target.read_bytes()),
        "runs_sha256": clean["provenance"]["runs_sha256"],
        "run_count": len(runs),
        "stats": stats,
    }


def build_weekend(activity: dict, archive_hash: str):
    by_person: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for (person, _date), row in activity.items():
        condition = "weekend" if row["date"].weekday() >= 5 else "weekday"
        by_person[person][condition].append(row)
    runs = []
    pair = 0
    for person in sorted(by_person):
        groups = by_person[person]
        if len(groups["weekday"]) < 2 or len(groups["weekend"]) < 2:
            continue
        pair += 1
        for condition in ("weekday", "weekend"):
            rows = groups[condition]
            runs.append(make_run("weekend-steps", condition, pair, mean([r["steps"] for r in rows]), len(rows), max(r["date"] for r in rows), "daily_steps"))
    experiment_id = "weekend-steps"
    data = base_experiment(
        experiment_id,
        "周末会走得更多吗？",
        "同一参与者的工作日与周末日均步数配对比较 · 公开观察性数据",
        {"key": "daily_steps", "label": "日均步数", "unit": "步", "higher_is_better": True},
        "weekday",
        pair,
        archive_hash,
        {
            "analysis": "paired",
            "配对方式": "同一参与者的 weekday 与 weekend 记录使用相同 repeat 编号",
            "条件定义": "周一至周五为工作日；周六、周日为周末",
            "纳入规则": "TotalSteps>0；每位参与者在两种条件下都至少有2个有效日",
            "分析单位": "先求每位参与者在各条件下的日均步数，再比较参与者条件均值",
            "因果边界": "未随机分配星期，结果只描述观察性关联；季节、工作、佩戴习惯等混杂仍可能存在",
        },
    )
    configs = [
        {"id": "weekday", "name": "工作日", "short_name": "工作日", "description": "周一至周五且步数大于0的日期", "parameters": {"days": "Monday–Friday", "min_valid_days": 2}},
        {"id": "weekend", "name": "周末", "short_name": "周末", "description": "周六、周日且步数大于0的日期", "parameters": {"days": "Saturday–Sunday", "min_valid_days": 2}},
    ]
    return finalize(data, configs, runs, "weekend-steps.json")


def build_sleep_next_day(activity: dict, sleep: dict, archive_hash: str):
    paired_days: dict[str, list[dict]] = defaultdict(list)
    for (person, sleep_date), minutes in sleep.items():
        next_day = activity.get((person, sleep_date + timedelta(days=1)))
        if next_day:
            paired_days[person].append({"sleep": minutes, "steps": next_day["steps"], "date": next_day["date"]})
    runs = []
    pair = 0
    for person in sorted(paired_days):
        rows = paired_days[person]
        median_sleep = statistics.median(row["sleep"] for row in rows)
        groups = {"shorter_sleep": [], "longer_sleep": []}
        for row in rows:
            condition = "longer_sleep" if row["sleep"] >= median_sleep else "shorter_sleep"
            groups[condition].append(row)
        if len(groups["shorter_sleep"]) < 2 or len(groups["longer_sleep"]) < 2:
            continue
        pair += 1
        for condition in ("shorter_sleep", "longer_sleep"):
            selected = groups[condition]
            runs.append(make_run(
                "sleep-next-day-steps", condition, pair,
                mean([row["steps"] for row in selected]), len(selected), max(row["date"] for row in selected),
                "next_day_steps", {"sleep_minutes": mean([row["sleep"] for row in selected])},
            ))
    data = base_experiment(
        "sleep-next-day-steps",
        "睡得更久后，第二天会走更多吗？",
        "以个人当夜睡眠中位数分组，比较次日真实步数 · 不推断睡眠的因果效果",
        {"key": "next_day_steps", "label": "次日步数", "unit": "步", "higher_is_better": True},
        "shorter_sleep",
        pair,
        archive_hash,
        {
            "analysis": "paired",
            "配对方式": "同一参与者的较短睡眠后与较长睡眠后记录使用相同 repeat 编号",
            "条件定义": "按每位参与者自身当夜睡眠时长中位数分为较短（<中位数）与较长（≥中位数）",
            "日期连接": "睡眠日期严格连接下一日历日的 TotalSteps；不使用下一条记录替代",
            "纳入规则": "次日 TotalSteps>0；当夜 TotalMinutesAsleep>0；每位参与者两种条件都至少有2个有效配对日",
            "分析单位": "先求每位参与者在各条件下的次日平均步数，再做配对比较",
            "因果边界": "睡眠时长未随机分配；同一人自身对照不能排除工作日、健康状态、活动安排等混杂，也不构成医疗诊断或睡眠建议",
        },
    )
    configs = [
        {"id": "shorter_sleep", "name": "较短睡眠后的次日", "short_name": "较短睡眠后", "description": "当夜睡眠低于该参与者个人中位数", "parameters": {"sleep_split": "< within-person median", "min_valid_pairs": 2}},
        {"id": "longer_sleep", "name": "较长睡眠后的次日", "short_name": "较长睡眠后", "description": "当夜睡眠大于或等于该参与者个人中位数", "parameters": {"sleep_split": ">= within-person median", "min_valid_pairs": 2}},
    ]
    return finalize(data, configs, runs, "sleep-next-day-steps.json")


def main():
    archive_hash, extracted = extract_raw_files()
    activity = activity_rows()
    sleep = sleep_rows()
    outputs = [build_weekend(activity, archive_hash), build_sleep_next_day(activity, sleep, archive_hash)]
    provenance = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_page": SOURCE_URL,
        "source_archive_url": ARCHIVE_URL,
        "license": "CC0-1.0 (as labeled on the Kaggle data card)",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "archive_sha256": archive_hash,
        "raw_files": {
            name: {
                "path": path,
                "sha256": sha256_bytes((ROOT / path).read_bytes()),
                "rows": len(read_csv(name)),
            }
            for name, path in zip((ACTIVITY_NAME, SLEEP_NAME), extracted)
        },
        "valid_activity_days": len(activity),
        "valid_sleep_days": len(sleep),
        "outputs": outputs,
        "method_note": "Observational associations only. Participant-level aggregation avoids pretending repeated days are independent people; it does not establish causation or statistical significance.",
    }
    target = ROOT / "data" / "lifestyle-provenance.json"
    target.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(provenance, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
