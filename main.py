from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routes import router as api_router

app = FastAPI(title="Watch Together")

# Serve static files (CSS, JS)
app.mount("/static", StaticFiles(directory="templates/static"), name="static")

# Include all the endpoints from routes.py
app.include_router(api_router)
