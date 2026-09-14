from __future__ import annotations

import json
import re
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import streamlit as st

from src.data import load_csv_dataset
from src.explain_qml import explain_ecg, get_project_root, save_explanation_plot

PROJECT_ROOT = get_project_root()
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
TEST_DATA_PATH = PROJECT_ROOT / "data" / "mitbih_test.csv"
CLASS_DESCRIPTIONS = {
    0: "0 - N: Normal beat",
    1: "1 - S: Supraventricular ectopic beat",
    2: "2 - V: Ventricular ectopic beat",
    3: "3 - F: Fusion beat",
    4: "4 - Q: Unknown beat",
}

st.set_page_config(page_title="ECG-QML Demonstration", page_icon="ECG", layout="wide")


@st.cache_data(show_spinner=False)
def load_test_samples():
    return load_csv_dataset(TEST_DATA_PATH)


@st.cache_data(show_spinner=False)
def cached_explanation(ecg_values: tuple[float, ...]) -> dict:
    return explain_ecg(np.asarray(ecg_values, dtype=float), model_mode="balanced")


def parse_signal_text(text: str) -> np.ndarray:
    tokens = [token for token in re.split(r"[\s,;]+", text.strip()) if token]
    if len(tokens) != 187:
        raise ValueError(f"Expected exactly 187 signal values, but received {len(tokens)}.")
    try:
        values = np.asarray([float(token) for token in tokens], dtype=float)
    except ValueError as exc:
        raise ValueError("Every signal value must be numeric.") from exc
    if not np.isfinite(values).all():
        raise ValueError("Signal values must be finite numbers.")
    return values


def display_explanation(explanation: dict, actual_class: int | None = None) -> None:
    prediction = explanation["prediction"]
    class_id = int(prediction["class_id"])
    st.subheader("Prediction")
    st.metric("Predicted heartbeat class", f"{class_id} - {prediction['class_name']}")
    st.write(CLASS_DESCRIPTIONS.get(class_id, str(class_id)))
    st.metric("Model probability score", f"{prediction['score']:.2%}")
    if actual_class is not None:
        st.caption(f"Demonstration sample label: {CLASS_DESCRIPTIONS[actual_class]}")

    waveform = np.asarray(explanation["waveform"], dtype=float)
    figure, axis = plt.subplots(figsize=(12, 3.5))
    axis.plot(np.arange(187), waveform, color="#1f2937", linewidth=1.2)
    axis.set_title("Selected 187-point ECG waveform")
    axis.set_xlabel("Signal position")
    axis.set_ylabel("Signal value")
    axis.grid(alpha=0.2)
    figure.tight_layout()
    st.pyplot(figure, clear_figure=True)

    st.subheader("Model interpretability")
    st.caption(
        "Highlighted regions show model importance only. They are not a clinical diagnosis "
        "and do not establish medical causality."
    )
    plot_path = OUTPUTS_DIR / "streamlit_explanation_latest.png"
    save_explanation_plot(explanation, plot_path)
    st.image(str(plot_path), caption="ECG waveform with model-importance overlay")

    st.write("Top 3 important PCA features")
    st.dataframe(
        [
            {
                "Rank": item["rank"],
                "PCA feature": f"PCA {item['pca_feature']}",
                "Importance": item["importance"],
                "Score change": item["score_change"],
            }
            for item in explanation["ranked_pca_features"][:3]
        ],
        hide_index=True,
        use_container_width=True,
    )
    with (OUTPUTS_DIR / "streamlit_explanation_latest.json").open("w", encoding="utf-8") as file:
        json.dump(explanation, file, indent=2)


def main() -> None:
    st.title("ECG-QML Heartbeat Classification")
    st.caption("Offline SIH research demonstration using the frozen 8-qubit, 4-layer QML model")
    st.info(
        "This application classifies heartbeat patterns for research demonstration only. "
        "It is not a medical device and does not provide a diagnosis."
    )

    with st.sidebar:
        st.header("Input")
        input_mode = st.radio("Choose an ECG source", ["Test dataset sample", "Enter or upload 187 values"])
        st.divider()
        st.write("Frozen configuration")
        st.write("187 values -> PCA-8 -> 8 qubits -> 4 VQC layers")
        st.write("Classes: 0 N, 1 S, 2 V, 3 F, 4 Q")

    signal: np.ndarray | None = None
    actual_class: int | None = None
    if input_mode == "Test dataset sample":
        test_df = load_test_samples()
        sample_index = st.sidebar.number_input(
            "Test sample index", min_value=0, max_value=len(test_df) - 1, value=0, step=1
        )
        row = test_df.iloc[int(sample_index)]
        signal = row.iloc[:-1].to_numpy(dtype=float)
        actual_class = int(row.iloc[-1])
        st.sidebar.caption(f"Dataset label: {CLASS_DESCRIPTIONS[actual_class]}")
    else:
        uploaded = st.file_uploader("Upload CSV or TXT", type=["csv", "txt"])
        signal_text = st.text_area("Enter 187 ECG values", height=180, placeholder="Comma- or space-separated values...")
        if uploaded is not None:
            signal_text = uploaded.getvalue().decode("utf-8")
            st.caption(f"Loaded {uploaded.name}")
        if signal_text.strip():
            try:
                signal = parse_signal_text(signal_text)
            except ValueError as exc:
                st.error(str(exc))

    if st.button("Analyze ECG", type="primary", use_container_width=True):
        if signal is None:
            st.error("Provide exactly 187 numeric values or select a test dataset sample.")
            return
        if signal.shape != (187,):
            st.error(f"Expected exactly 187 signal values, but received {signal.size}.")
            return
        with st.spinner("Running the frozen QML model and XAI analysis..."):
            try:
                explanation = cached_explanation(tuple(float(value) for value in signal))
            except (FileNotFoundError, ValueError, RuntimeError) as exc:
                st.error(f"Analysis could not be completed: {exc}")
                return
        display_explanation(explanation, actual_class=actual_class)


if __name__ == "__main__":
    main()
