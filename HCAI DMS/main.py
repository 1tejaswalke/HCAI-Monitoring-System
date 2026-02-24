from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import csv
import os
from datetime import datetime

app = FastAPI()

CSV_FILE = "driver_log.csv"

# Serve frontend
app.mount("/", StaticFiles(directory=".", html=True), name="static")

# Create CSV if not exists
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, mode="w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "ear", "head_pose", "fatigue_score"])

@app.post("/log")
async def log_data(request: Request):
    data = await request.json()

    with open(CSV_FILE, mode="a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.now().isoformat(),
            data.get("ear"),
            data.get("head_pose"),
            data.get("fatigue_score")
        ])

    return {"status": "logged"}

@app.get("/download")
def download_csv():
    return FileResponse(CSV_FILE, media_type="text/csv", filename="driver_log.csv")