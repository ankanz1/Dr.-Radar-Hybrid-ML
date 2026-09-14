import json
import csv
from pathlib import Path

project_root = Path("/mnt/c/Users/ankan/OneDrive/Projects/Dr.-radder-TestCase/ecg-qml")

# Load all metrics
with open(project_root / "outputs" / "xgboost_metrics.json") as f:
    xgb_full = json.load(f)["test_metrics"]

with open(project_root / "outputs" / "xgb_pca8_test_metrics.json") as f:
    xgb_pca8 = json.load(f)["test_metrics"]

with open(project_root / "outputs" / "xgb_pca_ablation_metrics.json") as f:
    xgb_ablation = json.load(f)

with open(project_root / "outputs" / "qml_balanced_test_metrics.json") as f:
    qml_pca8 = json.load(f)["metrics"]

with open(project_root / "outputs" / "qml_mlp_head_test_metrics.json") as f:
    qml_mlp_head = json.load(f)["metrics"]

with open(project_root / "outputs" / "qml_pca12_metrics.json") as f:
    qml_pca12 = json.load(f)

# Classical MLP test metrics (just computed)
mlp_test = {
    "accuracy": 0.9622693221268043,
    "balanced_accuracy": 0.7801200308342364,
    "macro_precision": 0.8736386850040739,
    "macro_recall": 0.7801200308342364,
    "macro_f1": 0.8206404072389606,
    "weighted_f1": 0.9605944872688322,
}

# Extract PCA-12 and PCA-16 XGBoost metrics from ablation
xgb_pca12 = xgb_ablation["results"][1]["test_metrics"]
xgb_pca16 = xgb_ablation["results"][2]["test_metrics"]

