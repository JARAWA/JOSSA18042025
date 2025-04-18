import pandas as pd
import numpy as np
import plotly.express as px
import math
from pathlib import Path
from datetime import datetime
from typing import Tuple, List, Dict, Optional, Union
import requests
from io import StringIO

def load_data() -> Optional[pd.DataFrame]:
    """
    Load and preprocess the JOSAA cutoff data
    
    Returns:
        Optional[pd.DataFrame]: Preprocessed DataFrame or None if loading fails
    """
    try:
        # GitHub raw content URL for the CSV file
        url = "https://raw.githubusercontent.com/JARAWA/JOSSA18042025/refs/heads/main/josaa2024_cutoff.csv"
        
        # Fetch data from GitHub
        response = requests.get(url)
        response.raise_for_status()
        
        # Read CSV from content
        df = pd.read_csv(StringIO(response.text))
        
        # Preprocess the data
        df["Opening Rank"] = pd.to_numeric(df["Opening Rank"], errors="coerce").fillna(9999999)
        df["Closing Rank"] = pd.to_numeric(df["Closing Rank"], errors="coerce").fillna(9999999)
        df["Round"] = df["Round"].astype(str)
        
        # Convert categories and branches to lowercase for case-insensitive comparison
        df["Category"] = df["Category"].str.lower()
        df["Academic Program Name"] = df["Academic Program Name"].str.lower()
        df["College Type"] = df["College Type"].str.upper()
        
        return df
    except Exception as e:
        print(f"Error loading data: {str(e)}")
        return None

def get_unique_branches() -> List[str]:
    """
    Get list of unique branches from the dataset
    
    Returns:
        List[str]: List of unique branch names
    """
    try:
        df = load_data()
        if df is not None:
            branches = sorted(df["Academic Program Name"].dropna().unique().tolist())
            return ["All"] + [b.title() for b in branches]  # Convert to title case
        return ["All"]
    except Exception as e:
        print(f"Error getting branches: {str(e)}")
        return ["All"]

