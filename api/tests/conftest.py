import os
import sys
from pathlib import Path

# Deterministic test configuration (set before the app is imported).
os.environ["UPLOAD_RATE_PER_MIN"] = "100000"
os.environ["CHAT_RATE_PER_MIN"] = "100000"
os.environ["ANTHROPIC_API_KEY"] = ""
os.environ["ALLOW_BYOK"] = "false"
os.environ["MAX_SESSIONS"] = "500"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
