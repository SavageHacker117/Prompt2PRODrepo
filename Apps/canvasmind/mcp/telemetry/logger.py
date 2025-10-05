import logging

logger = logging.getLogger("mcp")
_handler = logging.StreamHandler()
_formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s")
_handler.setFormatter(_formatter)
logger.addHandler(_handler)
logger.setLevel(logging.INFO)

def event(name: str, **fields):
    logger.info("event=%s %s", name, " ".join(f"{k}={v}" for k,v in fields.items()))
