from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, null, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Product, Store, StoreStock
from app.schemas import AvailabilityOut, CategoryWithCount, ProductOut, ProductPage, StoreOut

router = APIRouter(prefix="/api", tags=["catalog"])

SortKey = Literal["popularity", "price_asc", "price_desc", "name"]


def product_out(product: Product, on_hand: int | None, reserved: int | None, store_id: int | None) -> ProductOut:
    availability = None
    if store_id is not None:
        available = max((on_hand or 0) - (reserved or 0), 0)
        availability = AvailabilityOut(store_id=store_id, available=available, in_stock=available > 0)
    return ProductOut(
        id=product.id,
        sku=product.sku,
        name=product.name,
        brand=product.brand,
        description=product.description,
        unit=product.unit,
        price_cents=product.price_cents,
        emoji=product.emoji,
        bg_color=product.bg_color,
        category=product.category,
        availability=availability,
    )


@router.get("/categories", response_model=list[CategoryWithCount])
def list_categories(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Category, func.count(Product.id))
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name)
    ).all()
    return [
        CategoryWithCount(id=c.id, name=c.name, slug=c.slug, emoji=c.emoji, color=c.color, product_count=n)
        for c, n in rows
    ]


@router.get("/stores", response_model=list[StoreOut])
def list_stores(db: Session = Depends(get_db)):
    return [StoreOut.model_validate(s) for s in db.execute(select(Store).order_by(Store.id)).scalars()]


@router.get("/stores/{store_id}", response_model=StoreOut)
def get_store(store_id: int, db: Session = Depends(get_db)):
    store = db.get(Store, store_id)
    if store is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Store not found")
    return StoreOut.model_validate(store)


@router.get("/products", response_model=ProductPage)
def list_products(
    q: str | None = Query(default=None, max_length=80),
    category: str | None = Query(default=None, max_length=80),
    min_price_cents: int | None = Query(default=None, ge=0),
    max_price_cents: int | None = Query(default=None, ge=0),
    in_stock: bool = False,
    store_id: int | None = None,
    sort: SortKey = "popularity",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=60),
    db: Session = Depends(get_db),
):
    if in_stock and store_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "in_stock needs a store_id")

    if store_id is not None:
        stmt = (
            select(Product, StoreStock.on_hand, StoreStock.reserved)
            .join(Category, Category.id == Product.category_id)
            .outerjoin(StoreStock, and_(StoreStock.product_id == Product.id, StoreStock.store_id == store_id))
        )
    else:
        stmt = select(Product, null(), null()).join(Category, Category.id == Product.category_id)

    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.name.ilike(term), Product.brand.ilike(term), Category.name.ilike(term)))
    if category:
        stmt = stmt.where(Category.slug == category)
    if min_price_cents is not None:
        stmt = stmt.where(Product.price_cents >= min_price_cents)
    if max_price_cents is not None:
        stmt = stmt.where(Product.price_cents <= max_price_cents)
    if in_stock:
        stmt = stmt.where((StoreStock.on_hand - StoreStock.reserved) > 0)

    total = db.execute(select(func.count()).select_from(stmt.order_by(None).subquery())).scalar_one()

    order_by = {
        "popularity": (Product.popularity.desc(), Product.name),
        "price_asc": (Product.price_cents, Product.name),
        "price_desc": (Product.price_cents.desc(), Product.name),
        "name": (Product.name,),
    }[sort]
    rows = db.execute(stmt.order_by(*order_by).offset((page - 1) * page_size).limit(page_size)).all()
    items = [product_out(p, on_hand, reserved, store_id) for p, on_hand, reserved in rows]
    return ProductPage(items=items, total=total, page=page, page_size=page_size, has_more=page * page_size < total)


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int, store_id: int | None = None, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    on_hand = reserved = None
    if store_id is not None:
        stock = db.execute(
            select(StoreStock).where(StoreStock.store_id == store_id, StoreStock.product_id == product_id)
        ).scalar_one_or_none()
        on_hand = stock.on_hand if stock else 0
        reserved = stock.reserved if stock else 0
    return product_out(product, on_hand, reserved, store_id)
