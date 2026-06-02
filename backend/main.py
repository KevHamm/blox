from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from exporter import document_to_latex

app = FastAPI()

class Document(BaseModel):
    data: dict

@app.post("/export-latex", response_class=PlainTextResponse)
def export_latex(doc: Document):
    latex = document_to_latex(doc.data)
    return latex