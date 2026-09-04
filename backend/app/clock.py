"""Today's date, in one place.

Several figures are scoped to "this month" or "the next 30 days", and they build
that window into the SQL they send — ``MONTH(date) = 9``, ``due_date >= '…'``.
That makes the app's queries a function of the calendar, which is correct in
production and ruinous in a test suite: the contract recordings captured in
August stopped matching the moment September began, and the suite went red on
the 1st without a line of code changing.

So the clock is a seam. Production reads the real one; the contract tests pin it
to the sample dataset's own as-of date, so a recording stays valid for as long as
the recorded data does.
"""

from __future__ import annotations

from datetime import date, datetime, timezone


def today() -> date:
    """The current UTC date. Patch this in tests rather than the callers."""
    return datetime.now(timezone.utc).date()
