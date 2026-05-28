from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from data.depots import DEPOTS, ROUTE_COLORS

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

    grouped_locations = {}

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
            continue

        if postcode == "NAN":
            continue

        route = get_route(
            postcode,
            depot_data["routes"]
        )

        # =========================
        # JDW NUMBER
        # =========================

        jdw_number = ""

        possible_jdw_columns = [

            "JDW",
            "JDW Number",
            "JDW_Number",
            "Tracking Number",
            "Tracking",
            "jdw"
        ]

        for col in possible_jdw_columns:

            if col in df.columns:

                value = row.get(col)

                if pd.notna(value):

                    jdw_number = str(value).strip()

                    break

        # =========================
        # POSTCODE LOOKUP
        # =========================

        try:

            clean_postcode = postcode.replace(
                " ",
                ""
            )

            response = requests.get(
                f"{POSTCODE_API}{clean_postcode}"
            )

            if response.status_code != 200:
                continue

            data = response.json()

            if data["status"] != 200:
                continue

            result = data["result"]

            # =========================
            # CREATE POSTCODE GROUP
            # =========================

            if postcode not in grouped_locations:

                grouped_locations[postcode] = {

                    "name": postcode,

                    "postcode": postcode,

                    "lat": result["latitude"],

                    "lng": result["longitude"],

                    "route": route,

                    "parcels": 0,

                    "jdwNumbers": [],

                    "color": ROUTE_COLORS.get(
                        route,
                        "gray"
                    )
                }

            # =========================
            # ADD PARCEL
            # =========================

            grouped_locations[postcode][
                "parcels"
            ] += 1

            # =========================
            # ADD JDW NUMBER
            # =========================

            if jdw_number:

                grouped_locations[postcode][
                    "jdwNumbers"
                ].append(jdw_number)

        except Exception as e:

            print(e)

    return list(
        grouped_locations.values()
)