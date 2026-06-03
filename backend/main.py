from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.exporter import document_to_latex


app = FastAPI()

class Document(BaseModel):
    data: dict

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/export-latex", response_class=PlainTextResponse)
def export_latex(doc: Document):
    latex = document_to_latex(doc.data)
    return latex