"""Load gitignored .env values into os.environ without third-party deps."""
import os
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_dotenv(path=None):
    file = Path(path) if path else HERE / '.env'
    if not file.is_file():
        return False
    for raw in file.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        os.environ.setdefault(key, value)
    return True


def agent_status():
    provider = (os.environ.get('BRIEF_PROVIDER') or 'openrouter').strip().lower()
    if provider not in ('openrouter', 'nvidia'):
        provider = 'openrouter'
    openrouter = bool(os.environ.get('OPENROUTER_API_KEY', '').strip())
    nvidia = bool(os.environ.get('NVIDIA_API_KEY', '').strip())
    ready = openrouter if provider == 'openrouter' else nvidia
    default_model = (
        os.environ.get('OPENROUTER_MODEL', 'openai/gpt-4.1-mini').strip()
        if provider == 'openrouter'
        else os.environ.get('NVIDIA_MODEL', 'meta/llama-3.1-70b-instruct').strip()
    )
    return {
        'ready': ready,
        'provider': provider,
        'model': default_model,
        'openrouter': openrouter,
        'nvidia': nvidia,
    }
