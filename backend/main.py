from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

import pandas as pd
import requests
import io

app = FastAPI()

# =====================================
# CORS
# =====================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================
# POSTCODE API
# =====================================

POSTCODE_API = "https://api.postcodes.io/postcodes/"


# =====================================
# DEPOTS
# =====================================

DEPOTS = {

    # =====================================
    # LEICESTER
    # =====================================

    "LE11": {

        "name": "Leicester Depot",

        "lat": 52.7806,

        "lng": -1.2215,

        "routes": {

            "Route 1": [
                "NG1", "NG2", "NG3",
                "NG4", "NG5", "NG12"
            ],

            "Route 2": [
                "NG6", "NG7", "NG8",
                "NG9", "NG10", "NG11"
            ],

            "Route 3": [
                "LE2", "LE3", "LE6",
                "LE9", "LE19", "CV13"
            ],

            "Route 4": [
                "LE1", "LE4", "LE5",
                "LE7", "LE8", "LE13",
                "LE14", "LE15",
                "LE16", "LE18"
            ],

            "Route 5": [
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

            "Route 1": [
                "B1", "B2", "B3",
                "B4", "B5", "B6"
            ],

            "Route 2": [
                "B7", "B8", "B9",
                "B10", "B11", "B12"
            ],

            "Route 3": [
                "B13", "B14", "B15",
                "B16", "B17", "B18"
            ],

            "Route 4": [
                "B19", "B20", "B21",
                "B23", "B24", "B25"
            ],

            "Route 5": [
                "B26", "B27", "B28",
                "B29", "B30", "B31"
            ],

            "Route 6": [
                "B32", "B33", "B34",
                "B35", "B36", "B37"
            ]
        }
    },

    # =====================================
    # LUTON
    # =====================================

    "LTN": {

        "name": "Luton Depot",

        "lat": 51.8787,

        "lng": -0.4200,

        "routes": {

            "Route 1": [

                "MK10", "MK11", "MK12",
                "MK13", "MK18", "MK19",

                "MK1", "MK3", "MK4",
                "MK5", "MK8",

                "LU6", "LU7",

                "HP16", "HP19",
                "HP20", "HP21",
                "HP22", "HP23",

                "HP5", "HP6",
                "HP7"
            ],

            "Route 2": [

                "MK43",

                "MK14", "MK15",
                "MK16", "MK17",

                "MK40", "MK41",
                "MK42", "MK44",
                "MK45",

                "MK46",

                "MK2", "MK6",
                "MK7", "MK9",

                "SG15", "SG16",
                "SG5"
            ],

            "Route 3": [

                "SG11", "SG12",
                "SG13", "SG14",

                "SG1", "SG2",
                "SG3", "SG4",
                "SG6", "SG9",

                "AL10",

                "AL1", "AL2",
                "AL3", "AL4",
                "AL5", "AL6",
                "AL7", "AL8",
                "AL9",

                "LU1", "LU2",
                "LU3", "LU4",
                "LU5",

                "HP1", "HP2",
                "HP3", "HP4"
            ]
        }
    }
}


# =====================================
# COLORS
# =====================================

ROUTE_COLORS = {

    "Route 1": "red",

    "Route 2": "blue",

    "Route 3": "green",

    "Route 4": "orange",

    "Route 5": "purple",

    "Route 6": "brown",

    "Unassigned": "gray",

    "Invalid": "black"
}


# =====================================
# ROUTE DETECTION
# =====================================

def get_route(postcode, depot_routes):

    postcode = postcode.upper().strip()

    district = postcode.split(" ")[0]

    district = ''.join([
        c for c in district
        if c.isalnum()
    ])

    for route_name, prefixes in depot_routes.items():

        sorted_prefixes = sorted(
            prefixes,
            key=len,
            reverse=True
        )

        for prefix in sorted_prefixes:

            if district == prefix:

                return route_name

    return "Unassigned"


# =====================================
# ROOT
# =====================================

@app.get("/")
def root():

    return {
        "status": "online"
    }


# =====================================
# UPLOAD
# =====================================

@app.post("/upload")
async def upload_excel(
    depot: str,
    file: UploadFile = File(...)
):

    depot_data = DEPOTS.get(depot)

    if not depot_data:

        return {
            "error": "Invalid depot"
        }

    content = await file.read()

    excel_file = pd.ExcelFile(
        io.BytesIO(content)
    )

    all_dfs = []

    for sheet in excel_file.sheet_names:

        temp_df = pd.read_excel(
            excel_file,
            sheet_name=sheet
        )

        all_dfs.append(temp_df)

    df = pd.concat(
        all_dfs,
        ignore_index=True
    )

    locations = []

    for _, row in df.iterrows():

        postcode = None

        possible_columns = [

            "Postcode",
            "postcode",
            "POSTCODE",
            "Post Code",
            "POST CODE",
            "Postal Code",
            "Address"
        ]

        for col in possible_columns:

            if col in df.columns:

                value = row.get(col)

                if pd.notna(value):

                    postcode = str(value).upper().strip()

                    break

        if not postcode:

            for col in df.columns:

                value = row.get(col)

                if pd.notna(value):

                    postcode = str(value).upper().strip()

                    break

        if not postcode:
            continue

        if postcode == "NAN":
            continue

        route = get_route(
            postcode,
            depot_data["routes"]
        )

        try:

            clean_postcode = postcode.replace(
                " ",
                ""
            )

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

                        "color": ROUTE_COLORS.get(
                            route,
                            "gray"
                        )
                    })

                else:

                    locations.append({

                        "name": postcode,

                        "postcode": postcode,

                        "lat": None,

                        "lng": None,

                        "route": "Invalid",

                        "color": "black"
                    })

        except Exception as e:

            print(e)

    return locations