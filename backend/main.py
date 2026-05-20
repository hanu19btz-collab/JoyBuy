from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import pandas as pd
import requests
import io
import math

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API postcode UK
POSTCODE_API = "https://api.postcodes.io/postcodes/"

# ORS Optimization API (VROOM)
ORS_OPTIMIZATION_API = "https://api.openrouteservice.org/optimization"

ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjU3Y2IzMWI1Y2M0YTQ5YzJiMjFhNmVlNmI0YjBiNzYxIiwiaCI6Im11cm11cjY0In0="


# =========================
# DEPOTS
# =========================

DEPOTS = {

    # =====================================
    # LEICESTER / LOUGHBOROUGH
    # =====================================

    "LE11": {

        "name": "Leicester / Loughborough Depot",

        "lat": 52.785239,

        "lng": -1.20804,

        "routes": {

            "Ruta 1": [
                "NG1", "NG2", "NG3",
                "NG4", "NG5", "NG12"
            ],

            "Ruta 2": [
                "NG6", "NG7", "NG8",
                "NG9", "NG10", "NG11"
            ],

            "Ruta 3": [
                "LE2", "LE3", "LE6",
                "LE9", "LE19", "CV13"
            ],

            "Ruta 4": [
                "LE1", "LE4", "LE5",
                "LE7", "LE8", "LE13",
                "LE14", "LE15",
                "LE16", "LE18"
            ],

            "Ruta 5": [
                "LE11", "LE12",
                "LE65", "LE67",
                "DE12", "DE73",
                "DE74", "DE24",
                "DE23", "DE22",
                "DE21", "DE1",
                "DE3"
            ]
        }
    },

    # =====================================
    # BIRMINGHAM
    # =====================================

    "B66": {

        "name": "Birmingham Depot",

        "lat": 52.4906,

        "lng": -1.9705,

        "routes": {

            "Ruta 1": [
                "B23", "B24", "B35",
                "B42", "B43", "B44",
                "B46", "B72", "B73",
                "B74", "B75", "B76",
                "B77", "B78", "B79"
            ],

            "Ruta 2": [
                "B25", "B26", "B27",
                "B28", "B33", "B34",
                "B36", "B37", "B40",
                "B47", "B90", "B91",
                "B92", "B93", "B94",
                "B95"
            ],

            "Ruta 3": [
                "B13", "B14", "B29",
                "B30", "B38", "B45",
                "B48", "B49", "B60",
                "B61", "B80", "B96",
                "B97", "B98", "B99"
            ],

            "Ruta 4": [
                "B31", "B17", "B20",
                "B21", "B32", "B62",
                "B63", "B64", "B65",
                "B66", "B67", "B68",
                "B69", "B70", "B71"
            ],

            "Ruta 5": [
                "B15", "B16",
                "B18", "B19",
                "B3", "B4", "B6"
            ],

            "Ruta 6": [
                "B1", "B2", "B5",
                "B7", "B8", "B9",
                "B10", "B11", "B12"
            ]
        }
    },
    # =====================================
# LUTON
# =====================================

"LTN": {

    "name": "Luton Depot",

    # coordonate aproximative depozit
    "lat": 51.8787,

    "lng": -0.4200,

    "routes": {

        "Ruta 1": [

            "LU6", "LU7",

            "MK1", "MK11", "MK12",
            "MK13", "MK18", "MK19",
            "MK3", "MK4", "MK5",
            "MK8",

            "HP5", "HP6",
            "HP7",

            "HP16", "HP19",
            "HP20", "HP21",
            "HP22", "HP23"
        ],

        "Ruta 2": [

            "MK43", "MK16",
            "MK10", "MK14",
            "MK15", "MK17",
            "MK7", "MK2",
            "MK6", "MK9",
            "MK46",

            "MK40", "MK41",
            "MK42", "MK44",
            "MK45",

            "SG5", "SG15",
            "SG16"
        ],

        "Ruta 3": [

            "SG1", "SG2",
            "SG3", "SG4",
            "SG6",

            "SG9", "SG11",
            "SG12", "SG13",
            "SG14",

            "AL1", "AL2",
            "AL3", "AL4",
            "AL5", "AL6",
            "AL7", "AL8",
            "AL9", "AL10",

            "LU1", "LU2",
            "LU3", "LU4",
            "LU5",

            "HP1", "HP2",
            "HP3", "HP4"
        ]
    }
}
}


# =========================
# COLORS
# =========================

ROUTE_COLORS = {

    "Ruta 1": "red",

    "Ruta 2": "blue",

    "Ruta 3": "green",

    "Ruta 4": "orange",

    "Ruta 5": "purple",

    "Ruta 6": "brown",

    "Unassigned": "gray",

    "Invalid": "black"
}


# =========================
# DETECT ROUTE
# =========================

def get_route(postcode, depot="LE11"):

    postcode = postcode.upper().strip()

    district = postcode.split(" ")[0]

    routes = DEPOTS[depot]["routes"]

    for route_name, prefixes in routes.items():

        for prefix in prefixes:

            if district == prefix:
                return route_name

    return "Unassigned"


# =========================
# NEAREST NEIGHBOR TSP
# (fallback when ORS fails)
# =========================

