from fastapi import FastAPI, HTTPException, Request  # Add Request here
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
from pathlib import Path
from .utils import (
    load_data,
    get_unique_branches,
    validate_inputs,
    generate_preference_list,
    get_probability_interpretation
)

# Initialize FastAPI app
app = FastAPI(
    title="JOSAA College Preference Generator",
    description="Generate college preferences based on JEE rank and other criteria",
    version="1.0.0"
)

# Setup static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

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

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""
    return {
        "error": True,
        "message": str(exc.detail),
        "status_code": exc.status_code
    }

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""
    return {
        "error": True,
        "message": "An unexpected error occurred",
        "detail": str(exc),
        "status_code": 500
    }

# Run the application
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=4
    )
