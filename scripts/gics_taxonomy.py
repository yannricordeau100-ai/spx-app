#!/usr/bin/env python3
"""
Taxonomie GICS 2024 (Global Industry Classification Standard)
S&P Dow Jones Indices / MSCI · méthodologie août 2024.

Hiérarchie :
  11 secteurs (2 chiffres)
  → 25 industry groups (4 chiffres)
  → 74 industries (6 chiffres)
  → 163 sub-industries (8 chiffres)

Source : S&P Global / MSCI GICS Methodology (août 2024).
"""

GICS = {
    "10": {
        "name": "Energy",
        "name_fr": "Énergie",
        "groups": {
            "1010": {
                "name": "Energy",
                "industries": {
                    "101010": {
                        "name": "Energy Equipment & Services",
                        "sub": {
                            "10101010": "Oil & Gas Drilling",
                            "10101020": "Oil & Gas Equipment & Services",
                        },
                    },
                    "101020": {
                        "name": "Oil, Gas & Consumable Fuels",
                        "sub": {
                            "10102010": "Integrated Oil & Gas",
                            "10102020": "Oil & Gas Exploration & Production",
                            "10102030": "Oil & Gas Refining & Marketing",
                            "10102040": "Oil & Gas Storage & Transportation",
                            "10102050": "Coal & Consumable Fuels",
                        },
                    },
                },
            },
        },
    },
    "15": {
        "name": "Materials",
        "name_fr": "Matériaux",
        "groups": {
            "1510": {
                "name": "Materials",
                "industries": {
                    "151010": {
                        "name": "Chemicals",
                        "sub": {
                            "15101010": "Commodity Chemicals",
                            "15101020": "Diversified Chemicals",
                            "15101030": "Fertilizers & Agricultural Chemicals",
                            "15101040": "Industrial Gases",
                            "15101050": "Specialty Chemicals",
                        },
                    },
                    "151020": {
                        "name": "Construction Materials",
                        "sub": {"15102010": "Construction Materials"},
                    },
                    "151030": {
                        "name": "Containers & Packaging",
                        "sub": {
                            "15103010": "Metal, Glass & Plastic Containers",
                            "15103020": "Paper & Plastic Packaging Products & Materials",
                        },
                    },
                    "151040": {
                        "name": "Metals & Mining",
                        "sub": {
                            "15104010": "Aluminum",
                            "15104020": "Diversified Metals & Mining",
                            "15104025": "Copper",
                            "15104030": "Gold",
                            "15104040": "Precious Metals & Minerals",
                            "15104045": "Silver",
                            "15104050": "Steel",
                        },
                    },
                    "151050": {
                        "name": "Paper & Forest Products",
                        "sub": {
                            "15105010": "Forest Products",
                            "15105020": "Paper Products",
                        },
                    },
                },
            },
        },
    },
    "20": {
        "name": "Industrials",
        "name_fr": "Industrie",
        "groups": {
            "2010": {
                "name": "Capital Goods",
                "industries": {
                    "201010": {"name": "Aerospace & Defense",
                               "sub": {"20101010": "Aerospace & Defense"}},
                    "201020": {"name": "Building Products",
                               "sub": {"20102010": "Building Products"}},
                    "201030": {"name": "Construction & Engineering",
                               "sub": {"20103010": "Construction & Engineering"}},
                    "201040": {
                        "name": "Electrical Equipment",
                        "sub": {
                            "20104010": "Electrical Components & Equipment",
                            "20104020": "Heavy Electrical Equipment",
                        },
                    },
                    "201050": {"name": "Industrial Conglomerates",
                               "sub": {"20105010": "Industrial Conglomerates"}},
                    "201060": {
                        "name": "Machinery",
                        "sub": {
                            "20106010": "Construction Machinery & Heavy Transportation Equipment",
                            "20106015": "Agricultural & Farm Machinery",
                            "20106020": "Industrial Machinery & Supplies & Components",
                        },
                    },
                    "201070": {"name": "Trading Companies & Distributors",
                               "sub": {"20107010": "Trading Companies & Distributors"}},
                },
            },
            "2020": {
                "name": "Commercial & Professional Services",
                "industries": {
                    "202010": {
                        "name": "Commercial Services & Supplies",
                        "sub": {
                            "20201010": "Commercial Printing",
                            "20201050": "Environmental & Facilities Services",
                            "20201060": "Office Services & Supplies",
                            "20201070": "Diversified Support Services",
                            "20201080": "Security & Alarm Services",
                        },
                    },
                    "202020": {
                        "name": "Professional Services",
                        "sub": {
                            "20202010": "Human Resource & Employment Services",
                            "20202020": "Research & Consulting Services",
                            "20202030": "Data Processing & Outsourced Services",
                        },
                    },
                },
            },
            "2030": {
                "name": "Transportation",
                "industries": {
                    "203010": {"name": "Air Freight & Logistics",
                               "sub": {"20301010": "Air Freight & Logistics"}},
                    "203020": {"name": "Passenger Airlines",
                               "sub": {"20302010": "Passenger Airlines"}},
                    "203030": {"name": "Marine Transportation",
                               "sub": {"20303010": "Marine Transportation"}},
                    "203040": {
                        "name": "Ground Transportation",
                        "sub": {
                            "20304010": "Rail Transportation",
                            "20304030": "Cargo Ground Transportation",
                            "20304040": "Passenger Ground Transportation",
                        },
                    },
                    "203050": {
                        "name": "Transportation Infrastructure",
                        "sub": {
                            "20305010": "Airport Services",
                            "20305020": "Highways & Railtracks",
                            "20305030": "Marine Ports & Services",
                        },
                    },
                },
            },
        },
    },
    "25": {
        "name": "Consumer Discretionary",
        "name_fr": "Consommation discrétionnaire",
        "groups": {
            "2510": {
                "name": "Automobiles & Components",
                "industries": {
                    "251010": {
                        "name": "Automobile Components",
                        "sub": {
                            "25101010": "Automotive Parts & Equipment",
                            "25101020": "Tires & Rubber",
                        },
                    },
                    "251020": {
                        "name": "Automobiles",
                        "sub": {
                            "25102010": "Automobile Manufacturers",
                            "25102020": "Motorcycle Manufacturers",
                        },
                    },
                },
            },
            "2520": {
                "name": "Consumer Durables & Apparel",
                "industries": {
                    "252010": {
                        "name": "Household Durables",
                        "sub": {
                            "25201010": "Consumer Electronics",
                            "25201020": "Home Furnishings",
                            "25201030": "Homebuilding",
                            "25201040": "Household Appliances",
                            "25201050": "Housewares & Specialties",
                        },
                    },
                    "252020": {"name": "Leisure Products",
                               "sub": {"25202010": "Leisure Products"}},
                    "252030": {
                        "name": "Textiles, Apparel & Luxury Goods",
                        "sub": {
                            "25203010": "Apparel, Accessories & Luxury Goods",
                            "25203020": "Footwear",
                            "25203030": "Textiles",
                        },
                    },
                },
            },
            "2530": {
                "name": "Consumer Services",
                "industries": {
                    "253010": {
                        "name": "Hotels, Restaurants & Leisure",
                        "sub": {
                            "25301010": "Casinos & Gaming",
                            "25301020": "Hotels, Resorts & Cruise Lines",
                            "25301030": "Leisure Facilities",
                            "25301040": "Restaurants",
                        },
                    },
                    "253020": {
                        "name": "Diversified Consumer Services",
                        "sub": {
                            "25302010": "Education Services",
                            "25302020": "Specialized Consumer Services",
                        },
                    },
                },
            },
            "2550": {
                "name": "Consumer Discretionary Distribution & Retail",
                "industries": {
                    "255010": {"name": "Distributors",
                               "sub": {"25501010": "Distributors"}},
                    "255020": {"name": "Broadline Retail",
                               "sub": {"25502020": "Broadline Retail"}},
                    "255030": {
                        "name": "Specialty Retail",
                        "sub": {
                            "25503030": "Apparel Retail",
                            "25503040": "Computer & Electronics Retail",
                            "25503050": "Home Improvement Retail",
                            "25503060": "Other Specialty Retail",
                            "25504010": "Automotive Retail",
                            "25504020": "Homefurnishing Retail",
                        },
                    },
                },
            },
        },
    },
    "30": {
        "name": "Consumer Staples",
        "name_fr": "Consommation de base",
        "groups": {
            "3010": {
                "name": "Consumer Staples Distribution & Retail",
                "industries": {
                    "301010": {
                        "name": "Consumer Staples Distribution & Retail",
                        "sub": {
                            "30101010": "Drug Retail",
                            "30101020": "Food Distributors",
                            "30101030": "Food Retail",
                            "30101040": "Consumer Staples Merchandise Retail",
                        },
                    },
                },
            },
            "3020": {
                "name": "Food, Beverage & Tobacco",
                "industries": {
                    "302010": {
                        "name": "Beverages",
                        "sub": {
                            "30201010": "Brewers",
                            "30201020": "Distillers & Vintners",
                            "30201030": "Soft Drinks & Non-alcoholic Beverages",
                        },
                    },
                    "302020": {
                        "name": "Food Products",
                        "sub": {
                            "30202010": "Agricultural Products & Services",
                            "30202030": "Packaged Foods & Meats",
                        },
                    },
                    "302030": {"name": "Tobacco",
                               "sub": {"30203010": "Tobacco"}},
                },
            },
            "3030": {
                "name": "Household & Personal Products",
                "industries": {
                    "303010": {"name": "Household Products",
                               "sub": {"30301010": "Household Products"}},
                    "303020": {"name": "Personal Care Products",
                               "sub": {"30302010": "Personal Care Products"}},
                },
            },
        },
    },
    "35": {
        "name": "Health Care",
        "name_fr": "Santé",
        "groups": {
            "3510": {
                "name": "Health Care Equipment & Services",
                "industries": {
                    "351010": {
                        "name": "Health Care Equipment & Supplies",
                        "sub": {
                            "35101010": "Health Care Equipment",
                            "35101020": "Health Care Supplies",
                        },
                    },
                    "351020": {
                        "name": "Health Care Providers & Services",
                        "sub": {
                            "35102010": "Health Care Distributors",
                            "35102015": "Health Care Services",
                            "35102020": "Health Care Facilities",
                            "35102030": "Managed Health Care",
                        },
                    },
                    "351030": {"name": "Health Care Technology",
                               "sub": {"35103010": "Health Care Technology"}},
                },
            },
            "3520": {
                "name": "Pharmaceuticals, Biotechnology & Life Sciences",
                "industries": {
                    "352010": {"name": "Biotechnology",
                               "sub": {"35201010": "Biotechnology"}},
                    "352020": {"name": "Pharmaceuticals",
                               "sub": {"35202010": "Pharmaceuticals"}},
                    "352030": {"name": "Life Sciences Tools & Services",
                               "sub": {"35203010": "Life Sciences Tools & Services"}},
                },
            },
        },
    },
    "40": {
        "name": "Financials",
        "name_fr": "Finance",
        "groups": {
            "4010": {
                "name": "Banks",
                "industries": {
                    "401010": {
                        "name": "Banks",
                        "sub": {
                            "40101010": "Diversified Banks",
                            "40101015": "Regional Banks",
                        },
                    },
                },
            },
            "4020": {
                "name": "Financial Services",
                "industries": {
                    "402010": {
                        "name": "Financial Services",
                        "sub": {
                            "40201020": "Diversified Financial Services",
                            "40201030": "Multi-Sector Holdings",
                            "40201040": "Specialized Finance",
                            "40201050": "Commercial & Residential Mortgage Finance",
                            "40201060": "Transaction & Payment Processing Services",
                        },
                    },
                    "402020": {"name": "Consumer Finance",
                               "sub": {"40202010": "Consumer Finance"}},
                    "402030": {
                        "name": "Capital Markets",
                        "sub": {
                            "40203010": "Asset Management & Custody Banks",
                            "40203020": "Investment Banking & Brokerage",
                            "40203030": "Diversified Capital Markets",
                            "40203040": "Financial Exchanges & Data",
                        },
                    },
                    "402040": {"name": "Mortgage Real Estate Investment Trusts (REITs)",
                               "sub": {"40204010": "Mortgage REITs"}},
                },
            },
            "4030": {
                "name": "Insurance",
                "industries": {
                    "403010": {
                        "name": "Insurance",
                        "sub": {
                            "40301010": "Insurance Brokers",
                            "40301020": "Life & Health Insurance",
                            "40301030": "Multi-line Insurance",
                            "40301040": "Property & Casualty Insurance",
                            "40301050": "Reinsurance",
                        },
                    },
                },
            },
        },
    },
    "45": {
        "name": "Information Technology",
        "name_fr": "Technologies de l'information",
        "groups": {
            "4510": {
                "name": "Software & Services",
                "industries": {
                    "451020": {
                        "name": "IT Services",
                        "sub": {
                            "45102010": "IT Consulting & Other Services",
                            "45102030": "Internet Services & Infrastructure",
                        },
                    },
                    "451030": {
                        "name": "Software",
                        "sub": {
                            "45103010": "Application Software",
                            "45103020": "Systems Software",
                        },
                    },
                },
            },
            "4520": {
                "name": "Technology Hardware & Equipment",
                "industries": {
                    "452010": {"name": "Communications Equipment",
                               "sub": {"45201020": "Communications Equipment"}},
                    "452020": {"name": "Technology Hardware, Storage & Peripherals",
                               "sub": {"45202030": "Technology Hardware, Storage & Peripherals"}},
                    "452030": {
                        "name": "Electronic Equipment, Instruments & Components",
                        "sub": {
                            "45203010": "Electronic Equipment & Instruments",
                            "45203015": "Electronic Components",
                            "45203020": "Electronic Manufacturing Services",
                            "45203030": "Technology Distributors",
                        },
                    },
                },
            },
            "4530": {
                "name": "Semiconductors & Semiconductor Equipment",
                "industries": {
                    "453010": {
                        "name": "Semiconductors & Semiconductor Equipment",
                        "sub": {
                            "45301010": "Semiconductor Materials & Equipment",
                            "45301020": "Semiconductors",
                        },
                    },
                },
            },
        },
    },
    "50": {
        "name": "Communication Services",
        "name_fr": "Services de communication",
        "groups": {
            "5010": {
                "name": "Telecommunication Services",
                "industries": {
                    "501010": {
                        "name": "Diversified Telecommunication Services",
                        "sub": {
                            "50101010": "Alternative Carriers",
                            "50101020": "Integrated Telecommunication Services",
                        },
                    },
                    "501020": {"name": "Wireless Telecommunication Services",
                               "sub": {"50102010": "Wireless Telecommunication Services"}},
                },
            },
            "5020": {
                "name": "Media & Entertainment",
                "industries": {
                    "502010": {
                        "name": "Media",
                        "sub": {
                            "50201010": "Advertising",
                            "50201020": "Broadcasting",
                            "50201030": "Cable & Satellite",
                            "50201040": "Publishing",
                        },
                    },
                    "502020": {
                        "name": "Entertainment",
                        "sub": {
                            "50202010": "Movies & Entertainment",
                            "50202020": "Interactive Home Entertainment",
                        },
                    },
                    "502030": {"name": "Interactive Media & Services",
                               "sub": {"50203010": "Interactive Media & Services"}},
                },
            },
        },
    },
    "55": {
        "name": "Utilities",
        "name_fr": "Services aux collectivités",
        "groups": {
            "5510": {
                "name": "Utilities",
                "industries": {
                    "551010": {"name": "Electric Utilities",
                               "sub": {"55101010": "Electric Utilities"}},
                    "551020": {"name": "Gas Utilities",
                               "sub": {"55102010": "Gas Utilities"}},
                    "551030": {"name": "Multi-Utilities",
                               "sub": {"55103010": "Multi-Utilities"}},
                    "551040": {"name": "Water Utilities",
                               "sub": {"55104010": "Water Utilities"}},
                    "551050": {
                        "name": "Independent Power and Renewable Electricity Producers",
                        "sub": {
                            "55105010": "Independent Power Producers & Energy Traders",
                            "55105020": "Renewable Electricity",
                        },
                    },
                },
            },
        },
    },
    "60": {
        "name": "Real Estate",
        "name_fr": "Immobilier",
        "groups": {
            "6010": {
                "name": "Equity Real Estate Investment Trusts (REITs)",
                "industries": {
                    "601010": {"name": "Diversified REITs",
                               "sub": {"60101010": "Diversified REITs"}},
                    "601025": {"name": "Industrial REITs",
                               "sub": {"60102510": "Industrial REITs"}},
                    "601030": {"name": "Hotel & Resort REITs",
                               "sub": {"60103010": "Hotel & Resort REITs"}},
                    "601040": {"name": "Office REITs",
                               "sub": {"60104010": "Office REITs"}},
                    "601050": {"name": "Health Care REITs",
                               "sub": {"60105010": "Health Care REITs"}},
                    "601060": {
                        "name": "Residential REITs",
                        "sub": {
                            "60106010": "Multi-Family Residential REITs",
                            "60106020": "Single-Family Residential REITs",
                        },
                    },
                    "601070": {"name": "Retail REITs",
                               "sub": {"60107010": "Retail REITs"}},
                    "601080": {
                        "name": "Specialized REITs",
                        "sub": {
                            "60108010": "Self-Storage REITs",
                            "60108020": "Telecom Tower REITs",
                            "60108030": "Timber REITs",
                            "60108040": "Data Center REITs",
                            "60108050": "Other Specialized REITs",
                        },
                    },
                },
            },
            "6020": {
                "name": "Real Estate Management & Development",
                "industries": {
                    "602010": {
                        "name": "Real Estate Management & Development",
                        "sub": {
                            "60201010": "Diversified Real Estate Activities",
                            "60201020": "Real Estate Operating Companies",
                            "60201030": "Real Estate Development",
                            "60201040": "Real Estate Services",
                        },
                    },
                },
            },
        },
    },
}