def nearest_neighbor_tsp(depot_lat, depot_lng, stops):
    """
    Greedy Nearest Neighbor algorithm.
    Returns stops reordered for shortest path,
    starting and ending at depot.
    """

    if len(stops) <= 1:
        return stops

    def haversine(lat1, lng1, lat2, lng2):
        R = 6371  # km
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) *
             math.cos(math.radians(lat2)) *
             math.sin(dlng / 2) ** 2)
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    unvisited = list(stops)
    ordered = []

    current_lat = depot_lat
    current_lng = depot_lng

    while unvisited:

        nearest = min(
            unvisited,
            key=lambda s: haversine(
                current_lat, current_lng,
                s["lat"], s["lng"]
            )
        )

        ordered.append(nearest)
        unvisited.remove(nearest)

        current_lat = nearest["lat"]
        current_lng = nearest["lng"]

    return ordered


# =========================
# UPLOAD
# =========================

@app.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    depot: str = "LE11"
):

    # Read Excel
    content = await file.read()

    df = pd.read_excel(
        io.BytesIO(content)
    )

    print(df.columns)
    print(df.head())

    locations = []

    for _, row in df.iterrows():

        postcode = str(

            row.get("Postcode") or
            row.get("postcode") or
            row.get("POSTCODE") or
            row.get("Post Code") or
            row.get("Postal Code") or
            row[df.columns[0]]

        ).upper().strip()

        if postcode == "NAN":
            continue

        # Detect route
        route = get_route(postcode, depot)

        try:

            clean_postcode = postcode.replace(" ", "")

            response = requests.get(
                f"{POSTCODE_API}{clean_postcode}"
            )

            if response.status_code == 200:

                data = response.json()

                if data["status"] == 200:

                    result = data["result"]

                    locations.append({

                        "name": postcode,

                        "postcode": postcode,

                        "lat": result["latitude"],

                        "lng": result["longitude"],

                        "route": route,

                        "color": ROUTE_COLORS.get(route, "gray")
                    })

                else:

                    print(f"Invalid postcode: {postcode}")

                    locations.append({

                        "name": postcode,

                        "postcode": postcode,

                        "lat": None,

                        "lng": None,

                        "route": "Invalid",

                        "color": "black"
                    })

            else:

                print(f"API error for: {postcode}")

        except Exception as e:

            print(f"Error for {postcode}: {e}")

    return locations


# =========================
# OPTIMIZE ROUTE (TSP)
# =========================

@app.post("/optimize")
async def optimize_route(payload: dict):
    """
    Accepts:
    {
        "depot": "LE11",
        "route": "Ruta 1",
        "stops": [{"postcode": ..., "lat": ..., "lng": ..., ...}]
    }

    Returns stops in optimized order using:
    1. ORS VROOM optimization API (real road TSP)
    2. Fallback: Nearest Neighbor greedy algorithm

    Response:
    {
        "method": "ors" | "nearest_neighbor",
        "stops": [...ordered stops...]
    }
    """

    depot_key = payload.get("depot", "LE11")
    stops = payload.get("stops", [])

    depot_info = DEPOTS.get(depot_key, DEPOTS["LE11"])
    depot_lat = depot_info["lat"]
    depot_lng = depot_info["lng"]

    valid_stops = [s for s in stops if s.get("lat") and s.get("lng")]

    if len(valid_stops) <= 1:
        return {
            "method": "trivial",
            "stops": valid_stops
        }

    # ----------------------------------------
    # Try ORS VROOM optimization (real roads)
    # ----------------------------------------
    try:

        # Build jobs (each delivery stop)
        jobs = []

        for i, stop in enumerate(valid_stops):

            jobs.append({
                "id": i,
                "location": [stop["lng"], stop["lat"]]
            })

        # Single vehicle starting and ending at depot
        vehicles = [
            {
                "id": 0,
                "start": [depot_lng, depot_lat],
                "end": [depot_lng, depot_lat],
                "profile": "driving-car"
            }
        ]

        ors_payload = {
            "jobs": jobs,
            "vehicles": vehicles
        }

        ors_response = requests.post(
            ORS_OPTIMIZATION_API,
            headers={
                "Authorization": ORS_API_KEY,
                "Content-Type": "application/json"
            },
            json=ors_payload,
            timeout=15
        )

        if ors_response.status_code == 200:

            ors_data = ors_response.json()

            # Extract ordered job IDs from VROOM response
            steps = ors_data["routes"][0]["steps"]

            ordered_job_ids = [
                step["job"]
                for step in steps
                if step["type"] == "job"
            ]

            ordered_stops = [
                valid_stops[job_id]
                for job_id in ordered_job_ids
            ]

            print(f"ORS optimized {len(ordered_stops)} stops for route")

            return {
                "method": "ors",
                "stops": ordered_stops
            }

        else:
            print(f"ORS optimization failed: {ors_response.status_code} - {ors_response.text}")

    except Exception as e:
        print(f"ORS optimization error: {e}")

    # ----------------------------------------
    # Fallback: Nearest Neighbor TSP
    # ----------------------------------------

    print("Falling back to Nearest Neighbor TSP")

    ordered_stops = nearest_neighbor_tsp(
        depot_lat, depot_lng, valid_stops
    )

    return {
        "method": "nearest_neighbor",
        "stops": ordered_stops
    }
@app.get("/")
def root():

    return {
        "status": "online"
    }