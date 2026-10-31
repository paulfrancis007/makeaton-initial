"""Check local Mailpit SMTP delivery and inbox capture using a synthetic email."""

from email.message import EmailMessage
import json
from pathlib import Path
import smtplib
import sys
import time
from urllib.request import ProxyHandler, build_opener
from uuid import uuid4


def main():
    env_path = Path(__file__).resolve().parents[1] / "backend/.env"
    config = {}
    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            config[key.strip()] = value.strip()
    if config.get("SMTP_HOST") != "127.0.0.1" or config.get("SMTP_PORT") != "1025":
        raise RuntimeError("Check is restricted to the local Mailpit configuration")
    if (config.get("SMTP_USERNAME") or config.get("SMTP_PASSWORD") or
            config.get("SMTP_STARTTLS") != "false" or config.get("SMTP_SSL") != "false"):
        raise RuntimeError("Expected the loopback-only unauthenticated Mailpit configuration")
    # Bypass ambient HTTP proxies for loopback diagnostics.
    opener = build_opener(ProxyHandler({}))
    with opener.open("http://127.0.0.1:8025/", timeout=5) as response:
        if response.status != 200:
            raise RuntimeError("Local inbox is unavailable")
    subject = "Brightloop local setup check " + uuid4().hex
    message = EmailMessage()
    message["From"] = config["EMAIL_FROM"]
    message["To"] = "setup-check@brightloop.test"
    message["Subject"] = subject
    message.set_content("Synthetic local SMTP check. No customer data or credentials.")
    with smtplib.SMTP("127.0.0.1", 1025, timeout=5) as smtp:
        refused = smtp.send_message(message)
        if refused:
            raise RuntimeError("Synthetic local recipient was refused")
    for _ in range(10):
        with opener.open("http://127.0.0.1:8025/api/v1/messages", timeout=5) as response:
            data = json.load(response)
        if any(item.get("Subject") == subject for item in data.get("messages", [])):
            print("PASS: inbox HTTP, SMTP delivery, and captured synthetic message")
            return
        time.sleep(0.5)
    raise RuntimeError("SMTP message did not appear in the local inbox")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("FAILED: local email check; no credentials or inbox contents displayed.", file=sys.stderr)
        sys.exit(1)
