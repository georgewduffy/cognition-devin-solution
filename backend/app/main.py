import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.devin.router import router as devin_router
from app.example.router import router as example_router
from app.github.router import router as github_router

app = FastAPI(title="Cognition Devin Solution API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(httpx.HTTPStatusError)
async def upstream_http_error(_: Request, exc: httpx.HTTPStatusError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.response.status_code,
        content={"detail": exc.response.text},
    )


app.include_router(example_router)
app.include_router(devin_router)
app.include_router(github_router)
