import io
import zipfile
from typing import Optional

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.exporter import document_to_latex, export_bundle


app = FastAPI()

class ExportPayload(BaseModel):
    data: dict
    # Editor state living outside the doc tree: cls / title / columns / fontSizePx.
    meta: Optional[dict] = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/export-latex", response_class=PlainTextResponse)
def export_latex(payload: ExportPayload):
    return document_to_latex(payload.data, payload.meta)


@app.post("/export-zip")
def export_zip(payload: ExportPayload):
    """The .tex plus every figure image decoded to a real file, zipped, so the
    archive compiles as-is with pdflatex."""
    tex, assets = export_bundle(payload.data, payload.meta)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("document.tex", tex)
        for name, data in assets:
            z.writestr(name, data)
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="document.zip"'},
    )
