"""
Cross-platform Discord relaunch with --remote-debugging-port=9222.

On startup, if CDP isn't reachable, kill the running Discord and relaunch it
with the debug flag so Hearth can connect.
"""
import logging
import os
import platform
import shutil
import subprocess
import time
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

CDP_PORT = 9222
CDP_URL = f"http://127.0.0.1:{CDP_PORT}/json/version"


def cdp_available(timeout: float = 1.0) -> bool:
    try:
        r = requests.get(CDP_URL, timeout=timeout)
        return r.status_code == 200
    except Exception:
        return False


def _find_discord_windows() -> Path | None:
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        return None
    base = Path(local) / "Discord"
    if not base.is_dir():
        return None
    # Pick highest app-* folder
    candidates = sorted(
        (p for p in base.glob("app-*") if (p / "Discord.exe").is_file()),
        key=lambda p: p.name,
        reverse=True,
    )
    if candidates:
        return candidates[0] / "Discord.exe"
    update = base / "Update.exe"
    return update if update.is_file() else None


def _find_discord_macos() -> Path | None:
    for p in ("/Applications/Discord.app", str(Path.home() / "Applications/Discord.app")):
        if Path(p).is_dir():
            return Path(p)
    return None


def _find_discord_linux() -> Path | None:
    for name in ("discord", "Discord", "discord-stable"):
        found = shutil.which(name)
        if found:
            return Path(found)
    # Flatpak fallback
    if shutil.which("flatpak"):
        try:
            out = subprocess.check_output(
                ["flatpak", "list", "--app", "--columns=application"],
                text=True, timeout=3,
            )
            if "com.discordapp.Discord" in out:
                return Path("flatpak://com.discordapp.Discord")
        except Exception:
            pass
    return None


def _kill_discord() -> None:
    system = platform.system()
    try:
        if system == "Windows":
            subprocess.run(
                ["taskkill", "/F", "/IM", "Discord.exe", "/T"],
                capture_output=True, timeout=10,
            )
        else:
            subprocess.run(["pkill", "-9", "-i", "Discord"], capture_output=True, timeout=10)
    except Exception as e:
        logger.warning(f"Kill discord failed: {e}")


def _spawn_discord() -> bool:
    system = platform.system()
    flag = f"--remote-debugging-port={CDP_PORT}"
    try:
        if system == "Windows":
            exe = _find_discord_windows()
            if not exe:
                logger.error("Could not locate Discord.exe under %LocalAppData%\\Discord")
                return False
            logger.info(f"Launching {exe} {flag}")
            subprocess.Popen(
                [str(exe), flag],
                creationflags=0x00000008,  # DETACHED_PROCESS
                close_fds=True,
            )
            return True

        if system == "Darwin":
            app = _find_discord_macos()
            if not app:
                logger.error("Could not locate Discord.app under /Applications")
                return False
            logger.info(f"Launching {app} with {flag}")
            subprocess.Popen(
                ["open", "-a", str(app), "--args", flag],
                close_fds=True,
            )
            return True

        if system == "Linux":
            exe = _find_discord_linux()
            if not exe:
                logger.error("Could not locate discord binary on PATH or flatpak")
                return False
            logger.info(f"Launching {exe} {flag}")
            if str(exe).startswith("flatpak://"):
                subprocess.Popen(
                    ["flatpak", "run", "com.discordapp.Discord", flag],
                    close_fds=True,
                )
            else:
                subprocess.Popen([str(exe), flag], close_fds=True)
            return True
    except Exception as e:
        logger.error(f"Spawn discord failed: {e}")
    return False


def ensure_cdp_ready(max_wait: float = 20.0) -> bool:
    """
    Ensure Discord is running with CDP on port 9222.
    Returns True if CDP is available (already was, or after relaunch).
    """
    if cdp_available():
        logger.info("Discord CDP already available")
        return True

    logger.info("Discord CDP not available — killing any running Discord and relaunching")
    _kill_discord()
    time.sleep(1.5)

    if not _spawn_discord():
        return False

    # Poll for CDP to come up
    deadline = time.monotonic() + max_wait
    while time.monotonic() < deadline:
        if cdp_available(timeout=0.5):
            logger.info("Discord CDP ready")
            return True
        time.sleep(0.5)

    logger.warning("Discord CDP did not come up within %.1fs", max_wait)
    return False
