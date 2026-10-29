from database import init_db, SessionLocal
from models import Hospital, PoliceStation, Incident, IncidentType, IncidentStatus, Dispatch, Institution

def seed():
    init_db()
    db = SessionLocal()
    try:
        # Clear existing data in correct FK order
        db.query(Dispatch).delete()
        db.query(Hospital).delete()
        db.query(PoliceStation).delete()
        db.query(Institution).delete()
        db.query(Incident).delete()
        db.commit()

        # --- Riyadh Institutions ---
        h1 = Hospital(
            name="Al-Shifa Emergency Hospital (مستشفى الشفاء للطوارئ)",
            location_lat=24.7136,
            location_lon=46.6753,
            contact_info="+966-11-200-1111",
            icu_beds_available=8,
            blood_units_available=25
        )
        h2 = Hospital(
            name="Central Trauma Center (مركز الحوادث المركزي)",
            location_lat=24.7250,
            location_lon=46.6900,
            contact_info="+966-11-200-2222",
            icu_beds_available=2,
            blood_units_available=10
        )
        p1 = PoliceStation(
            name="Highway Patrol Station 4 (مركز دوريات طريق 60)",
            location_lat=24.7180,
            location_lon=46.6800,
            contact_info="+966-11-999-0001",
            patrols_available=5,
            security_level="High"
        )

        # --- Hebron (الخليل) Institutions ---
        # Coordinates around Industrial Zone (المنطقة الصناعية بالخليل: ~ 31.5273, 35.0946)
        h_hebron_1 = Hospital(
            name="Al-Ahli Hospital - Hebron (المستشفى الأهلي - الخليل)",
            location_lat=31.5435,
            location_lon=35.0872,
            contact_info="+970-2-222-7777",
            icu_beds_available=15, # Has 15 ICU beds, enough for 12 casualties!
            blood_units_available=75
        )
        h_hebron_2 = Hospital(
            name="Princess Alia Governmental Hospital (مستشفى الأميرة عالية الحكومي)",
            location_lat=31.5310,
            location_lon=35.1010,
            contact_info="+970-2-222-8888",
            icu_beds_available=6,
            blood_units_available=35
        )
        h_hebron_3 = Hospital(
            name="Al-Mizan Specialized Hospital (مستشفى الميزان التخصصي)",
            location_lat=31.5380,
            location_lon=35.0900,
            contact_info="+970-2-225-5555",
            icu_beds_available=8,
            blood_units_available=40
        )
        p_hebron_1 = PoliceStation(
            name="Hebron District Police Directorate (مديرية شرطة محافظة الخليل)",
            location_lat=31.5285,
            location_lon=35.0920,
            contact_info="+970-2-229-9999",
            patrols_available=8,
            security_level="Maximum"
        )
        p_hebron_2 = PoliceStation(
            name="Industrial Zone Police & Security Patrols (مركز دوريات المنطقة الصناعية)",
            location_lat=31.5260,
            location_lon=35.0960,
            contact_info="+970-2-229-8888",
            patrols_available=4,
            security_level="High"
        )

        # Sample Incidents
        inc1 = Incident(
            id=1,
            type=IncidentType.CRASH,
            severity_level=5,
            status=IncidentStatus.OPEN,
            location_lat=24.7150,
            location_lon=46.6780
        )
        inc2 = Incident(
            id=2,
            type=IncidentType.FIRE,
            severity_level=5,
            status=IncidentStatus.OPEN,
            location_lat=31.5273,
            location_lon=35.0946
        )

        db.add_all([h1, h2, p1, h_hebron_1, h_hebron_2, h_hebron_3, p_hebron_1, p_hebron_2, inc1, inc2])
        db.commit()
        print("Database re-seeded with Hebron and Riyadh institutions & incidents 1 & 2.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