def validate_inputs(
    jee_rank: int,
    category: str,
    college_type: str,
    preferred_branch: str,
    round_no: str
) -> Tuple[bool, str]:
    """
    Validate user inputs
    
    Args:
        jee_rank (int): JEE rank
        category (str): Category
        college_type (str): College type
        preferred_branch (str): Preferred branch
        round_no (str): Round number
    
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if not jee_rank or jee_rank <= 0:
        rank_type = "JEE Advanced" if college_type.upper() == "IIT" else "JEE Main"
        return False, f"Please enter a valid {rank_type} rank (greater than 0)"
    if not category:
        return False, "Please select a category"
    if not college_type:
        return False, "Please select a college type"
    if not preferred_branch:
        return False, "Please select a branch"
    if not round_no:
        return False, "Please select a round"
    return True, ""

def hybrid_probability_calculation(rank: int, opening_rank: float, closing_rank: float) -> float:
    """
    Calculate admission probability using hybrid approach
    
    Args:
        rank (int): Student's rank
        opening_rank (float): Opening rank
        closing_rank (float): Closing rank
    
    Returns:
        float: Calculated probability
    """
    try:
        # Logistic function calculation
        M = (opening_rank + closing_rank) / 2
        S = max((closing_rank - opening_rank) / 10, 1)
        logistic_prob = 1 / (1 + math.exp((rank - M) / S)) * 100

        # Piece-wise calculation
        if rank < opening_rank:
            improvement = (opening_rank - rank) / opening_rank
            if improvement >= 0.5:
                piece_wise_prob = 99.0
            else:
                piece_wise_prob = 96 + (improvement * 6)
        elif rank == opening_rank:
            piece_wise_prob = 95.0
        elif rank < closing_rank:
            range_width = closing_rank - opening_rank
            position = (rank - opening_rank) / range_width
            if position <= 0.2:
                piece_wise_prob = 94 - (position * 70)
            elif position <= 0.5:
                piece_wise_prob = 80 - ((position - 0.2) / 0.3 * 20)
            elif position <= 0.8:
                piece_wise_prob = 60 - ((position - 0.5) / 0.3 * 20)
            else:
                piece_wise_prob = 40 - ((position - 0.8) / 0.2 * 20)
        elif rank == closing_rank:
            piece_wise_prob = 15.0
        elif rank <= closing_rank + 10:
            piece_wise_prob = 5.0
        else:
            piece_wise_prob = 0.0

        # Combine probabilities
        if rank < opening_rank:
            improvement = (opening_rank - rank) / opening_rank
            final_prob = max(logistic_prob, 95) if improvement > 0.5 else (logistic_prob * 0.4 + piece_wise_prob * 0.6)
        elif rank <= closing_rank:
            final_prob = (logistic_prob * 0.7 + piece_wise_prob * 0.3)
        else:
            final_prob = 0.0 if rank > closing_rank + 100 else min(logistic_prob, 5)

        return round(max(0, min(100, final_prob)), 2)

    except Exception as e:
        print(f"Error in probability calculation: {str(e)}")
        return 0.0

def get_probability_interpretation(probability: float) -> str:
    """
    Convert probability percentage to text interpretation
    
    Args:
        probability (float): Probability value
    
    Returns:
        str: Interpretation text
    """
    if probability >= 95:
        return "Very High Chance"
    elif probability >= 80:
        return "High Chance"
    elif probability >= 60:
        return "Moderate Chance"
    elif probability >= 40:
        return "Low Chance"
    elif probability > 0:
        return "Very Low Chance"
    else:
        return "No Chance"

def generate_preference_list(
    jee_rank: int,
    category: str,
    college_type: str,
    preferred_branch: str,
    round_no: str,
    min_probability: float = 0
) -> Tuple[pd.DataFrame, Dict]:
    """
    Generate college preference list with admission probabilities
    
    Args:
        jee_rank (int): JEE rank
        category (str): Category
        college_type (str): College type
        preferred_branch (str): Preferred branch
        round_no (str): Round number
        min_probability (float): Minimum probability threshold
    
    Returns:
        Tuple[pd.DataFrame, Dict]: (Results DataFrame, Plot data)
    """
    try:
        df = load_data()
        if df is None:
            return pd.DataFrame(), {"x": [], "type": "histogram", "nbinsx": 20}

        # Apply filters
        if category.lower() != "all":
            df = df[df["Category"] == category.lower()]
        if college_type.upper() != "ALL":
            df = df[df["College Type"] == college_type.upper()]
        if preferred_branch.lower() != "all":
            df = df[df["Academic Program Name"] == preferred_branch.lower()]
        df = df[df["Round"] == str(round_no)]

        if df.empty:
            return pd.DataFrame(), {"x": [], "type": "histogram", "nbinsx": 20}

        # Generate college lists
        top_10 = df[
            (df["Opening Rank"] >= jee_rank - 200) &
            (df["Opening Rank"] <= jee_rank)
        ].head(10)

        next_20 = df[
            (df["Opening Rank"] <= jee_rank) &
            (df["Closing Rank"] >= jee_rank)
        ].head(20)

        last_20 = df[
            (df["Closing Rank"] >= jee_rank) &
            (df["Closing Rank"] <= jee_rank + 200)
        ].head(20)

        # Combine results
        final_list = pd.concat([top_10, next_20, last_20]).drop_duplicates()

        # Calculate probabilities
        final_list['Admission Probability (%)'] = final_list.apply(
            lambda x: hybrid_probability_calculation(jee_rank, x['Opening Rank'], x['Closing Rank']),
            axis=1
        )

        # Add interpretation
        final_list['Admission Chances'] = final_list['Admission Probability (%)'].apply(get_probability_interpretation)

        # Filter by minimum probability
        final_list = final_list[final_list['Admission Probability (%)'] >= min_probability]
        
        # Sort by probability
        final_list = final_list.sort_values('Admission Probability (%)', ascending=False)
        
        # Add preference numbers
        final_list['Preference'] = range(1, len(final_list) + 1)

        # Prepare final result
        result = final_list[[
            'Preference',
            'Institute',
            'College Type',
            'Location',
            'Academic Program Name',
            'Opening Rank',
            'Closing Rank',
            'Admission Probability (%)',
            'Admission Chances'
        ]].rename(columns={
            'Academic Program Name': 'Branch'
        })

        # Prepare plot data
        plot_data = {
            "x": result['Admission Probability (%)'].tolist(),
            "type": "histogram",
            "nbinsx": 20,
            "marker": {
                "color": "#006B6B",
                "line": {
                    "color": "white",
                    "width": 1
                }
            }
        }

        return result, plot_data

    except Exception as e:
        print(f"Error generating preferences: {str(e)}")
        return pd.DataFrame(), {"x": [], "type": "histogram", "nbinsx": 20}
