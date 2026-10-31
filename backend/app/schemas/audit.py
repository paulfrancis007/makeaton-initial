import datetime
import uuid
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict


class AuditLogPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    actor_user_id: Optional[uuid.UUID] = None
    action: str
    entity_name: str
    entity_id: Optional[uuid.UUID] = None
    ip_address: Optional[str] = None
    details: Dict[str, Any]
    created_at: datetime.datetime
