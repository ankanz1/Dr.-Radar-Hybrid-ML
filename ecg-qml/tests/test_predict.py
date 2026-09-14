import pytest

from src.predict import predict_ecg


def test_predict_ecg_rejects_invalid_length():
    with pytest.raises(ValueError):
        predict_ecg([0.1] * 186)