# Build benchmark table
benchmark = [
    {
        "Model": "Classical MLP",
        "Feature_representation": "Full 187 features",
        "Quantum_classical": "Classical",
        "Qubits": "N/A",
        "VQC_layers": "N/A",
        "Trainable_parameters": 187*64 + 64 + 64*32 + 32 + 32*5 + 5,  # 12288+64+2048+32+160+5 = 14597
        "Accuracy": round(mlp_test["accuracy"], 4),
        "Balanced_Accuracy": round(mlp_test["balanced_accuracy"], 4),
        "Macro_Precision": round(mlp_test["macro_precision"], 4),
        "Macro_Recall": round(mlp_test["macro_recall"], 4),
        "Macro_F1": round(mlp_test["macro_f1"], 4),
        "Weighted_F1": round(mlp_test["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "Full-feature XGBoost",
        "Feature_representation": "Full 187 features",
        "Quantum_classical": "Classical",
        "Qubits": "N/A",
        "VQC_layers": "N/A",
        "Trainable_parameters": "N/A (tree ensemble)",
        "Accuracy": round(xgb_full["accuracy"], 4),
        "Balanced_Accuracy": round(xgb_full["balanced_accuracy"], 4),
        "Macro_Precision": round(xgb_full["macro_precision"], 4),
        "Macro_Recall": round(xgb_full["macro_recall"], 4),
        "Macro_F1": round(xgb_full["macro_f1"], 4),
        "Weighted_F1": round(xgb_full["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "PCA-8 XGBoost",
        "Feature_representation": "PCA (8 components)",
        "Quantum_classical": "Classical",
        "Qubits": "N/A",
        "VQC_layers": "N/A",
        "Trainable_parameters": "N/A (tree ensemble)",
        "Accuracy": round(xgb_pca8["accuracy"], 4),
        "Balanced_Accuracy": round(xgb_pca8["balanced_accuracy"], 4),
        "Macro_Precision": round(xgb_pca8["macro_precision"], 4),
        "Macro_Recall": round(xgb_pca8["macro_recall"], 4),
        "Macro_F1": round(xgb_pca8["macro_f1"], 4),
        "Weighted_F1": round(xgb_pca8["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "PCA-12 XGBoost",
        "Feature_representation": "PCA (12 components)",
        "Quantum_classical": "Classical",
        "Qubits": "N/A",
        "VQC_layers": "N/A",
        "Trainable_parameters": "N/A (tree ensemble)",
        "Accuracy": round(xgb_pca12["accuracy"], 4),
        "Balanced_Accuracy": round(xgb_pca12["balanced_accuracy"], 4),
        "Macro_Precision": round(xgb_pca12["macro_precision"], 4),
        "Macro_Recall": round(xgb_pca12["macro_recall"], 4),
        "Macro_F1": round(xgb_pca12["macro_f1"], 4),
        "Weighted_F1": round(xgb_pca12["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "PCA-16 XGBoost",
        "Feature_representation": "PCA (16 components)",
        "Quantum_classical": "Classical",
        "Qubits": "N/A",
        "VQC_layers": "N/A",
        "Trainable_parameters": "N/A (tree ensemble)",
        "Accuracy": round(xgb_pca16["accuracy"], 4),
        "Balanced_Accuracy": round(xgb_pca16["balanced_accuracy"], 4),
        "Macro_Precision": round(xgb_pca16["macro_precision"], 4),
        "Macro_Recall": round(xgb_pca16["macro_recall"], 4),
        "Macro_F1": round(xgb_pca16["macro_f1"], 4),
        "Weighted_F1": round(xgb_pca16["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "PCA-8 QML (linear head)",
        "Feature_representation": "PCA (8 components)",
        "Quantum_classical": "Quantum",
        "Qubits": 8,
        "VQC_layers": 4,
        "Trainable_parameters": 141,
        "Accuracy": round(qml_pca8["accuracy"], 4),
        "Balanced_Accuracy": round(qml_pca8["balanced_accuracy"], 4),
        "Macro_Precision": round(qml_pca8["macro_precision"], 4),
        "Macro_Recall": round(qml_pca8["macro_recall"], 4),
        "Macro_F1": round(qml_pca8["macro_f1"], 4),
        "Weighted_F1": round(qml_pca8["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "PCA-8 QML (MLP head)",
        "Feature_representation": "PCA (8 components)",
        "Quantum_classical": "Quantum",
        "Qubits": 8,
        "VQC_layers": 4,
        "Trainable_parameters": 325,
        "Accuracy": round(qml_mlp_head["accuracy"], 4),
        "Balanced_Accuracy": round(qml_mlp_head["balanced_accuracy"], 4),
        "Macro_Precision": round(qml_mlp_head["macro_precision"], 4),
        "Macro_Recall": round(qml_mlp_head["macro_recall"], 4),
        "Macro_F1": round(qml_mlp_head["macro_f1"], 4),
        "Weighted_F1": round(qml_mlp_head["weighted_f1"], 4),
        "Evaluation_split": "held-out test"
    },
    {
        "Model": "PCA-12 QML",
        "Feature_representation": "PCA (12 components)",
        "Quantum_classical": "Quantum",
        "Qubits": 12,
        "VQC_layers": 4,
        "Trainable_parameters": 209,
        "Accuracy": round(qml_pca12["metrics"]["accuracy"], 4),
        "Balanced_Accuracy": round(qml_pca12["metrics"]["balanced_accuracy"], 4),
        "Macro_Precision": round(qml_pca12["metrics"]["macro_precision"], 4),
        "Macro_Recall": round(qml_pca12["metrics"]["macro_recall"], 4),
        "Macro_F1": round(qml_pca12["metrics"]["macro_f1"], 4),
        "Weighted_F1": round(qml_pca12["metrics"]["weighted_f1"], 4),
        "Evaluation_split": "validation"
    },
]

# Save JSON
json_path = project_root / "outputs" / "final_benchmark.json"
with open(json_path, "w") as f:
    json.dump(benchmark, f, indent=2)

# Save CSV
csv_path = project_root / "outputs" / "final_benchmark.csv"
fieldnames = ["Model", "Feature_representation", "Quantum_classical", "Qubits", "VQC_layers", 
              "Trainable_parameters", "Accuracy", "Balanced_Accuracy", "Macro_Precision", 
              "Macro_Recall", "Macro_F1", "Weighted_F1", "Evaluation_split"]
with open(csv_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(benchmark)

print("Saved JSON:", json_path)
print("Saved CSV:", csv_path)

# Print table
print("\nFinal Benchmark Table:")
print("=" * 160)
header = f"{'Model':<28} {'Features':<18} {'Q/C':<5} {'Qubits':<7} {'Layers':<7} {'Params':<18} {'Acc':<8} {'BalAcc':<8} {'MacroP':<8} {'MacroR':<8} {'MacroF1':<8} {'WF1':<8} {'Split'}"
print(header)
print("-" * 160)
for row in benchmark:
    qc = row["Quantum_classical"]
    split = row["Evaluation_split"]
    model = row["Model"]
    if split == "validation":
        model += " (val)"
    print(f"{model:<28} {row['Feature_representation']:<18} {qc:<5} {str(row['Qubits']):<7} {str(row['VQC_layers']):<7} {str(row['Trainable_parameters']):<18} {row['Accuracy']:<8} {row['Balanced_Accuracy']:<8} {row['Macro_Precision']:<8} {row['Macro_Recall']:<8} {row['Macro_F1']:<8} {row['Weighted_F1']:<8} {split}")
print("=" * 160)