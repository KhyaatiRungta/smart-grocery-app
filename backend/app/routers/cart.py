from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import current_user
from app.models import CartItem, Product, Store, StoreStock, User
from app.routers.catalog import product_out
from app.schemas import CartItemIn, CartLineOut, CartOut, CartQuantityIn, StoreOut

router = APIRouter(prefix="/api/cart", tags=["cart"])


def _stock_for(db: Session, store_id: int, product_id: int) -> StoreStock | None:
    return db.execute(
        select(StoreStock).where(StoreStock.store_id == store_id, StoreStock.product_id == product_id)
    ).scalar_one_or_none()


def _available(db: Session, store_id: int, product_id: int) -> int:
    stock = _stock_for(db, store_id, product_id)
    return stock.available if stock else 0


def _require_store(user: User) -> int:
    if user.selected_store_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Select a store first")
    return user.selected_store_id


def cart_view(db: Session, user: User) -> CartOut:
    settings = get_settings()
    store = db.get(Store, user.selected_store_id) if user.selected_store_id else None
    if store is None:
        return CartOut(
            store=None,
            items=[],
            item_count=0,
            subtotal_cents=0,
            delivery_fee_cents=0,
            total_cents=0,
            free_delivery_threshold_cents=settings.free_delivery_threshold_cents,
            delivery_fee_if_under_threshold_cents=settings.delivery_fee_cents,
        )
    lines = (
        db.execute(
            select(CartItem).where(CartItem.user_id == user.id, CartItem.store_id == store.id).order_by(CartItem.id)
        )
        .scalars()
        .all()
    )
    stock = {
        s.product_id: s
        for s in db.execute(
            select(StoreStock).where(
                StoreStock.store_id == store.id, StoreStock.product_id.in_([line.product_id for line in lines] or [0])
            )
        ).scalars()
    }
    items: list[CartLineOut] = []
    subtotal = 0
    for line in lines:
        row = stock.get(line.product_id)
        product = line.product
        items.append(
            CartLineOut(
                product=product_out(product, row.on_hand if row else 0, row.reserved if row else 0, store.id),
                quantity=line.quantity,
                line_total_cents=product.price_cents * line.quantity,
            )
        )
        subtotal += product.price_cents * line.quantity
    fee = 0 if not items or subtotal >= settings.free_delivery_threshold_cents else settings.delivery_fee_cents
    return CartOut(
        store=StoreOut.model_validate(store),
        items=items,
        item_count=sum(line.quantity for line in lines),
        subtotal_cents=subtotal,
        delivery_fee_cents=fee,
        total_cents=subtotal + fee,
        free_delivery_threshold_cents=settings.free_delivery_threshold_cents,
        delivery_fee_if_under_threshold_cents=settings.delivery_fee_cents,
    )


@router.get("", response_model=CartOut)
def get_cart(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return cart_view(db, user)


@router.post("/items", response_model=CartOut, status_code=status.HTTP_201_CREATED)
def add_item(body: CartItemIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    store_id = _require_store(user)
    if db.get(Product, body.product_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    line = db.execute(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.store_id == store_id, CartItem.product_id == body.product_id
        )
    ).scalar_one_or_none()
    wanted = body.quantity + (line.quantity if line else 0)
    available = _available(db, store_id, body.product_id)
    if wanted > available:
        raise HTTPException(
            status.HTTP_409_CONFLICT, {"message": f"Only {available} available at this store", "available": available}
        )
    if line:
        line.quantity = wanted
    else:
        db.add(CartItem(user_id=user.id, store_id=store_id, product_id=body.product_id, quantity=wanted))
    db.commit()
    return cart_view(db, user)


@router.put("/items/{product_id}", response_model=CartOut)
def set_quantity(
    product_id: int, body: CartQuantityIn, user: User = Depends(current_user), db: Session = Depends(get_db)
):
    store_id = _require_store(user)
    line = db.execute(
        select(CartItem).where(
            CartItem.user_id == user.id, CartItem.store_id == store_id, CartItem.product_id == product_id
        )
    ).scalar_one_or_none()
    if line is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item is not in your cart")
    if body.quantity == 0:
        db.delete(line)
    else:
        available = _available(db, store_id, product_id)
        if body.quantity > available:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                {"message": f"Only {available} available at this store", "available": available},
            )
        line.quantity = body.quantity
    db.commit()
    return cart_view(db, user)


@router.delete("/items/{product_id}", response_model=CartOut)
def remove_item(product_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.selected_store_id is not None:
        db.execute(
            delete(CartItem).where(
                CartItem.user_id == user.id, CartItem.store_id == user.selected_store_id, CartItem.product_id == product_id
            )
        )
        db.commit()
    return cart_view(db, user)


@router.delete("", response_model=CartOut)
def clear_cart(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.selected_store_id is not None:
        db.execute(delete(CartItem).where(CartItem.user_id == user.id, CartItem.store_id == user.selected_store_id))
        db.commit()
    return cart_view(db, user)
