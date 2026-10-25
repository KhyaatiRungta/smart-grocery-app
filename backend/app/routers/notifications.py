from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_user
from app.models import Notification, PushDevice, User
from app.schemas import DeviceIn, NotificationOut, NotificationPage

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.post("/devices", status_code=status.HTTP_204_NO_CONTENT)
def register_device(body: DeviceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Store (or re-assign) an Expo push token for this user's device."""
    device = db.execute(select(PushDevice).where(PushDevice.token == body.token)).scalar_one_or_none()
    if device is None:
        db.add(PushDevice(user_id=user.id, token=body.token, platform=body.platform))
    else:
        device.user_id = user.id
        device.platform = body.platform
    db.commit()


@router.get("", response_model=NotificationPage)
def list_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(100)
        )
        .scalars()
        .all()
    )
    unread = db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))
    ).scalar_one()
    return NotificationPage(items=[NotificationOut.model_validate(r) for r in rows], unread_count=unread)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id).values(read=True))
    db.commit()


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user.id)
        .values(read=True)
    )
    db.commit()
