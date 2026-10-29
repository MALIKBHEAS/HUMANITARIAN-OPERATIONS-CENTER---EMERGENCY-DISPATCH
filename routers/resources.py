from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import Hospital, PoliceStation
from schemas import HospitalResponse, PoliceStationResponse, ResourcesSummaryResponse

router = APIRouter()

@router.get("/hospitals", response_model=List[HospitalResponse])
def get_hospitals(db: Session = Depends(get_db)):
    """Retrieves all registered hospitals and live ICU bed availability."""
    hospitals = db.query(Hospital).all()
    return hospitals

@router.get("/police", response_model=List[PoliceStationResponse])
def get_police_stations(db: Session = Depends(get_db)):
    """Retrieves all registered police stations and active patrol readiness."""
    police_stations = db.query(PoliceStation).all()
    return police_stations

@router.get("/all", response_model=ResourcesSummaryResponse)
def get_all_resources(db: Session = Depends(get_db)):
    """Consolidated summary of all available emergency institutions."""
    hospitals = db.query(Hospital).all()
    police = db.query(PoliceStation).all()
    return {
        "hospitals": hospitals,
        "police_stations": police
    }
