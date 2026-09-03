import sys
import json
import os
from datetime import datetime, timedelta

import copernicusmarine


# ============================================================
# READ INPUT
# ============================================================

input_data = json.loads(sys.stdin.read())

latitude = float(input_data["latitude"])
longitude = float(input_data["longitude"])
date = input_data["date"]


# ============================================================
# CONFIGURATION
# ============================================================

SURFACE_DEPTH = 0.4940253794193268

USERNAME = os.environ.get(
    "COPERNICUSMARINE_SERVICE_USERNAME"
)

PASSWORD = os.environ.get(
    "COPERNICUSMARINE_SERVICE_PASSWORD"
)


# ============================================================
# DATASET IDS
# ============================================================

# ------------------------------------------------------------
# GLOBAL BIOGEOCHEMISTRY FORECAST
# ------------------------------------------------------------
#
# These datasets belong to the Copernicus Global Ocean
# Biogeochemistry Analysis and Forecast product.
#
# They provide forecast ecosystem variables.
#
# ------------------------------------------------------------

PFT_DATASET = \
    "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m"

BIO_DATASET = \
    "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m"

NUTRIENTS_DATASET = \
    "cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m"

CARBON_DATASET = \
    "cmems_mod_glo_bgc-car_anfc_0.25deg_P1D-m"

CO2_DATASET = \
    "cmems_mod_glo_bgc-co2_anfc_0.25deg_P1D-m"

OPTICS_DATASET = \
    "cmems_mod_glo_bgc-optics_anfc_0.25deg_P1D-m"

PLANKTON_DATASET = \
    "cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m"


# ============================================================
# OCEAN COLOUR OBSERVATION DATASET
# ============================================================
#
# IMPORTANT:
#
# This dataset is observational / near-real-time.
# It is NOT a future forecast dataset.
#
# Therefore:
#
#   SPM
#   ZSD
#   KD490
#
# should only be used when observations are available.
#
# ------------------------------------------------------------

OCEAN_COLOUR_DATASET = \
    "cmems_obs-oc_glo_bgc-transp_nrt_l3-multi-4km_P1D"


# ============================================================
# DATE VALIDATION
# ============================================================

def validate_date(date_string):

    try:

        datetime.strptime(
            date_string,
            "%Y-%m-%d"
        )

        return True

    except ValueError:

        return False


if not validate_date(date):

    print(
        json.dumps(
            {
                "error":
                    "Invalid date. Use YYYY-MM-DD."
            }
        )
    )

    sys.exit(1)


# ============================================================
# COMMON PARAMETERS
# ============================================================

COMMON_PARAMS = {

    "minimum_longitude":
        longitude - 0.25,

    "maximum_longitude":
        longitude + 0.25,

    "minimum_latitude":
        latitude - 0.25,

    "maximum_latitude":
        latitude + 0.25,

    "minimum_depth":
        SURFACE_DEPTH,

    "maximum_depth":
        SURFACE_DEPTH,

    "start_datetime":
        date,

    "end_datetime":
        date
}


# ============================================================
# FETCH DATASET
# ============================================================

def fetch_dataset(dataset_id, variables):

    try:

        result = copernicusmarine.read_dataframe(

            dataset_id=dataset_id,

            variables=variables,

            **COMMON_PARAMS

        )

        if result is None:

            return {}

        if result.empty:

            return {}

        return result

    except Exception as e:

        print(
            f"Dataset error [{dataset_id}]: {e}",
            file=sys.stderr
        )

        return {}


# ============================================================
# GET FIRST VALID VALUE
# ============================================================

def get_value(data, variable):

    try:

        if data is None:

            return None

        if not hasattr(data, "columns"):

            return None

        if variable not in data.columns:

            return None

        values = data[variable].dropna()

        if values.empty:

            return None

        return float(values.iloc[0])

    except Exception:

        return None


# ============================================================
# CHL + PHYTOPLANKTON
# ============================================================

def get_pft():

    data = fetch_dataset(

        PFT_DATASET,

        [
            "chl",
            "phyc"
        ]

    )

    return {

        "chlorophyll_mg_m3":
            get_value(data, "chl"),

        "phytoplankton_mmol_m3":
            get_value(data, "phyc")

    }


# ============================================================
# O2 + PRIMARY PRODUCTION
# ============================================================

def get_bio():

    data = fetch_dataset(

        BIO_DATASET,

        [
            "o2",
            "nppv"
        ]

    )

    oxygen = get_value(
        data,
        "o2"
    )

    if oxygen is not None:

        oxygen = oxygen * 32 / 1000

    return {

        "dissolved_oxygen_mg_l":
            oxygen,

        "primary_production_mg_c_m3_day":
            get_value(
                data,
                "nppv"
            )

    }


