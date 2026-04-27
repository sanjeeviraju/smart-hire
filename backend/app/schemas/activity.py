from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActivityResponse(BaseModel):
    id: int
    type: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
