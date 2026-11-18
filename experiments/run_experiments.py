"""生成 RunLedger 的两组真实演示实验，结果写入 public/data。"""
from __future__ import annotations

import hashlib
import json
import os
import platform
import time
import warnings
from datetime import datetime
from pathlib import Path

import numpy as np
import scipy
import sklearn
from scipy import ndimage
from sklearn.datasets import load_digits, load_sample_image
from sklearn.exceptions import ConvergenceWarning
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data"
OUT.mkdir(parents=True, exist_ok=True)


def now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def environment() -> dict:
    return {
        "python": platform.python_version(),
        "numpy": np.__version__,
        "scipy": scipy.__version__,
        "sklearn": sklearn.__version__,
        "platform": platform.platform(),
        "processor": platform.processor() or platform.machine(),
        "logical_cpu": int(os.cpu_count() or 1),
    }


def write_result(name: str, result: dict) -> None:
    canonical = json.dumps(result["runs"], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    result["provenance"]["runs_sha256"] = hashlib.sha256(canonical.encode()).hexdigest()
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已写入 {path.relative_to(ROOT)}：{len(result['runs'])} 条运行记录")


def run_digits() -> None:
    started = time.perf_counter()
    X, y = load_digits(return_X_y=True)
    indices = np.arange(len(y))
    train_idx, remaining = train_test_split(
        indices, train_size=360, random_state=2026, stratify=y
    )
    test_idx, _ = train_test_split(
        remaining, train_size=540, random_state=2027, stratify=y[remaining]
    )
    configs = [
        {
            "id": "mlp32",
            "name": "基线 · MLP 32",
            "short_name": "MLP 32",
            "description": "单隐层32单元，作为所有提升声明的基线。",
            "parameters": {"hidden_layer_sizes": [32], "alpha": 0.0001, "max_iter": 220},
            "seeds": [11, 29, 47],
        },
        {
            "id": "mlp128",
            "name": "候选 · MLP 128",
            "short_name": "MLP 128",
            "description": "仅扩大单隐层宽度，检查容量提升是否超过种子波动。",
            "parameters": {"hidden_layer_sizes": [128], "alpha": 0.0001, "max_iter": 220},
            "seeds": [11, 29, 47],
        },
        {
            "id": "mlp128_l2",
            "name": "消融 · MLP 128 + L2",
            "short_name": "128 + L2",
            "description": "在128单元配置上仅调整L2正则强度。",
            "parameters": {"hidden_layer_sizes": [128], "alpha": 0.05, "max_iter": 220},
            "seeds": [11, 29, 47],
        },
        {
            "id": "mlp64x2",
            "name": "探索 · MLP 64×2",
            "short_name": "MLP 64×2",
            "description": "探索性双隐层配置，当前只执行一个种子，不能用于稳定排名。",
            "parameters": {"hidden_layer_sizes": [64, 64], "alpha": 0.0001, "max_iter": 220},
            "seeds": [11],
        },
    ]
    runs = []
    serial = 0
    for config in configs:
        for seed in config["seeds"]:
            serial += 1
            params = dict(config["parameters"])
            params["hidden_layer_sizes"] = tuple(params["hidden_layer_sizes"])
            model = make_pipeline(
                StandardScaler(),
                MLPClassifier(random_state=seed, **params),
            )
            tic = time.perf_counter_ns()
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always", ConvergenceWarning)
                model.fit(X[train_idx], y[train_idx])
            elapsed_ms = (time.perf_counter_ns() - tic) / 1e6
            pred = model.predict(X[test_idx])
            accuracy = float(np.mean(pred == y[test_idx]))
            # 逐类召回后取宏平均，避免只报告总体准确率。
            recalls = []
            for label in np.unique(y):
                mask = y[test_idx] == label
                recalls.append(float(np.mean(pred[mask] == label)))
            macro_recall = float(np.mean(recalls))
            mlp = model.named_steps["mlpclassifier"]
            runs.append({
                "id": f"digits-{config['id']}-s{seed}-v1",
                "config_id": config["id"],
                "seed": seed,
                "repeat": seed,
                "phase": "training",
                "value": round(accuracy * 100, 4),
                "metrics": {
                    "accuracy": round(accuracy * 100, 4),
                    "macro_recall": round(macro_recall * 100, 4),
                },
                "duration_ms": round(elapsed_ms, 3),
                "iterations": int(mlp.n_iter_),
                "converged": not any(issubclass(w.category, ConvergenceWarning) for w in caught),
                "batch": "original",
                "recorded_at": now(),
            })
            print(
                f"{config['id']:12s} seed={seed:2d} acc={accuracy * 100:6.2f}% "
                f"macroR={macro_recall * 100:6.2f}% {elapsed_ms / 1000:5.2f}s"
            )

    public_configs = [{k: v for k, v in c.items() if k != "seeds"} for c in configs]
    result = {
        "schema_version": "1.0",
        "experiment": {
            "id": "digits-small-sample",
            "title": "digits 小样本图像分类",
            "subtitle": "模型容量提升，还是随机种子的噪声？",
            "kind": "classification",
            "created_at": now(),
            "duration_s": round(time.perf_counter() - started, 3),
            "metric": {"key": "accuracy", "label": "测试准确率", "unit": "%", "higher_is_better": True},
            "baseline_config": "mlp32",
            "target_seeds": 3,
            "dataset": {
                "name": "sklearn digits / UCI Optical Recognition of Handwritten Digits",
                "samples": int(len(y)),
                "features": int(X.shape[1]),
                "classes": int(len(np.unique(y))),
                "image_shape": "8×8 灰度图",
                "source": "https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_digits.html",
                "license_note": "随 scikit-learn 分发的真实公开数据集；本地离线加载。",
            },
            "design": {
                "train_samples": int(len(train_idx)),
                "test_samples": int(len(test_idx)),
                "split_seed": 2026,
                "test_split_seed": 2027,
                "seeds": [11, 29, 47],
                "control": "所有配置使用相同训练/测试划分；仅模型参数和MLP随机种子变化。",
                "limitations": "受控小样本实验，不代表完整digits或SGG任务上的最优性能。",
            },
            "environment": environment(),
        },
        "configs": public_configs,
        "runs": runs,
        "provenance": {
            "script": "experiments/run_experiments.py",
            "command": "python experiments/run_experiments.py",
            "data_mode": "real",
            "description": "所有数值由本地真实模型训练产生；无手工填写的指标。",
        },
    }
    write_result("digits-small-sample", result)


def run_performance() -> None:
    started = time.perf_counter()
    image = load_sample_image("china.jpg").astype(np.float32) / 255.0
    sigma = 1.2
    radius = 2
    xs = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel_1d = np.exp(-(xs ** 2) / (2 * sigma ** 2))
    kernel_1d /= kernel_1d.sum()
    kernel_2d = np.outer(kernel_1d, kernel_1d)

    def full_2d(data: np.ndarray) -> np.ndarray:
        return np.stack([
            ndimage.convolve(data[:, :, c], kernel_2d, mode="reflect")
            for c in range(3)
        ], axis=2)

    def separable(data: np.ndarray) -> np.ndarray:
        channels = []
        for c in range(3):
            horizontal = ndimage.convolve1d(data[:, :, c], kernel_1d, axis=1, mode="reflect")
            channels.append(ndimage.convolve1d(horizontal, kernel_1d, axis=0, mode="reflect"))
        return np.stack(channels, axis=2)

    configs = [
        {
            "id": "full2d",
            "name": "基线 · 二维卷积",
            "short_name": "二维卷积",
            "description": "每个颜色通道执行一次5×5二维卷积。",
            "parameters": {"operation": "ndimage.convolve", "kernel": "5×5", "sigma": sigma},
        },
        {
            "id": "separable",
            "name": "优化 · 可分离卷积",
            "short_name": "可分离卷积",
            "description": "将同一个高斯核拆成水平与垂直两次一维卷积。",
            "parameters": {"operation": "ndimage.convolve1d × 2", "kernel": "5 + 5", "sigma": sigma},
        },
    ]
    functions = {"full2d": full_2d, "separable": separable}
    reference = full_2d(image)
    optimized = separable(image)
    max_error = float(np.max(np.abs(reference - optimized)))
    if not np.allclose(reference, optimized, atol=1e-6, rtol=1e-5):
        raise RuntimeError(f"两种实现输出不一致，max_error={max_error}")

    runs = []
    serial = 0
    for config_id in ("full2d", "separable"):
        tic = time.perf_counter_ns()
        functions[config_id](image)
        elapsed = (time.perf_counter_ns() - tic) / 1e6
        serial += 1
        runs.append({
            "id": f"perf-{config_id}-first-v1",
            "config_id": config_id,
            "seed": None,
            "repeat": 0,
            "phase": "first_call",
            "value": round(elapsed, 5),
            "metrics": {"latency_ms": round(elapsed, 5)},
            "batch": "original",
            "recorded_at": now(),
        })

    for repeat in range(1, 16):
        order = ("full2d", "separable") if repeat % 2 else ("separable", "full2d")
        for config_id in order:
            tic = time.perf_counter_ns()
            functions[config_id](image)
            elapsed = (time.perf_counter_ns() - tic) / 1e6
            serial += 1
            runs.append({
                "id": f"perf-{config_id}-r{repeat}-v1",
                "config_id": config_id,
                "seed": None,
                "repeat": repeat,
                "phase": "warm",
                "value": round(elapsed, 5),
                "metrics": {"latency_ms": round(elapsed, 5)},
                "batch": "original",
                "recorded_at": now(),
            })

    result = {
        "schema_version": "1.0",
        "experiment": {
            "id": "local-performance",
            "title": "本地高斯模糊性能计时",
            "subtitle": "可分离卷积的加速，能否经受重复测量？",
            "kind": "performance",
            "created_at": now(),
            "duration_s": round(time.perf_counter() - started, 3),
            "metric": {"key": "latency_ms", "label": "单次耗时", "unit": "ms", "higher_is_better": False},
            "baseline_config": "full2d",
            "target_seeds": 15,
            "dataset": {
                "name": "sklearn 示例照片 china.jpg",
                "samples": 1,
                "shape": list(image.shape),
                "source": "https://scikit-learn.org/stable/modules/generated/sklearn.datasets.load_sample_image.html",
                "license_note": "随 scikit-learn 分发的真实示例照片；本地离线加载。",
            },
            "design": {
                "repetitions": 15,
                "first_call_separate": True,
                "order": "预热测量按AB/BA交替，降低执行顺序与系统漂移偏差。",
                "control": "相同图片、相同5×5高斯核、相同reflect边界；已校验两种实现输出一致。",
                "limitations": "首次调用仅表示当前进程内第一次执行，不等于全新操作系统冷启动。",
            },
            "environment": environment(),
            "validation": {
                "output_allclose": True,
                "max_abs_error": max_error,
                "tolerance": "atol=1e-6, rtol=1e-5",
            },
        },
        "configs": configs,
        "runs": runs,
        "provenance": {
            "script": "experiments/run_experiments.py",
            "command": "python experiments/run_experiments.py",
            "data_mode": "real",
            "description": "耗时来自time.perf_counter_ns；首次与预热测量分开保存。",
        },
    }
    write_result("local-performance", result)
    print(f"两种实现最大输出误差：{max_error:.3e}")


if __name__ == "__main__":
    run_digits()
    run_performance()