# ============================================================
# NUTRIENTS
# ============================================================

def get_nutrients():

    data = fetch_dataset(

        NUTRIENTS_DATASET,

        [
            "no3",
            "po4",
            "si",
            "fe"
        ]

    )

    return {

        "nitrate_mmol_m3":
            get_value(
                data,
                "no3"
            ),

        "phosphate_mmol_m3":
            get_value(
                data,
                "po4"
            ),

        "silicate_mmol_m3":
            get_value(
                data,
                "si"
            ),

        "dissolved_iron_mmol_m3":
            get_value(
                data,
                "fe"
            )

    }


# ============================================================
# CARBON + PH
# ============================================================

def get_carbon():

    data = fetch_dataset(

        CARBON_DATASET,

        [
            "ph",
            "dissic",
            "talk"
        ]

    )

    return {

        "ph":
            get_value(
                data,
                "ph"
            ),

        "dissolved_inorganic_carbon_mmol_m3":
            get_value(
                data,
                "dissic"
            ),

        "total_alkalinity_mmol_m3":
            get_value(
                data,
                "talk"
            )

    }


# ============================================================
# CO2
# ============================================================

def get_co2():

    data = fetch_dataset(

        CO2_DATASET,

        [
            "spco2"
        ]

    )

    return {

        "surface_co2_pa":
            get_value(
                data,
                "spco2"
            )

    }


# ============================================================
# OPTICS
# ============================================================

def get_optics():

    data = fetch_dataset(

        OPTICS_DATASET,

        [
            "kd"
        ]

    )

    return {

        "optical_attenuation_m_inv":
            get_value(
                data,
                "kd"
            )

    }


# ============================================================
# ZOOPLANKTON
# ============================================================

def get_plankton():

    data = fetch_dataset(

        PLANKTON_DATASET,

        [
            "zooc"
        ]

    )

    return {

        "zooplankton_mmol_m3":
            get_value(
                data,
                "zooc"
            )

    }


# ============================================================
# OCEAN COLOUR
# ============================================================

def get_ocean_colour():

    # --------------------------------------------------------
    # Ocean Colour is observational.
    #
    # It should NOT be treated as a future forecast.
    #
    # --------------------------------------------------------

    today = datetime.utcnow().date()

    requested_date = datetime.strptime(
        date,
        "%Y-%m-%d"
    ).date()

    # --------------------------------------------------------
    # FUTURE DATE
    # --------------------------------------------------------

    if requested_date > today:

        return {

            "suspended_matter_mg_l": None,

            "secchi_depth_m": None,

            "kd490_m_inv": None,

            "ocean_colour_status":
                "forecast_unavailable"

        }


    # --------------------------------------------------------
    # OBSERVATION DATE
    # --------------------------------------------------------

    data = fetch_dataset(

        OCEAN_COLOUR_DATASET,

        [
            "SPM",
            "ZSD",
            "KD490"
        ]

    )

    spm = get_value(
        data,
        "SPM"
    )

    zsd = get_value(
        data,
        "ZSD"
    )

    kd490 = get_value(
        data,
        "KD490"
    )

    # --------------------------------------------------------
    # STATUS
    # --------------------------------------------------------

    if (
        spm is None and
        zsd is None and
        kd490 is None
    ):

        status = "no_observation"

    else:

        status = "observation_available"


    return {

        "suspended_matter_mg_l":
            spm,

        "secchi_depth_m":
            zsd,

        "kd490_m_inv":
            kd490,

        "ocean_colour_status":
            status

    }


# ============================================================
# MAIN
# ============================================================

try:

    ecosystem = {}


    # --------------------------------------------------------
    # PFT
    # --------------------------------------------------------

    ecosystem.update(
        get_pft()
    )


    # --------------------------------------------------------
    # BIO
    # --------------------------------------------------------

    ecosystem.update(
        get_bio()
    )


    # --------------------------------------------------------
    # NUTRIENTS
    # --------------------------------------------------------

    ecosystem.update(
        get_nutrients()
    )


    # --------------------------------------------------------
    # CARBON
    # --------------------------------------------------------

    ecosystem.update(
        get_carbon()
    )


    # --------------------------------------------------------
    # CO2
    # --------------------------------------------------------

    ecosystem.update(
        get_co2()
    )


    # --------------------------------------------------------
    # OPTICS
    # --------------------------------------------------------

    ecosystem.update(
        get_optics()
    )


    # --------------------------------------------------------
    # ZOOPLANKTON
    # --------------------------------------------------------

    ecosystem.update(
        get_plankton()
    )


    # --------------------------------------------------------
    # OCEAN COLOUR
    # --------------------------------------------------------

    ecosystem.update(
        get_ocean_colour()
    )


    # --------------------------------------------------------
    # FORECAST INFORMATION
    # --------------------------------------------------------

    today = datetime.utcnow().date()

    requested_date = datetime.strptime(
        date,
        "%Y-%m-%d"
    ).date()

    days_from_today = (
        requested_date - today
    ).days


    if days_from_today > 0:

        forecast_status = "future_forecast"

    elif days_from_today == 0:

        forecast_status = "current"

    else:

        forecast_status = "historical"


    # --------------------------------------------------------
    # RETURN
    # --------------------------------------------------------

    print(
        json.dumps(
            {

                "ecosystem":
                    ecosystem,

                "data_info": {

                    "requested_date":
                        date,

                    "forecast_status":
                        forecast_status,

                    "days_from_today":
                        days_from_today,

                    "source":
                        "Copernicus Marine Global Ocean Biogeochemistry Analysis and Forecast"

                }

            }
        )
    )


