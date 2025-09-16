from . import health_bp

@health_bp.get("/health")
def health():
    return {"ok": True}
