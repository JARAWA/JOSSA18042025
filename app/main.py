from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from pathlib import Path
import os

# Get the directory containing the current file (app directory)
CURRENT_DIR = Path(__file__).parent

# Initialize FastAPI app
app = FastAPI(
    title="JOSAA College Preference Generator",
    description="Generate college preferences based on JEE rank and other criteria",
    version="1.0.0"
)

# Setup static files and templates
app.mount("/static", StaticFiles(directory=str(CURRENT_DIR / "static")), name="static")
templates = Jinja2Templates(directory=str(CURRENT_DIR / "templates"))

# Add debugging
@app.on_event("startup")
async def startup_event():
    print("=== Debug Information ===")
    print(f"Current directory: {CURRENT_DIR}")
    print(f"Templates directory: {CURRENT_DIR / 'templates'}")
    print(f"Templates directory exists: {(CURRENT_DIR / 'templates').exists()}")
    if (CURRENT_DIR / 'templates').exists():
        print(f"Templates directory contents: {list((CURRENT_DIR / 'templates').iterdir())}")
    print("=== End Debug Information ===")

# Modified root endpoint with error handling
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main application page"""
    try:
        template_path = CURRENT_DIR / "templates" / "index.html"
        print(f"Attempting to load template from: {template_path}")
        print(f"Template exists: {template_path.exists()}")
        
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        print(f"Error loading template: {str(e)}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Directory contents: {os.listdir(CURRENT_DIR)}")
        raise HTTPException(status_code=500, detail=f"Template error: {str(e)}")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class PredictionRequest(BaseModel):
    jee_rank: int
    category: str
    college_type: str
    preferred_branch: str
    round_no: str
    min_probability: float = 0.0

class PredictionResponse(BaseModel):
    preferences: List[dict]
    plot_data: Optional[dict] = None

# Routes
@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/health")
async def health_check():
    """Check API health and data availability"""
    try:
        from .utils import load_data
        df = load_data()
        return {
            "status": "healthy",
            "data_loaded": df is not None,
            "timestamp": pd.Timestamp.now().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": pd.Timestamp.now().isoformat()
        }

@app.get("/api/branches")
async def get_branches():
    """Get list of available branches"""
    try:
        from .utils import get_unique_branches
        branches = get_unique_branches()
        return {"branches": branches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching branches: {str(e)}")

@app.get("/api/categories")
async def get_categories():
    """Get list of available categories"""
    categories = [
        "All", "OPEN", "OBC-NCL", "OBC-NCL (PwD)", 
        "EWS", "EWS (PwD)", "SC", "SC (PwD)", 
        "ST", "ST (PwD)"
    ]
    return {"categories": categories}

@app.get("/api/college-types")
async def get_college_types():
    """Get list of available college types"""
    college_types = ["ALL", "IIT", "NIT", "IIIT", "GFTI"]
    return {"college_types": college_types}

@app.get("/api/rounds")
async def get_rounds():
    """Get list of available rounds"""
    rounds = ["1", "2", "3", "4", "5", "6"]
    return {"rounds": rounds}

@app.post("/api/predict", response_model=PredictionResponse)
async def predict_preferences(request: PredictionRequest):
    """Generate college preferences based on input criteria"""
    try:
        from .utils import validate_inputs, generate_preference_list
        
        # Validate inputs
        is_valid, error_message = validate_inputs(
            request.jee_rank,
            request.category,
            request.college_type,
            request.preferred_branch,
            request.round_no
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)

        # Generate preferences
        result_df, plot_data = generate_preference_list(
            jee_rank=request.jee_rank,
            category=request.category,
            college_type=request.college_type,
            preferred_branch=request.preferred_branch,
            round_no=request.round_no,
            min_probability=request.min_probability
        )

        if result_df.empty:
            return PredictionResponse(
                preferences=[],
                plot_data={"x": [], "type": "histogram", "nbinsx": 20}
            )

        # Convert results to response format
        preferences = result_df.to_dict('records')
        
        return PredictionResponse(
            preferences=preferences,
            plot_data=plot_data
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