except Exception as e:

    print(
        json.dumps(
            {
                "error":
                    str(e)
            }
        )
    )

    sys.exit(1)




# #########################################################


# import sys
# import json
# import os
# import copernicusmarine


# # ============================================================
# # READ INPUT
# # ============================================================

# input_data = json.loads(sys.stdin.read())

# latitude = float(input_data["latitude"])
# longitude = float(input_data["longitude"])
# date = input_data["date"]


# # ============================================================
# # CONFIGURATION
# # ============================================================

# SURFACE_DEPTH = 0.4940253794193268

# USERNAME = os.environ.get(
#     "COPERNICUSMARINE_SERVICE_USERNAME"
# )

# PASSWORD = os.environ.get(
#     "COPERNICUSMARINE_SERVICE_PASSWORD"
# )


# # ============================================================
# # DATASET IDS
# # ============================================================

# PFT_DATASET = \
#     "cmems_mod_glo_bgc-pft_anfc_0.25deg_P1D-m"

# BIO_DATASET = \
#     "cmems_mod_glo_bgc-bio_anfc_0.25deg_P1D-m"

# NUTRIENTS_DATASET = \
#     "cmems_mod_glo_bgc-nut_anfc_0.25deg_P1D-m"

# CARBON_DATASET = \
#     "cmems_mod_glo_bgc-car_anfc_0.25deg_P1D-m"

# CO2_DATASET = \
#     "cmems_mod_glo_bgc-co2_anfc_0.25deg_P1D-m"

# OPTICS_DATASET = \
#     "cmems_mod_glo_bgc-optics_anfc_0.25deg_P1D-m"

# PLANKTON_DATASET = \
#     "cmems_mod_glo_bgc-plankton_anfc_0.25deg_P1D-m"


# # ============================================================
# # OCEAN COLOUR DATASET
# # ============================================================
# #
# # This is the transparency dataset containing:
# # - SPM
# # - ZSD
# # - KD490
# #
# # ============================================================

# OCEAN_COLOUR_DATASET = \
#     "cmems_obs-oc_glo_bgc-transp_nrt_l3-multi-4km_P1D"


# # ============================================================
# # COMMON PARAMETERS
# # ============================================================

# COMMON_PARAMS = {

#     "minimum_longitude":
#         longitude - 0.25,

#     "maximum_longitude":
#         longitude + 0.25,

#     "minimum_latitude":
#         latitude - 0.25,

#     "maximum_latitude":
#         latitude + 0.25,

#     "minimum_depth":
#         SURFACE_DEPTH,

#     "maximum_depth":
#         SURFACE_DEPTH,

#     "start_datetime":
#         date,

#     "end_datetime":
#         date
# }


# # ============================================================
# # FETCH DATASET
# # ============================================================

# def fetch_dataset(dataset_id, variables):

#     try:

#         result = copernicusmarine.read_dataframe(

#             dataset_id=dataset_id,

#             variables=variables,

#             **COMMON_PARAMS

#         )

#         if result is None:

#             return {}

#         if result.empty:

#             return {}

#         return result

#     except Exception as e:

#         print(
#             f"Dataset error [{dataset_id}]: {e}",
#             file=sys.stderr
#         )

#         return {}


# # ============================================================
# # GET FIRST VALID VALUE
# # ============================================================

# def get_value(data, variable):

#     try:

#         if data is None:

#             return None

#         if not hasattr(data, "columns"):

#             return None

#         if variable not in data.columns:

#             return None

#         values = data[variable].dropna()

#         if values.empty:

#             return None

#         return float(values.iloc[0])

#     except Exception:

#         return None


# # ============================================================
# # CHL + PHYTOPLANKTON
# # ============================================================

# def get_pft():

#     data = fetch_dataset(

#         PFT_DATASET,

#         [
#             "chl",
#             "phyc"
#         ]

