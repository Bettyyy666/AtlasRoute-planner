export const queryResponses: Record<string, any> = {
    // 1. Valid query for full county subdivisions
    "https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:*&in=state:36&in=county:*&key=YOUR_KEY_GOES_HERE": [
        ["Amherst town, Erie County, New York","126078","36","029","02000"],
        ["Cheektowaga town, Erie C2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3ounty, New York","85887","36","029","15011"],
        ["Tonawanda town, Erie County, New York","71676","36","029","75000"],
        ["Buffalo city, Erie County, New York","255300","36","029","11000"],
        ["Yonkers city, Westchester County, New York","200362","36","119","84000"],
        ["New Rochelle city, Westchester County, New York","78568","36","119","50617"],
        ["Albany city, Albany County, New York","96460","36","001","01000"],
        ["Colonie town, Albany County, New York","82797","36","001","17343"],
        ["Brooklyn borough, Kings County, New York","2559903","36","047","10022"],
        ["Manhattan borough, New York County, New York","1628706","36","061","44919"],
        ["Greenburgh town, Westchester County, New York","90991","36","119","30367"],
        ["Mount Vernon city, Westchester County, New York","67330","36","119","49121"],
        ["Oyster Bay town, Nassau County, New York","298397","36","059","56000"],
        ["Hempstead town, Nassau County, New York","766993","36","059","34000"],
        ["Syracuse city, Onondaga County, New York","142310","36","067","73000"],
        ["Clarkstown town, Rockland County, New York","86254","36","087","15968"],
        ["Ramapo town, Rockland County, New York","137392","36","087","60510"],
        ["Queens borough, Queens County, New York","2253858","36","081","60323"],
        ["Brookhaven town, Suffolk County, New York","480768","36","103","10000"],
        ["Islip town, Suffolk County, New York","329611","36","103","38000"],
        ["Huntington town, Suffolk County, New York","200495","36","103","37000"],
        ["Smithtown town, Suffolk County, New York","116034","36","103","68000"],
        ["Babylon town, Suffolk County, New York","210122","36","103","04000"],
        ["Schenectady city, Schenectady County, New York","65272","36","093","65508"],
        ["North Hempstead town, Nassau County, New York","230919","36","059","53000"],
        ["Staten Island borough, Richmond County, New York","476143","36","085","70915"],
        ["Bronx borough, Bronx County, New York","1418207","36","005","08510"],
        ["Rochester city, Monroe County, New York","205704","36","055","63000"],
        ["Greece town, Monroe County, New York","95494","36","055","30290"]
    ],

    // 1.1 Used personal API key for 1
    "https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:*&in=state:36&in=county:*&key=2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3": [
    [["NAME","B01001_001E","state","county","county subdivision"],
    ["Amherst town, Erie County, New York","126078","36","029","02000"],
    ["Cheektowaga town, Erie County, New York","85887","36","029","15011"],
    ["Tonawanda town, Erie County, New York","71676","36","029","75000"],
    ["Buffalo city, Erie County, New York","255300","36","029","11000"],
    ["Yonkers city, Westchester County, New York","200362","36","119","84000"],
    ["New Rochelle city, Westchester County, New York","78568","36","119","50617"],
    ["Albany city, Albany County, New York","96460","36","001","01000"],
    ["Colonie town, Albany County, New York","82797","36","001","17343"],
    ["Brooklyn borough, Kings County, New York","2559903","36","047","10022"],
    ["Manhattan borough, New York County, New York","1628706","36","061","44919"],
    ["Greenburgh town, Westchester County, New York","90991","36","119","30367"],
    ["Mount Vernon city, Westchester County, New York","67330","36","119","49121"],
    ["Oyster Bay town, Nassau County, New York","298397","36","059","56000"],
    ["Hempstead town, Nassau County, New York","766993","36","059","34000"],
    ["Syracuse city, Onondaga County, New York","142310","36","067","73000"],
    ["Clarkstown town, Rockland County, New York","86254","36","087","15968"],
    ["Ramapo town, Rockland County, New York","137392","36","087","60510"],
    ["Queens borough, Queens County, New York","2253858","36","081","60323"],
    ["Brookhaven town, Suffolk County, New York","480768","36","103","10000"],
    ["Islip town, Suffolk County, New York","329611","36","103","38000"],
    ["Huntington town, Suffolk County, New York","200495","36","103","37000"],
    ["Smithtown town, Suffolk County, New York","116034","36","103","68000"],
    ["Babylon town, Suffolk County, New York","210122","36","103","04000"],
    ["Schenectady city, Schenectady County, New York","65272","36","093","65508"],
    ["North Hempstead town, Nassau County, New York","230919","36","059","53000"],
    ["Staten Island borough, Richmond County, New York","476143","36","085","70915"],
    ["Bronx borough, Bronx County, New York","1418207","36","005","08510"],
    ["Rochester city, Monroe County, New York","205704","36","055","63000"],
    ["Greece town, Monroe County, New York","95494","36","055","30290"]]
    ],

    // 1.2 Changed state # from 36 -> 26
    "https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:*&in=state:26&in=county:*&key=2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3" : [
        [["NAME","B01001_001E","state","county","county subdivision"],
        ["Dearborn city, Wayne County, Michigan","93927","26","163","21000"],
        ["Detroit city, Wayne County, Michigan","670052","26","163","22000"],
        ["Kalamazoo city, Kalamazoo County, Michigan","76201","26","077","42160"],
        ["Westland city, Wayne County, Michigan","81524","26","163","86000"],
        ["Clinton charter township, Macomb County, Michigan","100479","26","099","16520"],
        ["Canton charter township, Wayne County, Michigan","93704","26","163","13120"],
        ["West Bloomfield charter township, Oakland County, Michigan","65588","26","125","85480"],
        ["Rochester Hills city, Oakland County, Michigan","74509","26","125","69035"],
        ["Waterford charter township, Oakland County, Michigan","72629","26","125","84240"],
        ["Farmington Hills city, Oakland County, Michigan","80597","26","125","27440"],
        ["Lansing city, Ingham County, Michigan","113315","26","065","46000"],
        ["Ann Arbor city, Washtenaw County, Michigan","119976","26","161","03000"],
        ["Troy city, Oakland County, Michigan","84087","26","125","80700"],
        ["Grand Rapids city, Kent County, Michigan","201004","26","081","34000"],
        ["Wyoming city, Kent County, Michigan","75660","26","081","88940"],
        ["Shelby charter township, Macomb County, Michigan","80625","26","099","72820"],
        ["Sterling Heights city, Macomb County, Michigan","132429","26","099","76460"],
        ["Warren city, Macomb County, Michigan","133944","26","099","84000"],
        ["Macomb township, Macomb County, Michigan","91579","26","099","50480"],
        ["Flint city, Genesee County, Michigan","95541","26","049","29000"],
        ["Livonia city, Wayne County, Michigan","93664","26","163","49000"],
        ["Southfield city, Oakland County, Michigan","72700","26","125","74900"]]
    ],

    // 2. Valid query for single subdivision (Amherst)
    "https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:02000&in=state:36%20county:029&key=YOUR_KEY_GOES_HERE": [
        ["NAME", "B01001_001E", "state", "county", "county subdivision"],
        ["Amherst town, Erie County, New York", "126078", "36", "029", "02000"]
    ],

    // 2.1 Used personal API key for 2
    "https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:02000&in=state:36%20county:029&key=2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3": [
        [["NAME","B01001_001E","state","county","county subdivision"],
        ["Amherst town, Erie County, New York","126078","36","029","02000"]]
    ],

    // 2.2 Changed county subdivision # from 02000 -> 01500
    "https://api.census.gov/data/2019/acs/acs1?get=NAME,B01001_001E&for=county%20subdivision:01500&in=state:36%20county:029&key=2ec9b4ea61f79f66eff9ebf7b9a8647995230ba3" : {
        error: "Blank screen"
    }
};
