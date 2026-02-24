from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
import csv
import os
from datetime import datetime

app = FastAPI()
templates = Jinja2Templates(directory="templates")

LOG_FILE = "dms_log.csv"

if not os.path.exists(LOG_FILE):
    with open(LOG_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Timestamp", "EAR", "Drowsy"])

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/log")
async def log_data(request: Request):
    data = await request.json()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(LOG_FILE, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([timestamp, data["ear"], data["drowsy"]])

    return {"status": "logged"}

@app.get("/download-report")
def download_report():
    return FileResponse(LOG_FILE, filename="DMS_Report.csv")