#     )

#     return {

#         "chlorophyll_mg_m3":
#             get_value(data, "chl"),

#         "phytoplankton_mmol_m3":
#             get_value(data, "phyc")

#     }


# # ============================================================
# # O2 + PRIMARY PRODUCTION
# # ============================================================

# def get_bio():

#     data = fetch_dataset(

#         BIO_DATASET,

#         [
#             "o2",
#             "nppv"
#         ]

#     )

#     oxygen = get_value(data, "o2")

#     if oxygen is not None:

#         oxygen = oxygen * 32 / 1000

#     return {

#         "dissolved_oxygen_mg_l":
#             oxygen,

#         "primary_production_mg_c_m3_day":
#             get_value(data, "nppv")

#     }


# # ============================================================
# # NUTRIENTS
# # ============================================================

# def get_nutrients():

#     data = fetch_dataset(

#         NUTRIENTS_DATASET,

#         [
#             "no3",
#             "po4",
#             "si",
#             "fe"
#         ]

#     )

#     return {

#         "nitrate_mmol_m3":
#             get_value(data, "no3"),

#         "phosphate_mmol_m3":
#             get_value(data, "po4"),

#         "silicate_mmol_m3":
#             get_value(data, "si"),

#         "dissolved_iron_mmol_m3":
#             get_value(data, "fe")

#     }


# # ============================================================
# # CARBON + PH
# # ============================================================

# def get_carbon():

#     data = fetch_dataset(

#         CARBON_DATASET,

#         [
#             "ph",
#             "dissic",
#             "talk"
#         ]

#     )

#     return {

#         "ph":
#             get_value(data, "ph"),

#         "dissolved_inorganic_carbon_mmol_m3":
#             get_value(data, "dissic"),

#         "total_alkalinity_mmol_m3":
#             get_value(data, "talk")

#     }


# # ============================================================
# # CO2
# # ============================================================

# def get_co2():

#     data = fetch_dataset(

#         CO2_DATASET,

#         [
#             "spco2"
#         ]

#     )

#     return {

#         "surface_co2_pa":
#             get_value(data, "spco2")

#     }


# # ============================================================
# # OPTICS
# # ============================================================

# def get_optics():

#     data = fetch_dataset(

#         OPTICS_DATASET,

#         [
#             "kd"
#         ]

#     )

#     return {

#         "optical_attenuation_m_inv":
#             get_value(data, "kd")

#     }


# # ============================================================
# # ZOOPLANKTON
# # ============================================================

# def get_plankton():

#     data = fetch_dataset(

#         PLANKTON_DATASET,

#         [
#             "zooc"
#         ]

#     )

#     return {

#         "zooplankton_mmol_m3":
#             get_value(data, "zooc")

#     }


# # ============================================================
# # OCEAN COLOUR
# # ============================================================

# def get_ocean_colour():

#     # --------------------------------------------------------
#     # ONE DATASET REQUEST
#     # --------------------------------------------------------
#     #
#     # Instead of making three separate Copernicus requests,
#     # request all three variables together.
#     #
#     # --------------------------------------------------------

#     data = fetch_dataset(

#         OCEAN_COLOUR_DATASET,

#         [
#             "SPM",
#             "ZSD",
#             "KD490"
#         ]

#     )

#     return {

#         "suspended_matter_mg_l":
#             get_value(data, "SPM"),

#         "secchi_depth_m":
#             get_value(data, "ZSD"),

#         "kd490_m_inv":
#             get_value(data, "KD490")

#     }


# # ============================================================
# # MAIN
# # ============================================================

# try:

#     ecosystem = {}


#     # --------------------------------------------------------
#     # PFT
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_pft()
#     )


#     # --------------------------------------------------------
#     # BIO
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_bio()
#     )


#     # --------------------------------------------------------
#     # NUTRIENTS
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_nutrients()
#     )


#     # --------------------------------------------------------
#     # CARBON
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_carbon()
#     )


#     # --------------------------------------------------------
#     # CO2
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_co2()
#     )


#     # --------------------------------------------------------
#     # OPTICS
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_optics()
#     )


#     # --------------------------------------------------------
#     # ZOOPLANKTON
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_plankton()
#     )


#     # --------------------------------------------------------
#     # OCEAN COLOUR
#     # --------------------------------------------------------

#     ecosystem.update(
#         get_ocean_colour()
#     )


#     # --------------------------------------------------------
#     # RETURN
#     # --------------------------------------------------------

#     print(
#         json.dumps(
#             {
#                 "ecosystem":
#                     ecosystem
#             }
#         )
#     )


# except Exception as e:

#     print(
#         json.dumps(
#             {
#                 "error":
#                     str(e)
#             }
#         )
#     )

#     sys.exit(1)