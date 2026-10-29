import os
import sys
from geoalchemy2.elements import WKTElement
from database import init_db, SessionLocal
from models import Hospital, PoliceStation, Incident, Dispatch, Institution, IncidentType, IncidentStatus

def make_point(lat: float, lon: float) -> WKTElement:
    """Creates a WGS 84 PostGIS Point Element. CRITICAL: WKT is POINT(lon lat)."""
    return WKTElement(f"POINT({lon} {lat})", srid=4326)

def seed():
    print("Initializing PostGIS tables...")
    init_db()
    db = SessionLocal()

    try:
        # Clear existing rows safely in foreign key cascade order
        db.query(Dispatch).delete()
        db.query(Hospital).delete()
        db.query(PoliceStation).delete()
        db.query(Institution).delete()
        db.query(Incident).delete()
        db.commit()

        institutions = [
            # ================================================================
            # 1. TOKYO METROPOLITAN SECTOR, JAPAN (WGS 84)
            # ================================================================
            Hospital(
                name="Tokyo Medical University Hospital (東京医科大学病院)",
                contact_info="+81-3-3342-6111",
                icu_beds_available=24,
                blood_units_available=120,
                location=make_point(lat=35.6938, lon=139.6917)
            ),
            Hospital(
                name="Juntendo University Hospital (順天堂医院)",
                contact_info="+81-3-3813-3111",
                icu_beds_available=18,
                blood_units_available=95,
                location=make_point(lat=35.7032, lon=139.7618)
            ),
            PoliceStation(
                name="Shinjuku Police Station (警視庁 新宿警察署)",
                contact_info="+81-3-3346-0110",
                patrols_available=12,
                security_level="Maximum",
                location=make_point(lat=35.6935, lon=139.6942)
            ),
            PoliceStation(
                name="Tokyo Central Police Headquarters (警視庁本部)",
                contact_info="+81-3-3581-4321",
                patrols_available=20,
                security_level="Maximum",
                location=make_point(lat=35.6762, lon=139.7528)
            ),

            # ================================================================
            # 2. MADRID SECTOR, SPAIN (WGS 84)
            # ================================================================
            Hospital(
                name="Hospital Universitario La Paz (Madrid)",
                contact_info="+34-91-727-7000",
                icu_beds_available=30,
                blood_units_available=150,
                location=make_point(lat=40.4816, lon=-3.6872)
            ),
            Hospital(
                name="Hospital General Universitario Gregorio Marañón",
                contact_info="+34-91-586-8000",
                icu_beds_available=22,
                blood_units_available=80,
                location=make_point(lat=40.4194, lon=-3.6705)
            ),
            PoliceStation(
                name="Comisaría de Policía Nacional Centro (Madrid)",
                contact_info="+34-91-322-3400",
                patrols_available=10,
                security_level="High",
                location=make_point(lat=40.4200, lon=-3.7050)
            ),
            PoliceStation(
                name="Jefatura Superior de Policía de Madrid",
                contact_info="+34-91-322-3000",
                patrols_available=15,
                security_level="Maximum",
                location=make_point(lat=40.4435, lon=-3.6830)
            ),

            # ================================================================
            # 3. HEBRON SECTOR, PALESTINE (WGS 84)
            # ================================================================
            Hospital(
                name="Al-Ahli Hospital - Hebron (المستشفى الأهلي)",
                contact_info="+970-2-222-7777",
                icu_beds_available=16,
                blood_units_available=70,
                location=make_point(lat=31.5435, lon=35.0872)
            ),
            Hospital(
                name="Princess Alia Governmental Hospital (مستشفى الأميرة عالية)",
                contact_info="+970-2-222-8888",
                icu_beds_available=8,
                blood_units_available=40,
                location=make_point(lat=31.5310, lon=35.1010)
            ),
            PoliceStation(
                name="Hebron District Police Directorate (مديرية شرطة محافظة الخليل)",
                contact_info="+970-2-229-9999",
                patrols_available=8,
                security_level="Maximum",
                location=make_point(lat=31.5285, lon=35.0920)
            ),
            PoliceStation(
                name="Industrial Zone Emergency Patrol Post (دوريات المنطقة الصناعية)",
                contact_info="+970-2-229-8888",
                patrols_available=5,
                security_level="High",
                location=make_point(lat=31.5260, lon=35.0960)
            ),

            # ================================================================
            # 4. NEW YORK CITY SECTOR, USA (WGS 84)
            # ================================================================
            Hospital(
                name="Mount Sinai Hospital Manhattan",
                contact_info="+1-212-241-6500",
                icu_beds_available=25,
                blood_units_available=110,
                location=make_point(lat=40.7903, lon=-73.9530)
            ),
            PoliceStation(
                name="NYPD 23rd Precinct Manhattan",
                contact_info="+1-212-860-6511",
                patrols_available=14,
                security_level="Maximum",
                location=make_point(lat=40.7905, lon=-73.9468)
            )
        ]

        db.add_all(institutions)
        db.commit()

        print(f"Successfully seeded {len(institutions)} global facilities across Tokyo, Madrid, Hebron, and New York.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
