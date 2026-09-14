import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import json
from pathlib import Path

project_root = Path("/mnt/c/Users/ankan/OneDrive/Projects/Dr.-radder-TestCase/ecg-qml")

with open(project_root / "outputs" / "final_benchmark.json") as f:
    benchmark = json.load(f)

# Filter for models with test results (exclude validation-only)
test_models = [m for m in benchmark if m["Evaluation_split"] == "held-out test"]
val_models = [m for m in benchmark if m["Evaluation_split"] == "validation"]

# Combine for plotting with clear labels
plot_models = []
plot_f1 = []
plot_colors = []

for m in test_models:
    plot_models.append(m["Model"])
    plot_f1.append(m["Macro_F1"])
    plot_colors.append("tab:blue")

for m in val_models:
    plot_models.append(m["Model"] + " (validation)")
    plot_f1.append(m["Macro_F1"])
    plot_colors.append("tab:orange")

# Create bar chart
fig, ax = plt.subplots(figsize=(12, 7))

bars = ax.barh(range(len(plot_models)), plot_f1, color=plot_colors, edgecolor="black", height=0.6)

ax.set_yticks(range(len(plot_models)))
ax.set_yticklabels(plot_models, fontsize=11)
ax.set_xlabel("Macro F1", fontsize=12)
ax.set_title("ECG Heartbeat Classification — Final Benchmark", fontsize=14, fontweight="bold")
ax.set_xlim(0, 1.0)
ax.grid(True, axis="x", linestyle="--", alpha=0.3)

# Annotate bars with percentages
for i, (bar, f1) in enumerate(zip(bars, plot_f1)):
    ax.text(f1 + 0.01, bar.get_y() + bar.get_height()/2, f"{f1:.1%}", 
            va="center", fontsize=10, fontweight="bold")

# Add legend for test vs validation
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor="tab:blue", edgecolor="black", label="Held-out test set"),
    Patch(facecolor="tab:orange", edgecolor="black", label="Validation set")
]
ax.legend(handles=legend_elements, loc="lower right", fontsize=10)

plt.tight_layout()
plot_path = project_root / "outputs" / "final_benchmark.png"
plt.savefig(plot_path, dpi=150)
plt.close(fig)

print(f"Saved plot: {plot_path}")