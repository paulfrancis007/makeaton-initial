#!/usr/bin/env python
"""
Standalone CLI script to execute recurring billing.
Can be invoked by Windows Task Scheduler or Linux Cron.

Usage:
    python backend/scripts/run_billing.py [--date YYYY-MM-DD] [--batch-size 100]
"""
import os
import sys

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.billing_scheduler import main

if __name__ == "__main__":
    main()
