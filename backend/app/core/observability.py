import logging
import re
import time
from uuid import uuid4

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.errors import ErrorResponse, ValidationIssue


logger = logging.getLogger("app.core.observability")
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def configure_logging(level: str) -> None:
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    if not root_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s %(name)s %(message)s"
            )
        )
        root_logger.addHandler(handler)


def get_request_id(request: Request) -> str:
    request_id = getattr(request.state, "request_id", None)
    return request_id if isinstance(request_id, str) else str(uuid4())


def _json_error(
    request: Request,
    status_code: int,
    detail: str,
    errors: list[ValidationIssue] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        detail=detail,
        request_id=get_request_id(request),
        errors=errors,
    ).model_dump(mode="json", exclude_none=True)
    response = JSONResponse(
        status_code=status_code,
        content=payload,
        headers=headers,
    )
    response.headers["X-Request-ID"] = payload["request_id"]
    return response


def _validation_location(location: tuple[object, ...]) -> str:
    return ".".join(str(part) for part in location)


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return _json_error(
        request=request,
        status_code=exc.status_code,
        detail=detail,
        headers=exc.headers,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    # Exclude input values and validation context: these can contain passwords,
    # tokens, document metadata, or other user-supplied sensitive information.
    issues = []
    for error in exc.errors():
        # Copy only safe descriptive fields; never serialize the original
        # validation dictionary because it can include submitted input/context.
        issues.append(
            ValidationIssue(
                location=_validation_location(tuple(error.get("loc", ()))),
                message=str(error.get("msg", "Invalid value")),
                type=str(error.get("type", "value_error")),
            )
        )
    return _json_error(
        request=request,
        status_code=422,
        detail="Request validation failed",
        errors=issues,
    )


async def database_exception_handler(
    request: Request,
    exc: SQLAlchemyError,
) -> JSONResponse:
    logger.error(
        "database operation failed request_id=%s exception_type=%s",
        get_request_id(request),
        type(exc).__name__,
    )
    return _json_error(
        request=request,
        status_code=503,
        detail="A database operation could not be completed. Please try again.",
    )


async def unexpected_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.error(
        "unexpected application error request_id=%s exception_type=%s",
        get_request_id(request),
        type(exc).__name__,
    )
    return _json_error(
        request=request,
        status_code=500,
        detail="An unexpected server error occurred. Please try again.",
    )


def install_error_handlers(app) -> None:
    app.add_exception_handler(
        StarletteHTTPException,
        http_exception_handler,
    )
    app.add_exception_handler(
        RequestValidationError,
        validation_exception_handler,
    )
    app.add_exception_handler(
        SQLAlchemyError,
        database_exception_handler,
    )
    app.add_exception_handler(
        Exception,
        unexpected_exception_handler,
    )


class RequestLoggingMiddleware:
    """Attach a safe correlation ID and log request metadata without query data."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        incoming_headers = Headers(scope=scope)
        supplied_id = incoming_headers.get("x-request-id", "")
        request_id = (
            supplied_id
            if _REQUEST_ID_PATTERN.fullmatch(supplied_id)
            else str(uuid4())
        )
        scope.setdefault("state", {})["request_id"] = request_id

        method = scope.get("method", "UNKNOWN")
        path = scope.get("path", "/")
        started_at = time.perf_counter()
        status_code = None

        async def send_with_request_id(message):
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception as exc:
            logger.error(
                "request failed method=%s path=%s request_id=%s exception_type=%s",
                method,
                path,
                request_id,
                type(exc).__name__,
            )
            raise
        finally:
            duration_ms = (time.perf_counter() - started_at) * 1000
            if status_code is not None:
                logger.info(
                    "request completed method=%s path=%s status_code=%s "
                    "duration_ms=%.2f request_id=%s",
                    method,
                    path,
                    status_code,
                    duration_ms,
                    request_id,
                )
