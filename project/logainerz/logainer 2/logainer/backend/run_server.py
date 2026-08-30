import os
import sys

# Ensure backend folder and platform-appropriate venv site-packages are on PYTHONPATH
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if sys.platform == "win32":
    for sub in [
        os.path.join(base_dir, "backend", "venv_win", "Lib", "site-packages"),
        os.path.join(base_dir, "backend", "venv", "Lib", "site-packages"),
    ]:
        if os.path.exists(sub) and sub not in sys.path:
            sys.path.insert(0, sub)
else:
    for sub in [
        os.path.join(base_dir, "backend", "venv", "lib", "python3.9", "site-packages"),
        os.path.join(base_dir, "backend", "venv", "lib", "python3.11", "site-packages"),
    ]:
        if os.path.exists(sub) and sub not in sys.path:
            sys.path.insert(0, sub)

if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

import uvicorn

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=False)

