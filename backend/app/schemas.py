import re
from datetime import datetime
from typing import Literal

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


# Plain pattern check: email-validator rejects reserved TLDs such as .test, which we use for demo accounts.
Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterIn(BaseModel):
    email: Email
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)


class LoginIn(BaseModel):
    email: Email
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    selected_store_id: int | None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SelectStoreIn(BaseModel):
    store_id: int


class StoreOut(ORM):
    id: int
    name: str
    address: str
    city: str
    pincode: str
    hours: str
    delivery_eta_minutes: int


class CategoryOut(ORM):
    id: int
    name: str
    slug: str
    emoji: str
    color: str


class CategoryWithCount(CategoryOut):
    product_count: int


class AvailabilityOut(BaseModel):
    store_id: int
    available: int
    in_stock: bool


class ProductOut(ORM):
    id: int
    sku: str
    name: str
    brand: str
    description: str
    unit: str
    price_cents: int
    emoji: str
    bg_color: str
    category: CategoryOut
    availability: AvailabilityOut | None = None


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
    has_more: bool


class CartItemIn(BaseModel):
    product_id: int
    quantity: int = Field(default=1, ge=1, le=99)


class CartQuantityIn(BaseModel):
    quantity: int = Field(ge=0, le=99)


class CartLineOut(BaseModel):
    product: ProductOut
    quantity: int
    line_total_cents: int


class CartOut(BaseModel):
    store: StoreOut | None
    items: list[CartLineOut]
    item_count: int
    subtotal_cents: int
    delivery_fee_cents: int
    total_cents: int
    free_delivery_threshold_cents: int
    delivery_fee_if_under_threshold_cents: int


class CheckoutIn(BaseModel):
    delivery_mode: Literal["delivery", "pickup"] = "delivery"
    address_line: str = Field(default="", max_length=255)
    city: str = Field(default="", max_length=80)
    pincode: str = Field(default="", max_length=10)

    @model_validator(mode="after")
    def validate_address(self):
        if self.delivery_mode == "delivery":
            if len(self.address_line.strip()) < 5:
                raise ValueError("Enter a full delivery address")
            if not self.city.strip():
                raise ValueError("City is required")
            if not re.fullmatch(r"\d{6}", self.pincode.strip()):
                raise ValueError("Pincode must be 6 digits")
        return self


class OrderItemOut(ORM):
    product_id: int
    product_name: str
    unit: str
    emoji: str
    unit_price_cents: int
    quantity: int
    line_total_cents: int


class OrderEventOut(ORM):
    status: str
    title: str
    detail: str
    created_at: datetime


class OrderOut(BaseModel):
    id: int
    order_number: str
    status: str
    delivery_mode: str
    store_name: str
    store_city: str
    address_line: str
    city: str
    pincode: str
    subtotal_cents: int
    delivery_fee_cents: int
    total_cents: int
    payment_status: str
    refund_cents: int
    reservation_expires_at: datetime | None
    cancel_reason: str | None
    cancellable: bool
    is_active: bool
    status_changed_at: datetime
    created_at: datetime
    item_count: int
    items: list[OrderItemOut]
    events: list[OrderEventOut]


class CancelIn(BaseModel):
    reason: str = Field(default="", max_length=255)


class DeviceIn(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    platform: Literal["ios", "android", "web", "unknown"] = "unknown"


class NotificationOut(ORM):
    id: int
    order_id: int | None
    title: str
    body: str
    read: bool
    push_status: str
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    unread_count: int


class ErrorOut(BaseModel):
    detail: str | dict
