import logging

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models import Notification, PushDevice

log = logging.getLogger("grocery.push")


def send_pushes(notification_ids: list[int]) -> None:
    """Deliver queued notifications through Expo's push service.

    Runs after the request/transaction that created the notifications has committed.
    Network failures are recorded on the row as push_status="failed" and never raised,
    so an offline backend or an unreachable Expo endpoint cannot break order updates.
    """
    if not notification_ids:
        return
    settings = get_settings()
    with SessionLocal() as db:
        notes = db.execute(select(Notification).where(Notification.id.in_(notification_ids))).scalars().all()
        for note in notes:
            devices = db.execute(select(PushDevice).where(PushDevice.user_id == note.user_id)).scalars().all()
            if not settings.expo_push_enabled or not devices:
                note.push_status = "skipped"
                continue
            note.push_status = _send_to_devices(settings.expo_push_url, note, [d.token for d in devices])
        db.commit()


def _send_to_devices(url: str, note: Notification, tokens: list[str]) -> str:
    messages = [
        {
            "to": token,
            "title": note.title,
            "body": note.body,
            "sound": "default",
            "data": {"orderId": note.order_id, "notificationId": note.id},
        }
        for token in tokens
    ]
    try:
        response = httpx.post(url, json=messages, timeout=3.0)
        response.raise_for_status()
        tickets = response.json().get("data", [])
        if any(t.get("status") == "error" for t in tickets):
            return "failed"
        return "sent"
    except (httpx.HTTPError, ValueError) as exc:
        log.info("push delivery skipped for notification %s: %s", note.id, exc.__class__.__name__)
        return "failed"


def add_notification(db: Session, *, user_id: int, title: str, body: str, order_id: int | None) -> Notification:
    note = Notification(user_id=user_id, order_id=order_id, title=title[:120], body=body[:255])
    db.add(note)
    db.flush()
    return note
