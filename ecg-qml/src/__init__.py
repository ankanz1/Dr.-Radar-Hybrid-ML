"""ECG classification baseline package."""

try:
    from .model import ECGMLP
except Exception:  # pragma: no cover - keeps project imports working when MLP deps are unavailable
    ECGMLP = None

__all__ = ["ECGMLP"]
