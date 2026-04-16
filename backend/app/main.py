from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.example.router import router as example_router

app = FastAPI(title="Cognition Devin Solution API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(example_router)
