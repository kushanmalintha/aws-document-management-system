from pydantic import BaseModel, ConfigDict


class ValidationIssue(BaseModel):
    location: str
    message: str
    type: str


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    detail: str
    request_id: str
    errors: list[ValidationIssue] | None = None
