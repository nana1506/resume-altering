from fastapi import FastAPI
from api._shared.auth import setup_cors

app = FastAPI(title="CV Tailor Health API", version="2.3.0")
setup_cors(app)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "CV Tailor API", "version": "2.3.0"}