def all_sub_industries() -> list[tuple[str, str, str, str, str, str, str, str]]:
    """Yield (sec_code, sec_name, ig_code, ig_name, ind_code, ind_name, sub_code, sub_name)."""
    out = []
    for sec_code, sec in GICS.items():
        for ig_code, ig in sec["groups"].items():
            for ind_code, ind in ig["industries"].items():
                for sub_code, sub_name in ind["sub"].items():
                    out.append((sec_code, sec["name"], ig_code, ig["name"],
                                ind_code, ind["name"], sub_code, sub_name))
    return out


def counts():
    n_sec = len(GICS)
    n_ig = sum(len(sec["groups"]) for sec in GICS.values())
    n_ind = sum(len(ig["industries"]) for sec in GICS.values() for ig in sec["groups"].values())
    n_sub = sum(len(ind["sub"]) for sec in GICS.values()
                for ig in sec["groups"].values() for ind in ig["industries"].values())
    return n_sec, n_ig, n_ind, n_sub


if __name__ == "__main__":
    n_sec, n_ig, n_ind, n_sub = counts()
    print(f"Sectors          : {n_sec}  (target 11)")
    print(f"Industry groups  : {n_ig}  (target 25)")
    print(f"Industries       : {n_ind} (target 74)")
    print(f"Sub-industries   : {n_sub} (target 163)")
